import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from './attendance.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class AttendanceController {
  private service: AttendanceService;

  constructor() {
    this.service = new AttendanceService();
  }

  // 7.1 Điểm danh toàn bộ buổi học
  markSession = async (req: Request<{ sessionId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.markSession(req.params.sessionId, req.body, req.user);
      const msg = `Điểm danh hoàn tất. Đã gửi thông báo vắng học cho ${result.notifications_queued} phụ huynh.`;
      sendCreated(res, result, msg);
    } catch (error) { next(error); }
  };

  // 7.2 Sửa điểm danh
  updateAttendance = async (
    req: Request<{ sessionId: string; studentId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.updateAttendance(
        req.params.sessionId,
        req.params.studentId,
        req.body,
        req.user
      );
      sendSuccess(res, result, 'Cập nhật điểm danh thành công');
    } catch (error) { next(error); }
  };

  // 7.3 Xem điểm danh buổi học
  getSessionAttendance = async (req: Request<{ sessionId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getSessionAttendance(req.params.sessionId, req.user);
      sendSuccess(res, result, 'Lấy danh sách điểm danh buổi học thành công');
    } catch (error) { next(error); }
  };

  // 7.4 Thống kê điểm danh học sinh
  getStudentAttendanceSummary = async (req: Request<{ studentId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getStudentAttendanceSummary(
        req.params.studentId,
        req.query,
        req.user
      );
      sendSuccess(res, result, 'Lấy thống kê điểm danh học sinh thành công');
    } catch (error) { next(error); }
  };
}
