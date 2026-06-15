import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { AttendanceController } from './attendance.controller.js';
import { markSessionAttendanceSchema, updateAttendanceSchema } from './attendance.schema.js';

export const attendanceRouter = Router();
const controller = new AttendanceController();

attendanceRouter.use(authenticate);

// 7.1 Điểm danh toàn bộ buổi học — chỉ GV của lớp
attendanceRouter.post(
  '/sessions/:sessionId/attendance',
  authorize(ROLES.TEACHER),
  validate(markSessionAttendanceSchema),
  controller.markSession
);

// 7.2 Sửa điểm danh — GV của lớp + quản lý
attendanceRouter.patch(
  '/sessions/:sessionId/attendance/:studentId',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  validate(updateAttendanceSchema),
  controller.updateAttendance
);

// 7.3 Xem điểm danh buổi học — GV của lớp + quản lý
attendanceRouter.get(
  '/sessions/:sessionId/attendance',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  controller.getSessionAttendance
);

// 7.4 Thống kê điểm danh học sinh — tất cả vai trò liên quan (RBAC check trong service)
attendanceRouter.get(
  '/students/:studentId/attendance-summary',
  controller.getStudentAttendanceSummary
);

// 7.5 Xem lại từng buổi điểm danh của học sinh
attendanceRouter.get(
  '/students/:studentId/attendance-history',
  controller.getStudentAttendanceHistory
);
