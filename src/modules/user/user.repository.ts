import { User, IUser } from '../../models/user.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { REVOKE_REASONS } from '../../shared/constants/roles.js';

export class UserRepository {
  async findByEmail(email: string) {
    return await User.findOne({ email }).lean();
  }

  async create(data: Partial<IUser>) {
    const user = new User(data);
    return await user.save();
  }

  async findAllPaginated(filter: any, skip: number, limit: number) {
    const [users, totalItems] = await Promise.all([
      User.find(filter)
        .select('-password') // Không trả về mật khẩu
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      User.countDocuments(filter)
    ]);
    return { users, totalItems };
  }

  async findById(id: string) {
    return await User.findById(id).select('-password').lean();
  }

  async updateById(id: string, data: any) {
    return await User.findByIdAndUpdate(id, data, { new: true }).select('-password').lean();
  }

  async revokeAllTokens(userId: string) {
    return await RefreshToken.updateMany(
      { userId, isRevoked: false },
      { 
        isRevoked: true, 
        revokeReason: REVOKE_REASONS.ADMIN_REVOKE,
        revokedAt: new Date() 
      }
    );
  }
}