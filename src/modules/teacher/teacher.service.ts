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
import { ClassSession } from '../../models/classSession.model.js';
import { Assignment } from '../../models/assignment.model.js';
import { Submission } from '../../models/submission.model.js';
import { Notification } from '../../models/notification.model.js';
import { Message } from '../../models/message.model.js';

export class TeacherService {
  private repo: TeacherRepository;

  constructor() {
    this.repo = new TeacherRepository();
  }

  private assertBranchScope(teacherBranchId: string, requester: any) {
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

  async createTeacher(data: any, requester: any) {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) throw new ConflictError('Email này đã được sử dụng');

    const passwordHash = await bcrypt.hash(data.password, 12);

    return await this.repo.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone ?? null,
      passwordHash,
      role: ROLES.TEACHER,
      branchId: requester.branchId,
      dateOfBirth: data.dateOfBirth ?? null,
      gender: data.gender ?? null,
      isActive: true,
      userCode: `GV${Date.now()}`,
      teacherInfo: {
        subjects: data.teacherInfo?.subjects ?? [],
        joinDate: data.teacherInfo?.joinDate ?? null,
        activeClassIds: [],
      },
      createdBy: requester.id,
    } as any);
  }

  async getTeachers(query: any, requester: any) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: any = { role: ROLES.TEACHER, deletedAt: null, branchId: requester.branchId };

    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.subject) filter['teacherInfo.subjects'] = query.subject;
    if (query.search) filter.fullName = { $regex: query.search, $options: 'i' };

    const { teachers, totalItems } = await this.repo.findAllPaginated(filter, skip, limit);
    return { teachers, totalItems, page, limit };
  }

  async getTeacherById(id: string, requester: any) {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new NotFoundError('Giáo viên');
    this.assertBranchScope(teacher.branchId?.toString() ?? '', requester);
    return teacher;
  }

  async getMyOverview(requester: any) {
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
        { $match: { teacherId, deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Class.aggregate([
        { $match: { teacherId, deletedAt: null, status: { $in: ['active', 'upcoming'] } } },
        { $group: { _id: null, total: { $sum: '$studentCount' } } },
      ]),
      ClassSession.find({
        teacherId,
        deletedAt: null,
        status: { $ne: 'cancelled' },
        sessionDate: { $gte: todayStart, $lte: todayEnd },
      })
        .populate('classId', 'name subject')
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(10)
        .lean(),
      ClassSession.find({
        teacherId,
        deletedAt: null,
        status: 'scheduled',
        sessionDate: { $gt: todayEnd, $lte: next7Days },
      })
        .populate('classId', 'name subject')
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(10)
        .lean(),
      ClassSession.countDocuments({
        teacherId,
        deletedAt: null,
        status: 'scheduled',
        attendanceStatus: 'pending',
        sessionDate: { $lte: todayEnd },
      }),
      Assignment.aggregate([
        { $match: { teacherId, deletedAt: null } },
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
        { $match: { status: { $in: ['submitted', 'revision_requested'] }, branchId: teacher.branchId } },
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

  async updateTeacher(id: string, data: any, requester: any) {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new NotFoundError('Giáo viên');
    this.assertBranchScope(teacher.branchId?.toString() ?? '', requester);

    const set: any = {};
    if (data.fullName !== undefined) set.fullName = data.fullName;
    if (data.phone !== undefined) set.phone = data.phone;
    if (data.dateOfBirth !== undefined) set.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) set.gender = data.gender;
    if (data.avatarUrl !== undefined) set.avatarUrl = data.avatarUrl;
    if (data.teacherInfo?.subjects !== undefined) set['teacherInfo.subjects'] = data.teacherInfo.subjects;
    if (data.teacherInfo?.joinDate !== undefined) set['teacherInfo.joinDate'] = data.teacherInfo.joinDate;

    return await this.repo.updateById(id, { $set: set });
  }

  async deleteTeacher(id: string, requester: any) {
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
