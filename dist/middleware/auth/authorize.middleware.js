import { ForbiddenError } from '../../shared/errors/AllErrors.js';
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ForbiddenError('Người dùng chưa được xác thực'));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError('Bạn không có quyền thực hiện hành động này'));
        }
        next();
    };
};
//# sourceMappingURL=authorize.middleware.js.map