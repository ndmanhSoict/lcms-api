import jwt from 'jsonwebtoken';
import { env } from '../../config/env.validation.js';
import { UnauthorizedError } from '../../shared/errors/AllErrors.js';
import { Types } from 'mongoose';
export const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('Vui lòng đăng nhập để truy cập');
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
        // Gán thông tin vào Request object đã định nghĩa trong express.d.ts
        req.user = {
            id: decoded.id,
            userId: new Types.ObjectId(decoded.id),
            email: decoded.email,
            role: decoded.role,
            branchId: decoded.branchId,
        };
        next();
    }
    catch (error) {
        next(new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn'));
    }
};
//# sourceMappingURL=authenticate.middleware.js.map