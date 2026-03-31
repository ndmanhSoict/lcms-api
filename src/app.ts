import express from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { NotFoundError } from './shared/errors/AllErrors.js';
import { appRouter } from './routes/index.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(requestIdMiddleware);

app.use('/', appRouter);

app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl}`));
});

app.use(errorHandler);

export default app;
