/**
 * api.js - SERVER-SIDE ONLY
 * Store in secure backend (Node.js/Express, serverless functions, etc.)
 * NEVER expose to frontend
 */

const CONFIG = {
  // Paystack credentials - KEEP SECRET
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || 'sk_live_your_secret_key_here',
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_your_public_key_here',
  
  // GitHub repo (raw content access)
  GITHUB_REPO: 'cybersweeft1/cybersweeft',
  GITHUB_BRANCH: 'main',
  PROJECTS_FOLDER: 'projects',
  
  // Fixed price for all projects (₦2,500 in kobo)
  PRICE_KOBO: 250000
};

const PAYSTACK_API = 'https://api.paystack.co';

/**
 * Initialize Paystack transaction
 */
async function initializeTransaction(paymentData) {
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: paymentData.email,
        amount: CONFIG.PRICE_KOBO,
        currency: 'NGN',
        reference: paymentData.reference,
        metadata: paymentData.metadata
      })
    });

    const data = await response.json();
    
    if (data.status) {
      return {
        success: true,
        authorization_url: data.data.authorization_url,
        reference: data.data.reference
      };
    }
    throw new Error(data.message || 'Transaction failed');
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Verify Paystack transaction
 */
async function verifyTransaction(reference) {
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/verify/${reference}`, {
      method: 'GET',
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
        metadata: data.data.metadata
      };
    }
    return { success: true, verified: false, status: data.data?.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get public config (safe for frontend)
 */
function getPublicConfig() {
  return {
    PAYSTACK_PUBLIC_KEY: CONFIG.PAYSTACK_PUBLIC_KEY,
    PRICE_KOBO: CONFIG.PRICE_KOBO,
    GITHUB_REPO: CONFIG.GITHUB_REPO,
    GITHUB_BRANCH: CONFIG.GITHUB_BRANCH,
    PROJECTS_FOLDER: CONFIG.PROJECTS_FOLDER
  };
}

// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeTransaction,
    verifyTransaction,
    getPublicConfig,
    CONFIG
  };
}
