import express, { Request, Response } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { NotFoundError } from './shared/errors/AllErrors.js';

const app = express();

// 1. Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(requestIdMiddleware);

// 2. Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Hệ thống LCMS API đang hoạt động!',
  });
});

app.use('/health', healthRouter);

// 3. Handle 404 Not Found
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl}`));
});

// 4. Global Error Handler (Luôn đặt cuối cùng)
app.use(errorHandler); //

export default app;
