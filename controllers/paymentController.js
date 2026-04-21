import { createCheckoutSession, handleWebhook } from '../services/paymentService.js';
import { HTTP_STATUS, MESSAGES } from '../constants/index.js';
import { baseController } from './baseController.js';


// Valid plan types from User model
const VALID_PLAN_TYPES = ['free', 'starter', 'pro', 'enterprise'];
const VALID_PERIODS = ['monthly', 'yearly'];

/**
 * Create Stripe checkout session
 * @route POST /create-checkout-session
 */
export const stripePayment = baseController.handleRequest(async (req, res) => {
  const { email, plan_type, period, userId, } = req.body;

  // Validate required parameters
  if (!email || !plan_type || !period || !userId) {
    const error = new Error('Missing required parameters: email, plan_type, period, userId');
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  // Validate plan_type enum
  const normalizedPlanType = plan_type.toLowerCase();
  if (!VALID_PLAN_TYPES.includes(normalizedPlanType)) {
    const error = new Error(`Invalid plan_type. Must be one of: ${VALID_PLAN_TYPES.join(', ')}`);
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  // Validate period
  const normalizedPeriod = period.toLowerCase();
  if (!VALID_PERIODS.includes(normalizedPeriod)) {
    const error = new Error(`Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`);
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  // Free plan cannot create checkout session
  if (normalizedPlanType === 'free') {
    const error = new Error('Cannot create checkout session for free plan');
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  // Create checkout session
  const result = await createCheckoutSession(
    email,
    normalizedPlanType,
    normalizedPeriod,
    userId
  );

  return baseController.sendSuccess(
    res,
    result,
    'Checkout session created successfully',
    HTTP_STATUS.CREATED
  );
});

/**
 * Handle Stripe webhook events
 * @route POST /payments/webhook
 */
export const paymentCheckout = baseController.handleRequest(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const rawBody = req.body;

  // Process webhook
  const result = await handleWebhook(rawBody, signature);

  return baseController.sendSuccess(
    res,
    result,
    'Webhook received',
    HTTP_STATUS.OK
  );
});
