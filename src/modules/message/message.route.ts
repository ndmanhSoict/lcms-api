import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { MessageController } from './message.controller.js';
import { sendMessageSchema } from './message.schema.js';

export const messageRouter = Router();
const controller = new MessageController();

messageRouter.use(authenticate);

// 14.1 Lấy danh sách conversation
messageRouter.get(
  '/messages/threads',
  authorize(ROLES.TEACHER, ROLES.PARENT),
  controller.getThreads
);

// 14.2 Lấy tin nhắn trong conversation — PHẢI trước /threads (không bị nhầm)
messageRouter.get(
  '/messages/threads/:threadId',
  authorize(ROLES.TEACHER, ROLES.PARENT),
  controller.getThreadMessages
);

// 14.3 Gửi tin nhắn
messageRouter.post(
  '/messages',
  authorize(ROLES.TEACHER, ROLES.PARENT),
  validate(sendMessageSchema),
  controller.sendMessage
);
