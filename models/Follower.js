import mongoose from 'mongoose';

const followerSchema = new mongoose.Schema(
  {
    follower_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    following_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Index on follower_id
followerSchema.index({ follower_id: 1 });

// Index on following_id
followerSchema.index({ following_id: 1 });

// Unique index to prevent duplicate followings
followerSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });

export default mongoose.model('Follower', followerSchema);
