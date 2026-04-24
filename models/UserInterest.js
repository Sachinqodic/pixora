import mongoose from 'mongoose';

const userInterestSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index for fast lookups by user
    },

    interest: {
      type: [String], // Array of strings
      default: [],
      validate: {
        validator: function (arr) {
          // Ensure array doesn't exceed reasonable size
          return arr.length <= 50;
        },
        message: 'Cannot have more than 50 interests',
      },
    },
  },
  {
    // Automatically manage created_at and updated_at fields
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Index on user_id for fast lookups
userInterestSchema.index({ user_id: 1 });

// Compound index for user_id and created_at (for sorting)
userInterestSchema.index({ user_id: 1, created_at: -1 });

/**
 * ============================================================================
 * INSTANCE METHODS
 * ============================================================================
 */

/**
 * Add an interest to the array
 *
 * @param {string} newInterest - Interest to add
 * @returns {Promise<void>}
 */
userInterestSchema.methods.addInterest = async function (newInterest) {
  if (!this.interest.includes(newInterest)) {
    this.interest.push(newInterest);
    await this.save();
  }
};

export default mongoose.model('UserInterest', userInterestSchema);
