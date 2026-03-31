// src/middleware/auth/authorizeBranch.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../shared/errors/AllErrors.js';
import { ROLES } from '../../shared/constants/roles.js';

export const authorizeBranch = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) return next(new ForbiddenError());

  // SYSTEM_OWNER có quyền xem mọi chi nhánh
  if (user.role === ROLES.SYSTEM_OWNER) {
    return next();
  }

  // Lấy branchId từ Params hoặc Query hoặc Body tùy theo API
  const requestedBranchId = req.params.branchId || req.query.branchId || req.body.branchId;

  // Nếu User thuộc chi nhánh nào đó, họ chỉ được phép thao tác trên đúng branchId đó
  if (user.branchId && requestedBranchId && user.branchId !== requestedBranchId) {
    throw new ForbiddenError('Bạn không có quyền truy cập dữ liệu của chi nhánh khác');
  }

  next();
};
