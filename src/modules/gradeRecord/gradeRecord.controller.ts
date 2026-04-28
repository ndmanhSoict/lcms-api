import { Request, Response, NextFunction } from 'express';
import { GradeRecordService } from './gradeRecord.service.js';
import { sendSuccess } from '../../shared/utils/response.helper.js';

export class GradeRecordController {
  private service: GradeRecordService;

  constructor() {
    this.service = new GradeRecordService();
  }

  upsertGradeRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.upsertGradeRecord(req.body, req.user);
      // 201 nếu tạo mới, 200 nếu cập nhật — dùng 200 chung cho PUT
      sendSuccess(res, result, 'Lưu học bạ thành công');
    } catch (error) { next(error); }
  };

  publishGradeRecord = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.publishGradeRecord(req.params.id, req.user);
      sendSuccess(res, result, 'Publish học bạ thành công');
    } catch (error) { next(error); }
  };

  getStudentGradeRecords = async (req: Request<{ studentId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getStudentGradeRecords(req.params.studentId, req.query, req.user);
      sendSuccess(res, result, 'Lấy học bạ học sinh thành công');
    } catch (error) { next(error); }
  };
}
