import type { Request } from 'express';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ParentRepository } from './parent.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AllErrors.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { ClassSession } from '../../models/classSession.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Assignment } from '../../models/assignment.model.js';
import { GradeRecord } from '../../models/gradeRecord.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { Notification } from '../../models/notification.model.js';
import { Message } from '../../models/message.model.js';

export class ParentService {
  private repo: ParentRepository;

  constructor() {
    this.repo = new ParentRepository();
  }

  private generateParentCode() {
    return `PH${Date.now()}`;
  }

  private assertBranchScope(parentBranchId: string, requester: Request['user']) {
    if (!requester) throw new ForbiddenError();
    if (parentBranchId?.toString() !== requester.branchId?.toString()) {
      throw new ForbiddenError('Phụ huynh không thuộc cơ sở của bạn');
    }
  }

  private normalizeEmail(email?: string, phone?: string) {
    const trimmedEmail = email?.trim();
    if (trimmedEmail) return trimmedEmail;

    const phoneToken = phone?.replace(/\s+/g, '') || Date.now().toString();
    return `ph.${phoneToken}@lcms.internal`;
  }

  private uniqueStudentIds(studentIds?: string[]) {
    return [...new Set((studentIds ?? []).filter(Boolean))];
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

  private async validateStudents(studentIds: string[], branchId?: string) {
    if (!branchId) throw new ForbiddenError('Tài khoản hiện tại chưa được gán chi nhánh');
    if (studentIds.length === 0) return [];

    const students = await this.repo.findStudentsByIds(studentIds, branchId);
    if (students.length !== studentIds.length) {
      throw new BadRequestError('Một hoặc nhiều học sinh không tồn tại hoặc không thuộc cơ sở của bạn');
    }

    return students;
  }

  async createParent(data: any, requester: Request['user']) {
    if (!requester?.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại chưa được gán chi nhánh');
    }

    const studentIds = this.uniqueStudentIds(data.parentInfo?.studentIds);
    await this.validateStudents(studentIds, requester.branchId);

    const email = this.normalizeEmail(data.email, data.phone);
    const existing = await this.repo.findByEmail(email);
    if (existing) throw new ConflictError('Email này đã được sử dụng');

    const passwordHash = await bcrypt.hash(data.password || 'TempPass@123', 12);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const parent = await this.repo.create(
        {
          fullName: data.fullName,
          email,
          phone: data.phone,
          passwordHash,
          role: ROLES.PARENT,
          branchId: requester.branchId,
          dateOfBirth: data.dateOfBirth ?? null,
          gender: data.gender ?? null,
          avatarUrl: data.avatarUrl ?? null,
          isActive: data.isActive ?? true,
          userCode: this.generateParentCode(),
          createdBy: requester.id,
          parentInfo: {
            studentIds,
            relationship: data.parentInfo?.relationship ?? null,
          },
        } as any,
        session
      );

      await this.repo.addParentToStudents(studentIds, parent._id.toString(), session);

      await session.commitTransaction();
      const result = await this.repo.getParentDetail(parent._id.toString());
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getParents(query: any, requester: Request['user']) {
    if (!requester?.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại chưa được gán chi nhánh');
    }

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: any = { role: ROLES.PARENT, deletedAt: null, branchId: requester.branchId };

    if (query.search) filter.fullName = { $regex: query.search, $options: 'i' };
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.studentId) filter['parentInfo.studentIds'] = query.studentId;
    if (query.relationship) filter['parentInfo.relationship'] = query.relationship;

    const { parents, totalItems } = await this.repo.findAllPaginated(filter, skip, limit);
    return { parents, totalItems, page, limit };
  }

  async getParentById(id: string, requester: Request['user']) {
    const parent = await this.repo.getParentDetail(id);
    if (!parent) throw new NotFoundError('Phụ huynh');
    this.assertBranchScope(parent.branchId?.toString() ?? '', requester);
    return parent;
  }

  async getMyOverview(requester: Request['user']) {
    if (!requester || requester.role !== ROLES.PARENT) {
      throw new ForbiddenError('Chỉ phụ huynh mới có quyền xem tổng quan phụ huynh');
    }

    const parent = await this.repo.getParentDetail(requester.id);
    if (!parent) throw new NotFoundError('Phụ huynh');

    const parentId = new Types.ObjectId(requester.id);
    const children = parent.parentInfo?.studentIds ?? [];
    const studentIds = children.map((student: any) => new Types.ObjectId(student._id ?? student));
    const classIdStrings = [
      ...new Set(
        children.flatMap((student: any) =>
          (student.studentInfo?.activeClassIds ?? []).map((classId: any) => classId.toString())
        )
      ),
    ] as string[];
    const classIds = classIdStrings.map(id => new Types.ObjectId(id));

    const now = new Date();
    const todayStart = this.startOfDay(now);
    const todayEnd = this.endOfDay(now);
    const next7Days = this.endOfDay(this.addDays(now, 7));
    const last30Days = this.startOfDay(this.addDays(now, -30));

    const [
      todaySessions,
      upcomingSessions,
      attendanceByStudent,
      activeAssignments,
      latestGrades,
      unpaidAgg,
      unreadNotifications,
      unreadMessages,
    ] = await Promise.all([
      ClassSession.find({
        classId: { $in: classIds },
        deletedAt: null,
        status: { $ne: 'cancelled' },
        sessionDate: { $gte: todayStart, $lte: todayEnd },
      })
        .populate('classId', 'name subject')
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(20)
        .lean(),
      ClassSession.find({
        classId: { $in: classIds },
        deletedAt: null,
        status: 'scheduled',
        sessionDate: { $gt: todayEnd, $lte: next7Days },
      })
        .populate('classId', 'name subject')
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(20)
        .lean(),
      Attendance.aggregate([
        { $match: { studentId: { $in: studentIds }, sessionDate: { $gte: last30Days, $lte: todayEnd } } },
        {
          $group: {
            _id: '$studentId',
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          },
        },
      ]),
      Assignment.find({
        classId: { $in: classIds },
        deletedAt: null,
        status: 'active',
        visibleToParent: true,
      })
        .select('_id classId title dueDate assignmentType maxScore')
        .sort({ dueDate: 1 })
        .limit(15)
        .lean(),
      GradeRecord.find({ studentId: { $in: studentIds }, status: 'published' })
        .populate('classId', 'name subject')
        .populate('studentId', 'fullName userCode')
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(10)
        .lean(),
      Invoice.aggregate([
        { $match: { studentId: { $in: studentIds }, status: { $in: ['unpaid', 'overdue', 'partial'] }, deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      ]),
      Notification.countDocuments({ recipientId: parentId, isRead: false }),
      Message.countDocuments({ receiverId: parentId, isRead: false, deletedAt: null }),
    ]);

    const attendanceMap = new Map(
      attendanceByStudent.map(item => {
        const rate = item.total > 0 ? Math.round((item.present / item.total) * 1000) / 10 : 0;
        return [item._id.toString(), { total: item.total, present: item.present, absent: item.absent, attendance_rate: rate }];
      })
    );
    const unpaidSummary = unpaidAgg.reduce(
      (acc, item) => {
        acc.count += item.count;
        acc.amount += item.amount;
        acc.by_status[item._id] = { count: item.count, amount: item.amount };
        return acc;
      },
      { count: 0, amount: 0, by_status: {} as Record<string, { count: number; amount: number }> }
    );

    return {
      profile: parent,
      children: children.map((student: any) => ({
        ...student,
        attendance_last_30_days: attendanceMap.get(student._id.toString()) ?? {
          total: 0,
          present: 0,
          absent: 0,
          attendance_rate: 0,
        },
      })),
      schedule: {
        today_sessions: todaySessions,
        upcoming_sessions: upcomingSessions,
      },
      assignments: {
        active_visible: activeAssignments,
      },
      grades: {
        latest_published: latestGrades,
      },
      finance: {
        unpaid_invoices: unpaidSummary.count,
        unpaid_amount: unpaidSummary.amount,
        by_status: unpaidSummary.by_status,
      },
      communication: {
        unread_notifications: unreadNotifications,
        unread_messages: unreadMessages,
      },
      as_of: new Date().toISOString(),
    };
  }

  async updateParent(id: string, data: any, requester: Request['user']) {
    const parent = await this.repo.findById(id);
    if (!parent) throw new NotFoundError('Phụ huynh');
    this.assertBranchScope(parent.branchId?.toString() ?? '', requester);

    const currentStudentIds = (parent.parentInfo?.studentIds ?? []).map((studentId: any) => studentId.toString());
    const shouldUpdateStudents = data.parentInfo?.studentIds !== undefined;
    const nextStudentIds = shouldUpdateStudents
      ? this.uniqueStudentIds(data.parentInfo?.studentIds)
      : currentStudentIds;

    await this.validateStudents(nextStudentIds, requester?.branchId);

    if (data.email !== undefined && data.email !== parent.email) {
      const existing = await this.repo.findByEmail(data.email);
      if (existing && existing._id.toString() !== id) {
        throw new ConflictError('Email này đã được sử dụng');
      }
    }

    const set: any = {};
    if (data.fullName !== undefined) set.fullName = data.fullName;
    if (data.phone !== undefined) set.phone = data.phone;
    if (data.email !== undefined) set.email = data.email;
    if (data.dateOfBirth !== undefined) set.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) set.gender = data.gender;
    if (data.avatarUrl !== undefined) set.avatarUrl = data.avatarUrl;
    if (data.isActive !== undefined) set.isActive = data.isActive;
    if (data.parentInfo?.relationship !== undefined) {
      set['parentInfo.relationship'] = data.parentInfo.relationship;
    }
    if (shouldUpdateStudents) {
      set['parentInfo.studentIds'] = nextStudentIds;
    }

    const addedStudentIds = nextStudentIds.filter((studentId: string) => !currentStudentIds.includes(studentId));
    const removedStudentIds = currentStudentIds.filter((studentId: string) => !nextStudentIds.includes(studentId));

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await this.repo.updateById(id, { $set: set }, session);
      await this.repo.addParentToStudents(addedStudentIds, id, session);
      await this.repo.removeParentFromStudents(removedStudentIds, id, session);

      await session.commitTransaction();
      const result = await this.repo.getParentDetail(id);
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async deleteParent(id: string, requester: Request['user']) {
    const parent = await this.repo.findById(id);
    if (!parent) throw new NotFoundError('Phụ huynh');
    this.assertBranchScope(parent.branchId?.toString() ?? '', requester);

    const studentIds = (parent.parentInfo?.studentIds ?? []).map((studentId: any) => studentId.toString());

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await this.repo.removeParentFromStudents(studentIds, id, session);
      await this.repo.revokeAllTokens(id, session);
      await this.repo.softDelete(id, requester?.id ?? '', session);

      await session.commitTransaction();
      return { deleted: true, parentId: id };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
