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
      const result = await this.authService.login(req.body, req.ip, req.headers['user-agent']);
      sendSuccess(res, result, 'Đăng nhập thành công');
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.refreshToken(req.body.refreshToken);
      sendSuccess(res, result, 'Làm mới token thành công');
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Sửa: Truyền toàn bộ req.user thay vì chỉ lấy req.user.id
      await this.authService.logout(req.body.refreshToken, req.user!);
      
      sendSuccess(res, null, 'Đăng xuất thành công');
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.changePassword(req.user!.id, req.body);
      sendSuccess(res, null, 'Đổi mật khẩu thành công');
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user!.id;
      const adminRole = req.user!.role;
      const adminBranchId = req.user!.branchId as string;
      const targetUserId = req.params.userId as string;

      await this.authService.resetPassword(adminId, adminRole, adminBranchId, targetUserId, req.body.newPassword);
      sendSuccess(res, null, 'Reset mật khẩu thành công');
    } catch (error) {
      next(error);
    }
  };
}