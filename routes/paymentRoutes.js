import express from 'express';
import { paymentCheckout, stripePayment } from '../controllers/paymentController.js';

const router = express.Router();

// Create checkout session
router.post('/create-checkout-session', stripePayment);

// Webhook endpoint (to be implemented in future)
router.post('/payments/webhook', express.raw({ type: 'application/json' }), paymentCheckout);

export default router;