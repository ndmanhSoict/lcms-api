import { Router } from 'express';
import { BranchController } from './branch.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { createBranchSchema } from './branch.schema.js';

export const branchRouter = Router();
const branchController = new BranchController();

branchRouter.post(
  '/register-branch',
  authenticate,
  authorize(ROLES.SYSTEM_OWNER), // 2. Phải là SYSTEM_OWNER
  validate(createBranchSchema), // 3. Dữ liệu body phải đúng format
  branchController.createBranch // 4. Vào controller
);