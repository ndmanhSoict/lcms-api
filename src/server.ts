import mongoose from 'mongoose';
import 'dotenv/config';
import app from './app.js';
import { env } from './config/env.validation.js';
import logger from './shared/constants/logger.js';

const PORT = env.PORT || 3003;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info(`✅ Kết nối MongoDB thành công: ${conn.connection.host}`);
  } catch (error) {
    logger.error('❌ Lỗi kết nối MongoDB:', error);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  });

  // Xử lý Graceful Shutdown (Tắt server an toàn khi có sự cố)
  process.on('unhandledRejection', err => {
    logger.error('UNHANDLED REJECTION! 💥 Đang tắt server...');
    console.error(err);
    server.close(() => {
      process.exit(1);
    });
  });
};

startServer();
