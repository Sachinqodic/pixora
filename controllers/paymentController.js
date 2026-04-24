import {
  createCheckoutSession,
  handleWebhook,
  createCustomerPortalSession,
  getBillingAnalytics,
  getBillingTimeSeries,
} from '../services/paymentService.js';
import { HTTP_STATUS, MESSAGES, VALID_PLAN_TYPES, VALID_PERIODS } from '../constants/index.js';
import { baseController } from './baseController.js';

/**
 * Create Stripe checkout session
 * @route POST /create-checkout-session
 */
export const stripePayment = baseController.handleRequest(async (req, res) => {
  const { email, plan_type, period, userId } = req.body;

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

  // Create checkout session (or upgrade if existing subscription)
  const result = await createCheckoutSession(email, normalizedPlanType, normalizedPeriod, userId);

  // Check if it was an upgrade
  if (result.upgraded) {
    return baseController.sendSuccess(
      res,
      result,
      'Subscription upgraded successfully with proration',
      HTTP_STATUS.OK
    );
  }

  return baseController.sendSuccess(
    res,
    result,
    'Checkout session created successfully',
    HTTP_STATUS.CREATED
  );
});

/**
 * Create Stripe Customer Portal session for managing subscriptions
 * @route POST /manage-subscription
 */
export const manageSubscription = baseController.handleRequest(async (req, res) => {
  const { email } = req.body;

  // Validate required parameters
  if (!email) {
    const error = new Error('Missing required parameter: email');
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  // Create customer portal session
  const result = await createCustomerPortalSession(email);

  return baseController.sendSuccess(
    res,
    result,
    'Customer portal session created successfully',
    HTTP_STATUS.OK
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

  return baseController.sendSuccess(res, result, 'Webhook received', HTTP_STATUS.OK);
});

/**
 * Get billing analytics for admin dashboard
 * @route GET /billing-analytics
 */
export const billingAnalytics = baseController.handleRequest(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Get billing analytics
  const result = await getBillingAnalytics(startDate, endDate);

  return baseController.sendSuccess(
    res,
    result.data,
    'Billing analytics retrieved successfully',
    HTTP_STATUS.OK
  );
});

/**
 * Get billing time-series data for charts
 * @route GET /subscribers-payments-graph
 */
export const billingTimeSeries = baseController.handleRequest(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Get billing time series
  const result = await getBillingTimeSeries(startDate, endDate);

  return baseController.sendSuccess(
    res,
    result.data,
    'Billing time series retrieved successfully',
    HTTP_STATUS.OK
  );
});
