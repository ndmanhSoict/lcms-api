import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { GradeRecordController } from './gradeRecord.controller.js';
import {
  getClassGradeRecordsSchema,
  publishGradeRecordSchema,
  upsertGradeRecordSchema,
} from './gradeRecord.schema.js';

export const gradeRecordRouter = Router();
const controller = new GradeRecordController();

gradeRecordRouter.use(authenticate);

// 11.1 Tạo / cập nhật học bạ — chỉ GV
gradeRecordRouter.put(
  '/grade-records',
  authorize(ROLES.TEACHER),
  validate(upsertGradeRecordSchema),
  controller.upsertGradeRecord
);

// 11.2 Publish học bạ — chỉ GV
gradeRecordRouter.patch(
  '/grade-records/:id/publish',
  authorize(ROLES.TEACHER),
  validate(publishGradeRecordSchema),
  controller.publishGradeRecord
);

// 11.3 Xem học bạ học sinh — nhiều role (RBAC trong service)
gradeRecordRouter.get('/students/:studentId/grade-records', controller.getStudentGradeRecords);

// 11.4 Xem học bạ theo lớp — GV/QL theo scope
gradeRecordRouter.get(
  '/classes/:classId/grade-records',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  validate(getClassGradeRecordsSchema),
  controller.getClassGradeRecords
);
