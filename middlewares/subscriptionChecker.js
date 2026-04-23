/**
 * Middleware to check if user's subscription has expired
 * This handles edge cases where webhooks fail or are missed
 * 
 * IMPORTANT: This is a safety net - webhooks should handle 99% of cases
 */

/**
 * Check if user's subscription has expired and downgrade if needed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const checkSubscriptionExpiry = async (req, res, next) => {
  try {
    // Only check if user is authenticated
    if (!req.user || !req.user._id) {
      return next();
    }

    const user = req.user;

    // Check if user has a canceled subscription with an end date
    if (
      user.subscription_status === 'canceled' &&
      user.plan_type !== 'free' &&
      user.subscription_end_date
    ) {
      const now = new Date();
      const endDate = new Date(user.subscription_end_date);

      // If subscription has expired, downgrade to free
      if (endDate <= now) {
        console.log(`⚠️  Subscription expired for user ${user.email} - downgrading to free (webhook missed)`);

        // Import User model
        const { default: User } = await import('../models/User.js');

        // Downgrade to free
        await User.findByIdAndUpdate(
          user._id,
          {
            plan_type: 'free',
            billing_period: null,
            subscription_status: 'canceled',
            subscription_end_date: null,
          },
          { new: true }
        );

        // Update req.user so current request sees the change
        req.user.plan_type = 'free';
        req.user.billing_period = null;
        req.user.subscription_status = 'canceled';
        req.user.subscription_end_date = null;
      }
    }

    next();
  } catch (error) {
    // Don't block the request if subscription check fails
    console.error('Error checking subscription expiry:', error);
    next();
  }
};

/**
 * Check if user has active paid access (including canceled but not expired)
 * @param {Object} user - User object from database
 * @returns {boolean} True if user has access, false otherwise
 */
export const hasActivePaidAccess = (user) => {
  if (!user) return false;

  // Free plan has no paid access
  if (user.plan_type === 'free') return false;

  // Active subscription
  if (user.subscription_status === 'active') return true;

  // Canceled but still within paid period
  if (
    user.subscription_status === 'canceled' &&
    user.subscription_end_date &&
    new Date(user.subscription_end_date) > new Date()
  ) {
    return true;
  }

  return false;
};

/**
 * Middleware to require active paid subscription
 * Use this to protect premium features
 */
export const requirePaidPlan = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!hasActivePaidAccess(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'This feature requires an active paid subscription',
      currentPlan: req.user.plan_type,
    });
  }

  next();
};

/**
 * Middleware to require specific plan type
 * @param {string[]} allowedPlans - Array of allowed plan types (e.g., ['pro', 'enterprise'])
 */
export const requirePlanType = (allowedPlans) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!hasActivePaidAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'This feature requires an active paid subscription',
        currentPlan: req.user.plan_type,
      });
    }

    if (!allowedPlans.includes(req.user.plan_type)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires one of these plans: ${allowedPlans.join(', ')}`,
        currentPlan: req.user.plan_type,
        requiredPlans: allowedPlans,
      });
    }

    next();
  };
};
