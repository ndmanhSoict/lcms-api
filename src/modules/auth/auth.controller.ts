import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../shared/utils/response.helper.js';
import { AuthService } from './auth.service.js';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Dữ liệu đã được kiểm tra qua validate.middleware
      const result = await this.authService.login(req.body);

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
        'Đăng nhập thành công'
      );
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.body.refreshToken;
      const result = await this.authService.refreshToken(token);

      sendSuccess(
        res,
        {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        },
        'Làm mới token thành công'
      );
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, null, 'Đăng xuất thành công');
    } catch (error) {
      next(error);
    }
  };
}
