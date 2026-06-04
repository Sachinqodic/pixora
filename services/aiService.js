import OpenAI from 'openai';
import { config } from '../config/env.js';
import AiSuggestion from '../models/AiSuggestion.js';

const openai = new OpenAI({
  apiKey: config.security.openaiApiKey,
});

/**
 * Valid categories for Pins
 */
export const PIN_CATEGORIES = [
  'Nature',
  'Travel',
  'Food & Drink',
  'Fashion',
  'Technology',
  'Art',
  'Architecture',
  'Fitness',
  'Home Decor',
  'Photography',
  'DIY & Crafts',
  'Design',
  'Quotes',
  'Cars',
  'Animals',

  // NEW categories (popular on Pinterest)
  'Beauty & Makeup',
  'Wedding Planning',
  'Parenting & Kids',
  'Education & Learning',
  'Business & Finance',
  'Gardening',
  'Books & Reading',
  'Music',
  'Gaming',
  'Sports',
  'Health & Wellness',
  'Recipes & Cooking',
  'Interior Design',
  'Tattoos & Body Art',
  'Hair & Hairstyles',
  'Jewelry & Accessories',
  'Outdoor & Camping',
  'Pets & Pet Care',
  'Holidays & Events',
  'Minimalism & Organization',
];

/**
 * Background worker to process AI suggestions.
 * This function updates the AiSuggestion document in the database when finished.
 *
 * @param {string} suggestionId - The MongoDB ID of the AiSuggestion record
 * @param {string} mediaUrl - The S3 Presigned URL of the media
 */
export const processAiSuggestionInBackground = async (suggestionId, mediaUrl) => {
  try {
    console.log(`[AI Worker] Starting suggestion process for: ${suggestionId}`);

    const suggestions = await generatePinMetadata(mediaUrl);

    // Update the database record
    await AiSuggestion.findByIdAndUpdate(suggestionId, {
      status: 'completed',
      suggestions: suggestions,
    });

    console.log(`[AI Worker] Successfully completed suggestion for: ${suggestionId}`);
  } catch (error) {
    console.error(`[AI Worker] Failed for ${suggestionId}:`, error.message);

    await AiSuggestion.findByIdAndUpdate(suggestionId, {
      status: 'failed',
      error: error.message,
    });
  }
};

/**
 * Generate suggested metadata (title, description, category) from an image or video frame URL.
 *
 * @param {string} mediaUrl - The URL of the image (S3 Presigned URL)
 * @returns {Promise<Object>} - Suggested metadata
 */
export const generatePinMetadata = async (mediaUrl) => {
  try {
    if (
      !config.security.openaiApiKey ||
      config.security.openaiApiKey === 'your_openai_api_key_here'
    ) {
      throw new Error('OpenAI API key is missing');
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a creative assistant for a Pinterest-like platform called Pixora. 
          Analyze the provided image and suggest a catchy title, a detailed 2-sentence description, and exactly one category from the following list: ${PIN_CATEGORIES.join(', ')}.
          Your response must be in JSON format.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please analyze this image and suggest metadata for a Pin.' },
            {
              type: 'image_url',
              image_url: {
                url: mediaUrl, // Using S3 URL instead of Base64
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = JSON.parse(response.choices[0].message.content);

    // Normalize keys to lowercase/standard names
    return {
      title: content.title || content.suggested_title || 'New Pin',
      description: content.description || content.suggested_description || '',
      category: content.category || 'Photography',
    };
  } catch (error) {
    console.error('Error generating AI metadata:', error.message);
    throw error; // Rethrow to let the worker handle it
  }
};
