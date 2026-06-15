import { Request, Response, NextFunction } from 'express';
import { StudentService } from './student.service.js';
import { sendCreated, sendSuccess, sendPaginated } from '../../shared/utils/response.helper.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';

export class StudentController {
  private studentService: StudentService;

  constructor() {
    this.studentService = new StudentService();
  }

  createStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.studentService.createStudent(req.body, req.user);
      sendCreated(
        res,
        result,
        result.parent
          ? 'Đã tạo hồ sơ học sinh và tài khoản phụ huynh thành công'
          : 'Đã tạo hồ sơ học sinh thành công'
      );
    } catch (error) {
      next(error);
    }
  };

  addParent = async (req: Request<{ studentId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.studentService.addSecondParent(
        req.params.studentId,
        req.body,
        req.user
      );
      sendCreated(res, result, 'Thêm phụ huynh thành công');
    } catch (error) {
      next(error);
    }
  };

  getStudents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.studentService.getStudents(req.query, req.user);
      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
      sendPaginated(res, result.students, meta, 'Lấy danh sách học sinh thành công');
    } catch (error) {
      next(error);
    }
  };

  getStudentById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.studentService.getStudentById(req.params.id, req.user);
      sendSuccess(res, result, 'Lấy chi tiết học sinh thành công');
    } catch (error) {
      next(error);
    }
  };

  getMyOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.studentService.getMyOverview(req.user);
      sendSuccess(res, result, 'Lấy tổng quan học sinh thành công');
    } catch (error) {
      next(error);
    }
  };

  updateStudent = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.studentService.updateStudent(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Cập nhật hồ sơ học sinh thành công');
    } catch (error) {
      next(error);
    }
  };
}
