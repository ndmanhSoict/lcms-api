import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service.js';
import { sendCreated, sendSuccess, sendPaginated } from '../../shared/utils/response.helper.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.userService.createUser(req.body, req.user);
      sendCreated(res, result, 'Tạo tài khoản thành công');
    } catch (error) { next(error); }
  };

  getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.userService.getUsers(req.query, req.user);
      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
      sendPaginated(res, result.users, meta as any, 'Lấy danh sách người dùng thành công');
    } catch (error) { next(error); }
  };

  getUserById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.userService.getUserById(req.params.id, req.user);
      sendSuccess(res, result, 'Lấy chi tiết người dùng thành công');
    } catch (error) { next(error); }
  };

  updateUser = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.userService.updateUser(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Cập nhật người dùng thành công');
    } catch (error) { next(error); }
  };

  deactivateUser = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      await this.userService.deactivateUser(req.params.id, req.user);
      sendSuccess(res, { isActive: false }, 'Khóa tài khoản thành công');
    } catch (error) { next(error); }
  };
}