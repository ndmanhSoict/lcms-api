import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ClassAnnouncementController } from './classAnnouncement.controller.js';
import { createAnnouncementSchema } from './classAnnouncement.schema.js';

export const classAnnouncementRouter = Router();
const controller = new ClassAnnouncementController();

classAnnouncementRouter.use(authenticate);

// 16.1 Tạo thông báo lớp — chỉ GV của lớp
classAnnouncementRouter.post(
  '/classes/:classId/announcements',
  authorize(ROLES.TEACHER),
  validate(createAnnouncementSchema),
  controller.createAnnouncement
);

// 16.2 Lấy danh sách thông báo lớp — TC, SD, PR (RBAC trong service)
classAnnouncementRouter.get(
  '/classes/:classId/announcements',
  controller.getAnnouncements
);
