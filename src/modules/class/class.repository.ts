import { ClientSession } from 'mongoose';
import { Class, IClass } from '../../models/class.model.js';
import { User } from '../../models/user.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { ROLES } from '../../shared/constants/roles.js';

export class ClassRepository {
  async createClass(data: Partial<IClass>, session?: ClientSession) {
    const newClass = new Class(data);
    return await newClass.save({ session });
  }

  async findByCode(branchId: string, classCode: string) {
    return await Class.findOne({ branchId, classCode }).lean();
  }

  async findById(id: string) {
    return await Class.findById(id).lean();
  }

  async updateById(id: string, data: any, session?: ClientSession) {
    return await Class.findByIdAndUpdate(id, data, { new: true, session }).lean();
  }

  async findAllPaginated(filter: any, skip: number, limit: number) {
    const query = Class.find(filter)
      .populate('teacherId', 'fullName avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const [classes, totalItems] = await Promise.all([
      query.lean(),
      Class.countDocuments(filter)
    ]);
    return { classes, totalItems };
  }

  // ─── TRANSACTION HELPERS ───────────────────────────────────────

  // Cập nhật mảng activeClassIds của Giáo viên
  async updateTeacherClasses(teacherId: string, classId: string, action: 'push' | 'pull', session: ClientSession) {
    const updateOp = action === 'push' 
      ? { $addToSet: { 'teacherInfo.activeClassIds': classId } }
      : { $pull: { 'teacherInfo.activeClassIds': classId } };
    
    await User.findByIdAndUpdate(teacherId, updateOp, { session });
  }

  // Cập nhật trạng thái Enrollment khi đóng lớp
  async closeAllEnrollments(classId: string, session: ClientSession) {
    // 1. Chốt ngày rời lớp cho các hồ sơ đang học
    await Enrollment.updateMany(
      { classId, leftAt: null },
      { $set: { leftAt: new Date(), leftReason: 'completed' } },
      { session }
    );

    // 2. Gỡ classId khỏi mảng activeClassIds của toàn bộ học sinh
    await User.updateMany(
      { role: ROLES.STUDENT, 'studentInfo.activeClassIds': classId },
      { $pull: { 'studentInfo.activeClassIds': classId } },
      { session }
    );
  }

  // Lấy danh sách Học sinh trong lớp (API 4.6)
  async getEnrollmentsByClassId(classId: string, statusFilter: string, skip: number, limit: number) {
    const filter: any = { classId };
    if (statusFilter === 'active') filter.leftAt = null;

    const [enrollments, totalItems] = await Promise.all([
      Enrollment.find(filter)
        .populate('studentId', 'userCode fullName dateOfBirth phone email')
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enrollment.countDocuments(filter)
    ]);
    return { enrollments, totalItems };
  }
}