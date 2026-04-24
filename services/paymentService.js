import Stripe from 'stripe';
import { config } from '../config/env.js';
import { fetchAllStripeRecords } from '../utils/stripeUtils.js';
import { ERROR_MESSAGES, HTTP_STATUS, NUMERIC_CONSTANTS } from '../constants/index.js';

// Initialize Stripe with secret key
const stripe = new Stripe(config.stripe.secretKey);

/**
 * Helper function to get plan details from Stripe price ID
 */
const getPlanDetailsFromPriceId = (priceId) => {
  // Reverse lookup: find which plan and period matches this price ID
  for (const [planType, periods] of Object.entries(config.stripe.prices)) {
    for (const [period, id] of Object.entries(periods)) {
      if (id === priceId) {
        return { planType, billingPeriod: period };
      }
    }
  }

  // Default to free if price ID not found
  return { planType: 'free', billingPeriod: null };
};

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
      limit: NUMERIC_CONSTANTS.DEFAULT_INDEX,
    });

    if (!existingCustomers || existingCustomers.data.length === NUMERIC_CONSTANTS.DEFAULT_VALUE) {
      // No customer exists, so no subscription
      return null;
    }

    const customerId = existingCustomers.data[NUMERIC_CONSTANTS.DEFAULT_VALUE].id;

    // Get all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: NUMERIC_CONSTANTS.PAGINATION_MAX_LIMIT,
    });

    // Check for active subscriptions with the same price
    const activeSubscription = subscriptions.data.find(
      (sub) => sub.status === 'active' && sub.items.data.some((item) => item.price.id === priceId)
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
      limit: NUMERIC_CONSTANTS.DEFAULT_INDEX,
    });

    if (!existingCustomers || existingCustomers.data.length === NUMERIC_CONSTANTS.DEFAULT_VALUE) {
      return null;
    }

    const customerId = existingCustomers.data[NUMERIC_CONSTANTS.DEFAULT_VALUE].id;

    // Get all active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: NUMERIC_CONSTANTS.DEFAULT_INDEX,
    });

    return subscriptions.data.length > NUMERIC_CONSTANTS.DEFAULT_VALUE
      ? subscriptions.data[NUMERIC_CONSTANTS.DEFAULT_VALUE]
      : null;
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
    const subscriptionItemId = activeSubscription.items.data[NUMERIC_CONSTANTS.DEFAULT_VALUE].id;

    // Update the subscription with proration
    const updatedSubscription = await stripe.subscriptions.update(activeSubscription.id, {
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
    });
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
          quantity: NUMERIC_CONSTANTS.DEFAULT_INDEX,
        },
      ],
      metadata: {
        email: email,
        userId: userId,
        billingPeriod: period,
        planType: planType,
      },
      currency: 'usd',
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
      limit: NUMERIC_CONSTANTS.DEFAULT_INDEX,
    });

    if (!existingCustomers || existingCustomers.data.length === NUMERIC_CONSTANTS.DEFAULT_VALUE) {
      const error = new Error('No customer found. Please subscribe to a plan first.');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    const customerId = existingCustomers.data[NUMERIC_CONSTANTS.DEFAULT_VALUE].id;

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
 * Get comprehensive billing analytics for admin dashboard
 * @param {string} startDate - Start date (ISO format or timestamp)
 * @param {string} endDate - End date (ISO format or timestamp)
 * @returns {Promise<Object>} Complete billing analytics
 */
export const getBillingAnalytics = async (startDate, endDate) => {
  try {
    // Convert dates to Unix timestamps
    const startTimestamp = Math.floor(
      new Date(startDate).getTime() / NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE
    );
    const endTimestamp = Math.floor(
      new Date(endDate).getTime() / NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE
    );

    // Call all Stripe APIs in parallel for better performance
    const [
      paidInvoicesData,
      failedInvoicesData,
      balanceTransactionsData,
      activeSubscriptionsData,
      canceledSubscriptionsData,
      allCustomersData,
      refundsData,
    ] = await Promise.all([
      // Paid invoices - fetch ALL records with pagination
      fetchAllStripeRecords(stripe.invoices.list.bind(stripe.invoices), {
        status: 'paid',
        created: { gte: startTimestamp, lte: endTimestamp },
      }),
      // Failed/open invoices - fetch ALL records with pagination
      fetchAllStripeRecords(stripe.invoices.list.bind(stripe.invoices), {
        status: 'open',
        created: { gte: startTimestamp, lte: endTimestamp },
      }),
      // Balance transactions (for net revenue and fees) - fetch ALL records with pagination
      fetchAllStripeRecords(stripe.balanceTransactions.list.bind(stripe.balanceTransactions), {
        created: { gte: startTimestamp, lte: endTimestamp },
        type: 'charge',
      }),
      // Active subscriptions - fetch ALL records with pagination
      fetchAllStripeRecords(stripe.subscriptions.list.bind(stripe.subscriptions), {
        status: 'active',
        created: { gte: startTimestamp, lte: endTimestamp },
      }),
      // Canceled subscriptions (churned customers) - fetch ALL records with pagination
      fetchAllStripeRecords(stripe.subscriptions.list.bind(stripe.subscriptions), {
        status: 'canceled',
        created: { gte: startTimestamp, lte: endTimestamp },
      }),
      // All customers created in period - fetch ALL records with pagination
      fetchAllStripeRecords(stripe.customers.list.bind(stripe.customers), {
        created: { gte: startTimestamp, lte: endTimestamp },
      }),
      // Refunds - fetch ALL records with pagination
      fetchAllStripeRecords(stripe.refunds.list.bind(stripe.refunds), {
        created: { gte: startTimestamp, lte: endTimestamp },
      }),
    ]);

    // ========== REVENUE METRICS ==========
    const totalRevenue =
      paidInvoicesData.reduce(
        (sum, inv) => sum + inv.amount_paid,
        NUMERIC_CONSTANTS.DEFAULT_VALUE
      ) / NUMERIC_CONSTANTS.PAGINATION_MAX_LIMIT;
    const netRevenue =
      balanceTransactionsData.reduce((sum, txn) => sum + txn.net, NUMERIC_CONSTANTS.DEFAULT_VALUE) /
      NUMERIC_CONSTANTS.PAGINATION_MAX_LIMIT;
    const stripeFees =
      balanceTransactionsData.reduce((sum, txn) => sum + txn.fee, NUMERIC_CONSTANTS.DEFAULT_VALUE) /
      NUMERIC_CONSTANTS.PAGINATION_MAX_LIMIT;
    const totalRefunds =
      refundsData.reduce((sum, refund) => sum + refund.amount, NUMERIC_CONSTANTS.DEFAULT_VALUE) /
      NUMERIC_CONSTANTS.PAGINATION_MAX_LIMIT;

    // ========== BILL METRICS ==========
    const totalBillsPaid = Number(paidInvoicesData.length);
    const totalBillsFailed = Number(failedInvoicesData.length);
    const averageBillAmount =
      totalBillsPaid > NUMERIC_CONSTANTS.DEFAULT_VALUE
        ? totalRevenue / totalBillsPaid
        : NUMERIC_CONSTANTS.DEFAULT_VALUE;

    // ========== CUSTOMER METRICS ==========
    const newCustomers = Number(allCustomersData.length);
    const churnedCustomers = Number(canceledSubscriptionsData.length);
    const activeSubscriptionsCount = Number(activeSubscriptionsData.length);

    // ========== GROWTH METRICS ==========
    // MRR: Sum of all monthly recurring revenue from active subscriptions
    const mrr =
      activeSubscriptionsData.reduce((sum, sub) => {
        const amount =
          sub.items.data[NUMERIC_CONSTANTS.DEFAULT_VALUE]?.price?.unit_amount ||
          NUMERIC_CONSTANTS.DEFAULT_VALUE;
        const interval =
          sub.items.data[NUMERIC_CONSTANTS.DEFAULT_VALUE]?.price?.recurring?.interval;

        // Convert yearly to monthly
        if (interval === 'year') {
          return sum + amount / NUMERIC_CONSTANTS.MONTHS_IN_YEAR;
        }
        return sum + amount;
      }, NUMERIC_CONSTANTS.DEFAULT_VALUE) / NUMERIC_CONSTANTS.PAGINATION_MAX_LIMIT;

    // ARR: Annual Recurring Revenue
    const arr = mrr * NUMERIC_CONSTANTS.MONTHS_IN_YEAR;

    // ========== RETURN COMPLETE ANALYTICS ==========
    return {
      success: true,
      data: {
        dateRange: {
          startDate: new Date(startTimestamp * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE).toISOString(),
          endDate: new Date(endTimestamp * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE).toISOString(),
        },
        revenueMetrics: {
          totalRevenue: parseFloat(totalRevenue.toFixed(NUMERIC_CONSTANTS.DECIMAL_PLACES)),
          netRevenue: parseFloat(netRevenue.toFixed(NUMERIC_CONSTANTS.DECIMAL_PLACES)),
          stripeFees: parseFloat(stripeFees.toFixed(NUMERIC_CONSTANTS.DECIMAL_PLACES)),
          totalRefunds: parseFloat(totalRefunds.toFixed(NUMERIC_CONSTANTS.DECIMAL_PLACES)),
        },
        billMetrics: {
          totalBillsPaid,
          totalBillsFailed,
          averageBillAmount: parseFloat(
            averageBillAmount.toFixed(NUMERIC_CONSTANTS.DECIMAL_PLACES)
          ),
        },
        customerMetrics: {
          newCustomers,
          churnedCustomers,
          activeSubscriptions: activeSubscriptionsCount,
        },
        growthMetrics: {
          mrr: parseFloat(mrr.toFixed(NUMERIC_CONSTANTS.DECIMAL_PLACES)),
          arr: parseFloat(arr.toFixed(NUMERIC_CONSTANTS.DECIMAL_PLACES)),
        },
      },
    };
  } catch (error) {
    const customError = new Error(`Failed to get billing analytics: ${error.message}`);
    customError.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    throw customError;
  }
};

/**
 * Get time-series billing data for charts (New Subscribers vs Payments)
 * @param {string} startDate - Start date (ISO format or timestamp)
 * @param {string} endDate - End date (ISO format or timestamp)
 * @returns {Promise<Object>} Time-series data grouped by month
 */
export const getBillingTimeSeries = async (startDate, endDate) => {
  try {
    // Convert dates to Unix timestamps
    const startTimestamp = Math.floor(
      new Date(startDate).getTime() / NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE
    );
    const endTimestamp = Math.floor(
      new Date(endDate).getTime() / NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE
    );

    // Fetch subscriptions and invoices in parallel
    const [subscriptionsData, invoicesData] = await Promise.all([
      fetchAllStripeRecords(stripe.subscriptions.list.bind(stripe.subscriptions), {
        created: { gte: startTimestamp, lte: endTimestamp },
      }),
      fetchAllStripeRecords(stripe.invoices.list.bind(stripe.invoices), {
        status: 'paid',
        created: { gte: startTimestamp, lte: endTimestamp },
      }),
    ]);

    // Generate month labels and periods for the date range
    const start = new Date(startTimestamp * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE);
    const end = new Date(endTimestamp * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE);
    const dataPoints = [];

    let currentDate = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), NUMERIC_CONSTANTS.DEFAULT_INDEX)
    );

    while (currentDate <= end) {
      const year = currentDate.getUTCFullYear();
      const month = currentDate.getUTCMonth();

      // Calculate period start and end using UTC to avoid timezone issues
      const periodStart = new Date(Date.UTC(year, month, NUMERIC_CONSTANTS.DEFAULT_INDEX));
      const periodEnd = new Date(
        Date.UTC(year, month + NUMERIC_CONSTANTS.DEFAULT_INDEX, NUMERIC_CONSTANTS.DEFAULT_VALUE)
      );

      // Get last day of month properly
      const lastDay = new Date(
        Date.UTC(year, month + NUMERIC_CONSTANTS.DEFAULT_INDEX, NUMERIC_CONSTANTS.DEFAULT_VALUE)
      ).getUTCDate();
      const periodEndDate = new Date(Date.UTC(year, month, lastDay));

      // Format xAxisLabel (e.g., "Jan21", "Feb21")
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const xAxisLabel = `${monthNames[month]}${year.toString().slice(-NUMERIC_CONSTANTS.DECIMAL_PLACES)}`;

      // Count new subscribers in this period
      const newSubscribers = subscriptionsData.filter((sub) => {
        const subDate = new Date(sub.created * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE);
        return subDate >= periodStart && subDate < periodEnd;
      }).length;

      // Count payments in this period
      const payments = invoicesData.filter((inv) => {
        const invDate = new Date(inv.created * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE);
        return invDate >= periodStart && invDate < periodEnd;
      }).length;

      // Format dates as YYYY-MM-DD
      const formatDate = (date) => {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + NUMERIC_CONSTANTS.DEFAULT_INDEX).padStart(
          NUMERIC_CONSTANTS.DECIMAL_PLACES,
          '0'
        );
        const d = String(date.getUTCDate()).padStart(NUMERIC_CONSTANTS.DECIMAL_PLACES, '0');
        return `${y}-${m}-${d}`;
      };

      dataPoints.push({
        xAxisLabel,
        period: {
          startDate: formatDate(periodStart),
          endDate: formatDate(periodEndDate),
        },
        newSubscribers,
        payments,
      });

      // Move to next month
      currentDate = new Date(
        Date.UTC(year, month + NUMERIC_CONSTANTS.DEFAULT_INDEX, NUMERIC_CONSTANTS.DEFAULT_INDEX)
      );
    }

    return {
      success: true,
      data: {
        dateRange: {
          startDate: new Date(startTimestamp * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE).toISOString(),
          endDate: new Date(endTimestamp * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE).toISOString(),
        },
        dataPoints,
      },
    };
  } catch (error) {
    const customError = new Error(`Failed to get billing time series: ${error.message}`);
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
      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
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
        const periodEnd =
          subscription.items?.data?.[NUMERIC_CONSTANTS.DEFAULT_VALUE]?.current_period_end ||
          subscription.current_period_end;

        const customer = await stripe.customers.retrieve(subscription.customer);

        if (customer.email) {
          const endDate = periodEnd
            ? new Date(periodEnd * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE)
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
        const periodEnd =
          subscription.items?.data?.[NUMERIC_CONSTANTS.DEFAULT_VALUE]?.current_period_end ||
          subscription.current_period_end;

        const customer = await stripe.customers.retrieve(subscription.customer);

        if (customer.email) {
          // Get price ID from subscription
          const priceId = subscription.items.data[NUMERIC_CONSTANTS.DEFAULT_VALUE]?.price.id;

          // Get plan details from price ID (reverse lookup)
          const { planType, billingPeriod } = getPlanDetailsFromPriceId(priceId);

          // Try to get from metadata first, fallback to price ID lookup
          const finalPlanType = subscription.metadata?.planType || planType;
          const finalBillingPeriod = subscription.metadata?.billingPeriod || billingPeriod;

          const endDate = periodEnd
            ? new Date(periodEnd * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE)
            : null;

          await User.findOneAndUpdate(
            { email: customer.email },
            {
              plan_type: finalPlanType,
              billing_period: finalBillingPeriod,
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

          // Get price ID from subscription
          const priceId = subscription.items.data[NUMERIC_CONSTANTS.DEFAULT_VALUE]?.price.id;

          // Get plan details from price ID (reverse lookup)
          const { planType, billingPeriod } = getPlanDetailsFromPriceId(priceId);

          // Try to get from metadata first, fallback to price ID lookup
          const finalPlanType = subscription.metadata?.planType || planType;
          const finalBillingPeriod = subscription.metadata?.billingPeriod || billingPeriod;

          // Get current_period_end from items.data[0] or top level
          const periodEnd =
            subscription.items?.data?.[NUMERIC_CONSTANTS.DEFAULT_VALUE]?.current_period_end ||
            subscription.current_period_end;

          const endDate = periodEnd
            ? new Date(periodEnd * NUMERIC_CONSTANTS.DEFAULT_LARGE_VALUE)
            : null;

          await User.findOneAndUpdate(
            { email: customer.email },
            {
              plan_type: finalPlanType,
              billing_period: finalBillingPeriod,
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
