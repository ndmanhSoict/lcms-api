import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service.js';
import { sendSuccess } from '../../shared/utils/response.helper.js';

export class NotificationController {
  private service: NotificationService;

  constructor() {
    this.service = new NotificationService();
  }

  // 13.1 Lấy danh sách thông báo
  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, meta } = await this.service.getNotifications(req.query, req.user);
      sendSuccess(res, data, 'Lấy danh sách thông báo thành công', 200, meta);
    } catch (error) { next(error); }
  };

  // 13.2 Đánh dấu 1 thông báo đã đọc
  markAsRead = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.markAsRead(req.params.id, req.user);
      sendSuccess(res, result, 'Đánh dấu đã đọc thành công');
    } catch (error) { next(error); }
  };

  // 13.3 Đánh dấu tất cả đã đọc
  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.markAllAsRead(req.user);
      sendSuccess(res, result, 'Đánh dấu tất cả đã đọc thành công');
    } catch (error) { next(error); }
  };
}
