import { NUMERIC_CONSTANTS } from '../constants/index.js';

/**
 * Fetch ALL records from Stripe API with automatic pagination
 */
export const fetchAllStripeRecords = async (listFunction, params) => {
  const allRecords = [];
  let hasMore = true;
  let startingAfter = null;

  while (hasMore) {
    const response = await listFunction({
      ...params,
      limit: NUMERIC_CONSTANTS.PAGINATION_MAX_LIMIT, // Fetch 100 at a time
      ...(startingAfter && { starting_after: startingAfter }),
    });

    allRecords.push(...response.data);
    hasMore = response.has_more;
    
    if (hasMore && response.data.length > NUMERIC_CONSTANTS.DEFAULT_VALUE) {
      startingAfter = response.data[response.data.length - NUMERIC_CONSTANTS.DEFAULT_INDEX].id;
    }
  }

  return allRecords;
};
