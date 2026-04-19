import { Router } from 'express';
import { ClassController } from './class.controller.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createClassSchema, updateClassSchema } from './class.schema.js';
import { ROLES } from '../../shared/constants/roles.js';

export const classRouter = Router();
const controller = new ClassController();

classRouter.use(authenticate);

classRouter.post('/create-class', authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF), validate(createClassSchema), controller.createClass);
classRouter.get('/all', authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER), controller.getClasses);
classRouter.get('/:id', authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER, ROLES.STUDENT, ROLES.PARENT), controller.getClassById);
classRouter.patch('/:id', authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF), validate(updateClassSchema), controller.updateClass);
classRouter.patch('/:id/close', authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF), controller.closeClass);
classRouter.get('/:id/students', authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER), controller.getClassStudents);