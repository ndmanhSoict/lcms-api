import { ClassSession, IClassSession, IMaterial } from '../../models/classSession.model.js';
import { Enrollment } from '../../models/enrollment.model.js';

export class ClassSessionRepository {
  async create(data: Partial<IClassSession>) {
    const session = new ClassSession(data);
    return await session.save();
  }

  // Lấy buổi học trong 1 ngày của 1 lớp để check trùng
  async findById(sessionId: string) {
    return await ClassSession.findOne({ _id: sessionId, deletedAt: null }).lean();
  }

  async updateById(sessionId: string, data: Partial<IClassSession>) {
    return await ClassSession.findByIdAndUpdate(sessionId, data, { new: true }).lean();
  }

  async addMaterial(sessionId: string, material: IMaterial) {
    return await ClassSession.findOneAndUpdate(
      { _id: sessionId, deletedAt: null },
      { $push: { materials: material } },
      { new: true }
    ).lean();
  }

  async findSessionByDate(
    classId: string,
    startOfDay: Date,
    endOfDay: Date,
    excludeSessionId?: string
  ) {
    const query: MongoFilter<IClassSession> = {
      classId,
      sessionDate: { $gte: startOfDay, $lte: endOfDay },
    };
    if (excludeSessionId) query._id = { $ne: excludeSessionId };

    return await ClassSession.findOne(query).lean();
  }

  async findRoomSessionsByDate(
    roomId: string,
    branchId: string,
    startOfDay: Date,
    endOfDay: Date,
    excludeSessionId?: string
  ) {
    const query: MongoFilter<IClassSession> = {
      roomId,
      branchId,
      deletedAt: null,
      status: { $ne: 'cancelled' },
      sessionDate: { $gte: startOfDay, $lte: endOfDay },
    };
    if (excludeSessionId) query._id = { $ne: excludeSessionId };

    return await ClassSession.find(query).select('startTime endTime').lean();
  }

  async findSessionsByClass(classId: string, filter: MongoFilter<IClassSession>) {
    return await ClassSession.find({ classId, ...filter })
      .populate({
        path: 'teacherId',
        select: 'fullName branchId',
        match: filter.branchId ? { branchId: filter.branchId } : undefined,
      })
      .populate({
        path: 'roomId',
        select: 'code capacity detail branchId',
        match: filter.branchId ? { branchId: filter.branchId } : undefined,
      })
      .sort({ sessionDate: 1, startTime: 1 })
      .lean();
  }

  async findTeacherSchedule(teacherId: string, fromDate: Date, toDate: Date, branchId?: string) {
    return await ClassSession.find({
      teacherId,
      ...(branchId && { branchId }),
      deletedAt: null,
      sessionDate: { $gte: fromDate, $lte: toDate },
    })
      .populate({
        path: 'classId',
        select: 'name subject classCode maxStudents studentCount branchId roomSnapshot',
        match: branchId ? { branchId } : undefined,
      })
      .populate({
        path: 'roomId',
        select: 'code capacity detail branchId',
        match: branchId ? { branchId } : undefined,
      })
      .sort({ sessionDate: 1, startTime: 1 })
      .lean();
  }

  async findStudentEnrollments(studentId: string, branchId?: string) {
    return await Enrollment.find({ studentId, ...(branchId && { branchId }) }).lean();
  }

  async findSessionsByClasses(classIds: string[], fromDate: Date, toDate: Date, branchId?: string) {
    return await ClassSession.find({
      classId: { $in: classIds },
      ...(branchId && { branchId }),
      deletedAt: null,
      sessionDate: { $gte: fromDate, $lte: toDate },
    })
      .populate({
        path: 'classId',
        select: 'name subject classCode branchId roomSnapshot',
        match: branchId ? { branchId } : undefined,
      })
      .populate({
        path: 'teacherId',
        select: 'fullName branchId',
        match: branchId ? { branchId } : undefined,
      })
      .populate({
        path: 'roomId',
        select: 'code capacity detail branchId',
        match: branchId ? { branchId } : undefined,
      })
      .sort({ sessionDate: 1, startTime: 1 })
      .lean();
  }
}
