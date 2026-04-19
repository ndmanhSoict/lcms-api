import { ClassSession, IClassSession } from '../../models/classSession.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { Attendance } from '../../models/attendance.model.js';

export class ClassSessionRepository {
  async create(data: Partial<IClassSession>) {
    const session = new ClassSession(data);
    return await session.save();
  }

  // Lấy buổi học trong 1 ngày của 1 lớp để check trùng
  async findSessionByDate(classId: string, startOfDay: Date, endOfDay: Date) {
    return await ClassSession.findOne({
      classId,
      sessionDate: { $gte: startOfDay, $lte: endOfDay }
    }).lean();
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