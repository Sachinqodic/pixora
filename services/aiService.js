import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import AiSuggestion from '../models/AiSuggestion.js';

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(config.security.geminiApiKey);

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
      !config.security.geminiApiKey ||
      config.security.geminiApiKey === 'your_gemini_api_key_here'
    ) {
      throw new Error('Google Gemini API key is missing');
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Fetch the image from URL
    const imageResponse = await fetch(mediaUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    // Determine MIME type from URL or default to jpeg
    const mimeType = mediaUrl.includes('.png')
      ? 'image/png'
      : mediaUrl.includes('.webp')
        ? 'image/webp'
        : 'image/jpeg';

    const prompt = `You are a creative assistant for a Pinterest-like platform called Pixora. 
Analyze the provided image and suggest:
1. A catchy title (max 100 characters)
2. A detailed description (2-3 sentences)
3. Exactly ONE category from this list: ${PIN_CATEGORIES.join(', ')}

Respond ONLY with valid JSON in this exact format:
{
  "title": "suggested title here",
  "description": "suggested description here",
  "category": "one category from the list"
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      },
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON from response (Gemini might wrap it in markdown)
    let content;
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      content = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : text);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      throw new Error('Invalid JSON response from Gemini');
    }

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
