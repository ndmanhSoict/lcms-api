import { Types } from 'mongoose';
import { Attendance } from '../../models/attendance.model.js';
import { ClassSession } from '../../models/classSession.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { AuditLog } from '../../models/auditLog.model.js';

export class AttendanceRepository {
  async findSessionById(sessionId: string) {
    return await ClassSession.findOne({ _id: sessionId, deletedAt: null }).lean();
  }

  async findActiveEnrollmentsByClass(classId: string) {
    return await Enrollment.find({ classId, leftAt: null }).lean();
  }

  async findAttendanceRecord(sessionId: string, studentId: string) {
    return await Attendance.findOne({ sessionId, studentId });
  }

  async findAttendancesBySession(sessionId: string) {
    return await Attendance.find({ sessionId })
      .populate('studentId', 'fullName code')
      .sort({ createdAt: 1 })
      .lean();
  }

  async createAttendance(data: {
    sessionId: Types.ObjectId;
    studentId: Types.ObjectId;
    classId: Types.ObjectId;
    branchId: Types.ObjectId;
    teacherId?: Types.ObjectId | null;
    status: string;
    sessionDate: Date;
  }) {
    return await Attendance.create({
      ...data,
      teacherId: data.teacherId ?? null,
      markedAt: new Date(),
      absenceNotified: false,
      editHistory: [],
    });
  }

  async updateAttendanceRecord(
    attendanceDoc: any,
    newStatus: string,
    changedBy: Types.ObjectId,
    reason?: string
  ) {
    attendanceDoc.editHistory.push({
      changedFrom: attendanceDoc.status,
      changedTo: newStatus,
      changedBy,
      changedAt: new Date(),
      reason: reason ?? null,
    });
    attendanceDoc.status = newStatus;
    attendanceDoc.markedAt = new Date();
    return await attendanceDoc.save();
  }

  async updateSessionAttendanceStatus(sessionId: string, status: 'pending' | 'submitted') {
    return await ClassSession.findByIdAndUpdate(
      sessionId,
      { attendanceStatus: status },
      { new: true }
    ).lean();
  }

  async createAuditLog(data: {
    action: string;
    actorId: Types.ObjectId;
    actorRole: string;
    branchId: Types.ObjectId;
    targetId: Types.ObjectId;
    before: Record<string, any>;
    after: Record<string, any>;
  }) {
    return await AuditLog.create({
      ...data,
      targetType: 'Attendance',
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });
  }

  // 7.4 Aggregate điểm danh của học sinh theo lớp và khoảng thời gian
  async getAttendanceSummary(
    studentId: string,
    classId: string,
    fromDate: Date,
    toDate: Date
  ) {
    const filter: any = {
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      sessionDate: { $gte: fromDate, $lte: toDate },
    };

    const records = await Attendance.find(filter)
      .select('sessionDate status')
      .sort({ sessionDate: 1 })
      .lean();

    return records;
  }
}
