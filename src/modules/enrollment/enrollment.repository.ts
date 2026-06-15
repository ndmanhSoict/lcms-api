import { ClientSession } from 'mongoose';
import { Enrollment, IEnrollment } from '../../models/enrollment.model.js';
import { Class } from '../../models/class.model.js';
import { User } from '../../models/user.model.js';
import { AuditLog } from '../../models/auditLog.model.js';

export class EnrollmentRepository {
  // Tìm hồ sơ đang học (chưa rời lớp) của 1 học sinh trong 1 lớp
  async findActiveEnrollment(studentId: string, classId: string) {
    return await Enrollment.findOne({ studentId, classId, leftAt: null }).lean();
  }

  async findById(enrollmentId: string) {
    return await Enrollment.findById(enrollmentId).lean();
  }

  // ─── TRANSACTION: XẾP LỚP ──────────────────────────────────────────────
  async createEnrollmentWithSession(data: Partial<IEnrollment>, session: ClientSession) {
    const enrollment = new Enrollment(data);
    return await enrollment.save({ session });
  }

  async addStudentToClass(classId: string, session: ClientSession) {
    await Class.findByIdAndUpdate(classId, { $inc: { studentCount: 1 } }, { session });
  }

  async addClassToStudent(studentId: string, classId: string, session: ClientSession) {
    await User.findByIdAndUpdate(
      studentId,
      { $addToSet: { 'studentInfo.activeClassIds': classId } },
      { session }
    );
  }

  // ─── TRANSACTION: RÚT LỚP ──────────────────────────────────────────────
  async leaveClassWithSession(
    enrollmentId: string,
    leaveData: MongoUpdate<IEnrollment>,
    session: ClientSession
  ) {
    return await Enrollment.findByIdAndUpdate(
      enrollmentId,
      { $set: leaveData },
      { new: true, session }
    ).lean();
  }

  async removeStudentFromClass(classId: string, session: ClientSession) {
    await Class.findByIdAndUpdate(classId, { $inc: { studentCount: -1 } }, { session });
  }

  async removeClassFromStudent(studentId: string, classId: string, session: ClientSession) {
    await User.findByIdAndUpdate(
      studentId,
      { $pull: { 'studentInfo.activeClassIds': classId } },
      { session }
    );
  }

  async createAuditLog(logData: AuditSnapshot, session: ClientSession) {
    const log = new AuditLog(logData);
    await log.save({ session });
  }

  // ─── LẤY LỊCH SỬ XẾP LỚP ───────────────────────────────────────────────
  async getEnrollmentsByStudent(studentId: string, branchId: string) {
    return await Enrollment.find({ studentId, branchId }).sort({ enrolledAt: -1 }).lean();
  }
}
