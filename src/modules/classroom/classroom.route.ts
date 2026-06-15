import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ClassroomController } from './classroom.controller.js';
import {
  createClassroomSchema,
  getClassroomsSchema,
  updateClassroomSchema,
} from './classroom.schema.js';

export const classroomRouter = Router();
const controller = new ClassroomController();

classroomRouter.use(authenticate);

classroomRouter.post(
  '/',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(createClassroomSchema),
  controller.createClassroom
);

classroomRouter.get(
  '/',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  validate(getClassroomsSchema),
  controller.getClassrooms
);

classroomRouter.get(
  '/:id',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  controller.getClassroomById
);

classroomRouter.patch(
  '/:id',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(updateClassroomSchema),
  controller.updateClassroom
);

classroomRouter.delete(
  '/:id',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  controller.deleteClassroom
);
