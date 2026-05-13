import { Router } from 'express';
import { BranchController } from './branch.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { createBranchSchema, getBranchesSchema, updateBranchSchema } from './branch.schema.js';
export const branchRouter = Router();
const branchController = new BranchController();
// 1.1 Tạo cơ sở mới
branchRouter.post('/create-branch', authenticate, authorize(ROLES.SYSTEM_OWNER), validate(createBranchSchema), branchController.createBranch);
// 1.2 Lấy danh sách cơ sở
branchRouter.get('/all', authenticate, authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER), validate(getBranchesSchema), branchController.getBranches);
// 1.2a Tổng quan cơ sở của tài khoản đang đăng nhập
branchRouter.get('/my-overview', authenticate, authorize(ROLES.BRANCH_OWNER, ROLES.STAFF), branchController.getMyBranchOverview);
// 1.2b Tổng quan cơ sở
branchRouter.get('/:id/overview', authenticate, authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF), branchController.getBranchOverview);
// 1.3 Lấy chi tiết một cơ sở
branchRouter.get('/:id', authenticate, 
// Cho phép nhiều role vào, scope sẽ được check trong service
authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER, ROLES.STUDENT), branchController.getBranchById);
// 1.4 Cập nhật thông tin cơ sở
branchRouter.patch('/:id', authenticate, authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER), validate(updateBranchSchema), branchController.updateBranch);
// 1.5 Vô hiệu hóa / Kích hoạt cơ sở
branchRouter.patch('/:id/toggle-active', authenticate, authorize(ROLES.SYSTEM_OWNER), branchController.toggleActive);
//# sourceMappingURL=branch.route.js.map