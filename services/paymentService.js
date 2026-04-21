import Stripe from 'stripe';
import { config } from '../config/env.js';
import { ERROR_MESSAGES, HTTP_STATUS } from '../constants/index.js';

// Initialize Stripe with secret key
const stripe = new Stripe(config.stripe.secretKey);

/**
 * Find existing Stripe customer or create new one
 * @param {string} email - Customer email
 * @param {string} name - Customer name
 * @param {string} userId - Internal user ID
 * @returns {Promise<Object>} Stripe customer object with id
 */
export const findOrCreateStripeCustomer = async (email, name, userId) => {
  try {
    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers && existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: email,
      name: name,
      description: 'Pixora user',
      metadata: {
        userId: userId,
        registrationDate: new Date().toISOString(),
      },
    });

    return customer;
  } catch (error) {
    const customError = new Error(`Failed to find or create Stripe customer: ${error.message}`);
    customError.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw customError;
  }
};

/**
 * Create Stripe checkout session
 * @param {string} email - Customer email
 * @param {string} planType - Plan type (starter, pro, enterprise)
 * @param {string} period - Billing period (monthly, yearly)
 * @param {string} userId - Internal user ID
 * @returns {Promise<Object>} Checkout session with id and url
 */
export const createCheckoutSession = async (email, planType, period, userId) => {
  try {
    // Get the correct price ID based on plan type and period
    const priceId = config.stripe.prices[planType]?.[period];
    
    if (!priceId) {
      const error = new Error(`Invalid plan configuration: ${planType} - ${period}`);
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      success_url: config.stripe.successUrl,
      cancel_url: config.stripe.cancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        email: email,
        userId: userId,
        billingPeriod: period,
        planType: planType,
      },
      currency: "usd",
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    const customError = new Error(`Failed to create checkout session: ${error.message}`);
    customError.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw customError;
  }
};

/**
 * Handle Stripe webhook events (future implementation)
 * @param {Buffer} rawBody - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Promise<Object>} Processing result
 */
export const handleWebhook = async (rawBody, signature) => {
  try {
    // Placeholder for future webhook signature verification
    // const event = stripe.webhooks.constructEvent(
    //   rawBody,
    //   signature,
    //   config.stripe.webhookSecret
    // );

    // Placeholder for event processing
    // switch (event.type) {
    //   case 'checkout.session.completed':
    //     // Handle successful checkout
    //     break;
    //   case 'customer.subscription.created':
    //     // Handle subscription creation
    //     break;
    //   case 'customer.subscription.updated':
    //     // Handle subscription update
    //     break;
    //   case 'customer.subscription.deleted':
    //     // Handle subscription cancellation
    //     break;
    //   default:
    //     console.log(`Unhandled event type: ${event.type}`);
    // }

    return { received: true };
  } catch (error) {
    const customError = new Error(`Webhook processing failed: ${error.message}`);
    customError.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw customError;
  }
};
