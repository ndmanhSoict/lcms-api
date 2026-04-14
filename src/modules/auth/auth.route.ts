import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { loginSchema, refreshTokenSchema } from './auth.schema.js';

export const authRouter = Router();
const authController = new AuthController();

authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
authRouter.post('/logout', validate(refreshTokenSchema), authController.logout);
