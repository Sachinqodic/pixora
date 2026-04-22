import Stripe from 'stripe';
import { config } from '../config/env.js';
import { ERROR_MESSAGES, HTTP_STATUS } from '../constants/index.js';

// Initialize Stripe with secret key
const stripe = new Stripe(config.stripe.secretKey);

/**
 * Check if customer has active subscription for the requested plan
 * @param {string} email - Customer email
 * @param {string} priceId - Stripe price ID to check
 * @returns {Promise<Object|null>} Active subscription if exists, null otherwise
 */
export const checkExistingSubscription = async (email, priceId) => {
  try {
    // Find customer by email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (!existingCustomers || existingCustomers.data.length === 0) {
      // No customer exists, so no subscription
      return null;
    }

    const customerId = existingCustomers.data[0].id;

    // Get all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });

    // Check for active subscriptions with the same price
    const activeSubscription = subscriptions.data.find(
      (sub) =>
        (sub.status === 'active') &&
        sub.items.data.some((item) => item.price.id === priceId)
    );

    return activeSubscription || null;
  } catch (error) {
    const customError = new Error(`Failed to check existing subscription: ${error.message}`);
    customError.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw customError;
  }
};

/**
 * Get any active subscription for customer (regardless of plan)
 * @param {string} email - Customer email
 * @returns {Promise<Object|null>} Active subscription if exists, null otherwise
 */
export const getActiveSubscription = async (email) => {
  try {
    // Find customer by email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (!existingCustomers || existingCustomers.data.length === 0) {
      return null;
    }

    const customerId = existingCustomers.data[0].id;

    // Get all active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    return subscriptions.data.length > 0 ? subscriptions.data[0] : null;
  } catch (error) {
    const customError = new Error(`Failed to get active subscription: ${error.message}`);
    customError.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw customError;
  }
};

/**
 * Upgrade/change subscription with proration
 * @param {string} email - Customer email
 * @param {string} newPriceId - New Stripe price ID
 * @param {string} planType - New plan type
 * @param {string} period - New billing period
 * @returns {Promise<Object>} Updated subscription details
 */
export const upgradeSubscription = async (email, newPriceId, planType, period) => {
  try {
    // Get the active subscription
    const activeSubscription = await getActiveSubscription(email);

    if (!activeSubscription) {
      const error = new Error('No active subscription found to upgrade');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    // Get the subscription item ID (first item)
    const subscriptionItemId = activeSubscription.items.data[0].id;

    // Update the subscription with proration
    const updatedSubscription = await stripe.subscriptions.update(
      activeSubscription.id,
      {
        items: [
          {
            id: subscriptionItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations', // Automatically prorate
        metadata: {
          planType: planType,
          billingPeriod: period,
          upgradedAt: new Date().toISOString(),
        },
      }
    );
    return {
      subscriptionId: updatedSubscription.id,
      status: updatedSubscription.status,
      currentPeriodEnd: updatedSubscription.current_period_end,
      planType: planType,
      period: period,
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    const customError = new Error(`Failed to upgrade subscription: ${error.message}`);
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

    // SCENARIO_1: Check if user already has an active subscription for this exact plan
    const existingSubscription = await checkExistingSubscription(email, priceId);
    
    if (existingSubscription) {
      const error = new Error(
        `You already have an active ${planType} ${period} subscription. Please manage your existing subscription instead.`
      );
      error.statusCode = HTTP_STATUS.CONFLICT;
      throw error;
    }

    // SCENARIO_2: Check if user has ANY active subscription (for upgrade/change)
    const activeSubscription = await getActiveSubscription(email);
    
    if (activeSubscription) {
      // User has a different plan - upgrade with proration instead of creating new checkout
      const result = await upgradeSubscription(email, priceId, planType, period);
      return {
        upgraded: true,
        ...result,
      };
    }

    // No existing subscription - create new checkout session
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
 * Create Stripe Customer Portal session for managing subscriptions
 * @param {string} email - Customer email
 * @returns {Promise<Object>} Portal session with url
 */
export const createCustomerPortalSession = async (email) => {
  try {
    // Find customer by email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (!existingCustomers || existingCustomers.data.length === 0) {
      const error = new Error('No customer found. Please subscribe to a plan first.');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    const customerId = existingCustomers.data[0].id;

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: config.stripe.portalReturnUrl,
    });

    return {
      url: session.url,
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    const customError = new Error(`Failed to create customer portal session: ${error.message}`);
    customError.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw customError;
  }
};

/**
 * Handle Stripe webhook events
 * @param {Buffer} rawBody - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Promise<Object>} Processing result
 */
export const handleWebhook = async (rawBody, signature) => {
  try {
    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        config.stripe.webhookSecret
      );
    } catch (err) {
      const error = new Error(`Webhook signature verification failed: ${err.message}`);
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    // Import User model
    const { default: User } = await import('../models/User.js');

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        // First payment completed
        const session = event.data.object;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const metadata = session.metadata;

        if (customerEmail && metadata) {
          await User.findOneAndUpdate(
            { email: customerEmail },
            {
              plan_type: metadata.planType || 'free',
              billing_period: metadata.billingPeriod || null,
              subscription_status: 'active',
              subscription_end_date: null, // Will be set by subscription.created event
            },
            { new: true }
          );
        }
        break;
      }

      case 'customer.subscription.created': {
        
        // Subscription created (set end date)
        const subscription = event.data.object;
        
        // Get current_period_end from items.data[0] or top level
        const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end;
        
        const customer = await stripe.customers.retrieve(subscription.customer);
        
        if (customer.email) {
          const endDate = periodEnd 
            ? new Date(periodEnd * 1000) 
            : null;
                      
          await User.findOneAndUpdate(
            { email: customer.email },
            {
              subscription_status: subscription.status,
              subscription_end_date: endDate,
            },
            { new: true }
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Subscription updated (upgrade/downgrade/renewal)
        const subscription = event.data.object;
        
        // Get current_period_end from items.data[0] or top level
        const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end;
      
        const customer = await stripe.customers.retrieve(subscription.customer);
        
        if (customer.email) {
          // Get plan type and period from subscription metadata or price
          const priceId = subscription.items.data[0]?.price.id;
          const metadata = subscription.metadata;
          
          const endDate = periodEnd 
            ? new Date(periodEnd * 1000) 
            : null;
                    
          await User.findOneAndUpdate(
            { email: customer.email },
            {
              plan_type: metadata.planType || 'free',
              billing_period: metadata.billingPeriod || null,
              subscription_status: subscription.status,
              subscription_end_date: endDate,
            },
            { new: true }
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled or expired
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        
        if (customer.email) {
          await User.findOneAndUpdate(
            { email: customer.email },
            {
              plan_type: 'free',
              billing_period: null,
              subscription_status: 'canceled',
              subscription_end_date: null,
            },
            { new: true }
          );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Payment succeeded (renewal or upgrade)
        const invoice = event.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);
        
        if (customer.email && invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          
          // Get current_period_end from items.data[0] or top level
          const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end;
          
          const endDate = periodEnd 
            ? new Date(periodEnd * 1000) 
            : null;
                    
          await User.findOneAndUpdate(
            { email: customer.email },
            {
              subscription_status: 'active',
              subscription_end_date: endDate,
            },
            { new: true }
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        // Payment failed (card declined, expired, etc.)
        const invoice = event.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);
        
        if (customer.email) {
          await User.findOneAndUpdate(
            { email: customer.email },
            {
              subscription_status: 'past_due',
            },
            { new: true }
          );
          
          // TODO: Send email notification to user about payment failure
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true, type: event.type };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    const customError = new Error(`Webhook processing failed: ${error.message}`);
    customError.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw customError;
  }
};
