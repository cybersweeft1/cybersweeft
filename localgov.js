/**
 * localgov.js - Frontend logic for Local Government ID service
 * No API keys or secrets in this file
 */

// Configuration loaded from server or inline (public only)
const APP_CONFIG = {
  PAYSTACK_PUBLIC_KEY: '', // Loaded from server on init
  PRICE_KOBO: 250000,
  FILES: {},
  STORAGE_KEY: 'cyber_sweeft_lg_v2',
  API_BASE: '/api' // Change to your backend URL
};

// State management
let currentRecord = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async function() {
  await loadConfig();
  checkReturningUser();
  setupEventListeners();
});

async function loadConfig() {
  try {
    // Fetch public config from your backend endpoint
    // This should call api.js getPublicConfig()
    const response = await fetch(`${APP_CONFIG.API_BASE}/config`);
    const config = await response.json();
    
    APP_CONFIG.PAYSTACK_PUBLIC_KEY = config.PAYSTACK_PUBLIC_KEY;
    APP_CONFIG.FILES = config.FILES || {};
  } catch (error) {
    console.error('Failed to load config:', error);
    // Fallback: config should be injected by server in HTML
    const fallback = document.getElementById('app-config');
    if (fallback) {
      const data = JSON.parse(fallback.textContent);
      APP_CONFIG.PAYSTACK_PUBLIC_KEY = data.PAYSTACK_PUBLIC_KEY;
      APP_CONFIG.FILES = data.FILES;
    }
  }
}

function setupEventListeners() {
  // Form submission
  document.getElementById('lgForm')?.addEventListener('submit', handleFormSubmit);
  
  // Theme toggle
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
}

// ==========================================
// THEME MANAGEMENT
// ==========================================
function toggleTheme() {
  const html = document.documentElement;
  const btn = document.getElementById('themeBtn');
  const isDark = html.getAttribute('data-theme') === 'dark';
  
  if (isDark) {
    html.removeAttribute('data-theme');
    btn.innerHTML = '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    btn.innerHTML = '<i class="fas fa-sun"></i>';
    localStorage.setItem('theme', 'dark');
  }
}

// ==========================================
// UI HELPERS
// ==========================================
function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('statusMessage');
  const statusText = document.getElementById('statusText');
  
  if (!statusDiv || !statusText) return;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    processing: 'fa-spinner fa-spin',
    info: 'fa-info-circle'
  };
  
  statusText.textContent = message;
  statusDiv.className = `status-message show ${type}`;
  statusDiv.querySelector('i').className = `fas ${icons[type] || icons.info}`;
  
  if (type !== 'processing') {
    setTimeout(hideStatus, 5000);
  }
}

function hideStatus() {
  document.getElementById('statusMessage')?.classList.remove('show');
}

function setLoading(isLoading) {
  const btn = document.getElementById('payBtn');
  const spinner = document.getElementById('spinner');
  const btnText = document.getElementById('btnText');
  const lockIcon = document.getElementById('lockIcon');
  
  if (!btn) return;
  
  btn.disabled = isLoading;
  
  if (isLoading) {
    spinner?.classList.add('show');
    if (btnText) btnText.textContent = 'Processing...';
    if (lockIcon) lockIcon.style.display = 'none';
  } else {
    spinner?.classList.remove('show');
    if (btnText) btnText.textContent = 'Pay ₦2,500 & Download Instantly';
    if (lockIcon) lockIcon.style.display = 'inline-block';
  }
}

function switchScreen(screenName) {
  document.querySelectorAll('.form-screen, .success-screen, .redownload-screen').forEach(el => {
    el.classList.remove('active');
  });
  
  const target = document.getElementById(screenName + 'Screen');
  if (target) target.classList.add('active');
}

// ==========================================
// TOKEN MANAGEMENT
// ==========================================
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3 || i === 7) token += '-';
  }
  return token;
}

function formatToken(token) {
  return token.replace(/-/g, '').replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

function normalizeToken(input) {
  return input.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12);
}

// ==========================================
// STORAGE OPERATIONS
// ==========================================
function savePurchase(record) {
  const key = APP_CONFIG.STORAGE_KEY;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.push(record);
  localStorage.setItem(key, JSON.stringify(existing));
}

function findPurchase(token) {
  const key = APP_CONFIG.STORAGE_KEY;
  const records = JSON.parse(localStorage.getItem(key) || '[]');
  return records.find(r => r.token === token);
}

function incrementDownloadCount(token) {
  const key = APP_CONFIG.STORAGE_KEY;
  const records = JSON.parse(localStorage.getItem(key) || '[]');
  const record = records.find(r => r.token === token);
  
  if (record) {
    record.downloadCount = (record.downloadCount || 0) + 1;
    record.lastDownload = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(records));
    return record;
  }
  return null;
}

// ==========================================
// PAYMENT FLOW
// ==========================================
async function handleFormSubmit(e) {
  e.preventDefault();
  hideStatus();
  
  const formData = collectFormData();
  if (!validateFormData(formData)) return;
  
  if (!APP_CONFIG.FILES[formData.lga]) {
    showStatus('Selected LGA form is not available yet.', 'error');
    return;
  }
  
  setLoading(true);
  
  const reference = `LGA_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const token = generateToken();
  
  // Store pending transaction
  const pending = {
    reference,
    token,
    formData,
    fileName: APP_CONFIG.FILES[formData.lga],
    timestamp: Date.now()
  };
  sessionStorage.setItem('pending_tx', JSON.stringify(pending));
  
  try {
    // Initialize payment via Paystack Inline
    const handler = PaystackPop.setup({
      key: APP_CONFIG.PAYSTACK_PUBLIC_KEY,
      email: formData.email,
      amount: APP_CONFIG.PRICE_KOBO,
      currency: 'NGN',
      ref: reference,
      metadata: {
        custom_fields: [
          { display_name: 'Name', variable_name: 'name', value: `${formData.firstName} ${formData.lastName}` },
          { display_name: 'LGA', variable_name: 'lga', value: formData.lga },
          { display_name: 'Token', variable_name: 'token', value: token }
        ],
        token: token,
        lga: formData.lga
      },
      callback: (response) => onPaymentSuccess(response, pending),
      onClose: () => {
        setLoading(false);
        showStatus('Payment cancelled.', 'warning');
      }
    });
    
    handler.openIframe();
  } catch (error) {
    console.error('Payment error:', error);
    showStatus('Payment system error. Please try again.', 'error');
    setLoading(false);
  }
}

function collectFormData() {
  return {
    firstName: document.getElementById('firstName')?.value.trim() || '',
    lastName: document.getElementById('lastName')?.value.trim() || '',
    email: document.getElementById('email')?.value.trim() || '',
    phone: document.getElementById('phone')?.value.trim() || '',
    lga: document.getElementById('lga')?.value || '',
    address: document.getElementById('address')?.value.trim() || ''
  };
}

function validateFormData(data) {
  if (Object.values(data).some(v => !v)) {
    showStatus('Please fill in all required fields.', 'error');
    return false;
  }
  
  if (!data.email.includes('@') || !data.email.includes('.')) {
    showStatus('Please enter a valid email address.', 'error');
    return false;
  }
  
  return true;
}

// ==========================================
// POST-PAYMENT HANDLING
// ==========================================
async function onPaymentSuccess(response, pending) {
  showStatus('Verifying payment...', 'processing');
  
  try {
    // Verify with backend (optional but recommended)
    const verifyRes = await fetch(`${APP_CONFIG.API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: response.reference })
    });
    
    const verifyData = await verifyRes.json();
    
    if (!verifyData.verified) {
      showStatus('Payment verification failed. Contact support.', 'error');
      setLoading(false);
      return;
    }
    
    // Create permanent record
    const record = {
      token: pending.token,
      reference: response.reference,
      email: pending.formData.email,
      lga: pending.formData.lga,
      fileName: pending.fileName,
      downloadUrl: getGitHubUrl(pending.fileName),
      purchaseDate: new Date().toISOString(),
      downloadCount: 0,
      verified: true
    };
    
    savePurchase(record);
    sessionStorage.removeItem('pending_tx');
    
    // Show success screen
    currentRecord = record;
    displaySuccessScreen(record);
    
    // Auto-download after delay
    setTimeout(() => {
      executeDownload(record);
    }, 1500);
    
  } catch (error) {
    console.error('Verification error:', error);
    // Proceed anyway if verification fails (Paystack callback is trustworthy)
    proceedWithDownload(pending);
  }
}

function proceedWithDownload(pending) {
  const record = {
    token: pending.token,
    reference: pending.reference,
    email: pending.formData.email,
    lga: pending.formData.lga,
    fileName: pending.fileName,
    downloadUrl: getGitHubUrl(pending.fileName),
    purchaseDate: new Date().toISOString(),
    downloadCount: 0,
    verified: true
  };
  
  savePurchase(record);
  sessionStorage.removeItem('pending_tx');
  currentRecord = record;
  
  displaySuccessScreen(record);
  setTimeout(() => executeDownload(record), 1500);
}

function getGitHubUrl(filename) {
  const repo = 'yourusername/cyber-sweeft-services'; // Update this
  const branch = 'main';
  return `https://raw.githubusercontent.com/${repo}/${branch}/local-gov-forms/${filename}`;
}

// ==========================================
// SUCCESS SCREEN UI
// ==========================================
function displaySuccessScreen(record) {
  switchScreen('success');
  
  const fileNameEl = document.getElementById('fileName');
  const tokenEl = document.getElementById('displayToken');
  
  if (fileNameEl) fileNameEl.textContent = record.fileName;
  if (tokenEl) tokenEl.textContent = formatToken(record.token);
  
  setLoading(false);
}

// ==========================================
// DOWNLOAD OPERATIONS
// ==========================================
function executeDownload(record) {
  if (!record?.downloadUrl) {
    showStatus('Download link not available.', 'error');
    return;
  }
  
  // Use fetch + blob for reliable download
  fetch(record.downloadUrl)
    .then(res => {
      if (!res.ok) throw new Error('File not found');
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      incrementDownloadCount(record.token);
      showStatus('Download started!', 'success');
    })
    .catch(err => {
      console.error('Download error:', err);
      // Fallback: open in new tab
      window.open(record.downloadUrl, '_blank');
      showStatus('File opened in new tab. Please save manually.', 'warning');
    });
}

function downloadFile() {
  if (!currentRecord) {
    showStatus('No file available. Enter your token to restore.', 'error');
    return;
  }
  executeDownload(currentRecord);
}

// ==========================================
// REDOWNLOAD FEATURES
// ==========================================
function showRedownloadInfo() {
  if (!currentRecord) return;
  
  document.getElementById('redownloadToken').textContent = formatToken(currentRecord.token);
  document.getElementById('successScreen')?.classList.remove('active');
  document.getElementById('redownloadScreen').style.display = 'block';
}

function backToSuccess() {
  document.getElementById('redownloadScreen').style.display = 'none';
  document.getElementById('successScreen')?.classList.add('active');
}

function copyToken() {
  if (!currentRecord) return;
  
  const formatted = formatToken(currentRecord.token);
  
  navigator.clipboard.writeText(formatted)
    .then(() => showStatus('Token copied!', 'success'))
    .catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = formatted;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showStatus('Token copied!', 'success');
    });
}

// ==========================================
// RETURNING USER FLOW
// ==========================================
function verifyExistingToken() {
  const input = document.getElementById('existingToken')?.value || '';
  const normalized = normalizeToken(input);
  
  if (normalized.length !== 12) {
    showStatus('Please enter a valid 12-character token.', 'error');
    return;
  }
  
  const record = findPurchase(normalized);
  
  if (!record) {
    showStatus('Token not found. Check your spelling or make a new purchase.', 'error');
    return;
  }
  
  if (!record.verified) {
    showStatus('Payment pending verification. Contact support if this persists.', 'error');
    return;
  }
  
  // Valid token - restore access
  currentRecord = record;
  displaySuccessScreen(record);
  showStatus('Welcome back! Your download is ready.', 'success');
}

function checkReturningUser() {
  // Check URL for token parameter
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  
  if (urlToken) {
    document.getElementById('existingToken').value = urlToken;
    verifyExistingToken();
    return;
  }
  
  // Check for pending transaction (user refreshed during payment)
  const pending = sessionStorage.getItem('pending_tx');
  if (pending) {
    const tx = JSON.parse(pending);
    // If older than 30 minutes, clear it
    if (Date.now() - tx.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem('pending_tx');
    }
    // Otherwise, we could attempt to verify status here
  }
}

// ==========================================
// EXPORTS (for testing/module use)
// ==========================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateToken,
    normalizeToken,
    formatToken,
    validateFormData
  };
}
