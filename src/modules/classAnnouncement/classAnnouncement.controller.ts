import { Request, Response, NextFunction } from 'express';
import { ClassAnnouncementService } from './classAnnouncement.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class ClassAnnouncementController {
  private service: ClassAnnouncementService;

  constructor() {
    this.service = new ClassAnnouncementService();
  }

  createAnnouncement = async (
    req: Request<{ classId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.createAnnouncement(req.params.classId, req.body, req.user);
      sendCreated(res, result, 'Tạo thông báo lớp thành công');
    } catch (error) {
      next(error);
    }
  };

  getAnnouncements = async (
    req: Request<{ classId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { data, meta } = await this.service.getAnnouncements(
        req.params.classId,
        req.query,
        req.user
      );
      sendSuccess(res, data, 'Lấy danh sách thông báo lớp thành công', 200, meta);
    } catch (error) {
      next(error);
    }
  };
}
