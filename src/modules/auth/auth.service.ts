import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env.validation.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AllErrors.js';
import { User } from '../../models/user.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { generateTokens } from './auth.helper.js';

export class AuthService {
  async login(data: any) {
    const { email, password } = data; // Dùng email thay vì phone

    // 1. Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    if (!user.isActive) throw new ForbiddenError('Tài khoản của bạn đã bị khóa');

    // 2. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');

    // 3. Tạo JWT tokens
    const tokens = generateTokens(user);

    // 4. Băm Refresh Token để lưu vào DB
    const tokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    
    const expiresInDays = parseInt(env.JWT_REFRESH_EXPIRES.replace(/\D/g, '')) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Dọn dẹp session cũ của user này để tránh lỗi duplicate token hash
    await RefreshToken.deleteMany({ userId: user._id });

    // Lưu Refresh Token vào collection mới
    await RefreshToken.create({
      schemaVersion: 1,
      userId: user._id,
      branchId: user.branchId,
      tokenHash,
      expiresAt,
    });

    // 5. Cập nhật last_login_at
    user.lastLoginAt = new Date();
    await user.save();

    return {
      user: { ...tokens.accessTokenPayload, fullName: user.fullName, role: user.role },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };

      // Kiểm tra token hash có tồn tại và chưa bị thu hồi trong DB không
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenRecord = await RefreshToken.findOne({ tokenHash, revokedAt: null });
      
      if (!tokenRecord) {
        throw new UnauthorizedError('Refresh token đã bị thu hồi hoặc không hợp lệ 1');
      }

      const user = await User.findById(decoded.id);
      if (!user) throw new UnauthorizedError('Người dùng không tồn tại');
      if (!user.isActive) throw new ForbiddenError('Tài khoản đã bị khóa');
      const tokens = generateTokens(user);

      // Cập nhật token mới vào DB, thu hồi token cũ
      tokenRecord.revokedAt = new Date();
      tokenRecord.revokedReason = 'rotated';
      await tokenRecord.save();

      const newTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
      const expiresInDays = parseInt(env.JWT_REFRESH_EXPIRES.replace(/\D/g, '')) || 7;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      await RefreshToken.create({
        schemaVersion: 1,
        userId: user._id,
        branchId: user.branchId,
        tokenHash: newTokenHash,
        expiresAt,
      });

      return {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      };
    } catch (error: any) {
      console.error("🔴 LỖI REFRESH TOKEN GỐC:", error);

      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        throw error;
      }
      
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token đã hết hạn, vui lòng đăng nhập lại');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Chữ ký token không hợp lệ');
      }

      throw new UnauthorizedError('Lỗi xác thực refresh token');
    }
  }

  async logout(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    await RefreshToken.updateOne(
      { tokenHash, revokedAt: null },
      { 
        $set: { 
          revokedAt: new Date(), 
          revokedReason: 'logout' 
        } 
      }
    );
  }
}