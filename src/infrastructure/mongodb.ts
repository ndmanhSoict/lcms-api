import mongoose from 'mongoose';
import { databaseConfig } from '../config/database.config.js';
import logger from '../shared/constants/logger.js';

export const connectMongoDB = async (): Promise<void> => {
  try {
    const { uri, options } = databaseConfig.mongodb;

    mongoose.connection.on('connected', () => {
      logger.info('Mongoose default connection open to MongoDB');
    });

    mongoose.connection.on('error', err => {
      logger.error(`Mongoose default connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose default connection disconnected');
    });

    await mongoose.connect(uri, options);
  } catch (error) {
    logger.error('❌ Lỗi khởi tạo kết nối MongoDB:', error);
    throw error;
  }
};
