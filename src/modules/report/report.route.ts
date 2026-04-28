import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ReportController } from './report.controller.js';

export const reportRouter = Router();
const controller = new ReportController();

reportRouter.use(authenticate);

// 15.1 Dashboard cơ sở — SO/BO
reportRouter.get(
  '/reports/branch-dashboard',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER),
  controller.getBranchDashboard
);

// 15.2 Báo cáo doanh thu — SO/BO
reportRouter.get(
  '/reports/revenue',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER),
  controller.getRevenueReport
);

// 15.3 Học sinh có nguy cơ bỏ học — SO/BO
reportRouter.get(
  '/reports/at-risk-students',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER),
  controller.getAtRiskStudents
);

// 15.4 Dashboard toàn hệ thống — chỉ SO
reportRouter.get(
  '/reports/system-dashboard',
  authorize(ROLES.SYSTEM_OWNER),
  controller.getSystemDashboard
);
