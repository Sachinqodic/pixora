import express from 'express';
import { validateDateRange } from '../validations/dateValidation.js';
import {
  paymentCheckout,
  stripePayment,
  manageSubscription,
  billingAnalytics,
  billingTimeSeries,
} from '../controllers/paymentController.js';
import { authChecker } from '../middlewares/authChecker.js';

const router = express.Router();

// Create checkout session (handles both new subscriptions and upgrades)
router.post('/create-checkout-session', authChecker, stripePayment);

// Manage subscription (Customer Portal) - for downgrades, cancellations
router.post('/manage-subscription', authChecker, manageSubscription);

// Get billing analytics for admin dashboard
router.get('/billing-analytics', authChecker, validateDateRange, billingAnalytics);

// Get billing time-series data for charts (New Subscribers vs Payments)
router.get('/subscribers-payments-graph', authChecker, validateDateRange, billingTimeSeries);

// Webhook endpoint (raw body parser applied in app.js for /webhook path)
router.post('/webhook/stripe', authChecker, paymentCheckout);

export default router;
