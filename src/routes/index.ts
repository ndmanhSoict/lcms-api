import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from '../modules/auth/auth.route.js'; 

export const appRouter = Router();

const apiV1Router = Router();
appRouter.use('/health', healthRouter);

apiV1Router.use('/auth', authRouter);

appRouter.use('/api/v1', apiV1Router);