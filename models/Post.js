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

export default mongoose.model('Post', postSchema);
