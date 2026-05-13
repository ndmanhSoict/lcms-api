import { User, IUser } from '../../models/user.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { ROLES, REVOKE_REASONS } from '../../shared/constants/roles.js';

export class TeacherRepository {
  async findByEmail(email: string) {
    return await User.findOne({ email, deletedAt: null }).lean();
  }

  async create(data: Partial<IUser>) {
    return await new User(data).save();
  }

  async findAllPaginated(filter: any, skip: number, limit: number) {
    const [teachers, totalItems] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return { teachers, totalItems };
  }

  async findById(id: string) {
    return await User.findOne({ _id: id, role: ROLES.TEACHER, deletedAt: null })
      .select('-passwordHash')
      .lean();
  }

  async updateById(id: string, data: any) {
    return await User.findByIdAndUpdate(id, data, { new: true })
      .select('-passwordHash')
      .lean();
  }

  async softDelete(id: string, deletedBy: string) {
    return await User.findByIdAndUpdate(
      id,
      { $set: { deletedAt: new Date(), deletedBy, isActive: false } },
      { new: true }
    ).lean();
  }

  async revokeAllTokens(userId: string) {
    return await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: REVOKE_REASONS.ADMIN_REVOKE } }
    );
  }
}
