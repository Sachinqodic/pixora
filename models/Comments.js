import mongoose from 'mongoose';

const CommentsSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    post_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },

    comments_text: {
      type: String,
      required: true,
      trim: true,
    },
    is_edited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Index on user_id
CommentsSchema.index({ user_id: 1 });

// Index on post_id
CommentsSchema.index({ post_id: 1 });

// Index on created_at for sorting posts by date
CommentsSchema.index({ created_at: -1 });

export default mongoose.model('Comments', CommentsSchema);
