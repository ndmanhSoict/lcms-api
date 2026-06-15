import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { MessageController } from './message.controller.js';
import { sendMessageSchema } from './message.schema.js';

export const messageRouter = Router();
const controller = new MessageController();

messageRouter.use(authenticate);

// 14.0 Tìm người dùng có thể nhắn tin
messageRouter.get('/messages/users', controller.getAvailableUsers);

// 14.0b Số tin nhắn chưa đọc
messageRouter.get('/messages/unread-count', controller.getUnreadCount);

// 14.1 Lấy danh sách conversation
messageRouter.get('/messages/threads', controller.getThreads);

// 14.2 Lấy tin nhắn trong conversation
messageRouter.get('/messages/threads/:threadId', controller.getThreadMessages);

// 14.3 Gửi tin nhắn
messageRouter.post('/messages', validate(sendMessageSchema), controller.sendMessage);
