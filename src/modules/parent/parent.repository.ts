import { ClientSession } from 'mongoose';
import { User, IUser } from '../../models/user.model.js';
import { RefreshToken } from '../../models/refreshToken.model.js';
import { ROLES, REVOKE_REASONS } from '../../shared/constants/roles.js';

export class ParentRepository {
  async findByEmail(email: string) {
    return await User.findOne({ email }).lean();
  }

  async create(data: Partial<IUser>, session?: ClientSession) {
    return await new User(data).save({ session });
  }

  async findAllPaginated(filter: MongoFilter<IUser>, skip: number, limit: number) {
    const [parents, totalItems] = await Promise.all([
      User.find({ ...filter, role: ROLES.PARENT })
        .select('-passwordHash')
        .populate({
          path: 'parentInfo.studentIds',
          select: 'fullName userCode phone branchId studentInfo.grade studentInfo.schoolName',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({ ...filter, role: ROLES.PARENT }),
    ]);

    return { parents, totalItems };
  }

  async findById(id: string) {
    return await User.findOne({ _id: id, role: ROLES.PARENT, deletedAt: null })
      .select('-passwordHash')
      .lean();
  }

  async getParentDetail(id: string) {
    return await User.findOne({ _id: id, role: ROLES.PARENT, deletedAt: null })
      .select('-passwordHash')
      .populate({
        path: 'parentInfo.studentIds',
        select: 'fullName userCode phone branchId dateOfBirth gender studentInfo',
        populate: {
          path: 'studentInfo.activeClassIds',
          select:
            'name classCode branchId description subject teacherSnapshot weeklySchedule status classType courseInfo ongoingInfo maxStudents studentCount',
        },
      })
      .lean();
  }

  async updateById(id: string, data: MongoUpdate<IUser>, session?: ClientSession) {
    return await User.findByIdAndUpdate(id, data, { new: true, session })
      .select('-passwordHash')
      .lean();
  }

  async findStudentsByIds(studentIds: string[], branchId: string) {
    return await User.find({
      _id: { $in: studentIds },
      role: ROLES.STUDENT,
      branchId,
      deletedAt: null,
    })
      .select('_id branchId fullName studentInfo.parentIds')
      .lean();
  }

  async addParentToStudents(studentIds: string[], parentId: string, session: ClientSession) {
    if (studentIds.length === 0) return;

    await User.updateMany(
      { _id: { $in: studentIds }, role: ROLES.STUDENT, deletedAt: null },
      { $addToSet: { 'studentInfo.parentIds': parentId } },
      { session }
    );
  }

  async removeParentFromStudents(studentIds: string[], parentId: string, session: ClientSession) {
    if (studentIds.length === 0) return;

    await User.updateMany(
      { _id: { $in: studentIds }, role: ROLES.STUDENT, deletedAt: null },
      { $pull: { 'studentInfo.parentIds': parentId } },
      { session }
    );
  }

  async softDelete(id: string, deletedBy: string, session: ClientSession) {
    return await User.findByIdAndUpdate(
      id,
      { $set: { deletedAt: new Date(), deletedBy, isActive: false } },
      { new: true, session }
    )
      .select('-passwordHash')
      .lean();
  }

  async revokeAllTokens(userId: string, session?: ClientSession) {
    return await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: REVOKE_REASONS.ADMIN_REVOKE } },
      { session }
    );
  }
}
