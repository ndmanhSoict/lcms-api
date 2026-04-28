import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { NotificationController } from './notification.controller.js';

export const notificationRouter = Router();
const controller = new NotificationController();

notificationRouter.use(authenticate);

// 13.1 Lấy danh sách thông báo
notificationRouter.get('/notifications', controller.getNotifications);

// 13.3 Đánh dấu TẤT CẢ đã đọc — PHẢI đứng TRƯỚC /:id để không bị match nhầm
notificationRouter.patch('/notifications/read-all', controller.markAllAsRead);

// 13.2 Đánh dấu 1 thông báo đã đọc
notificationRouter.patch('/notifications/:id/read', controller.markAsRead);
