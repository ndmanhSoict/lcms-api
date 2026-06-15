import app from './app.js';
import { env } from './config/env.validation.js';
import { connectMongoDB } from './infrastructure/mongodb.js';
import { initializeSocket } from './infrastructure/socket.js';
import logger from './shared/constants/logger.js';

const startServer = async () => {
  try {
    await connectMongoDB();

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server đang chạy tại http://localhost:${env.PORT}`);
    });
    initializeSocket(server);

    // Graceful Shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();
