import { Request, Response, NextFunction } from 'express';
import { TeacherService } from './teacher.service.js';
import { sendCreated, sendSuccess, sendPaginated } from '../../shared/utils/response.helper.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';

export class TeacherController {
  private service: TeacherService;

  constructor() {
    this.service = new TeacherService();
  }

  createTeacher = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createTeacher(req.body, req.user);
      sendCreated(res, result, 'Tạo giáo viên thành công');
    } catch (error) { next(error); }
  };

  getTeachers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getTeachers(req.query, req.user);
      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
      sendPaginated(res, result.teachers, meta as any, 'Lấy danh sách giáo viên thành công');
    } catch (error) { next(error); }
  };

  getTeacherById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getTeacherById(req.params.id, req.user);
      sendSuccess(res, result, 'Lấy thông tin giáo viên thành công');
    } catch (error) { next(error); }
  };

  getMyOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMyOverview(req.user);
      sendSuccess(res, result, 'Lấy tổng quan giáo viên thành công');
    } catch (error) { next(error); }
  };

  updateTeacher = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.updateTeacher(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Cập nhật giáo viên thành công');
    } catch (error) { next(error); }
  };

  deleteTeacher = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.deleteTeacher(req.params.id, req.user);
      sendSuccess(res, result, 'Xóa giáo viên thành công');
    } catch (error) { next(error); }
  };
}
