/**
 * api.js - SERVER-SIDE ONLY
 * Store in secure backend (Node.js/Express, Vercel Functions, etc.)
 * NEVER expose to frontend
 */

const CONFIG = {
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || 'sk_live_your_secret_key_here',
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_your_public_key_here',
  
  GITHUB_REPO: 'cybersweeft1/cybersweeft',
  GITHUB_BRANCH: 'main',
  PROJECTS_FOLDER: 'projects',
  
  PRICE_KOBO: 250000, // ₦2,500
  
  // Categories based on filename prefixes
  CATEGORIES: {
    'CS': 'Computer Science',
    'ENG': 'Engineering',
    'BUS': 'Business Admin',
    'MED': 'Medical/Health',
    'LAW': 'Law',
    'EDU': 'Education',
    'SCI': 'Science',
    'ART': 'Arts/Humanities',
    'AGR': 'Agriculture',
    'MAS': 'Mass Communication'
  }
};

const PAYSTACK_API = 'https://api.paystack.co';

/**
 * Initialize Paystack transaction
 */
async function initializeTransaction(email, metadata = {}) {
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        amount: CONFIG.PRICE_KOBO,
        currency: 'NGN',
        metadata: metadata,
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
      })
    });

    const data = await response.json();
    
    if (data.status) {
      return {
        success: true,
        authorization_url: data.data.authorization_url,
        reference: data.data.reference
      };
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Paystack Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify transaction
 */
async function verifyTransaction(reference) {
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.status && data.data.status === 'success') {
      return {
        success: true,
        verified: true,
        reference: data.data.reference,
        amount: data.data.amount / 100,
        customer: data.data.customer.email,
        paid_at: data.data.paid_at,
        metadata: data.data.metadata
      };
    }
    
    return { success: true, verified: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get GitHub raw URL for project file
 */
function getProjectUrl(filename) {
  return `https://raw.githubusercontent.com/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${CONFIG.PROJECTS_FOLDER}/${filename}`;
}

/**
 * Parse filename to extract metadata
 * Format: CATEGORY_Title_Words_Here_Year.pdf
 */
function parseFilename(filename) {
  const parts = filename.replace('.pdf', '').split('_');
  const categoryCode = parts[0] || 'OTH';
  const year = parts[parts.length - 1] || '2024';
  const title = parts.slice(1, -1).join(' ') || filename;
  
  return {
    filename,
    categoryCode,
    category: CONFIG.CATEGORIES[categoryCode] || 'Other',
    title: title.replace(/-/g, ' '),
    year,
    displayName: title.replace(/-/g, ' '),
    downloadUrl: getProjectUrl(filename)
  };
}

/**
 * Get public config (safe for frontend)
 */
function getPublicConfig() {
  return {
    PAYSTACK_PUBLIC_KEY: CONFIG.PAYSTACK_PUBLIC_KEY,
    PRICE_NAIRA: 2500,
    CATEGORIES: CONFIG.CATEGORIES,
    GITHUB_REPO: CONFIG.GITHUB_REPO,
    GITHUB_BRANCH: CONFIG.GITHUB_BRANCH,
    PROJECTS_FOLDER: CONFIG.PROJECTS_FOLDER
  };
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  getProjectUrl,
  parseFilename,
  getPublicConfig,
  CONFIG
};
