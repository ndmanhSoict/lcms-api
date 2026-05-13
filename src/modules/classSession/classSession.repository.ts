import { ClassSession, IClassSession } from '../../models/classSession.model.js';
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

  async findSessionByDate(
    classId: string,
    startOfDay: Date,
    endOfDay: Date,
    excludeSessionId?: string
  ) {
    const query: Record<string, any> = {
      classId,
      sessionDate: { $gte: startOfDay, $lte: endOfDay },
    };
    if (excludeSessionId) query._id = { $ne: excludeSessionId };

    return await ClassSession.findOne(query).lean();
  }

  async findSessionsByClass(classId: string, filter: any) {
    return await ClassSession.find({ classId, ...filter })
      .populate('teacherId', 'fullName')
      .sort({ sessionDate: 1, startTime: 1 })
      .lean();
  }

  async findTeacherSchedule(teacherId: string, fromDate: Date, toDate: Date) {
    return await ClassSession.find({
      teacherId,
      sessionDate: { $gte: fromDate, $lte: toDate }
    })
      .populate('classId', 'name subject classCode maxStudents studentCount')
      .sort({ sessionDate: 1, startTime: 1 })
      .lean();
  }

  async findStudentEnrollments(studentId: string) {
    return await Enrollment.find({ studentId }).lean();
  }

  async findSessionsByClasses(classIds: string[], fromDate: Date, toDate: Date) {
    return await ClassSession.find({
      classId: { $in: classIds },
      sessionDate: { $gte: fromDate, $lte: toDate }
    })
      .populate('classId', 'name subject classCode')
      .populate('teacherId', 'fullName')
      .sort({ sessionDate: 1, startTime: 1 })
      .lean();
  }
}
