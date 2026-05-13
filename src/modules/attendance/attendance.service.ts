import { Types } from 'mongoose';
import { AttendanceRepository } from './attendance.repository.js';
import { User } from '../../models/user.model.js';
import { Class } from '../../models/class.model.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
  getBranchOwnerAndStaffIds,
  getRelatedParentIds,
  NOTIFICATION_TYPES,
  sendNotifications,
} from '../../shared/utils/notification.helper.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '../../shared/errors/AllErrors.js';

export class AttendanceService {
  private repo: AttendanceRepository;

  constructor() {
    this.repo = new AttendanceRepository();
  }

  // Lấy session và kiểm tra branch scope
  private async resolveSession(sessionId: string, requester: any) {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) throw new NotFoundError('Buổi học');

    if (session.status === 'cancelled') {
      throw new BadRequestError('Buổi học đã bị hủy, không thể thao tác điểm danh');
    }

    if (requester.role !== ROLES.SYSTEM_OWNER && session.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Buổi học không thuộc cơ sở của bạn');
    }

    return session;
  }

  // 7.1 Điểm danh toàn bộ buổi học (chỉ GV của lớp)
  async markSession(
    sessionId: string,
    data: { records: { student_id: string; status: string }[] },
    requester: any
  ) {
    const session = await this.resolveSession(sessionId, requester);

    // checkIsClassTeacher: chỉ GV được phân công mới điểm danh lần đầu
    if (session.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy buổi học này');
    }

    // 409 nếu buổi đã điểm danh — phải dùng API 7.2 để sửa
    if (session.attendanceStatus === 'submitted') {
      throw new ConflictError(
        'Buổi học này đã được điểm danh. Dùng PATCH /sessions/:sessionId/attendance/:studentId để sửa.'
      );
    }

    // Lấy danh sách HS đang học trong lớp để validate
    const enrollments = await this.repo.findActiveEnrollmentsByClass(session.classId.toString());
    const enrolledIds = new Set(enrollments.map(e => e.studentId.toString()));

    const skipped: string[] = [];
    const toCreate = data.records.filter(r => {
      if (!enrolledIds.has(r.student_id)) {
        skipped.push(r.student_id);
        return false;
      }
      return true;
    });

    if (toCreate.length === 0) {
      throw new BadRequestError('Không có học sinh hợp lệ nào trong danh sách điểm danh');
    }

    const teacherId = session.teacherId
      ? new Types.ObjectId(session.teacherId.toString())
      : null;

    const attendanceRecords = await Promise.all(
      toCreate.map(r =>
        this.repo.createAttendance({
          sessionId: new Types.ObjectId(sessionId),
          studentId: new Types.ObjectId(r.student_id),
          classId: session.classId,
          branchId: session.branchId,
          teacherId,
          status: r.status,
          sessionDate: session.sessionDate,
        })
      )
    );

    await this.repo.updateSessionAttendanceStatus(sessionId, 'submitted');

    const totalPresent = attendanceRecords.filter(r => r.status === 'present').length;
    const totalAbsent = attendanceRecords.filter(r => r.status === 'absent').length;

    const cls = await Class.findById(session.classId).lean();
    const studentIds = attendanceRecords.map(record => record.studentId.toString());
    const recipients = [
      ...studentIds,
      ...await getRelatedParentIds(studentIds),
      ...await getBranchOwnerAndStaffIds(session.branchId),
    ];
    await sendNotifications(recipients, {
      branchId: session.branchId,
      type: NOTIFICATION_TYPES.ATTENDANCE_MARKED,
      title: `Đã điểm danh: ${cls?.name ?? 'Buổi học'}`,
      content: `Buổi học ${cls?.name ? `lớp ${cls.name} ` : ''}ngày ${session.sessionDate.toLocaleDateString('vi-VN')} đã được điểm danh: ${totalPresent} có mặt, ${totalAbsent} vắng.`,
      actionUrl: `/sessions/${sessionId}/attendance`,
      metadata: {
        classId: session.classId.toString(),
        sessionId,
        totalPresent,
        totalAbsent,
        markedBy: requester.id,
        markedByRole: requester.role,
      },
      excludeUserIds: [requester.id],
    });

    return {
      session_id: sessionId,
      total_present: totalPresent,
      total_absent: totalAbsent,
      attendance_records: attendanceRecords,
      notifications_queued: totalAbsent,
      skipped_student_ids: skipped,
    };
  }

  // 7.2 Sửa điểm danh (sau khi đã submit) — TC + SO/BO/ST
  async updateAttendance(
    sessionId: string,
    studentId: string,
    data: { status: string; reason?: string },
    requester: any
  ) {
    const session = await this.resolveSession(sessionId, requester);

    if (requester.role === ROLES.TEACHER && session.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy buổi học này');
    }

    const existing = await this.repo.findAttendanceRecord(sessionId, studentId);
    if (!existing) throw new NotFoundError('Bản ghi điểm danh');

    if (existing.status === data.status) {
      throw new BadRequestError('Trạng thái điểm danh không thay đổi');
    }

    const before = { status: existing.status };
    const updated = await this.repo.updateAttendanceRecord(
      existing,
      data.status,
      new Types.ObjectId(requester.id),
      data.reason
    );

    // Ghi audit log UPDATE_SCORE vì ảnh hưởng đến học phí
    await this.repo.createAuditLog({
      action: 'UPDATE_SCORE',
      actorId: new Types.ObjectId(requester.id),
      actorRole: requester.role,
      branchId: session.branchId,
      targetId: existing._id as Types.ObjectId,
      before,
      after: { status: data.status, reason: data.reason },
    });

    return updated;
  }

  // 7.3 Xem điểm danh của một buổi học — TC + SO/BO/ST
  async getSessionAttendance(sessionId: string, requester: any) {
    const session = await this.resolveSession(sessionId, requester);

    if (requester.role === ROLES.TEACHER && session.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy buổi học này');
    }

    const records = await this.repo.findAttendancesBySession(sessionId);

    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;

    return {
      session_id: sessionId,
      session_date: session.sessionDate,
      attendance_status: session.attendanceStatus,
      records: records.map(r => ({
        student_id: (r.studentId as any)?._id ?? r.studentId,
        student_name: (r.studentId as any)?.fullName ?? null,
        status: r.status,
        marked_at: r.markedAt,
      })),
      summary: {
        present,
        absent,
        total: records.length,
      },
    };
  }

  // 7.4 Thống kê điểm danh của học sinh
  async getStudentAttendanceSummary(studentId: string, query: any, requester: any) {
    const student = await User.findById(studentId).lean();
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const isSelf = requester.id === studentId;
    const isParent =
      requester.role === ROLES.PARENT &&
      student.studentInfo?.parentIds?.map(String).includes(requester.id);
    const isStaff =
      [ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER].includes(requester.role) &&
      (requester.role === ROLES.SYSTEM_OWNER || student.branchId?.toString() === requester.branchId);

    if (!isSelf && !isParent && !isStaff) {
      throw new ForbiddenError('Không có quyền xem thống kê điểm danh của học sinh này');
    }

    if (!query.class_id) throw new BadRequestError('Thiếu tham số class_id');
    if (!query.from || !query.to) throw new BadRequestError('Thiếu khoảng thời gian (from, to)');

    const fromDate = new Date(query.from);
    const toDate = new Date(new Date(query.to).setHours(23, 59, 59, 999));

    const records = await this.repo.getAttendanceSummary(
      studentId,
      query.class_id,
      fromDate,
      toDate
    );

    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const total = records.length;

    return {
      student_id: studentId,
      class_id: query.class_id,
      period: { from: query.from, to: query.to },
      total_sessions: total,
      present,
      absent,
      attendance_rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      detail: records.map(r => ({
        session_date: r.sessionDate,
        status: r.status,
      })),
    };
  }
}
