import mongoose from 'mongoose';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { StudentRepository } from './student.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/errors/AllErrors.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { User, IUser } from '../../models/user.model.js';
import { normalizeVietnamPhone } from '../../shared/utils/validators.js';
import { ClassSession } from '../../models/classSession.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Assignment } from '../../models/assignment.model.js';
import { Submission } from '../../models/submission.model.js';
import { GradeRecord } from '../../models/gradeRecord.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { Notification } from '../../models/notification.model.js';
import { Message } from '../../models/message.model.js';

export class StudentService {
  private studentRepo: StudentRepository;

  constructor() {
    this.studentRepo = new StudentRepository();
  }

  private generateUserCode(role: string): string {
    const prefix = role === ROLES.STUDENT ? 'HS' : 'PH';
    return `${prefix}${Date.now()}`; // Theo ý bạn: dùng Date.now() cho nhanh và unique
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

  async createStudent(data: AppPayload, creator: RequestUser) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { parent: parentData, password: studentPassword, ...studentData } = data;
      if (!studentPassword) throw new BadRequestError('Thiếu mật khẩu tài khoản học sinh');
      const branchId =
        creator.role === ROLES.SYSTEM_OWNER ? studentData.branchId : creator.branchId;
      if (!branchId) throw new ForbiddenError('Không xác định được cơ sở để tạo học sinh');

      const studentPhone = normalizeVietnamPhone(studentData.phone);
      const studentEmail = typeof studentData.email === 'string' ? studentData.email.trim() : '';
      const parentPhone = parentData ? normalizeVietnamPhone(parentData.phone) : undefined;
      const parentEmail = parentData
        ? parentData.email || `ph.${parentPhone}@lcms.internal`
        : undefined;

      if (parentData && parentPhone) {
        const existingPhone = await User.findOne({ phone: parentPhone, deletedAt: null }).lean();
        if (existingPhone) throw new ConflictError('Số điện thoại phụ huynh này đã được sử dụng');
      }
      if (studentPhone) {
        const existingPhone = await User.findOne({ phone: studentPhone, deletedAt: null }).lean();
        if (existingPhone) throw new ConflictError('Số điện thoại học sinh này đã được sử dụng');
      }
      if (parentData && parentEmail) {
        const existingEmail = await User.findOne({ email: parentEmail, deletedAt: null }).lean();
        if (existingEmail) throw new ConflictError('Email phụ huynh này đã được sử dụng');
      }
      if (studentEmail) {
        const existingEmail = await User.findOne({ email: studentEmail, deletedAt: null }).lean();
        if (existingEmail) throw new ConflictError('Email học sinh này đã được sử dụng');
      }

      const salt = await bcrypt.genSalt(10);
      let parentDoc: IUser | null = null;

      if (parentData) {
        const parentPasswordHash = await bcrypt.hash(parentData.password || 'TempPass@123', salt);
        parentDoc = await this.studentRepo.createUserWithSession(
          {
            fullName: parentData.fullName,
            email: parentEmail,
            phone: parentPhone,
            passwordHash: parentPasswordHash,
            role: ROLES.PARENT,
            branchId: new Types.ObjectId(branchId),
            isActive: true,
            userCode: this.generateUserCode(ROLES.PARENT),
            createdBy: new Types.ObjectId(creator.id),
            parentInfo: {
              studentIds: [],
              relationship: parentData.relationship ?? parentData.parentInfo?.relationship,
            },
          },
          session
        );
      }

      const studentPasswordHash = await bcrypt.hash(studentPassword, salt);
      const studentDoc = await this.studentRepo.createUserWithSession(
        {
          ...(studentData as Partial<IUser>),
          email: studentEmail || undefined,
          phone: studentPhone,
          branchId: new Types.ObjectId(branchId),
          passwordHash: studentPasswordHash,
          role: ROLES.STUDENT,
          isActive: true,
          userCode: this.generateUserCode(ROLES.STUDENT),
          createdBy: new Types.ObjectId(creator.id),
          studentInfo: {
            activeClassIds: [],
            parentIds: parentDoc ? [parentDoc._id] : [],
            schoolName: studentData.schoolName,
            grade: studentData.grade,
            enrollmentDate: new Date(),
          },
        },
        session
      );

      if (parentDoc) {
        await this.studentRepo.updateById(
          parentDoc._id.toString(),
          {
            $push: { 'parentInfo.studentIds': studentDoc._id },
          },
          session
        );
      }

      await session.commitTransaction();
      return { student: studentDoc, parent: parentDoc ?? undefined };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async addSecondParent(studentId: string, parentData: AppPayload, requester: RequestUser) {
    const student = await this.studentRepo.findById(studentId);
    if (!student || student.role !== ROLES.STUDENT || student.deletedAt) {
      throw new NotFoundError('Học sinh');
    }
    if (
      requester.role !== ROLES.SYSTEM_OWNER &&
      student.branchId?.toString() !== requester.branchId?.toString()
    ) {
      throw new ForbiddenError('Học sinh không thuộc cơ sở của bạn');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(parentData.password ?? 'TempPass@123', salt);
    const phone = normalizeVietnamPhone(parentData.phone);
    const email = parentData.email || `ph.${phone}@lcms.internal`;

    if (phone) {
      const existingPhone = await User.findOne({ phone, deletedAt: null }).lean();
      if (existingPhone) throw new ConflictError('Số điện thoại phụ huynh này đã được sử dụng');
    }
    const existingEmail = await User.findOne({ email, deletedAt: null }).lean();
    if (existingEmail) throw new ConflictError('Email phụ huynh này đã được sử dụng');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const newParent = await this.studentRepo.createUserWithSession(
        {
          ...(parentData as Partial<IUser>),
          email,
          phone,
          passwordHash,
          role: ROLES.PARENT,
          branchId: student.branchId,
          isActive: true,
          userCode: this.generateUserCode(ROLES.PARENT),
          parentInfo: {
            studentIds: [student._id],
            relationship: parentData.relationship ?? parentData.parentInfo?.relationship,
          },
        },
        session
      );

      await this.studentRepo.updateById(
        studentId,
        {
          $push: { 'studentInfo.parentIds': newParent._id },
        },
        session
      );

      await session.commitTransaction();
      return newParent;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getStudents(query: AppQuery, user: RequestUser) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IUser> = { role: ROLES.STUDENT, deletedAt: null };

    if (user.role !== ROLES.SYSTEM_OWNER) filter.branchId = user.branchId;
    if (query.classId) filter['studentInfo.activeClassIds'] = query.classId;
    if (query.grade) filter['studentInfo.grade'] = parseInt(String(query.grade), 10);
    if (query.search) filter.fullName = { $regex: query.search, $options: 'i' };

    // Xử lý status
    if (query.status === 'no_class') filter['studentInfo.activeClassIds'] = { $size: 0 };

    const { students, totalItems } = await this.studentRepo.findAllStudents(filter, skip, limit);
    return { students, totalItems, page, limit };
  }

  async getStudentById(id: string, requester: RequestUser) {
    const student = await this.studentRepo.getStudentDetail(id);
    if (!student) throw new NotFoundError('Học sinh');

    const isSelf = requester.id === id;
    const isParent =
      requester.role === ROLES.PARENT &&
      student.branchId?.toString() === requester.branchId?.toString() &&
      student.studentInfo?.parentIds?.map(String).includes(requester.id);
    const isSameBranchStaff =
      ([ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER] as string[]).includes(requester.role) &&
      student.branchId?.toString() === requester.branchId?.toString();

    if (requester.role !== ROLES.SYSTEM_OWNER && !isSelf && !isParent && !isSameBranchStaff) {
      throw new ForbiddenError('Bạn không có quyền xem hồ sơ học sinh này');
    }

    return student;
  }

  async getMyOverview(requester: RequestUser) {
    if (requester.role !== ROLES.STUDENT) {
      throw new ForbiddenError('Chỉ học sinh mới có quyền xem tổng quan học sinh');
    }

    const student = await User.findOne({ _id: requester.id, role: ROLES.STUDENT, deletedAt: null })
      .select('-passwordHash')
      .populate({
        path: 'studentInfo.activeClassIds',
        select: 'name subject teacherId weeklySchedule',
        match: { branchId: new Types.ObjectId(requester.branchId) },
        populate: { path: 'teacherId', select: 'fullName avatarUrl' },
      })
      .lean();

    if (!student) throw new NotFoundError('Học sinh');

    const studentId = new Types.ObjectId(requester.id);
    const branchId = student.branchId;
    const classIds = (student.studentInfo?.activeClassIds ?? []).map(
      (item: Types.ObjectId | PopulatedClassSummary) => (item as PopulatedClassSummary)._id ?? item
    );
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const todayEnd = this.endOfDay(now);
    const next7Days = this.endOfDay(this.addDays(now, 7));
    const last30Days = this.startOfDay(this.addDays(now, -30));

    const [
      todaySessions,
      upcomingSessions,
      attendanceAgg,
      assignments,
      submissionStats,
      latestGrades,
      unpaidAgg,
      unreadNotifications,
      unreadMessages,
    ] = await Promise.all([
      ClassSession.find({
        branchId,
        classId: { $in: classIds },
        deletedAt: null,
        status: { $ne: 'cancelled' },
        sessionDate: { $gte: todayStart, $lte: todayEnd },
      })
        .populate({ path: 'classId', select: 'name subject branchId', match: { branchId } })
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(10)
        .lean(),
      ClassSession.find({
        branchId,
        classId: { $in: classIds },
        deletedAt: null,
        status: 'scheduled',
        sessionDate: { $gt: todayEnd, $lte: next7Days },
      })
        .populate({ path: 'classId', select: 'name subject branchId', match: { branchId } })
        .sort({ sessionDate: 1, startTime: 1 })
        .limit(10)
        .lean(),
      Attendance.aggregate([
        { $match: { branchId, studentId, sessionDate: { $gte: last30Days, $lte: todayEnd } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          },
        },
      ]),
      Assignment.find({
        branchId,
        classId: { $in: classIds },
        deletedAt: null,
        status: 'active',
      })
        .select('_id classId title dueDate assignmentType maxScore')
        .sort({ dueDate: 1 })
        .limit(10)
        .lean(),
      Submission.aggregate([
        { $match: { branchId, studentId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      GradeRecord.find({ branchId, studentId, status: 'published' })
        .populate({ path: 'classId', select: 'name subject branchId', match: { branchId } })
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(5)
        .lean(),
      Invoice.aggregate([
        {
          $match: {
            branchId,
            studentId,
            status: { $in: ['unpaid', 'overdue', 'partial'] },
            deletedAt: null,
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      ]),
      Notification.countDocuments({ recipientId: studentId, isRead: false }),
      Message.countDocuments({ receiverId: studentId, isRead: false, deletedAt: null }),
    ]);

    const attendance = attendanceAgg[0] ?? { total: 0, present: 0, absent: 0 };
    const attendanceRate =
      attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 1000) / 10 : 0;
    const submissionsByStatus = submissionStats.reduce<Record<string, number>>((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
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
      profile: student,
      classes: {
        total_active: classIds.length,
        items: student.studentInfo?.activeClassIds ?? [],
      },
      schedule: {
        today_sessions: todaySessions,
        upcoming_sessions: upcomingSessions,
      },
      attendance: {
        last_30_days_total: attendance.total,
        present: attendance.present,
        absent: attendance.absent,
        attendance_rate: attendanceRate,
      },
      assignments: {
        active: assignments,
        submission_by_status: submissionsByStatus,
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

  async updateStudent(id: string, data: AppPayload, requester: RequestUser) {
    const student = await this.studentRepo.findById(id);
    if (!student || student.role !== ROLES.STUDENT) {
      throw new NotFoundError('Học sinh không tồn tại');
    }

    // Kiểm tra quyền (Enforce Branch Scope):
    // STAFF và BO chỉ được sửa học sinh thuộc cơ sở của mình
    if (
      requester.role !== ROLES.SYSTEM_OWNER &&
      student.branchId?.toString() !== requester.branchId?.toString()
    ) {
      throw new ForbiddenError('Bạn không có quyền chỉnh sửa hồ sơ học sinh ở cơ sở khác');
    }

    // Mapping dữ liệu để cập nhật (vì schoolName và grade nằm trong object studentInfo)
    const updateData: EntityPatch = {};
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
      updateData.phone = phone ?? null;
    }
    if (data.schoolName) updateData['studentInfo.schoolName'] = data.schoolName;
    if (data.grade !== undefined) updateData['studentInfo.grade'] = data.grade;

    // Sử dụng $set để chỉ cập nhật đúng các trường truyền lên, không làm mất dữ liệu cũ của studentInfo
    return await this.studentRepo.updateById(id, { $set: updateData });
  }
}
