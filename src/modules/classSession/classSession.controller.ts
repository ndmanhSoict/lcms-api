import { Request, Response, NextFunction } from 'express';
import { ClassSessionService } from './classSession.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class ClassSessionController {
  private sessionService: ClassSessionService;

  constructor() {
    this.sessionService = new ClassSessionService();
  }

  createSession = async (req: Request<{ classId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionService.createSession(req.params.classId, req.body, req.user);
      sendCreated(res, result, 'Tạo buổi học thành công');
    } catch (error) { next(error); }
  };

  getClassSessions = async (req: Request<{ classId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionService.getClassSessions(req.params.classId, req.query, req.user);
      sendSuccess(res, result, 'Lấy danh sách buổi học của lớp thành công');
    } catch (error) { next(error); }
  };

  getTeacherSchedule = async (req: Request<{ teacherId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionService.getTeacherSchedule(req.params.teacherId, req.query, req.user);
      sendSuccess(res, result, 'Lấy lịch dạy giáo viên thành công');
    } catch (error) { next(error); }
  };

  getStudentSchedule = async (req: Request<{ studentId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionService.getStudentSchedule(req.params.studentId, req.query, req.user);
      sendSuccess(res, result, 'Lấy lịch học thành công');
    } catch (error) { next(error); }
  };
}