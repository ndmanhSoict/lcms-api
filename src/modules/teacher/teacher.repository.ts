import { User, IUser } from '../../models/user.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { ROLES, REVOKE_REASONS } from '../../shared/constants/roles.js';
import { ClassSession } from '../../models/classSession.model.js';

export class TeacherRepository {
  async findByEmail(email: string) {
    return await User.findOne({ email, deletedAt: null }).lean();
  }

  async create(data: Partial<IUser>) {
    return await new User(data).save();
  }

  async findAllPaginated(filter: MongoFilter<IUser>, skip: number, limit: number) {
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

  async updateById(id: string, data: MongoUpdate<IUser>) {
    return await User.findByIdAndUpdate(id, data, { new: true }).select('-passwordHash').lean();
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

  async findPayableSessions(teacherId: string, branchId: string, from: Date, to: Date) {
    return await ClassSession.find({
      teacherId,
      branchId,
      deletedAt: null,
      status: { $ne: 'cancelled' },
      sessionDate: { $gte: from, $lte: to },
      $or: [{ status: 'completed' }, { attendanceStatus: 'submitted' }],
    })
      .populate({
        path: 'classId',
        select: 'name subject classCode branchId',
        match: { branchId },
      })
      .sort({ sessionDate: 1, startTime: 1 })
      .lean();
  }

  async getSalaryPeriodSessionStats(teacherId: string, branchId: string, from: Date, to: Date) {
    const [total, completed, submitted, pendingAttendance] = await Promise.all([
      ClassSession.countDocuments({
        teacherId,
        branchId,
        deletedAt: null,
        status: { $ne: 'cancelled' },
        sessionDate: { $gte: from, $lte: to },
      }),
      ClassSession.countDocuments({
        teacherId,
        branchId,
        deletedAt: null,
        status: 'completed',
        sessionDate: { $gte: from, $lte: to },
      }),
      ClassSession.countDocuments({
        teacherId,
        branchId,
        deletedAt: null,
        status: { $ne: 'cancelled' },
        attendanceStatus: 'submitted',
        sessionDate: { $gte: from, $lte: to },
      }),
      ClassSession.countDocuments({
        teacherId,
        branchId,
        deletedAt: null,
        status: { $ne: 'cancelled' },
        attendanceStatus: 'pending',
        sessionDate: { $gte: from, $lte: to },
      }),
    ]);

    return { total, completed, submitted, pendingAttendance };
  }
}
