import { Router } from 'express';
import { StudentController } from './student.controller.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  addStudentParentSchema,
  createStudentSchema,
  updateStudentSchema,
} from './student.schema.js';
import { ROLES } from '../../shared/constants/roles.js';

export const studentRouter = Router();
const controller = new StudentController();

studentRouter.use(authenticate);

studentRouter.post(
  '/create-student',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(createStudentSchema),
  controller.createStudent
);
studentRouter.get(
  '/all',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  controller.getStudents
);
studentRouter.get('/my-overview', authorize(ROLES.STUDENT), controller.getMyOverview);
studentRouter.get('/:id', controller.getStudentById);
studentRouter.post(
  '/:studentId/parents',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(addStudentParentSchema),
  controller.addParent
);
studentRouter.patch(
  '/:id',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(updateStudentSchema),
  controller.updateStudent
);
