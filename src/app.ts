import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { NotFoundError } from './shared/errors/AllErrors.js';
import { appRouter } from './routes/index.js';
import { authenticate } from './middleware/auth/authenticate.middleware.js';
import { authorizeUpload } from './middleware/authorizeUpload.middleware.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(requestIdMiddleware);
app.use(
  '/uploads',
  authenticate,
  authorizeUpload,
  express.static(path.join(process.cwd(), 'uploads'))
);

app.use('/', appRouter);

app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl}`));
});

app.use(errorHandler);

export default app;
