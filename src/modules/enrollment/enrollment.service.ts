import mongoose, { Types } from 'mongoose';
import { EnrollmentRepository } from './enrollment.repository.js';
import { User } from '../../models/user.model.js';
import { Class } from '../../models/class.model.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ConflictError, NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';

export class EnrollmentService {
  private enrollmentRepo: EnrollmentRepository;

  constructor() {
    this.enrollmentRepo = new EnrollmentRepository();
  }

  // 5.1 Xếp học sinh vào lớp
  async enrollStudent(data: { studentId: string, classId: string }, requester: any) {
    const { studentId, classId } = data;

    // 1. Kiểm tra học sinh hợp lệ
    const student = await User.findOne({ _id: studentId, role: ROLES.STUDENT }).lean();
    if (!student) throw new NotFoundError('Học sinh');
    if (!student.isActive) throw new BadRequestError('Học sinh đang bị khóa tài khoản');

    // 2. Kiểm tra lớp hợp lệ & sức chứa
    const cls = await Class.findById(classId).populate('teacherId', 'fullName').lean();
    if (!cls) throw new NotFoundError('Lớp học');
    if (cls.status !== 'active') throw new BadRequestError('Lớp học không ở trạng thái hoạt động');
    if (cls.maxStudents && cls.studentCount >= cls.maxStudents) {
      throw new BadRequestError('Lớp học đã đạt sĩ số tối đa');
    }

    // 3. Kiểm tra Branch Scope (RBAC)
    if (requester.role !== ROLES.SYSTEM_OWNER) {
      if (student.branchId?.toString() !== requester.branchId || cls.branchId?.toString() !== requester.branchId) {
        throw new ForbiddenError('Không thể xếp lớp vượt ngoài cơ sở của bạn');
      }
    }

    // 4. Kiểm tra trùng lặp (Partial Index check)
    const existing = await this.enrollmentRepo.findActiveEnrollment(studentId, classId);
    if (existing) throw new ConflictError('Học sinh đang học trong lớp này rồi');

    // 5. Bắt đầu Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const teacherName = cls.teacherId ? (cls.teacherId as any).fullName : 'Chưa phân công';
      
      const newEnrollment = await this.enrollmentRepo.createEnrollmentWithSession({
        studentId: new Types.ObjectId(studentId),
        classId: new Types.ObjectId(classId),
        branchId: cls.branchId,
        enrolledAt: new Date(),
        classSnapshot: {
          name: cls.name,
          subjectName: cls.subject?.name || '',
          teacherName: teacherName
        }
      }, session);

      await this.enrollmentRepo.addStudentToClass(classId, session);
      await this.enrollmentRepo.addClassToStudent(studentId, classId, session);

      await session.commitTransaction();

      // (Mock) Tự động gửi thông báo
      console.log(`[Notification] Đã gửi lịch học lớp ${cls.name} cho HS ${student.fullName}`);

      return newEnrollment;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // 5.2 Rút học sinh khỏi lớp
  async leaveClass(enrollmentId: string, leaveData: { reason: string, note?: string }, requester: any) {
    const enrollment = await this.enrollmentRepo.findById(enrollmentId);
    if (!enrollment) throw new NotFoundError('Hồ sơ xếp lớp');
    if (enrollment.leftAt) throw new BadRequestError('Học sinh này đã rời lớp từ trước');

    // Kiểm tra Branch Scope
    if (requester.role !== ROLES.SYSTEM_OWNER && enrollment.branchId?.toString() !== requester.branchId) {
      throw new ForbiddenError('Không có quyền thao tác trên cơ sở này');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const leftAt = new Date();
      await this.enrollmentRepo.leaveClassWithSession(enrollmentId, {
        leftAt,
        leftReason: leaveData.reason,
        note: leaveData.note
      }, session);

      await this.enrollmentRepo.removeStudentFromClass(enrollment.classId.toString(), session);
      await this.enrollmentRepo.removeClassFromStudent(enrollment.studentId.toString(), enrollment.classId.toString(), session);

      // Ghi Audit Log
      await this.enrollmentRepo.createAuditLog({
        action: 'TRANSFER_CLASS',
        actorId: requester.id,
        actorRole: requester.role,
        branchId: enrollment.branchId,
        targetId: enrollment.studentId,
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      }, session);

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // 5.3 Lấy lịch sử enrollment của học sinh
  async getStudentEnrollments(studentId: string, requester: any) {
    const student = await User.findById(studentId).lean();
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    // RBAC: Học sinh tự xem, Phụ huynh xem của con, SO/BO/STAFF xem trong nhánh
    const isSelf = requester.id === studentId;
    const isParent = requester.role === ROLES.PARENT && student.studentInfo?.parentIds?.map(String).includes(requester.id);
    const isAdminSameBranch = [ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF].includes(requester.role) 
      && (requester.role === ROLES.SYSTEM_OWNER || student.branchId?.toString() === requester.branchId);

    if (!isSelf && !isParent && !isAdminSameBranch) {
      throw new ForbiddenError('Bạn không có quyền xem lịch sử của học sinh này');
    }

    return await this.enrollmentRepo.getEnrollmentsByStudent(studentId);
  }
}