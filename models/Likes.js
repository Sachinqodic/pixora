import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        post_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
            required: true
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

// Index on user_id 
likeSchema.index({ user_id: 1 });

// Index on post_id 
likeSchema.index({ post_id: 1 });

// Unique index to prevent duplicate likes by the same user on the same post
likeSchema.index({ user_id: 1, post_id: 1 }, { unique: true });

// Index on created_at for sorting posts by date
likeSchema.index({ created_at: -1 });

export default mongoose.model('Like', likeSchema);
