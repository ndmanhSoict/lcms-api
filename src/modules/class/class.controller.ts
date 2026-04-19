import { Request, Response, NextFunction } from 'express';
import { ClassService } from './class.service.js';
import { sendCreated, sendSuccess, sendPaginated } from '../../shared/utils/response.helper.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';

export class ClassController {
  private classService: ClassService;

  constructor() {
    this.classService = new ClassService();
  }

  createClass = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.classService.createClass(req.body, req.user);
      sendCreated(res, result, 'Tạo lớp học thành công');
    } catch (error) { next(error); }
  };

  getClasses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.classService.getClasses(req.query, req.user);
      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
      sendPaginated(res, result.classes, meta as any, 'Lấy danh sách lớp học thành công');
    } catch (error) { next(error); }
  };

  getClassById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.classService.getClassById(req.params.id, req.user);
      sendSuccess(res, result, 'Lấy chi tiết lớp học thành công');
    } catch (error) { next(error); }
  };

  updateClass = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.classService.updateClass(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Cập nhật lớp học thành công');
    } catch (error) { next(error); }
  };

  closeClass = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.classService.closeClass(req.params.id, req.body.reason, req.user);
      sendSuccess(res, result, 'Đóng lớp học thành công');
    } catch (error) { next(error); }
  };

  getClassStudents = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.classService.getClassStudents(req.params.id, req.query, req.user);
      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
      sendPaginated(res, result.enrollments, meta as any, 'Lấy danh sách học sinh thành công');
    } catch (error) { next(error); }
  };
}