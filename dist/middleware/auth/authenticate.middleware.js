import jwt from 'jsonwebtoken';
import { env } from '../../config/env.validation.js';
import { UnauthorizedError } from '../../shared/errors/AllErrors.js';
import { Types } from 'mongoose';
import { User } from '../../models/user.model.js';
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('Vui lòng đăng nhập để truy cập');
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
        const user = await User.findOne({
            _id: decoded.id,
            isActive: true,
            deletedAt: null,
        })
            .select('_id email role branchId')
            .lean();
        if (!user) {
            throw new UnauthorizedError('Tài khoản không tồn tại hoặc đã bị khóa');
        }
        // Role and branch come from the current database state, not stale JWT claims.
        req.user = {
            id: user._id.toString(),
            userId: new Types.ObjectId(user._id),
            email: user.email,
            role: user.role,
            branchId: user.branchId?.toString(),
        };
        next();
    }
    catch {
        next(new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn'));
    }
};
//# sourceMappingURL=authenticate.middleware.js.map