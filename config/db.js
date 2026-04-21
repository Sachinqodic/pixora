import mongoose from 'mongoose';
import { config } from './env.js';

const connectDB = async () => {
  try {
    await mongoose.connect(config.database.url, config.database.options);
    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1;
};

export const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log(' MongoDB connection closed');
  } catch (error) {
    console.error(' Error closing MongoDB connection:', error.message);
    throw error;
  }
};

export default connectDB;
