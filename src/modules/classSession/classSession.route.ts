import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadSessionMaterial } from '../../middleware/upload.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ClassSessionController } from './classSession.controller.js';
import { createSessionSchema, updateSessionSchema } from './classSession.schema.js';

export const classSessionRouter = Router();
const controller = new ClassSessionController();

classSessionRouter.use(authenticate);

// 6.1 Tạo buổi học cho lớp
classSessionRouter.post(
  '/classes/:classId/sessions',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  validate(createSessionSchema),
  controller.createSession
);

// 6.1b Chỉnh sửa buổi học
classSessionRouter.patch(
  '/sessions/:sessionId',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  validate(updateSessionSchema),
  controller.updateSession
);

// 6.1c Giáo viên tải tài liệu buổi học
classSessionRouter.post(
  '/sessions/:sessionId/materials',
  authorize(ROLES.TEACHER),
  uploadSessionMaterial.single('file'),
  controller.uploadSessionMaterial
);

// 6.2 Lấy buổi học của lớp
classSessionRouter.get('/classes/:classId/sessions', controller.getClassSessions);

// 6.3 Lấy lịch dạy của Giáo viên
classSessionRouter.get('/users/:teacherId/schedule', controller.getTeacherSchedule);

// 6.4 Lấy lịch học của Học sinh
classSessionRouter.get('/students/:studentId/schedule', controller.getStudentSchedule);
