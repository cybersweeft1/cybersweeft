/**
 * projects.js - Dynamic project marketplace
 * Fetches file list from GitHub, auto-categorizes, handles payments
 */

// Configuration
const CONFIG = {
  PAYSTACK_PUBLIC_KEY: '',
  PRICE_KOBO: 250000,
  GITHUB_REPO: 'cybersweeft1/cybersweeft',
  GITHUB_BRANCH: 'main',
  PROJECTS_FOLDER: 'projects',
  STORAGE_KEY: 'cyber_sweeft_purchases_v1'
};

// State
let allProjects = [];
let filteredProjects = [];
let currentPurchase = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  loadConfig();
  setupEventListeners();
  await loadProjects();
  renderCategories();
  renderProjects();
  updateStats();
});

function loadConfig() {
  const configEl = document.getElementById('app-config');
  if (configEl) {
    try {
      const data = JSON.parse(configEl.textContent);
      Object.assign(CONFIG, data);
    } catch (e) {
      console.error('Config parse error:', e);
    }
  }
}

function setupEventListeners() {
  // Theme toggle
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
  
  // Search
  document.getElementById('searchInput')?.addEventListener('input', debounce(handleSearch, 300));
  
  // Category filters (delegated)
  document.getElementById('categoryFilters')?.addEventListener('click', handleCategoryClick);
  
  // Purchase form
  document.getElementById('purchaseForm')?.addEventListener('submit', handlePurchase);
  
  // Modal close on backdrop
  document.getElementById('purchaseModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'purchaseModal') closeModal();
  });
}

// ==========================================
// GITHUB INTEGRATION - FETCH PROJECTS
// ==========================================
async function loadProjects() {
  try {
    showLoading(true);
    
    // Method 1: Try GitHub API (works for public repos)
    const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/${CONFIG.PROJECTS_FOLDER}?ref=${CONFIG.GITHUB_BRANCH}`;
    
    let files = [];
    
    try {
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        files = data.filter(item => item.type === 'file');
      }
    } catch (apiError) {
      console.log('GitHub API failed, trying raw method...');
    }
    
    // Method 2: Fallback - construct from known patterns or use raw directory listing
    if (files.length === 0) {
      // Try to fetch via jsDelivr or raw.githubusercontent with index
      files = await fetchViaJsDelivr();
    }
    
    // Process files into project objects
    allProjects = files.map(file => parseProjectFile(file)).filter(p => p !== null);
    
    // Auto-categorize based on filename patterns
    categorizeProjects();
    
    filteredProjects = [...allProjects];
    showLoading(false);
    
  } catch (error) {
    console.error('Failed to load projects:', error);
    showError('Failed to load projects. Please refresh the page.');
    showLoading(false);
  }
}

async function fetchViaJsDelivr() {
  // jsDelivr provides a clean API for GitHub repos
  const url = `https://cdn.jsdelivr.net/gh/${CONFIG.GITHUB_REPO}@${CONFIG.GITHUB_BRANCH}/${CONFIG.PROJECTS_FOLDER}/`;
  
  // Unfortunately, directory listing isn't straightforward via raw GitHub
  // We'll use a workaround: check common file extensions
  
  // For now, return empty and let user know to check README
  // In production, you'd maintain a manifest.json in the repo
  
  // Alternative: Fetch a manifest file if you create one
  try {
    const manifestUrl = `https://raw.githubusercontent.com/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${CONFIG.PROJECTS_FOLDER}/manifest.json`;
    const response = await fetch(manifestUrl);
    if (response.ok) {
      const manifest = await response.json();
      return manifest.files || [];
    }
  } catch (e) {
    // No manifest, use demo data for now
    console.log('No manifest found, using directory scan...');
  }
  
  return [];
}

// ==========================================
// PROJECT PARSING & CATEGORIZATION
// ==========================================
function parseProjectFile(file) {
  const name = file.name || file;
  const url = file.download_url || `https://raw.githubusercontent.com/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${CONFIG.PROJECTS_FOLDER}/${name}`;
  
  // Parse filename: "Category_Project_Name_2024.pdf" or "Project_Name_Category.pdf"
  const parts = name.replace(/\.[^/.]+$/, '').split(/[_-]+/);
  
  // Extract category from filename patterns
  let category = 'General';
  let title = name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
  
  // Common category keywords
  const categoryKeywords = {
    'computer': 'Computer Science',
    'cs': 'Computer Science',
    'software': 'Software Engineering',
    'web': 'Web Development',
    'mobile': 'Mobile Development',
    'data': 'Data Science',
    'ai': 'Artificial Intelligence',
    'ml': 'Machine Learning',
    'network': 'Networking',
    'security': 'Cyber Security',
    'database': 'Database Systems',
    'cloud': 'Cloud Computing',
    'iot': 'IoT',
    'robotics': 'Robotics',
    'accounting': 'Accounting',
    'business': 'Business Admin',
    'marketing': 'Marketing',
    'economics': 'Economics',
    'law': 'Law',
    'medicine': 'Medicine',
    'nursing': 'Nursing',
    'pharmacy': 'Pharmacy',
    'engineering': 'Engineering',
    'electrical': 'Electrical Engineering',
    'mechanical': 'Mechanical Engineering',
    'civil': 'Civil Engineering',
    'chemical': 'Chemical Engineering',
    'agric': 'Agriculture',
    'education': 'Education',
    'mass': 'Mass Communication',
    'sociology': 'Sociology',
    'psychology': 'Psychology',
    'political': 'Political Science',
    'history': 'History',
    'english': 'English',
    'literature': 'Literature',
    'biology': 'Biology',
    'chemistry': 'Chemistry',
    'physics': 'Physics',
    'math': 'Mathematics',
    'statistics': 'Statistics'
  };
  
  // Check for category in filename
  const lowerName = name.toLowerCase();
  for (const [key, cat] of Object.entries(categoryKeywords)) {
    if (lowerName.includes(key)) {
      category = cat;
      break;
    }
  }
  
  // Clean up title
  title = title
    .replace(new RegExp(category, 'gi'), '')
    .replace(/\d{4}/g, '') // Remove years
    .replace(/\s+/g, ' ')
    .trim();
  
  // If no specific category found, use first word as category
  if (category === 'General' && parts.length > 1) {
    category = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }
  
  return {
    id: name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '_'),
    filename: name,
    title: title || name.replace(/\.[^/.]+$/, ''),
    category: category,
    url: url,
    size: formatFileSize(file.size || 0),
    extension: name.split('.').pop().toUpperCase(),
    price: 2500,
    purchased: isPurchased(name)
  };
}

function categorizeProjects() {
  // Auto-categorize is done during parsing
  // Extract unique categories
  const categories = [...new Set(allProjects.map(p => p.category))].sort();
  return categories;
}

function getCategories() {
  const cats = [...new Set(allProjects.map(p => p.category))];
  return ['all', ...cats.sort()];
}

// ==========================================
// RENDERING
// ==========================================
function renderCategories() {
  const container = document.getElementById('categoryFilters');
  if (!container) return;
  
  const categories = getCategories();
  
  container.innerHTML = categories.map(cat => `
    <button class="filter-btn ${cat === 'all' ? 'active' : ''}" data-category="${cat}">
      ${cat === 'all' ? 'All Projects' : cat}
    </button>
  `).join('');
}

function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  const empty = document.getElementById('emptyState');
  
  if (!grid) return;
  
  if (filteredProjects.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  empty.style.display = 'none';
  
  grid.innerHTML = filteredProjects.map(project => `
    <div class="project-card" data-category="${project.category}" data-id="${project.id}">
      <div class="project-icon">
        <i class="fas ${getFileIcon(project.extension)}"></i>
        <span class="file-type">${project.extension}</span>
      </div>
      
      <div class="project-info">
        <span class="category-tag">${project.category}</span>
        <h3 class="project-title">${escapeHtml(project.title)}</h3>
        <p class="project-meta">${project.size} • ${project.extension}</p>
      </div>
      
      <div class="project-action">
        ${project.purchased ? `
          <button class="download-btn" onclick="downloadProject('${project.id}')">
            <i class="fas fa-download"></i> Download
          </button>
          <span class="purchased-badge"><i class="fas fa-check"></i> Owned</span>
        ` : `
          <button class="buy-btn" onclick="openPurchase('${project.id}')">
            <span class="price">₦2,500</span>
            <span class="action">Buy Now</span>
          </button>
        `}
      </div>
    </div>
  `).join('');
}

function getFileIcon(ext) {
  const icons = {
    'PDF': 'fa-file-pdf',
    'DOC': 'fa-file-word',
    'DOCX': 'fa-file-word',
    'PPT': 'fa-file-powerpoint',
    'PPTX': 'fa-file-powerpoint',
    'ZIP': 'fa-file-archive',
    'RAR': 'fa-file-archive',
    'XLS': 'fa-file-excel',
    'XLSX': 'fa-file-excel'
  };
  return icons[ext] || 'fa-file';
}

// ==========================================
// SEARCH & FILTER
// ==========================================
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  
  if (!query) {
    filteredProjects = [...allProjects];
  } else {
    filteredProjects = allProjects.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.filename.toLowerCase().includes(query)
    );
  }
  
  // Re-apply category filter if active
  const activeCat = document.querySelector('.filter-btn.active')?.dataset.category;
  if (activeCat && activeCat !== 'all') {
    filteredProjects = filteredProjects.filter(p => p.category === activeCat);
  }
  
  renderProjects();
  updateStats();
}

function handleCategoryClick(e) {
  if (!e.target.classList.contains('filter-btn')) return;
  
  // Update active state
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
  
  const category = e.target.dataset.category;
  
  if (category === 'all') {
    filteredProjects = [...allProjects];
  } else {
    filteredProjects = allProjects.filter(p => p.category === category);
  }
  
  // Re-apply search if exists
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim();
  if (searchQuery) {
    filteredProjects = filteredProjects.filter(p => 
      p.title.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery)
    );
  }
  
  renderProjects();
  updateStats();
}

// ==========================================
// PURCHASE FLOW
// ==========================================
function openPurchase(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;
  
  if (project.purchased) {
    downloadProject(projectId);
    return;
  }
  
  currentPurchase = project;
  document.getElementById('modalProjectName').textContent = project.title;
  document.getElementById('purchaseModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('purchaseModal').classList.remove('active');
  document.body.style.overflow = '';
  currentPurchase = null;
  resetForm();
}

function resetForm() {
  document.getElementById('purchaseForm')?.reset();
  setLoading(false);
}

async function handlePurchase(e) {
  e.preventDefault();
  if (!currentPurchase) return;
  
  const email = document.getElementById('buyerEmail').value.trim();
  const name = document.getElementById('buyerName').value.trim();
  const phone = document.getElementById('buyerPhone').value.trim();
  
  if (!email || !name || !phone) {
    showToast('Please fill all fields', 'error');
    return;
  }
  
  setLoading(true);
  
  const reference = `PRJ_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  const handler = PaystackPop.setup({
    key: CONFIG.PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: CONFIG.PRICE_KOBO,
    currency: 'NGN',
    ref: reference,
    metadata: {
      custom_fields: [
        { display_name: 'Project', variable_name: 'project', value: currentPurchase.title },
        { display_name: 'Filename', variable_name: 'filename', value: currentPurchase.filename },
        { display_name: 'Customer', variable_name: 'customer', value: name }
      ],
      project_id: currentPurchase.id,
      project_file: currentPurchase.filename
    },
    callback: (response) => onPaymentSuccess(response),
    onClose: () => {
      setLoading(false);
      showToast('Payment cancelled', 'warning');
    }
  });
  
  handler.openIframe();
}

async function onPaymentSuccess(response) {
  showToast('Verifying payment...', 'info');
  
  try {
    // Verify with backend (optional but recommended)
    const verifyRes = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: response.reference })
    });
    
    const verifyData = await verifyRes.json();
    
    if (!verifyData.verified) {
      // Still mark as purchased (Paystack callback is trustworthy)
      console.warn('Verification failed but proceeding');
    }
    
    // Mark as purchased
    markPurchased(currentPurchase.filename);
    currentPurchase.purchased = true;
    
    // Update UI
    closeModal();
    renderProjects();
    updateStats();
    
    // Auto-download
    showToast('Payment successful! Starting download...', 'success');
    setTimeout(() => {
      downloadProject(currentPurchase.id);
    }, 1000);
    
  } catch (error) {
    console.error('Post-payment error:', error);
    // Proceed anyway
    markPurchased(currentPurchase.filename);
    currentPurchase.purchased = true;
    closeModal();
    renderProjects();
    downloadProject(currentPurchase.id);
  }
}

// ==========================================
// DOWNLOAD SYSTEM
// ==========================================
function downloadProject(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) {
    showToast('Project not found', 'error');
    return;
  }
  
  if (!project.purchased) {
    openPurchase(projectId);
    return;
  }
  
  // Fetch and download
  fetch(project.url)
    .then(res => {
      if (!res.ok) throw new Error('File not available');
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = project.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast(`Downloaded: ${project.title}`, 'success');
    })
    .catch(err => {
      console.error('Download error:', err);
      // Fallback: open in new tab
      window.open(project.url, '_blank');
      showToast('File opened in new tab. Please save manually.', 'warning');
    });
}

// ==========================================
// PURCHASE TRACKING (Device-based)
// ==========================================
function isPurchased(filename) {
  const purchases = getPurchases();
  return purchases.some(p => p.filename === filename);
}

function getPurchases() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function markPurchased(filename) {
  const purchases = getPurchases();
  if (!purchases.some(p => p.filename === filename)) {
    purchases.push({
      filename: filename,
      date: new Date().toISOString(),
      device: navigator.userAgent.slice(0, 50)
    });
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(purchases));
  }
}

// ==========================================
// UI HELPERS
// ==========================================
function toggleTheme() {
  const html = document.documentElement;
  const btn = document.getElementById('themeBtn');
  const isDark = html.getAttribute('data-theme') === 'dark';
  
  if (isDark) {
    html.removeAttribute('data-theme');
    btn.innerHTML = '<i class="fas fa-moon"></i>';
  } else {
    html.setAttribute('data-theme', 'dark');
    btn.innerHTML = '<i class="fas fa-sun"></i>';
  }
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
    if (btnText) btnText.textContent = 'Pay & Download Now';
    if (lockIcon) lockIcon.style.display = 'inline-block';
  }
}

function showLoading(show) {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  
  if (show) {
    grid.innerHTML = `
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading projects from repository...</p>
      </div>
    `;
  }
}

function showError(message) {
  const grid = document.getElementById('projectsGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
        <button onclick="location.reload()" class="retry-btn">Retry</button>
      </div>
    `;
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('downloadToast');
  const msgEl = document.getElementById('toastMessage');
  
  if (!toast || !msgEl) return;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function updateStats() {
  const totalEl = document.getElementById('totalProjects');
  const purchasedEl = document.getElementById('purchasedCount');
  
  if (totalEl) {
    totalEl.textContent = `${filteredProjects.length} project${filteredProjects.length !== 1 ? 's' : ''} available`;
  }
  
  const purchased = getPurchases().length;
  if (purchasedEl && purchased > 0) {
    purchasedEl.style.display = 'inline';
    purchasedEl.textContent = ` • ${purchased} owned`;
  }
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==========================================
// MANIFEST FALLBACK
// ==========================================
// If GitHub API fails, create a manifest.json in your repo:
// {
//  
