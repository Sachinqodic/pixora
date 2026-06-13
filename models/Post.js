import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    title: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
      default: 'General',
    },

    media_url: {
      type: String,
      trim: true,
    },

    original_media_url: {
      type: String,
      trim: true,
    },

    resource_type: {
      type: String,
      trim: true,
    },

    file_size: {
      type: Number,
      default: 0,
      required: true,
      index: true, // Index for aggregation queries
    },

    status: {
      type: String,
      enum: ['processing', 'uploaded', 'ready', 'failed'],
      default: 'processing',
    },

    error_message: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Index on user_id for fast lookups of user's posts
postSchema.index({ user_id: 1 });

// Index on created_at for sorting posts by date
postSchema.index({ created_at: -1 });

// Text indexes for search functionality (full-word matches)
postSchema.index({ title: 'text', description: 'text', category: 'text' });

// Individual field indexes for regex search (partial matches)
postSchema.index({ title: 1 });
postSchema.index({ description: 1 });
postSchema.index({ category: 1 });

// Compound indexes for optimized queries
postSchema.index({ status: 1, created_at: -1 }); // For filtering and sorting

export default mongoose.model('Post', postSchema);
