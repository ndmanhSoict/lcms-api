import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ParentRepository } from './parent.repository.js';
import { ATTENDANCE_STATUS, ROLES } from '../../shared/constants/roles.js';
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
import { User, type IUser } from '../../models/user.model.js';
import type { IAttendance } from '../../models/attendance.model.js';
import { normalizeVietnamPhone } from '../../shared/utils/validators.js';

type EntityReference = ObjectIdLike | { _id?: ObjectIdLike };
type ParentStudentView = PopulatedUserSummary & {
  phone?: string;
  dateOfBirth?: Date;
  gender?: string;
};
type ParentDetailView = Omit<PopulatedUserSummary, 'parentInfo'> & {
  email?: string;
  phone?: string;
  branchId?: Types.ObjectId;
  dateOfBirth?: Date;
  gender?: string;
  deletedAt?: Date;
  parentInfo?: {
    studentIds?: Array<ParentStudentView | Types.ObjectId>;
    relationship?: string;
  };
};
type AttendanceAggregateRow = {
  _id: Types.ObjectId;
  total: number;
  present: number;
  absent: number;
};
type InvoiceAggregateRow = {
  _id: string;
  count: number;
  amount: number;
};
type AttendanceStudentView = Pick<PopulatedUserSummary, '_id' | 'fullName' | 'userCode'>;
type AttendanceClassView = PopulatedClassSummary & {
  teacherSnapshot?: { fullName?: string };
};
type AttendanceSessionView = {
  _id?: Types.ObjectId;
  topic?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  attendanceStatus?: string;
};
type AttendanceRecordView = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId | AttendanceStudentView;
  classId: Types.ObjectId | AttendanceClassView;
  sessionId: Types.ObjectId | AttendanceSessionView;
  status: string;
  sessionDate: Date;
  markedAt?: Date;
  editHistory?: unknown[];
};

export class ParentService {
  private repo: ParentRepository;

  constructor() {
    this.repo = new ParentRepository();
  }

  private generateParentCode() {
    return `PH${Date.now()}`;
  }

  private assertBranchScope(parentBranchId: string, requester: RequestUser) {
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

  private uniqueStudentIds(studentIds?: ObjectIdLike[]) {
    return [...new Set((studentIds ?? []).map(String).filter(Boolean))];
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

  private getEntityId(value: EntityReference | null | undefined): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toString();
    return value._id?.toString?.() ?? '';
  }

  private getPopulatedEntity<T extends { _id?: ObjectIdLike }>(
    value: ObjectIdLike | T | null | undefined
  ): T | undefined {
    if (!value || typeof value === 'string' || value instanceof Types.ObjectId) return undefined;
    return value;
  }

  private getOwnedStudentIds(parent: ParentDetailView) {
    return (parent.parentInfo?.studentIds ?? [])
      .map(student => this.getEntityId(student))
      .filter((studentId): studentId is string => Boolean(studentId));
  }

  private getSafeDate(value: string | number | Date | undefined, fallback: Date) {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date;
  }

  private normalizeAttendanceStatus(status: unknown) {
    return status === ATTENDANCE_STATUS.PRESENT
      ? ATTENDANCE_STATUS.PRESENT
      : ATTENDANCE_STATUS.ABSENT;
  }

  private async validateStudents(studentIds: string[], branchId?: string) {
    if (!branchId) throw new ForbiddenError('Tài khoản hiện tại chưa được gán chi nhánh');
    if (studentIds.length === 0) return [];

    const students = await this.repo.findStudentsByIds(studentIds, branchId);
    if (students.length !== studentIds.length) {
      throw new BadRequestError(
        'Một hoặc nhiều học sinh không tồn tại hoặc không thuộc cơ sở của bạn'
      );
    }

    return students;
  }

  async createParent(data: AppPayload, requester: RequestUser) {
    if (!requester.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại chưa được gán chi nhánh');
    }

    const studentIds = this.uniqueStudentIds(data.parentInfo?.studentIds);
    await this.validateStudents(studentIds, requester.branchId);

    const phone = normalizeVietnamPhone(data.phone);
    const email = this.normalizeEmail(data.email, phone);
    if (phone) {
      const existingPhone = await User.findOne({ phone, deletedAt: null }).lean();
      if (existingPhone) throw new ConflictError('Số điện thoại này đã được sử dụng');
    }
    const existing = await this.repo.findByEmail(email);
    if (existing) throw new ConflictError('Email này đã được sử dụng');

    const passwordHash = await bcrypt.hash(data.password || 'TempPass@123', 12);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const parentData: Partial<IUser> = {
        fullName: data.fullName,
        email,
        phone,
        passwordHash,
        role: ROLES.PARENT,
        branchId: new Types.ObjectId(requester.branchId),
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        gender: data.gender,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive ?? true,
        userCode: this.generateParentCode(),
        createdBy: new Types.ObjectId(requester.id),
        parentInfo: {
          studentIds: studentIds.map(studentId => new Types.ObjectId(studentId)),
          relationship: data.parentInfo?.relationship,
        },
      };

      const parent = await this.repo.create(parentData, session);

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

  async getParents(query: AppQuery, requester: RequestUser) {
    if (!requester.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại chưa được gán chi nhánh');
    }

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IUser> = {
      role: ROLES.PARENT,
      deletedAt: null,
      branchId: new Types.ObjectId(requester.branchId),
    };

    if (query.search) filter.fullName = { $regex: String(query.search), $options: 'i' };
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.studentId) filter['parentInfo.studentIds'] = new Types.ObjectId(query.studentId);
    if (query.relationship) filter['parentInfo.relationship'] = query.relationship;

    const { parents, totalItems } = await this.repo.findAllPaginated(filter, skip, limit);
    return { parents, totalItems, page, limit };
  }

  async getParentById(id: string, requester: RequestUser) {
    const parent = (await this.repo.getParentDetail(id)) as ParentDetailView | null;
    if (!parent) throw new NotFoundError('Phụ huynh');
    this.assertBranchScope(parent.branchId?.toString() ?? '', requester);
    return parent;
  }

  async getMyOverview(requester: RequestUser) {
    if (requester.role !== ROLES.PARENT) {
      throw new ForbiddenError('Chỉ phụ huynh mới có quyền xem tổng quan phụ huynh');
    }

    const parent = (await this.repo.getParentDetail(requester.id)) as ParentDetailView | null;
    if (!parent) throw new NotFoundError('Phụ huynh');
    this.assertBranchScope(parent.branchId?.toString() ?? '', requester);

    const parentId = new Types.ObjectId(requester.id);
    const children = (parent.parentInfo?.studentIds ?? [])
      .map(student => this.getPopulatedEntity<ParentStudentView>(student))
      .filter(
        (student): student is ParentStudentView =>
          Boolean(student) && student?.branchId?.toString() === parent.branchId?.toString()
      );
    const studentIds = children.map(student => new Types.ObjectId(student._id));
    const classIdStrings = [
      ...new Set(
        children.flatMap(student =>
          (student.studentInfo?.activeClassIds ?? [])
            .map(classId => this.getEntityId(classId))
            .filter((classId): classId is string => Boolean(classId))
        )
      ),
    ];
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
        branchId: parent.branchId,
        classId: { $in: classIds },
        deletedAt: null,
        status: { $ne: 'cancelled' },
        sessionDate: { $gte: todayStart, $lte: todayEnd },
      })
        .populate({
          path: 'classId',
          select: 'name subject branchId',
          match: { branchId: parent.branchId },
        })
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(20)
        .lean(),
      ClassSession.find({
        branchId: parent.branchId,
        classId: { $in: classIds },
        deletedAt: null,
        status: 'scheduled',
        sessionDate: { $gt: todayEnd, $lte: next7Days },
      })
        .populate({
          path: 'classId',
          select: 'name subject branchId',
          match: { branchId: parent.branchId },
        })
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(20)
        .lean(),
      Attendance.aggregate<AttendanceAggregateRow>([
        {
          $match: {
            branchId: parent.branchId,
            studentId: { $in: studentIds },
            sessionDate: { $gte: last30Days, $lte: todayEnd },
          },
        },
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
        branchId: parent.branchId,
        classId: { $in: classIds },
        deletedAt: null,
        status: 'active',
        visibleToParent: true,
      })
        .select('_id classId title dueDate assignmentType maxScore')
        .sort({ dueDate: 1 })
        .limit(15)
        .lean(),
      GradeRecord.find({
        branchId: parent.branchId,
        studentId: { $in: studentIds },
        status: 'published',
      })
        .populate({
          path: 'classId',
          select: 'name subject branchId',
          match: { branchId: parent.branchId },
        })
        .populate({
          path: 'studentId',
          select: 'fullName userCode branchId',
          match: { branchId: parent.branchId },
        })
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(10)
        .lean(),
      Invoice.aggregate<InvoiceAggregateRow>([
        {
          $match: {
            branchId: parent.branchId,
            studentId: { $in: studentIds },
            status: { $in: ['unpaid', 'overdue', 'partial'] },
            deletedAt: null,
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      ]),
      Notification.countDocuments({ recipientId: parentId, isRead: false }),
      Message.countDocuments({ receiverId: parentId, isRead: false, deletedAt: null }),
    ]);

    const attendanceMap = new Map(
      attendanceByStudent.map(item => {
        const rate = item.total > 0 ? Math.round((item.present / item.total) * 1000) / 10 : 0;
        return [
          item._id.toString(),
          { total: item.total, present: item.present, absent: item.absent, attendance_rate: rate },
        ];
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
      children: children.map(student => ({
        ...student,
        studentInfo: {
          ...student.studentInfo,
          activeClassIds: (student.studentInfo?.activeClassIds ?? []).filter(classId => {
            const cls = this.getPopulatedEntity<PopulatedClassSummary>(classId);
            return !cls || cls.branchId?.toString() === parent.branchId?.toString();
          }),
        },
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

  async getMyAttendance(query: AppQuery, requester: RequestUser) {
    if (requester.role !== ROLES.PARENT) {
      throw new ForbiddenError('Chỉ phụ huynh mới có quyền xem điểm danh học sinh');
    }

    const parent = (await this.repo.getParentDetail(requester.id)) as ParentDetailView | null;
    if (!parent) throw new NotFoundError('Phụ huynh');
    this.assertBranchScope(parent.branchId?.toString() ?? '', requester);

    const ownedStudentIds = (parent.parentInfo?.studentIds ?? [])
      .map(student => this.getPopulatedEntity<ParentStudentView>(student))
      .filter(
        (student): student is ParentStudentView =>
          Boolean(student) && student?.branchId?.toString() === parent.branchId?.toString()
      )
      .map(student => student._id.toString());
    const ownedStudentSet = new Set(ownedStudentIds);
    if (ownedStudentIds.length === 0) {
      return {
        records: [],
        summary: { total: 0, present: 0, absent: 0, attendance_rate: 0 },
        filters: {
          from: null,
          to: null,
          student_id: query.student_id ?? null,
          class_id: query.class_id ?? null,
          status: query.status ?? null,
        },
        as_of: new Date().toISOString(),
      };
    }

    const now = new Date();
    const from = this.startOfDay(this.getSafeDate(query.from, this.addDays(now, -90)));
    const to = this.endOfDay(this.getSafeDate(query.to, now));
    const requestedStudentId = query.student_id?.toString?.() ?? '';
    const studentIds =
      requestedStudentId && ownedStudentSet.has(requestedStudentId)
        ? [requestedStudentId]
        : ownedStudentIds;

    if (requestedStudentId && !ownedStudentSet.has(requestedStudentId)) {
      throw new ForbiddenError('Học sinh không thuộc tài khoản phụ huynh này');
    }

    const filter: MongoFilter<IAttendance> = {
      branchId: parent.branchId,
      studentId: { $in: studentIds.map((id: string) => new Types.ObjectId(id)) },
      sessionDate: { $gte: from, $lte: to },
    };

    if (query.class_id) filter.classId = new Types.ObjectId(query.class_id.toString());
    if (query.status) {
      const status = query.status.toString();
      if (!Object.values(ATTENDANCE_STATUS).includes(status as never)) {
        throw new BadRequestError('Trạng thái điểm danh không hợp lệ');
      }
      filter.status =
        status === ATTENDANCE_STATUS.PRESENT
          ? ATTENDANCE_STATUS.PRESENT
          : { $ne: ATTENDANCE_STATUS.PRESENT };
    }

    const records = (await Attendance.find(filter)
      .populate({
        path: 'studentId',
        select: 'fullName userCode branchId',
        match: { branchId: parent.branchId },
      })
      .populate({
        path: 'classId',
        select: 'name classCode subject teacherSnapshot branchId',
        match: { branchId: parent.branchId },
      })
      .populate({
        path: 'sessionId',
        select: 'topic startTime endTime status attendanceStatus branchId',
        match: { branchId: parent.branchId },
      })
      .sort({ sessionDate: -1, createdAt: -1 })
      .limit(300)
      .lean()) as AttendanceRecordView[];

    const normalizedRecords = records.map(record => ({
      ...record,
      status: this.normalizeAttendanceStatus(record.status),
    }));

    const summary = normalizedRecords.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.status === ATTENDANCE_STATUS.PRESENT) acc.present += 1;
        if (record.status === ATTENDANCE_STATUS.ABSENT) acc.absent += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, attendance_rate: 0 }
    );
    summary.attendance_rate =
      summary.total > 0 ? Math.round((summary.present / summary.total) * 1000) / 10 : 0;

    return {
      records: normalizedRecords.map(record => {
        const student = this.getPopulatedEntity<AttendanceStudentView>(record.studentId);
        const classItem = this.getPopulatedEntity<AttendanceClassView>(record.classId);
        const session = this.getPopulatedEntity<AttendanceSessionView>(record.sessionId);
        const subject = classItem?.subject ?? {};

        return {
          id: record._id,
          student_id: student?._id ?? record.studentId,
          student_name: student?.fullName ?? 'Học sinh',
          student_code: student?.userCode ?? '',
          class_id: classItem?._id ?? record.classId,
          class_name: classItem?.name ?? 'Lớp học',
          class_code: classItem?.classCode ?? '',
          subject_name: subject.name ?? 'Môn học',
          teacher_name: classItem?.teacherSnapshot?.fullName ?? 'Giáo viên',
          session_id: session?._id ?? record.sessionId,
          topic: session?.topic ?? 'Nội dung buổi học',
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
      summary,
      filters: {
        from: from.toISOString(),
        to: to.toISOString(),
        student_id: requestedStudentId || null,
        class_id: query.class_id ?? null,
        status: query.status ?? null,
      },
      as_of: new Date().toISOString(),
    };
  }

  async updateParent(id: string, data: AppPayload, requester: RequestUser) {
    const parent = (await this.repo.findById(id)) as ParentDetailView | null;
    if (!parent) throw new NotFoundError('Phụ huynh');
    this.assertBranchScope(parent.branchId?.toString() ?? '', requester);

    const currentStudentIds = this.getOwnedStudentIds(parent);
    const shouldUpdateStudents = data.parentInfo?.studentIds !== undefined;
    const nextStudentIds = shouldUpdateStudents
      ? this.uniqueStudentIds(data.parentInfo?.studentIds)
      : currentStudentIds;

    await this.validateStudents(nextStudentIds, requester.branchId);

    if (data.email !== undefined && data.email !== parent.email) {
      const existing = await this.repo.findByEmail(data.email);
      if (existing && existing._id.toString() !== id) {
        throw new ConflictError('Email này đã được sử dụng');
      }
    }

    const phone = data.phone !== undefined ? normalizeVietnamPhone(data.phone) : undefined;
    if (phone && phone !== parent.phone) {
      const existingPhone = await User.findOne({
        _id: { $ne: id },
        phone,
        deletedAt: null,
      }).lean();
      if (existingPhone) throw new ConflictError('Số điện thoại này đã được sử dụng');
    }

    const set: Record<string, unknown> = {};
    if (data.fullName !== undefined) set.fullName = data.fullName;
    if (data.phone !== undefined) set.phone = phone ?? null;
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

    const addedStudentIds = nextStudentIds.filter(
      (studentId: string) => !currentStudentIds.includes(studentId)
    );
    const removedStudentIds = currentStudentIds.filter(
      (studentId: string) => !nextStudentIds.includes(studentId)
    );

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await this.repo.updateById(id, { $set: set } as MongoUpdate<IUser>, session);
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

  async deleteParent(id: string, requester: RequestUser) {
    const parent = (await this.repo.findById(id)) as ParentDetailView | null;
    if (!parent) throw new NotFoundError('Phụ huynh');
    this.assertBranchScope(parent.branchId?.toString() ?? '', requester);

    const studentIds = this.getOwnedStudentIds(parent);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await this.repo.removeParentFromStudents(studentIds, id, session);
      await this.repo.revokeAllTokens(id, session);
      await this.repo.softDelete(id, requester.id, session);

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
