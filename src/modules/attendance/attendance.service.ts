import { Types } from 'mongoose';
import { AttendanceRepository } from './attendance.repository.js';
import { User } from '../../models/user.model.js';
import { Class } from '../../models/class.model.js';
import { ATTENDANCE_STATUS, AttendanceStatus, ROLES } from '../../shared/constants/roles.js';
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

interface PopulatedAttendanceStudent {
  _id: Types.ObjectId;
  fullName?: string;
  userCode?: string;
}

interface PopulatedAttendanceClass {
  _id: Types.ObjectId;
  name?: string;
  classCode?: string;
  subject?: { name?: string };
  teacherSnapshot?: { fullName?: string };
}

interface PopulatedAttendanceSession {
  _id: Types.ObjectId;
  note?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  attendanceStatus?: string;
}

export class AttendanceService {
  private repo: AttendanceRepository;

  constructor() {
    this.repo = new AttendanceRepository();
  }

  private getPopulatedEntity<T>(value: unknown): T | null {
    return value && typeof value === 'object' && '_id' in value ? (value as T) : null;
  }

  private normalizeAttendanceStatus(status: unknown): AttendanceStatus {
    return status === ATTENDANCE_STATUS.PRESENT
      ? ATTENDANCE_STATUS.PRESENT
      : ATTENDANCE_STATUS.ABSENT;
  }

  private async resolveAuthorizedStudent(studentId: string, requester: RequestUser) {
    const student = await User.findById(studentId).lean();
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const isSelf = requester.id === studentId;
    const isParent =
      requester.role === ROLES.PARENT &&
      student.branchId?.toString() === requester.branchId?.toString() &&
      student.studentInfo?.parentIds?.map(String).includes(requester.id);
    const isStaff =
      ([ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER] as string[]).includes(
        requester.role
      ) &&
      (requester.role === ROLES.SYSTEM_OWNER ||
        student.branchId?.toString() === requester.branchId);

    if (!isSelf && !isParent && !isStaff) {
      throw new ForbiddenError('Không có quyền xem điểm danh của học sinh này');
    }

    return student;
  }

  private parseDate(value: unknown, fallback: Date, endOfDay = false) {
    if (!value) return fallback;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Khoảng thời gian không hợp lệ');
    if (endOfDay) date.setHours(23, 59, 59, 999);
    else date.setHours(0, 0, 0, 0);
    return date;
  }

  // Lấy session và kiểm tra branch scope
  private async resolveSession(sessionId: string, requester: RequestUser) {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) throw new NotFoundError('Buổi học');

    if (session.status === 'cancelled') {
      throw new BadRequestError('Buổi học đã bị hủy, không thể thao tác điểm danh');
    }

    if (
      requester.role !== ROLES.SYSTEM_OWNER &&
      session.branchId.toString() !== requester.branchId
    ) {
      throw new ForbiddenError('Buổi học không thuộc cơ sở của bạn');
    }

    return session;
  }

  // 7.1 Điểm danh toàn bộ buổi học (chỉ GV của lớp)
  async markSession(
    sessionId: string,
    data: { records: { student_id: string; status: AttendanceStatus }[] },
    requester: RequestUser
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
    const enrollments = await this.repo.findActiveEnrollmentsByClass(
      session.classId.toString(),
      session.branchId.toString()
    );
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

    const teacherId = session.teacherId ? new Types.ObjectId(session.teacherId.toString()) : null;

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

    const totalPresent = attendanceRecords.filter(
      r => this.normalizeAttendanceStatus(r.status) === ATTENDANCE_STATUS.PRESENT
    ).length;
    const totalAbsent = attendanceRecords.length - totalPresent;

    const cls = await Class.findById(session.classId).lean();
    const studentIds = attendanceRecords.map(record => record.studentId.toString());
    const recipients = [
      ...studentIds,
      ...(await getRelatedParentIds(studentIds)),
      ...(await getBranchOwnerAndStaffIds(session.branchId)),
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
    data: { status: AttendanceStatus; reason?: string },
    requester: RequestUser
  ) {
    const session = await this.resolveSession(sessionId, requester);

    if (requester.role === ROLES.TEACHER && session.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy buổi học này');
    }

    const existing = await this.repo.findAttendanceRecord(
      sessionId,
      studentId,
      session.branchId.toString()
    );
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
  async getSessionAttendance(sessionId: string, requester: RequestUser) {
    const session = await this.resolveSession(sessionId, requester);

    if (requester.role === ROLES.TEACHER && session.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy buổi học này');
    }

    const records = await this.repo.findAttendancesBySession(
      sessionId,
      session.branchId.toString()
    );

    const normalizedRecords = records.map(r => ({
      ...r,
      status: this.normalizeAttendanceStatus(r.status),
    }));
    const present = normalizedRecords.filter(r => r.status === ATTENDANCE_STATUS.PRESENT).length;
    const absent = normalizedRecords.length - present;

    return {
      session_id: sessionId,
      session_date: session.sessionDate,
      attendance_status: session.attendanceStatus,
      records: normalizedRecords.map(r => ({
        student_id: (r.studentId as PopulatedUserSummary)._id ?? r.studentId,
        student_name: (r.studentId as PopulatedUserSummary).fullName ?? null,
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
  async getStudentAttendanceSummary(studentId: string, query: AppQuery, requester: RequestUser) {
    const student = await this.resolveAuthorizedStudent(studentId, requester);
    const isSelf = requester.id === studentId;
    const isParent = requester.role === ROLES.PARENT;

    if (!query.class_id) throw new BadRequestError('Thiếu tham số class_id');
    if (!query.from || !query.to) throw new BadRequestError('Thiếu khoảng thời gian (from, to)');
    const cls = await Class.findOne({ _id: query.class_id, deletedAt: null }).lean();
    if (!cls) throw new NotFoundError('Lớp học');
    if (cls.branchId.toString() !== student.branchId?.toString()) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của học sinh');
    }
    if (
      requester.role !== ROLES.SYSTEM_OWNER &&
      cls.branchId.toString() !== requester.branchId &&
      !isSelf &&
      !isParent
    ) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }

    const fromDate = new Date(query.from);
    const toDate = new Date(new Date(query.to).setHours(23, 59, 59, 999));

    const records = await this.repo.getAttendanceSummary(
      studentId,
      query.class_id,
      student.branchId?.toString() ?? '',
      fromDate,
      toDate
    );

    const normalizedRecords = records.map(r => ({
      ...r,
      status: this.normalizeAttendanceStatus(r.status),
    }));
    const present = normalizedRecords.filter(r => r.status === ATTENDANCE_STATUS.PRESENT).length;
    const absent = normalizedRecords.length - present;
    const total = normalizedRecords.length;

    return {
      student_id: studentId,
      class_id: query.class_id,
      period: { from: query.from, to: query.to },
      total_sessions: total,
      present,
      absent,
      attendance_rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      detail: normalizedRecords.map(r => ({
        session_date: r.sessionDate,
        status: r.status,
      })),
    };
  }

  // 7.5 Lịch sử điểm danh chi tiết của học sinh
  async getStudentAttendanceHistory(studentId: string, query: AppQuery, requester: RequestUser) {
    const student = await this.resolveAuthorizedStudent(studentId, requester);
    const branchId = student.branchId?.toString();
    if (!branchId) throw new BadRequestError('Học sinh chưa được gán cơ sở');

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 90);
    defaultFrom.setHours(0, 0, 0, 0);

    const fromDate = this.parseDate(query.from, defaultFrom);
    const toDate = this.parseDate(query.to, now, true);
    if (fromDate > toDate) throw new BadRequestError('Ngày bắt đầu phải trước ngày kết thúc');

    const classId = query.class_id?.toString();
    if (classId && !Types.ObjectId.isValid(classId)) {
      throw new BadRequestError('class_id không hợp lệ');
    }

    const status = query.status?.toString() as AttendanceStatus | undefined;
    if (status && !Object.values(ATTENDANCE_STATUS).includes(status)) {
      throw new BadRequestError('Trạng thái điểm danh không hợp lệ');
    }

    const records = await this.repo.findStudentAttendanceHistory(
      studentId,
      branchId,
      fromDate,
      toDate,
      { classId, status }
    );

    const normalizedRecords = records.map(record => ({
      ...record,
      status: this.normalizeAttendanceStatus(record.status),
    }));
    const present = normalizedRecords.filter(
      record => record.status === ATTENDANCE_STATUS.PRESENT
    ).length;
    const absent = normalizedRecords.length - present;
    const total = normalizedRecords.length;

    return {
      records: normalizedRecords.map(record => {
        const studentItem = this.getPopulatedEntity<PopulatedAttendanceStudent>(record.studentId);
        const classItem = this.getPopulatedEntity<PopulatedAttendanceClass>(record.classId);
        const session = this.getPopulatedEntity<PopulatedAttendanceSession>(record.sessionId);

        return {
          id: record._id,
          student_id: studentItem?._id ?? record.studentId,
          student_name: studentItem?.fullName ?? student.fullName,
          student_code: studentItem?.userCode ?? student.userCode ?? '',
          class_id: classItem?._id ?? record.classId,
          class_name: classItem?.name ?? 'Lớp học',
          class_code: classItem?.classCode ?? '',
          subject_name: classItem?.subject?.name ?? 'Môn học',
          teacher_name: classItem?.teacherSnapshot?.fullName ?? 'Giáo viên',
          session_id: session?._id ?? record.sessionId,
          topic: session?.note ?? 'Nội dung buổi học',
          start_time: session?.startTime ?? '',
          end_time: session?.endTime ?? '',
          session_status: session?.status ?? '',
          attendance_status: session?.attendanceStatus ?? '',
          status: record.status,
          session_date: record.sessionDate,
          marked_at: record.markedAt,
          edited_count: record.editHistory?.length ?? 0,
        };
      }),
      summary: {
        total,
        present,
        absent,
        attendance_rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      },
      filters: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        class_id: classId ?? null,
        status: status ?? null,
      },
      as_of: new Date().toISOString(),
    };
  }
}
