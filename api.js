// api.js - SERVER SIDE ONLY - Store this securely, never expose to frontend
// This should be used in a Node.js/Express backend or serverless function

const PAYSTACK_SECRET_KEY = 'sk_live_your_actual_secret_key_here'; // Replace with your Paystack Secret Key
const PAYSTACK_PUBLIC_KEY = 'pk_live_your_actual_public_key_here';  // For reference only

// Paystack API Base URL
const PAYSTACK_API = 'https://api.paystack.co';

/**
 * Initialize a transaction with Paystack
 * @param {Object} paymentData - { email, amount, metadata, callback_url }
 * @returns {Promise} - Returns authorization_url and reference
 */
async function initializeTransaction(paymentData) {
    try {
        const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: paymentData.email,
                amount: paymentData.amount * 100, // Convert to kobo (smallest currency unit)
                metadata: paymentData.metadata || {},
                callback_url: paymentData.callback_url || '',
                reference: paymentData.reference || generateReference()
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
        console.error('Paystack Initialization Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verify a transaction with Paystack
 * @param {string} reference - Transaction reference
 * @returns {Promise} - Returns transaction status and details
 */
async function verifyTransaction(reference) {
    try {
        const response = await fetch(`${PAYSTACK_API}/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.status && data.data.status === 'success') {
            return {
                success: true,
                verified: true,
                amount: data.data.amount / 100, // Convert back from kobo
                reference: data.data.reference,
                customer: data.data.customer,
                paid_at: data.data.paid_at,
                channel: data.data.channel,
                metadata: data.data.metadata
            };
        } else {
            return {
                success: true,
                verified: false,
                status: data.data?.status || 'failed',
                message: 'Payment not successful or pending'
            };
        }
    } catch (error) {
        console.error('Paystack Verification Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate unique transaction reference
 */
function generateReference() {
    return 'LGA_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// For Node.js/Express export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeTransaction,
        verifyTransaction,
        generateReference,
        PAYSTACK_PUBLIC_KEY
    };
}
