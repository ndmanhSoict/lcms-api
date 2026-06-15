import { Request, Response, NextFunction } from 'express';
import { MessageService } from './message.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class MessageController {
  private service: MessageService;

  constructor() {
    this.service = new MessageService();
  }

  getAvailableUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getAvailableUsers(req.query, req.user);
      sendSuccess(res, result, 'Lấy danh sách người dùng có thể nhắn tin thành công');
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getUnreadCount(req.user);
      sendSuccess(res, result, 'Lấy số tin nhắn chưa đọc thành công');
    } catch (error) {
      next(error);
    }
  };

  getThreads = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getThreads(req.user);
      sendSuccess(res, result, 'Lấy danh sách hội thoại thành công');
    } catch (error) {
      next(error);
    }
  };

  getThreadMessages = async (
    req: Request<{ threadId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { data, meta } = await this.service.getThreadMessages(
        req.params.threadId,
        req.query,
        req.user
      );
      sendSuccess(
        res,
        data,
        'Lấy tin nhắn thành công',
        200,
        meta
      );
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.sendMessage(req.body, req.user);
      sendCreated(res, result, 'Gửi tin nhắn thành công');
    } catch (error) {
      next(error);
    }
  };
}
