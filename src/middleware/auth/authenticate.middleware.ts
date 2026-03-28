import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.validation.js';
import { UnauthorizedError } from '../../shared/errors/AllErrors.js';
import { RoleType } from '../../shared/constants/roles.js';
import { Types } from 'mongoose';

interface JwtPayload {
  id: string;
  email: string;
  role: RoleType;
  branchId?: string;
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Vui lòng đăng nhập để truy cập');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    // Gán thông tin vào Request object đã định nghĩa trong express.d.ts
    req.user = {
      id: decoded.id,
      userId: new Types.ObjectId(decoded.id),
      email: decoded.email,
      role: decoded.role,
      branchId: decoded.branchId,
    };

    next();
  } catch (error) {
    next(new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn'));
  }
};