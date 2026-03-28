import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../shared/errors/AllErrors.js';
import { RoleType } from '../../shared/constants/roles.js';

export const authorize = (...allowedRoles: RoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError('Người dùng chưa được xác thực'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Bạn không có quyền thực hiện hành động này'));
    }

    next();
  };
};