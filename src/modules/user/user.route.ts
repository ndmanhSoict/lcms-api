import { Router } from 'express';
import { UserController } from './user.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { createUserSchema, getUsersSchema } from './user.schema.js';

export const userRouter = Router();
const userController = new UserController();

// Các route cơ bản
userRouter.post('/create-user', authenticate, authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER), validate(createUserSchema), userController.createUser);
userRouter.get('/all', authenticate, authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER), validate(getUsersSchema), userController.getUsers);
userRouter.get('/:id', authenticate, userController.getUserById);
userRouter.patch('/:id', authenticate, userController.updateUser);
userRouter.patch('/:id/deactivate', authenticate, authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER), userController.deactivateUser);