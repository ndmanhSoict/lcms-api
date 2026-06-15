import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { TeacherRepository } from './teacher.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../shared/errors/AllErrors.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { Class } from '../../models/class.model.js';
import { ClassSession, IClassSession } from '../../models/classSession.model.js';
import { Assignment } from '../../models/assignment.model.js';
import { Submission } from '../../models/submission.model.js';
import { Notification } from '../../models/notification.model.js';
import { Message } from '../../models/message.model.js';
import { IUser, User } from '../../models/user.model.js';
import { normalizeVietnamPhone } from '../../shared/utils/validators.js';

type PayableSession = Omit<IClassSession, 'classId'> & {
  classId: Types.ObjectId | PopulatedClassSummary;
};

const DEFAULT_TEACHER_RATE_PER_SESSION = 200000;

export class TeacherService {
  private repo: TeacherRepository;

  constructor() {
    this.repo = new TeacherRepository();
  }

  private assertBranchScope(teacherBranchId: string, requester: RequestUser) {
    if (requester.role === ROLES.SYSTEM_OWNER) return;
    if (teacherBranchId?.toString() !== requester.branchId?.toString()) {
      throw new ForbiddenError('Giáo viên không thuộc cơ sở của bạn');
    }
  }

  private startOfDay(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private endOfDay(date: Date) {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private getBillingPeriodRange(period: string) {
    const [year, month] = period.split('-').map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);
    return { from, to };
  }

  private serializeSalarySession(session: PayableSession) {
    const cls = session.classId as PopulatedClassSummary;
    return {
      _id: session._id,
      session_id: session._id,
      class_id: cls?._id ?? session.classId,
      class_name: cls?.name ?? 'Lớp học',
      class_code: cls?.classCode ?? '',
      subject_name: cls?.subject?.name ?? '',
      session_date: session.sessionDate,
      start_time: session.startTime,
      end_time: session.endTime,
      status: session.status,
      attendance_status: session.attendanceStatus,
    };
  }

  private serializeSalaryTeacher(teacher: Pick<IUser, '_id' | 'fullName' | 'userCode' | 'email'>) {
    return {
      _id: teacher._id,
      full_name: teacher.fullName,
      user_code: teacher.userCode ?? null,
      email: teacher.email,
    };
  }

  private buildSalaryClassSummary(sessions: PayableSession[], ratePerSession: number) {
    const classSummary = sessions.reduce<
      Record<string, { class_name: string; subject_name: string; sessions: number }>
    >((acc, session) => {
      const cls = session.classId as PopulatedClassSummary;
      const classId = cls?._id?.toString?.() ?? session.classId?.toString?.() ?? 'unknown';
      if (!acc[classId]) {
        acc[classId] = {
          class_name: cls?.name ?? 'Lớp học',
          subject_name: cls?.subject?.name ?? '',
          sessions: 0,
        };
      }
      acc[classId].sessions += 1;
      return acc;
    }, {});

    return Object.entries(classSummary).map(([classId, item]) => ({
      class_id: classId,
      ...item,
      amount: item.sessions * ratePerSession,
    }));
  }

  async createTeacher(data: AppPayload, requester: RequestUser) {
    if (!data.email || !data.password || !requester.branchId) {
      throw new BadRequestError('Thiếu email, mật khẩu hoặc cơ sở');
    }

    const existing = await this.repo.findByEmail(data.email);
    if (existing) throw new ConflictError('Email này đã được sử dụng');

    const phone = normalizeVietnamPhone(data.phone);
    if (phone) {
      const existingPhone = await User.findOne({ phone, deletedAt: null }).lean();
      if (existingPhone) throw new ConflictError('Số điện thoại này đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const teacherData: Partial<IUser> = {
      fullName: data.fullName,
      email: data.email,
      phone,
      passwordHash,
      role: ROLES.TEACHER,
      branchId: new Types.ObjectId(requester.branchId),
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      gender: data.gender,
      isActive: true,
      userCode: `GV${Date.now()}`,
      teacherInfo: {
        subjects: data.teacherInfo?.subjects ?? [],
        joinDate: data.teacherInfo?.joinDate ? new Date(data.teacherInfo.joinDate) : undefined,
        activeClassIds: [],
      },
      createdBy: requester.userId,
    };

    return await this.repo.create(teacherData);
  }

  async getTeachers(query: AppQuery, requester: RequestUser) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IUser> = {
      role: ROLES.TEACHER,
      deletedAt: null,
      branchId: requester.branchId,
    };

    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.subject) filter['teacherInfo.subjects'] = query.subject;
    if (query.search) filter.fullName = { $regex: query.search, $options: 'i' };

    const { teachers, totalItems } = await this.repo.findAllPaginated(filter, skip, limit);
    return { teachers, totalItems, page, limit };
  }

  async getTeacherById(id: string, requester: RequestUser) {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new NotFoundError('Giáo viên');
    this.assertBranchScope(teacher.branchId?.toString() ?? '', requester);
    return teacher;
  }

  async getMyOverview(requester: RequestUser) {
    if (requester.role !== ROLES.TEACHER) {
      throw new ForbiddenError('Chỉ giáo viên mới có quyền xem tổng quan giáo viên');
    }

    const teacher = await this.repo.findById(requester.id);
    if (!teacher) throw new NotFoundError('Giáo viên');

    const teacherId = new Types.ObjectId(requester.id);
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const todayEnd = this.endOfDay(now);
    const next7Days = this.endOfDay(this.addDays(now, 7));

    const [
      classStats,
      totalStudentsAgg,
      todaySessions,
      upcomingSessions,
      pendingAttendanceCount,
      assignmentStats,
      pendingSubmissions,
      unreadNotifications,
      unreadMessages,
    ] = await Promise.all([
      Class.aggregate([
        { $match: { teacherId, branchId: teacher.branchId, deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Class.aggregate([
        {
          $match: {
            teacherId,
            branchId: teacher.branchId,
            deletedAt: null,
            status: { $in: ['active', 'upcoming'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$studentCount' } } },
      ]),
      ClassSession.find({
        teacherId,
        branchId: teacher.branchId,
        deletedAt: null,
        status: { $ne: 'cancelled' },
        sessionDate: { $gte: todayStart, $lte: todayEnd },
      })
        .populate({
          path: 'classId',
          select: 'name subject branchId',
          match: { branchId: teacher.branchId },
        })
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(10)
        .lean(),
      ClassSession.find({
        teacherId,
        branchId: teacher.branchId,
        deletedAt: null,
        status: 'scheduled',
        sessionDate: { $gt: todayEnd, $lte: next7Days },
      })
        .populate({
          path: 'classId',
          select: 'name subject branchId',
          match: { branchId: teacher.branchId },
        })
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(10)
        .lean(),
      ClassSession.countDocuments({
        teacherId,
        branchId: teacher.branchId,
        deletedAt: null,
        status: 'scheduled',
        attendanceStatus: 'pending',
        sessionDate: { $lte: todayEnd },
      }),
      Assignment.aggregate([
        { $match: { teacherId, branchId: teacher.branchId, deletedAt: null } },
        {
          $group: {
            _id: null,
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
            due_soon: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'active'] },
                      { $gte: ['$dueDate', now] },
                      { $lte: ['$dueDate', next7Days] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Submission.aggregate([
        {
          $match: {
            status: { $in: ['submitted', 'revision_requested'] },
            branchId: teacher.branchId,
          },
        },
        {
          $lookup: {
            from: 'assignments',
            localField: 'assignmentId',
            foreignField: '_id',
            as: 'assignment',
          },
        },
        { $unwind: '$assignment' },
        { $match: { 'assignment.teacherId': teacherId, 'assignment.deletedAt': null } },
        { $count: 'count' },
      ]),
      Notification.countDocuments({ recipientId: teacherId, isRead: false }),
      Message.countDocuments({ receiverId: teacherId, isRead: false, deletedAt: null }),
    ]);

    const byStatus = classStats.reduce<Record<string, number>>((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return {
      profile: teacher,
      class_summary: {
        total: classStats.reduce((sum, item) => sum + item.count, 0),
        active: byStatus.active ?? 0,
        upcoming: byStatus.upcoming ?? 0,
        completed: byStatus.completed ?? 0,
        total_students: totalStudentsAgg[0]?.total ?? 0,
      },
      schedule: {
        today_sessions: todaySessions,
        upcoming_sessions: upcomingSessions,
        pending_attendance_count: pendingAttendanceCount,
      },
      assignments: {
        active: assignmentStats[0]?.active ?? 0,
        draft: assignmentStats[0]?.draft ?? 0,
        due_soon: assignmentStats[0]?.due_soon ?? 0,
        pending_submissions: pendingSubmissions[0]?.count ?? 0,
      },
      communication: {
        unread_notifications: unreadNotifications,
        unread_messages: unreadMessages,
      },
      as_of: new Date().toISOString(),
    };
  }

  async getSalaryOverview(query: AppQuery, requester: RequestUser) {
    const teacherId = requester.role === ROLES.TEACHER ? requester.id : query.teacher_id;
    if (!teacherId) throw new BadRequestError('Vui lòng chọn giáo viên cần xem kỳ lương');

    const teacher = await this.repo.findById(teacherId);
    if (!teacher) throw new NotFoundError('Giáo viên');

    if (requester.role === ROLES.TEACHER && teacherId !== requester.id) {
      throw new ForbiddenError('Bạn chỉ được xem bảng lương của chính mình');
    }
    if (requester.role !== ROLES.TEACHER) {
      this.assertBranchScope(teacher.branchId?.toString() ?? '', requester);
    }

    if (!query.billing_period) throw new BadRequestError('Vui lòng chọn kỳ lương');
    const { from, to } = this.getBillingPeriodRange(query.billing_period);
    const branchId = teacher.branchId?.toString() ?? '';
    const [sessions, stats] = await Promise.all([
      this.repo.findPayableSessions(teacherId, branchId, from, to),
      this.repo.getSalaryPeriodSessionStats(teacherId, branchId, from, to),
    ]);

    const payableSessions = sessions as PayableSession[];
    const latestSession = payableSessions[payableSessions.length - 1] ?? null;

    return {
      teacher: this.serializeSalaryTeacher(teacher),
      billing_period: query.billing_period,
      period_start: from,
      period_end: to,
      default_rate_per_session: DEFAULT_TEACHER_RATE_PER_SESSION,
      scheduled_session_count: stats.total,
      payable_session_count: payableSessions.length,
      completed_session_count: stats.completed,
      attendance_submitted_count: stats.submitted,
      pending_attendance_count: stats.pendingAttendance,
      pending_salary_session_count: Math.max(0, stats.total - payableSessions.length),
      estimated_base_amount: payableSessions.length * DEFAULT_TEACHER_RATE_PER_SESSION,
      class_count: new Set(
        payableSessions.map((session) => {
          const cls = session.classId as PopulatedClassSummary;
          return cls?._id?.toString?.() ?? session.classId?.toString?.() ?? 'unknown';
        })
      ).size,
      class_summary: this.buildSalaryClassSummary(
        payableSessions,
        DEFAULT_TEACHER_RATE_PER_SESSION
      ),
      latest_session: latestSession ? this.serializeSalarySession(latestSession) : null,
      generated_at: new Date().toISOString(),
    };
  }

  async calculateSalary(query: AppQuery, requester: RequestUser) {
    const teacherId = requester.role === ROLES.TEACHER ? requester.id : query.teacher_id;
    if (!teacherId) throw new BadRequestError('Vui lòng chọn giáo viên cần tính lương');

    const teacher = await this.repo.findById(teacherId);
    if (!teacher) throw new NotFoundError('Giáo viên');

    if (requester.role === ROLES.TEACHER && teacherId !== requester.id) {
      throw new ForbiddenError('Bạn chỉ được xem bảng lương của chính mình');
    }
    if (requester.role !== ROLES.TEACHER) {
      this.assertBranchScope(teacher.branchId?.toString() ?? '', requester);
    }

    if (!query.billing_period) throw new BadRequestError('Vui lòng chọn kỳ lương');
    const { from, to } = this.getBillingPeriodRange(query.billing_period);
    const sessions = await this.repo.findPayableSessions(
      teacherId,
      teacher.branchId?.toString() ?? '',
      from,
      to
    );
    const sessionCount = sessions.length;
    const ratePerSession = Number(query.rate_per_session ?? 0);
    const bonusAmount = Number(query.bonus_amount ?? 0);
    const deductionAmount = Number(query.deduction_amount ?? 0);
    const baseAmount = sessionCount * ratePerSession;
    const totalAmount = Math.max(0, baseAmount + bonusAmount - deductionAmount);

    return {
      teacher: this.serializeSalaryTeacher(teacher),
      billing_period: query.billing_period,
      rate_per_session: ratePerSession,
      session_count: sessionCount,
      base_amount: baseAmount,
      bonus_amount: bonusAmount,
      deduction_amount: deductionAmount,
      total_amount: totalAmount,
      note: query.note ?? null,
      class_summary: this.buildSalaryClassSummary(sessions as PayableSession[], ratePerSession),
      sessions: sessions.map(session => this.serializeSalarySession(session as PayableSession)),
      generated_at: new Date().toISOString(),
    };
  }

  async updateTeacher(id: string, data: AppPayload, requester: RequestUser) {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new NotFoundError('Giáo viên');
    this.assertBranchScope(teacher.branchId?.toString() ?? '', requester);

    const set: EntityPatch = {};
    if (data.fullName !== undefined) set.fullName = data.fullName;
    if (data.phone !== undefined) {
      const phone = normalizeVietnamPhone(data.phone);
      if (phone) {
        const existingPhone = await User.findOne({
          _id: { $ne: id },
          phone,
          deletedAt: null,
        }).lean();
        if (existingPhone) throw new ConflictError('Số điện thoại này đã được sử dụng');
      }
      set.phone = phone ?? null;
    }
    if (data.dateOfBirth !== undefined) set.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) set.gender = data.gender;
    if (data.avatarUrl !== undefined) set.avatarUrl = data.avatarUrl;
    if (data.teacherInfo?.subjects !== undefined)
      set['teacherInfo.subjects'] = data.teacherInfo.subjects;
    if (data.teacherInfo?.joinDate !== undefined)
      set['teacherInfo.joinDate'] = data.teacherInfo.joinDate;

    return await this.repo.updateById(id, { $set: set });
  }

  async deleteTeacher(id: string, requester: RequestUser) {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new NotFoundError('Giáo viên');
    this.assertBranchScope(teacher.branchId?.toString() ?? '', requester);

    const activeClassCount = teacher.teacherInfo?.activeClassIds?.length ?? 0;
    if (activeClassCount > 0) {
      throw new BadRequestError(
        `Không thể xóa giáo viên đang phụ trách ${activeClassCount} lớp học. Hãy chuyển hoặc đóng lớp trước.`
      );
    }

    await this.repo.revokeAllTokens(id);
    await this.repo.softDelete(id, requester.id);

    console.log(`[Audit] DELETE_TEACHER by ${requester.id}: ${teacher.email}`);
    return { deleted: true, teacherId: id };
  }
}
