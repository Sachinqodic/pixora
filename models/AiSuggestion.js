import mongoose from 'mongoose';

const aiSuggestionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
  },
  suggestions: {
    title: String,
    description: String,
    category: String,
  },
  error: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // Automatically delete after 1 hour to keep DB clean
  },
});

const AiSuggestion = mongoose.model('AiSuggestion', aiSuggestionSchema);

export default AiSuggestion;
