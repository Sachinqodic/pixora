import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    
    password_hash: {
      type: String,
      required: true,
      select: false // Don't include password hash in queries by default
    },
    
    is_email_verified: {
      type: Boolean,
      default: false
    },
    
    plan_type: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'], // Database-level constraint
      default: 'free',
      lowercase: true
    },
    
    storage_used: {
      type: Number,
      default: 0,
      min: 0 // Database-level constraint
    },
    
    role: {
      type: String,
      enum: ['user', 'admin'], // Database-level constraint
      default: 'user',
      lowercase: true
    },
    
    last_logged_in: {
      type: Date,
      default: null
    },
    
    is_active: {
      type: Boolean,
      default: true
    },
    
    profile_url: {
      type: String,
      default: null
    },
    
    deleted_at: {
      type: Date,
      default: null
    }
  },
  {
    // Automatically manage created_at and updated_at fields
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

/**
 * Indexes improve query performance for common access patterns
 */

// Unique index on email for fast lookups and uniqueness constraint
userSchema.index({ email: 1 }, { unique: true });

// Index on is_active for filtering active/inactive users
userSchema.index({ is_active: 1 });

// Compound index for active users by plan type (common query pattern)
userSchema.index({ is_active: 1, plan_type: 1 });


/**
 * ============================================================================
 * INSTANCE METHODS
 * ============================================================================
 */

/**
 * Get public profile (without sensitive data)
 * 
 * @returns {Object} User object without password_hash
 */
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password_hash;
  return userObject;
};



export default mongoose.model('User', userSchema);
