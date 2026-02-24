/**
 * projects.js - Frontend logic for Cyber Sweeft Project Store
 * No API keys here - all secrets stay server-side
 */

const APP_CONFIG = {
  PAYSTACK_PUBLIC_KEY: '', // Loaded from server
  FIXED_PRICE: 2500,
  STORAGE_KEY: 'cybersweeft_purchases_v1',
  PROJECTS_URL: 'projects.json', // Load from same repo
  GITHUB_RAW_BASE: 'https://raw.githubusercontent.com/cybersweeft1/cybersweeft/main'
};

let allProjects = [];
let filteredProjects = [];
let currentPurchase = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadProjects();
  setupEventListeners();
  checkPaymentCallback();
  applySavedTheme();
});

async function loadConfig() {
  try {
    // Try to fetch from backend first
    const response = await fetch('/api/config');
    const config = await response.json();
    APP_CONFIG.PAYSTACK_PUBLIC_KEY = config.PAYSTACK_PUBLIC_KEY;
  } catch (e) {
    // Fallback: parse from inline script or use default
    const inline = document.getElementById('app-config')?.textContent;
    if (inline) {
      const data = JSON.parse(inline);
      APP_CONFIG.PAYSTACK_PUBLIC_KEY = data.PAYSTACK_PUBLIC_KEY;
    }
  }
}

async function loadProjects() {
  try {
    // Load projects.json from GitHub raw
    const response = await fetch(`${APP_CONFIG.GITHUB_RAW_BASE}/projects.json?t=${Date.now()}`);
    const data = await response.json();
    
    allProjects = data.projects.map(p => ({
      ...p,
      driveDownloadUrl: `https://drive.google.com/uc?export=download&id=${p.driveId}`,
      viewUrl: `https://drive.google.com/file/d/${p.driveId}/view`
    }));
    
    filteredProjects = [...allProjects];
    renderCategories(data.categories);
    renderProjects();
  } catch (error) {
    showError('Failed to load projects. Please refresh.');
    console.error('Load error:', error);
  }
}

// ==========================================
// RENDERING
// ==========================================
function renderCategories(categories) {
  const container = document.getElementById('categoryFilters');
  if (!container) return;
  
  const allBtn = document.createElement('button');
  allBtn.className = 'category-btn active';
  allBtn.textContent = 'All Projects';
  allBtn.onclick = () => filterByCategory('all');
  container.appendChild(allBtn);
  
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.textContent = cat.replace(/_/g, ' ');
    btn.onclick = () => filterByCategory(cat);
    container.appendChild(btn);
  });
}

function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (filteredProjects.length === 0) {
    grid.innerHTML = '<div class="no-results">No projects found. Try a different search.</div>';
    return;
  }
  
  const purchased = getPurchasedProjects();
  
  filteredProjects.forEach(project => {
    const isPurchased = purchased.includes(project.id);
    const card = createProjectCard(project, isPurchased);
    grid.appendChild(card);
  });
}

function createProjectCard(project, isPurchased) {
  const div = document.createElement('div');
  div.className = 'project-card';
  
  const categoryClass = project.category.toLowerCase().replace(/_/g, '-');
  
  div.innerHTML = `
    <div class="project-header">
      <span class="project-category ${categoryClass}">${project.category.replace(/_/g, ' ')}</span>
      ${isPurchased ? '<span class="purchased-badge"><i class="fas fa-check"></i> Owned</span>' : ''}
    </div>
    <h3 class="project-title">${project.name}</h3>
    <p class="project-desc">${project.description}</p>
    <div class="project-footer">
      <span class="project-price">₦${APP_CONFIG.FIXED_PRICE.toLocaleString()}</span>
      ${isPurchased 
        ? `<button class="download-btn-sm" onclick="directDownload('${project.id}')">
             <i class="fas fa-download"></i> Download Again
           </button>`
        : `<button class="buy-btn" onclick="initiatePurchase('${project.id}')">
             <i class="fas fa-lock"></i> Buy Now
           </button>`
      }
    </div>
  `;
  
  return div;
}

// ==========================================
// SEARCH & FILTER
// ==========================================
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  }
  
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
}

function handleSearch(query) {
  const term = query.toLowerCase().trim();
  
  if (!term) {
    filteredProjects = [...allProjects];
  } else {
    filteredProjects = allProjects.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term)
    );
  }
  
  renderProjects();
}

function filterByCategory(category) {
  // Update active button
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', 
      (category === 'all' && btn.textContent === 'All Projects') ||
      btn.textContent === category.replace(/_/g, ' ')
    );
  });
  
  if (category === 'all') {
    filteredProjects = [...allProjects];
  } else {
    filteredProjects = allProjects.filter(p => p.category === category);
  }
  
  // Maintain search if exists
  const searchTerm = document.getElementById('searchInput')?.value;
  if (searchTerm) handleSearch(searchTerm);
  else renderProjects();
}

// ==========================================
// PURCHASE FLOW
// ==========================================
function initiatePurchase(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;
  
  // Check if already purchased
  if (getPurchasedProjects().includes(projectId)) {
    directDownload(projectId);
    return;
  }
  
  // Show email modal
  showPurchaseModal(project);
}

function showPurchaseModal(project) {
  const modal = document.getElementById('purchaseModal');
  const title = document.getElementById('modalProjectTitle');
  const emailInput = document.getElementById('buyerEmail');
  
  title.textContent = project.name;
  emailInput.value = '';
  currentPurchase = project;
  
  modal.classList.add('show');
  emailInput.focus();
}

function closeModal() {
  document.getElementById('purchaseModal')?.classList.remove('show');
  currentPurchase = null;
}

function confirmPurchase() {
  const email = document.getElementById('buyerEmail')?.value.trim();
  
  if (!email || !email.includes('@')) {
    showModalError('Please enter a valid email address');
    return;
  }
  
  if (!currentPurchase) return;
  
  processPayment(email, currentPurchase);
}

function processPayment(email, project) {
  const btn = document.getElementById('confirmBuyBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  
  const handler = PaystackPop.setup({
    key: APP_CONFIG.PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: APP_CONFIG.FIXED_PRICE * 100, // kobo
    currency: 'NGN',
    ref: `PRJ_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    metadata: {
      custom_fields: [
        { display_name: "Project", variable_name: "project_name", value: project.name },
        { display_name: "Project ID", variable_name: "project_id", value: project.id }
      ],
      project_id: project.id
    },
    callback: (response) => onPaymentSuccess(response, project),
    onClose: () => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock"></i> Pay ₦2,500';
    }
  });
  
  handler.openIframe();
}

function onPaymentSuccess(response, project) {
  closeModal();
  
  // Record purchase
  recordPurchase(project.id);
  
  // Show success + download screen
  showDownloadScreen(project, response.reference);
  
  // Auto-download after 1 second
  setTimeout(() => {
    executeDownload(project);
  }, 1000);
}

// ==========================================
// DOWNLOAD HANDLING
// ==========================================
function showDownloadScreen(project, reference) {
  const screen = document.getElementById('downloadScreen');
  const title = document.getElementById('downloadProjectTitle');
  const ref = document.getElementById('transactionRef');
  
  title.textContent = project.name;
  ref.textContent = reference;
  
  // Hide grid, show download screen
  document.getElementById('projectsGrid').style.display = 'none';
  document.getElementById('categoryFilters').style.display = 'none';
  document.querySelector('.search-section').style.display = 'none';
  
  screen.classList.add('show');
}

function executeDownload(project) {
  // Google Drive direct download
  const url = project.driveDownloadUrl;
  
  // Create hidden iframe for download (avoids popup blockers)
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  
  // Also try anchor method as backup
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '_')}.pdf`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    document.body.removeChild(iframe);
  }, 5000);
  
  showNotification('Download started! Check your downloads folder.', 'success');
}

function directDownload(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;
  
  if (!getPurchasedProjects().includes(projectId)) {
    initiatePurchase(projectId);
    return;
  }
  
  executeDownload(project);
}

function retryDownload() {
  if (!currentPurchase) {
    // Try to get from URL params or storage
    const lastProject = sessionStorage.getItem('last_purchase');
    if (lastProject) {
      const project = JSON.parse(lastProject);
      executeDownload(project);
      return;
    }
    showNotification('Download session expired. Please purchase again.', 'error');
    returnToStore();
  } else {
    executeDownload(currentPurchase);
  }
}

function returnToStore() {
  document.getElementById('downloadScreen')?.classList.remove('show');
  document.getElementById('projectsGrid').style.display = 'grid';
  document.getElementById('categoryFilters').style.display = 'flex';
  document.querySelector('.search-section').style.display = 'block';
  currentPurchase = null;
}

// ==========================================
// PURCHASE TRACKING (Device-level)
// ==========================================
function getPurchasedProjects() {
  try {
    const data = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function recordPurchase(projectId) {
  const purchased = getPurchasedProjects();
  if (!purchased.includes(projectId)) {
    purchased.push(projectId);
    localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(purchased));
  }
  
  // Also save to session for retry functionality
  const project = allProjects.find(p => p.id === projectId);
  if (project) {
    sessionStorage.setItem('last_purchase', JSON.stringify(project));
  }
}

// ==========================================
// CALLBACK HANDLING (URL params)
// ==========================================
function checkPaymentCallback() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get('reference');
  const projectId = params.get('project');
  
  if (reference && projectId) {
    // Verify with backend
    verifyAndDownload(reference, projectId);
  }
}

async function verifyAndDownload(reference, projectId) {
  showNotification('Verifying payment...', 'processing');
  
  try {
    const response = await fetch(`/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    });
    
    const result = await response.json();
    
    if (result.verified) {
      const project = allProjects.find(p => p.id === projectId);
      if (project) {
        recordPurchase(projectId);
        showDownloadScreen(project, reference);
        setTimeout(() => executeDownload(project), 500);
      }
    } else {
      showNotification('Payment verification failed. Please contact support.', 'error');
    }
  } catch (error) {
    // Silent fail - let user retry manually
    console.error('Verification error:', error);
  }
  
  // Clean URL
  window.history.replaceState({}, document.title, window.location.pathname);
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

function showError(msg) {
  showNotification(msg, 'error');
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
  
  updateThemeIcon(!isDark);
}

function applySavedTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon(true);
  }
}

function updateThemeIcon(isDark) {
  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
}

// ==========================================
// EXPORTS
// ==========================================
if (typeof module !== 'undefined') {
  module.exports = { getPurchasedProjects, recordPurchase };
}
