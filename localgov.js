/**
 * localgov.js - Local Government ID Forms Store
 * ₦3,000 per form - Auto download after payment
 * Device-level purchase tracking (lost if device wiped)
 */

const APP_CONFIG = {
  PAYSTACK_PUBLIC_KEY: '',
  FIXED_PRICE: 3000, // ₦3,000 per form
  STORAGE_KEY: 'cybersweeft_lg_forms_v1',
  JSON_URL: 'lgforms.json',
  DEVICE_ID: generateDeviceId()
};

let allForms = [];
let currentForm = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  loadConfig();
  await loadForms();
  setupEventListeners();
  renderForms();
  applySavedTheme();
});

function loadConfig() {
  const inline = document.getElementById('app-config')?.textContent;
  if (inline) {
    const data = JSON.parse(inline);
    APP_CONFIG.PAYSTACK_PUBLIC_KEY = data.PAYSTACK_PUBLIC_KEY;
  }
}

async function loadForms() {
  try {
    const response = await fetch(`${APP_CONFIG.JSON_URL}?t=${Date.now()}`);
    const data = await response.json();
    
    allForms = data.forms.map(f => ({
      ...f,
      driveDownloadUrl: `https://drive.google.com/uc?export=download&id=${f.driveId}`,
      shortName: f.name.replace(' Local Government ID Form', '')
    }));
  } catch (error) {
    showNotification('Failed to load forms. Please refresh.', 'error');
    console.error(error);
  }
}

function setupEventListeners() {
  document.getElementById('searchInput')?.addEventListener('input', handleSearch);
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
}

// ==========================================
// DEVICE ID GENERATION (for purchase tracking)
// ==========================================
function generateDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'DVC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    localStorage.setItem('device_id', id);
  }
  return id;
}

// ==========================================
// RENDERING
// ==========================================
function renderForms() {
  const grid = document.getElementById('formsGrid');
  if (!grid) return;
  
  const purchased = getPurchasedForms();
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  
  let forms = allForms;
  if (searchTerm) {
    forms = forms.filter(f => 
      f.name.toLowerCase().includes(searchTerm) ||
      f.description.toLowerCase().includes(searchTerm)
    );
  }
  
  if (forms.length === 0) {
    grid.innerHTML = '<div class="no-results">No forms found. Try a different search.</div>';
    return;
  }
  
  grid.innerHTML = forms.map(form => {
    const isPurchased = purchased.includes(form.id);
    return `
      <div class="form-card">
        <div class="form-header">
          <span class="form-badge">LG ID</span>
          ${isPurchased ? '<span class="purchased-badge"><i class="fas fa-check"></i> Owned</span>' : ''}
        </div>
        <h3 class="form-title">${form.shortName}</h3>
        <p class="form-desc">${form.description}</p>
        <div class="form-footer">
          <span class="form-price">₦${APP_CONFIG.FIXED_PRICE.toLocaleString()}</span>
          ${isPurchased 
            ? `<button class="download-btn-sm" onclick="directDownload('${form.id}')">
                 <i class="fas fa-download"></i> Download
               </button>`
            : `<button class="buy-btn" onclick="initiatePurchase('${form.id}')">
                 <i class="fas fa-lock"></i> Buy Now
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// SEARCH
// ==========================================
function handleSearch(e) {
  renderForms();
}

// ==========================================
// PURCHASE FLOW
// ==========================================
function initiatePurchase(formId) {
  const form = allForms.find(f => f.id === formId);
  if (!form) return;
  
  if (getPurchasedForms().includes(formId)) {
    directDownload(formId);
    return;
  }
  
  currentForm = form;
  showPurchaseModal(form);
}

function showPurchaseModal(form) {
  const modal = document.getElementById('purchaseModal');
  document.getElementById('modalFormName').textContent = form.shortName;
  document.getElementById('buyerEmail').value = '';
  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('purchaseModal')?.classList.remove('show');
  currentForm = null;
}

function confirmPurchase() {
  const email = document.getElementById('buyerEmail')?.value.trim();
  
  if (!email || !email.includes('@')) {
    showModalError('Please enter a valid email address');
    return;
  }
  
  if (!currentForm) return;
  
  const btn = document.getElementById('confirmBuyBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  
  const handler = PaystackPop.setup({
    key: APP_CONFIG.PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: APP_CONFIG.FIXED_PRICE * 100, // kobo
    currency: 'NGN',
    ref: `LG_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    metadata: {
      custom_fields: [
        { display_name: "Form", variable_name: "form_name", value: currentForm.name },
        { display_name: "Form ID", variable_name: "form_id", value: currentForm.id },
        { display_name: "Device", variable_name: "device_id", value: APP_CONFIG.DEVICE_ID }
      ],
      form_id: currentForm.id
    },
    callback: (response) => onPaymentSuccess(response),
    onClose: () => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock"></i> Pay ₦3,000 & Download';
    }
  });
  
  handler.openIframe();
}

function onPaymentSuccess(response) {
  closeModal();
  recordPurchase(currentForm.id);
  showDownloadScreen(currentForm, response.reference);
  
  // Auto-download after 1 second
  setTimeout(() => {
    executeDownload(currentForm);
  }, 1000);
}

// ==========================================
// DOWNLOAD HANDLING
// ==========================================
function showDownloadScreen(form, reference) {
  document.getElementById('formsGrid').style.display = 'none';
  document.querySelector('.search-section').style.display = 'none';
  document.querySelector('.price-banner').style.display = 'none';
  
  const screen = document.getElementById('downloadScreen');
  document.getElementById('downloadFormName').textContent = form.name;
  document.getElementById('transactionRef').textContent = reference;
  screen.classList.add('show');
}

function executeDownload(form) {
  // Google Drive direct download
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = form.driveDownloadUrl;
  document.body.appendChild(iframe);
  
  // Backup anchor method
  const a = document.createElement('a');
  a.href = form.driveDownloadUrl;
  a.download = `${form.id.replace('-lg', '_LG_ID')}.pdf`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    document.body.removeChild(iframe);
  }, 5000);
  
  showNotification('Download started! Check your downloads folder.', 'success');
}

function directDownload(formId) {
  const form = allForms.find(f => f.id === formId);
  if (!form) return;
  
  if (!getPurchasedForms().includes(formId)) {
    initiatePurchase(formId);
    return;
  }
  
  executeDownload(form);
}

function retryDownload() {
  if (currentForm) {
    executeDownload(currentForm);
  }
}

function returnToStore() {
  document.getElementById('downloadScreen')?.classList.remove('show');
  document.getElementById('formsGrid').style.display = 'grid';
  document.querySelector('.search-section').style.display = 'block';
  document.querySelector('.price-banner').style.display = 'block';
  currentForm = null;
  renderForms();
}

// ==========================================
// PURCHASE TRACKING (Device-only)
// ==========================================
function getPurchasedForms() {
  try {
    const data = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    // Filter by current device only
    return parsed.filter(p => p.device === APP_CONFIG.DEVICE_ID).map(p => p.formId);
  } catch (e) {
    return [];
  }
}

function recordPurchase(formId) {
  const purchases = JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_KEY) || '[]');
  purchases.push({
    formId: formId,
    device: APP_CONFIG.DEVICE_ID,
    date: new Date().toISOString(),
    price: APP_CONFIG.FIXED_PRICE
  });
  localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(purchases));
}

// ==========================================
// UI HELPERS
// ==========================================
function showNotification(message, type = 'info') {
  const notif = document.getElementById('notification');
  if (!notif) return;
  notif.textContent = message;
  notif.className = `notification show ${type}`;
  setTimeout(() => notif.classList.remove('show'), 5000);
}

function showModalError(msg) {
  const err = document.getElementById('modalError');
  if (err) {
    err.textContent = msg;
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
  
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

function applySavedTheme() {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const btn = document.getElementById('themeBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
  }
}
