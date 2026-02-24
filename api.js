/**
 * api.js - SERVER SIDE ONLY
 * Store in backend (Node.js/Express, Vercel Functions, etc.)
 * NEVER expose to frontend
 */

const CONFIG = {
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || 'sk_live_your_secret_key_here',
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_your_public_key_here',
  FIXED_PRICE_KOBO: 250000, // ₦2,500 in kobo
  REPO_URL: 'https://github.com/cybersweeft1/cybersweeft'
};

const PAYSTACK_API = 'https://api.paystack.co';

async function initializeTransaction(email, projectId, projectName, callbackUrl) {
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        amount: CONFIG.FIXED_PRICE_KOBO,
        currency: 'NGN',
        reference: `PRJ_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        metadata: {
          custom_fields: [
            { display_name: "Project", variable_name: "project_name", value: projectName },
            { display_name: "Project ID", variable_name: "project_id", value: projectId }
          ],
          project_id: projectId,
          project_name: projectName
        },
        callback_url: callbackUrl
      })
    });

    const data = await response.json();
    return data.status ? { success: true, data: data.data } : { success: false, error: data.message };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

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
        projectId: data.data.metadata?.project_id,
        projectName: data.data.metadata?.project_name,
        reference: data.data.reference,
        amount: data.data.amount / 100
      };
    }
    return { success: true, verified: false, status: data.data?.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getPublicConfig() {
  return {
    PAYSTACK_PUBLIC_KEY: CONFIG.PAYSTACK_PUBLIC_KEY,
    FIXED_PRICE: 2500,
    CURRENCY: 'NGN'
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initializeTransaction, verifyTransaction, getPublicConfig };
}
