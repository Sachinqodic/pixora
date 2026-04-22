import express from 'express';
import { paymentCheckout, stripePayment, manageSubscription } from '../controllers/paymentController.js';

const router = express.Router();

// Create checkout session (handles both new subscriptions and upgrades)
router.post('/create-checkout-session', stripePayment);

// Manage subscription (Customer Portal) - for downgrades, cancellations
router.post('/manage-subscription', manageSubscription);

// Webhook endpoint (raw body parser applied in app.js for /webhook path)
router.post('/webhook/stripe', paymentCheckout);

export default router;