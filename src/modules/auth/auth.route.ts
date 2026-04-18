import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { authorizeBranch } from '../../middleware/auth/authorizeBranch.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { 
  loginSchema, 
  refreshTokenSchema, 
  changePasswordSchema, 
  resetPasswordSchema 
} from './auth.schema.js';

export const authRouter = Router();
const authController = new AuthController();

// Rate limiter cho Login
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 5, // Tối đa 5 request / phút / IP
  message: { success: false, code: 'TOO_MANY_REQUESTS', message: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 1 phút.' }
});

// 0.1 Đăng nhập
authRouter.post('/login', loginLimiter, validate(loginSchema), authController.login);

// 0.2 Làm mới token (Không dùng authenticate, chỉ dùng schema validation)
authRouter.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// 0.3 Đăng xuất
authRouter.post('/logout', authenticate, validate(refreshTokenSchema), authController.logout);

// 0.4 Đổi mật khẩu của mình
authRouter.patch('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

// 0.5 Reset mật khẩu (Admin) - Cắm theo đúng Pipeline [SO] và [BO]
authRouter.post(
  '/reset-password/:userId',
  authenticate,
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER),
  authorizeBranch, 
  validate(resetPasswordSchema),
  authController.resetPassword
);