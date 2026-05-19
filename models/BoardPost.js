import mongoose from 'mongoose';

const boardPostSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    board_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    post_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Compound index to prevent duplicate post in same board
boardPostSchema.index({ board_id: 1, post_id: 1 }, { unique: true });

const BoardPost = mongoose.model('BoardPost', boardPostSchema);

export default BoardPost;
