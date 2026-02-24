/**
 * api.js - SERVER-SIDE ONLY
 * Store this in a secure backend (Node.js/Express, serverless function, etc.)
 * NEVER expose this file or its contents to the frontend
 */

const CONFIG = {
  // Paystack credentials - KEEP SECRET
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || 'sk_live_your_actual_secret_key_here',
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_your_actual_public_key_here',
  
  // GitHub repo details
  GITHUB_REPO: process.env.GITHUB_REPO || 'yourusername/cyber-sweeft-services',
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',
  
  // Price in kobo (₦2,500)
  PRICE_KOBO: 250000,
  
  // File mappings
  FILES: {
    'agege': 'Agege_LG_ID_Form.pdf',
    'ajeromi-ifelodun': 'Ajeromi_Ifelodun_LG_ID_Form.pdf',
    'alimosho': 'Alimosho_LG_ID_Form.pdf',
    'amuwo-odofin': 'Amuwo_Odofin_LG_ID_Form.pdf',
    'apapa': 'Apapa_LG_ID_Form.pdf',
    'badagry': 'Badagry_LG_ID_Form.pdf',
    'epe': 'Epe_LG_ID_Form.pdf',
    'eti-osa': 'Eti_Osa_LG_ID_Form.pdf',
    'ibeju-lekki': 'Ibeju_Lekki_LG_ID_Form.pdf',
    'ifako-ijaiye': 'Ifako_Ijaiye_LG_ID_Form.pdf',
    'ikeja': 'Ikeja_LG_ID_Form.pdf',
    'ikorodu': 'Ikorodu_LG_ID_Form.pdf',
    'kosofe': 'Kosofe_LG_ID_Form.pdf',
    'lagos-island': 'Lagos_Island_LG_ID_Form.pdf',
    'lagos-mainland': 'Lagos_Mainland_LG_ID_Form.pdf',
    'mushin': 'Mushin_LG_ID_Form.pdf',
    'ojo': 'Ojo_LG_ID_Form.pdf',
    'oshodi-isolo': 'Oshodi_Isolo_LG_ID_Form.pdf',
    'shomolu': 'Shomolu_LG_ID_Form.pdf',
    'surulere': 'Surulere_LG_ID_Form.pdf'
  }
};

const PAYSTACK_API = 'https://api.paystack.co';

/**
 * Initialize Paystack transaction (server-side)
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
        metadata: paymentData.metadata,
        callback_url: paymentData.callback_url || ''
      })
    });

    const data = await response.json();
    
    if (data.status) {
      return {
        success: true,
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference
      };
    } else {
      throw new Error(data.message || 'Transaction initialization failed');
    }
  } catch (error) {
    console.error('Paystack Init Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify Paystack transaction (server-side)
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
        amount: data.data.amount / 100,
        reference: data.data.reference,
        customer: data.data.customer,
        paid_at: data.data.paid_at,
        metadata: data.data.metadata
      };
    } else {
      return {
        success: true,
        verified: false,
        status: data.data?.status || 'failed',
        message: 'Payment not successful'
      };
    }
  } catch (error) {
    console.error('Paystack Verify Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get GitHub raw URL for file
 */
function getDownloadUrl(lgaValue) {
  const filename = CONFIG.FILES[lgaValue];
  if (!filename) return null;
  return `https://raw.githubusercontent.com/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/local-gov-forms/${filename}`;
}

/**
 * Get public config (safe to expose)
 */
function getPublicConfig() {
  return {
    PAYSTACK_PUBLIC_KEY: CONFIG.PAYSTACK_PUBLIC_KEY,
    PRICE_KOBO: CONFIG.PRICE_KOBO,
    FILES: CONFIG.FILES
  };
}

// Export for Node.js/Express
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeTransaction,
    verifyTransaction,
    getDownloadUrl,
    getPublicConfig,
    CONFIG
  };
}
