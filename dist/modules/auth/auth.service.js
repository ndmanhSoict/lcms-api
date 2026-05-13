import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.validation.js';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '../../shared/errors/AllErrors.js';
import { User } from '../../models/user.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { AuditLog } from '../../models/auditLog.model.js';
export class AuthService {
    // 0.1 Đăng nhập
    async login(data, ipAddress, userAgent) {
        const { email, password } = data;
        const user = await User.findOne({ email }).select('+passwordHash');
        if (!user) {
            throw new UnauthorizedError('Email hoặc mật khẩu không đúng'); // Mã INVALID_CREDENTIALS cấu hình ở class Error
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
    async refreshToken(rawRefreshToken) {
        let decoded;
        try {
            decoded = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET);
        }
        catch (err) {
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
        const user = await User.findById(userId);
        if (!user)
            throw new NotFoundError('Người dùng');
        return this.generateAndSaveTokens(user);
    }
    // 0.3 Đăng xuất
    async logout(rawRefreshToken, userPayload) {
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
                    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // Bắt buộc: Hết hạn sau 180 ngày
                });
                return;
            }
        }
        throw new UnauthorizedError('Token không hợp lệ');
    }
    // 0.4 Đổi mật khẩu
    async changePassword(userId, data) {
        const { currentPassword, newPassword } = data;
        const user = await User.findById(userId).select('+passwordHash');
        if (!user)
            throw new NotFoundError('Người dùng');
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch)
            throw new UnauthorizedError('Mật khẩu hiện tại không đúng');
        // Hash mật khẩu mới (cost 12 theo requirement)
        const salt = await bcrypt.genSalt(12);
        user.passwordHash = await bcrypt.hash(newPassword, salt);
        await user.save();
        // Thu hồi toàn bộ Refresh Token của user
        await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: 'password_changed' } });
        // Ghi log
        await AuditLog.create({
            action: 'LOGOUT',
            actorId: userId,
            actorRole: user.role, // Thêm role bắt buộc
            branchId: user.branchId, // Thêm branch (nếu có)
            expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // Bắt buộc: Hết hạn sau 180 ngày
        });
    }
    // 0.5 Reset mật khẩu (Admin)
    async resetPassword(adminId, adminRole, adminBranchId, targetUserId, newPassword) {
        const targetUser = await User.findById(targetUserId);
        if (!targetUser)
            throw new NotFoundError('Người dùng cần reset');
        // Business Rule: BO chỉ reset được user trong branch của mình
        if (adminRole === 'branch_owner' && targetUser.branchId?.toString() !== adminBranchId) {
            throw new ForbiddenError('Bạn chỉ có quyền thao tác với người dùng thuộc cơ sở của mình');
        }
        const salt = await bcrypt.genSalt(12);
        targetUser.passwordHash = await bcrypt.hash(newPassword, salt);
        await targetUser.save();
        await RefreshToken.updateMany({ user: targetUserId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: 'password_reset_by_admin' } });
        await AuditLog.create({
            action: 'RESET_PASSWORD',
            actorId: adminId,
            actorRole: adminRole, // Bổ sung
            expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // Bổ sung
            targetId: targetUserId,
        });
    }
    // Helper function sinh token và trả về payload chuẩn
    async generateAndSaveTokens(user) {
        const accessTokenPayload = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            ...(user.branchId && { branchId: user.branchId.toString() })
        };
        const accessToken = jwt.sign(accessTokenPayload, env.JWT_ACCESS_SECRET, {
            expiresIn: env.JWT_ACCESS_EXPIRES
        });
        const refreshToken = jwt.sign({ id: user._id.toString() }, env.JWT_REFRESH_SECRET, {
            expiresIn: env.JWT_REFRESH_EXPIRES
        });
        // Lưu Hash của Refresh Token vào DB
        const salt = await bcrypt.genSalt(10);
        const tokenHash = await bcrypt.hash(refreshToken, salt);
        await RefreshToken.create({
            userId: user._id,
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Ví dụ: 7 ngày
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
                avatarUrl: user.avatarUrl || null
            }
        };
    }
}
//# sourceMappingURL=auth.service.js.map