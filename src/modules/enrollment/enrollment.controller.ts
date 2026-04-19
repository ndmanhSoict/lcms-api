import { Request, Response, NextFunction } from 'express';
import { EnrollmentService } from './enrollment.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class EnrollmentController {
  private enrollmentService: EnrollmentService;

  constructor() {
    this.enrollmentService = new EnrollmentService();
  }

  enrollStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.enrollmentService.enrollStudent(req.body, req.user);
      sendCreated(res, result, 'Xếp lớp thành công. Đã gửi thông báo lịch học cho học sinh và phụ huynh.');
    } catch (error) { next(error); }
  };

  leaveClass = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      await this.enrollmentService.leaveClass(req.params.id, req.body, req.user);
      sendSuccess(res, null, 'Đã rút học sinh khỏi lớp');
    } catch (error) { next(error); }
  };

  getStudentEnrollments = async (req: Request<{ studentId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.enrollmentService.getStudentEnrollments(req.params.studentId, req.user);
      sendSuccess(res, result, 'Lấy lịch sử xếp lớp thành công');
    } catch (error) { next(error); }
  };
}