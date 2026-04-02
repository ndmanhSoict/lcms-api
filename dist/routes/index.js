import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from '../modules/auth/auth.route.js';
import { branchRouter } from '../modules/branch/branch.route.js';
export const appRouter = Router();
const apiV1Router = Router();
appRouter.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/branch', branchRouter);
appRouter.use('/api/v1', apiV1Router);
//# sourceMappingURL=index.js.map