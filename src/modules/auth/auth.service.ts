import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.validation.js';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '../../shared/errors/AllErrors.js';
import { User, IUser } from '../../models/user.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { AuditLog } from '../../models/auditLog.model.js';
import { RoleType } from '../../shared/constants/roles.js';

interface LoginCredentials {
  email: string;
  password: string;
}

interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export class AuthService {
  // 0.1 Đăng nhập
  async login(data: LoginCredentials, ipAddress?: string, userAgent?: string) {
    const { email, password } = data;

    const user = await User.findOne({ email, deletedAt: null }).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedError('Email hoặc mật khẩu không đúng'); // Mã INVALID_CREDENTIALS cấu hình ở class Error
    }
    if (!user.isActive) {
      throw new UnauthorizedError('Tài khoản đã bị khóa');
    }

    // Bcrypt compare
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Ghi audit log FAILED_LOGIN
      await AuditLog.create({
        action: 'FAILED_LOGIN',
        actorId: user._id,
        actorRole: user.role, // Bổ sung
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // Bổ sung
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError('Email hoặc mật khẩu không đúng');
    }

    // Cập nhật lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    return this.generateAndSaveTokens(user);
  }

  // 0.2 Làm mới Access Token (Rotate Token)
  async refreshToken(rawRefreshToken: string) {
    let decoded: JwtUserPayload;
    try {
      decoded = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET) as JwtUserPayload;
    } catch {
      throw new UnauthorizedError('Token hết hạn hoặc không hợp lệ');
    }

    const userId = decoded.id;

    // Tìm tất cả active refresh tokens của user này
    const activeTokens = await RefreshToken.find({ userId, revokedAt: null });

    let matchedTokenDoc = null;
    for (const tokenDoc of activeTokens) {
      const isMatch = await bcrypt.compare(rawRefreshToken, tokenDoc.tokenHash);
      if (isMatch) {
        matchedTokenDoc = tokenDoc;
        break;
      }
    }

    if (!matchedTokenDoc) {
      throw new UnauthorizedError('Token đã bị thu hồi hoặc không tồn tại');
    }

    // Rotate: Thu hồi token cũ
    matchedTokenDoc.revokedAt = new Date();
    matchedTokenDoc.revokedReason = 'rotated';
    await matchedTokenDoc.save();

    // Sinh cặp token mới
    const user = await User.findOne({ _id: userId, isActive: true, deletedAt: null });
    if (!user) throw new UnauthorizedError('Tài khoản không tồn tại hoặc đã bị khóa');

    return this.generateAndSaveTokens(user);
  }

  // 0.3 Đăng xuất
  async logout(rawRefreshToken: string, userPayload: RequestUser) {
    const userId = userPayload.id; // Lấy ID từ payload
    const activeTokens = await RefreshToken.find({ userId, revokedAt: null });

    for (const tokenDoc of activeTokens) {
      const isMatch = await bcrypt.compare(rawRefreshToken, tokenDoc.tokenHash);
      if (isMatch) {
        tokenDoc.revokedAt = new Date();
        tokenDoc.revokedReason = 'logout';
        await tokenDoc.save();

        // SỬA ĐOẠN GHI LOG Ở ĐÂY
        await AuditLog.create({
          action: 'LOGOUT',
          actorId: userId,
          actorRole: userPayload.role, // Thêm role bắt buộc
          branchId: userPayload.branchId, // Thêm branch (nếu có)
          expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // Bắt buộc: Hết hạn sau 180 ngày
        });

        return;
      }
    }
    throw new UnauthorizedError('Token không hợp lệ');
  }

  // 0.4 Đổi mật khẩu
  async changePassword(userId: string, data: ChangePasswordPayload) {
    const { currentPassword, newPassword } = data;
    const user = await User.findOne({ _id: userId, isActive: true, deletedAt: null }).select(
      '+passwordHash'
    );
    if (!user) throw new NotFoundError('Người dùng');

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new UnauthorizedError('Mật khẩu hiện tại không đúng');

    // Hash mật khẩu mới (cost 12 theo requirement)
    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Thu hồi toàn bộ Refresh Token của user
    await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'password_changed' } }
    );

    // Ghi lại đúng sự kiện bảo mật thay vì coi đổi mật khẩu là đăng xuất.
    await AuditLog.create({
      action: 'CHANGE_PASSWORD',
      actorId: userId,
      actorRole: user.role,
      branchId: user.branchId,
      targetType: 'User',
      targetId: user._id,
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });
  }

  // 0.5 Reset mật khẩu (Admin)
  async resetPassword(
    adminId: string,
    adminRole: RoleType,
    adminBranchId: string,
    targetUserId: string,
    newPassword: string
  ) {
    const targetUser = await User.findOne({ _id: targetUserId, deletedAt: null });
    if (!targetUser) throw new NotFoundError('Người dùng cần reset');

    // Business Rule: BO chỉ reset được user trong branch của mình
    if (adminRole === 'branch_owner' && targetUser.branchId?.toString() !== adminBranchId) {
      throw new ForbiddenError('Bạn chỉ có quyền thao tác với người dùng thuộc cơ sở của mình');
    }

    const salt = await bcrypt.genSalt(12);
    targetUser.passwordHash = await bcrypt.hash(newPassword, salt);
    await targetUser.save();

    await RefreshToken.updateMany(
      { userId: targetUserId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'password_reset_by_admin' } }
    );

    await AuditLog.create({
      action: 'RESET_PASSWORD',
      actorId: adminId,
      actorRole: adminRole, // Bổ sung
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // Bổ sung
      targetId: targetUserId,
    });
  }

  // Helper function sinh token và trả về payload chuẩn
  private async generateAndSaveTokens(user: IUser) {
    const accessTokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      ...(user.branchId && { branchId: user.branchId.toString() }),
    };

    const accessToken = jwt.sign(accessTokenPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign({ id: user._id.toString() }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions['expiresIn'],
    });

    // Lưu Hash của Refresh Token vào DB
    const salt = await bcrypt.genSalt(10);
    const tokenHash = await bcrypt.hash(refreshToken, salt);

    await RefreshToken.create({
      userId: user._id,
      branchId: user.branchId,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Ví dụ: 7 ngày
    });

    return {
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        avatarUrl: user.avatarUrl || null,
      },
    };
  }
}
