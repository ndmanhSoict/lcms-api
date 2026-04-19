import { Router } from 'express';
import { EnrollmentController } from './enrollment.controller.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { enrollStudentSchema, leaveClassSchema } from './enrollment.schema.js';
import { ROLES } from '../../shared/constants/roles.js';

export const enrollmentRouter = Router();
const controller = new EnrollmentController();

enrollmentRouter.use(authenticate);

// 5.1 Xếp lớp
enrollmentRouter.post(
  '/add', 
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF), 
  validate(enrollStudentSchema), 
  controller.enrollStudent
);

// 5.2 Rút lớp
enrollmentRouter.patch(
  '/:id/leave', 
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF), 
  validate(leaveClassSchema), 
  controller.leaveClass
);

// 5.3 Lịch sử xếp lớp (Dùng tham số studentId trên URL)
enrollmentRouter.get(
  '/students/:studentId', 
  controller.getStudentEnrollments
);