import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.validation.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AllErrors.js';
import { User } from '../../models/user.model.js';
import { generateTokens } from './auth.helper.js';

export class AuthService {
  async login(data: any) {
    const { email, password } = data;

    const user = await User.findOne({ email });
    if (!user) throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    if (!user.isActive) throw new ForbiddenError('Tài khoản của bạn đã bị khóa');

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');

    const tokens = generateTokens(user);

    return {
      user: tokens.accessTokenPayload,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };

      const user = await User.findById(decoded.id);
      if (!user) throw new UnauthorizedError('Người dùng không tồn tại');
      if (!user.isActive) throw new ForbiddenError('Tài khoản đã bị khóa');

      const tokens = generateTokens(user);

      return {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      };
    } catch (error) {
      throw new UnauthorizedError('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }
}
