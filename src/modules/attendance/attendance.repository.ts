import { Types } from 'mongoose';
import { Attendance, IAttendance } from '../../models/attendance.model.js';
import { ClassSession } from '../../models/classSession.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { AuditLog } from '../../models/auditLog.model.js';
import { ATTENDANCE_STATUS, AttendanceStatus } from '../../shared/constants/roles.js';

export class AttendanceRepository {
  async findSessionById(sessionId: string) {
    return await ClassSession.findOne({ _id: sessionId, deletedAt: null }).lean();
  }

  async findActiveEnrollmentsByClass(classId: string, branchId: string) {
    return await Enrollment.find({ classId, branchId, leftAt: null }).lean();
  }

  async findAttendanceRecord(sessionId: string, studentId: string, branchId: string) {
    return await Attendance.findOne({ sessionId, studentId, branchId });
  }

  async findAttendancesBySession(sessionId: string, branchId: string) {
    return await Attendance.find({ sessionId, branchId })
      .populate({
        path: 'studentId',
        select: 'fullName userCode branchId',
        match: { branchId },
      })
      .sort({ createdAt: 1 })
      .lean();
  }

  async createAttendance(data: {
    sessionId: Types.ObjectId;
    studentId: Types.ObjectId;
    classId: Types.ObjectId;
    branchId: Types.ObjectId;
    teacherId?: Types.ObjectId | null;
    status: AttendanceStatus;
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
    attendanceDoc: IAttendance,
    newStatus: AttendanceStatus,
    changedBy: Types.ObjectId,
    reason?: string
  ) {
    attendanceDoc.editHistory.push({
      changedFrom: attendanceDoc.status,
      changedTo: newStatus,
      changedBy,
      changedAt: new Date(),
      reason,
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
    before: AuditSnapshot;
    after: AuditSnapshot;
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
    branchId: string,
    fromDate: Date,
    toDate: Date
  ) {
    const filter: MongoFilter<IAttendance> = {
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      branchId: new Types.ObjectId(branchId),
      sessionDate: { $gte: fromDate, $lte: toDate },
    };

    const records = await Attendance.find(filter)
      .select('sessionDate status')
      .sort({ sessionDate: 1 })
      .lean();

    return records;
  }

  async findStudentAttendanceHistory(
    studentId: string,
    branchId: string,
    fromDate: Date,
    toDate: Date,
    filters: { classId?: string; status?: AttendanceStatus }
  ) {
    const filter: MongoFilter<IAttendance> = {
      studentId: new Types.ObjectId(studentId),
      branchId: new Types.ObjectId(branchId),
      sessionDate: { $gte: fromDate, $lte: toDate },
    };

    if (filters.classId) filter.classId = new Types.ObjectId(filters.classId);
    if (filters.status === ATTENDANCE_STATUS.PRESENT) filter.status = ATTENDANCE_STATUS.PRESENT;
    if (filters.status === ATTENDANCE_STATUS.ABSENT) filter.status = { $ne: ATTENDANCE_STATUS.PRESENT };

    return await Attendance.find(filter)
      .populate({
        path: 'studentId',
        select: 'fullName userCode branchId',
        match: { branchId },
      })
      .populate({
        path: 'classId',
        select: 'name classCode subject teacherSnapshot branchId',
        match: { branchId },
      })
      .populate({
        path: 'sessionId',
        select: 'note startTime endTime status attendanceStatus branchId',
        match: { branchId },
      })
      .sort({ sessionDate: -1, createdAt: -1 })
      .limit(300)
      .lean();
  }
}
