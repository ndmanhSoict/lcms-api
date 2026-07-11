import { Types } from 'mongoose';
import { ClassRepository } from './class.repository.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/errors/AllErrors.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { ROLES } from '../../shared/constants/roles.js';
import { Class, IClass, IWeeklyScheduleSlot } from '../../models/class.model.js'; // Import để query conflict
import { ClassSession, IClassSession } from '../../models/classSession.model.js';
import { User } from '../../models/user.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { Classroom, IClassroom } from '../../models/classroom.model.js';
import { FinanceService } from '../finance/finance.service.js';
import {
  getClassAudienceRecipientIds,
  NOTIFICATION_TYPES,
  sendNotifications,
} from '../../shared/utils/notification.helper.js';
import { runOptionalTransaction } from '../../shared/utils/mongooseTransaction.js';

type CourseInfoPayload = {
  startDate?: string | Date;
  endDate?: string | Date;
  totalSessions?: number;
  completedSessions?: number;
  feePerCourse?: number;
};

type OngoingInfoPayload = {
  feePerSession?: number;
  billingCycle?: 'monthly' | 'per_session';
};

export class ClassService {
  private classRepo: ClassRepository;
  private financeService: FinanceService;

  constructor() {
    this.classRepo = new ClassRepository();
    this.financeService = new FinanceService();
  }

  // Kiểm tra trùng lịch của Giáo viên
  private async checkScheduleConflict(
    teacherId: string,
    newSchedule: IWeeklyScheduleSlot[],
    newStartDate: Date,
    newEndDate: Date,
    excludeClassId?: string
  ) {
    const activeClasses = await Class.find({
      teacherId,
      status: { $in: ['active', 'upcoming'] },
      deletedAt: null,
      ...(excludeClassId && { _id: { $ne: excludeClassId } }),
    })
      .select('weeklySchedule startDate endDate courseInfo')
      .lean();

    for (const cls of activeClasses) {
      const existingRange = this.getClassScheduleRange(cls);
      if (
        !this.dateRangesOverlap(
          newStartDate,
          newEndDate,
          existingRange.startDate,
          existingRange.endDate
        )
      ) {
        continue;
      }
      if (!cls.weeklySchedule) continue;
      for (const slot of cls.weeklySchedule) {
        for (const newSlot of newSchedule) {
          if (slot.dayOfWeek === newSlot.dayOfWeek) {
            // So sánh thời gian (string "HH:mm")
            if (newSlot.startTime < slot.endTime && slot.startTime < newSlot.endTime) {
              return true; // Bị trùng lịch
            }
          }
        }
      }
    }
    return false;
  }

  private async assertTeacherInBranch(teacherId: string, branchId: string) {
    const teacher = await User.findOne({
      _id: teacherId,
      role: ROLES.TEACHER,
      branchId: new Types.ObjectId(branchId),
      isActive: true,
      deletedAt: null,
    })
      .select('_id fullName')
      .lean();

    if (!teacher) {
      throw new ForbiddenError('Giáo viên không thuộc cơ sở của lớp học');
    }

    return teacher;
  }

  private async assertRoomInBranch(roomId: string, branchId: string) {
    const room = await Classroom.findOne({
      _id: roomId,
      branchId: new Types.ObjectId(branchId),
      isActive: true,
      deletedAt: null,
    }).lean();

    if (!room) {
      throw new ForbiddenError('Phòng học không thuộc cơ sở hoặc đã tạm dừng');
    }

    return room as IClassroom;
  }

  private buildRoomSnapshot(room: IClassroom) {
    return {
      code: room.code,
      capacity: room.capacity,
      detail: room.detail,
    };
  }

  private getRoomIdValue(roomId: unknown) {
    if (!roomId) return '';
    if (typeof roomId === 'string') return roomId;
    if (roomId instanceof Types.ObjectId) return roomId.toString();
    if (typeof roomId === 'object' && '_id' in roomId) {
      return String((roomId as { _id: unknown })._id);
    }
    return String(roomId);
  }

  private getObjectIdValue(value: unknown) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toString();
    if (typeof value === 'object' && '_id' in value) {
      return String((value as { _id: unknown })._id);
    }
    return String(value);
  }

  private parseScheduleDate(value: unknown, fieldName: string) {
    const date = new Date(String(value));
    if (!value || Number.isNaN(date.getTime())) {
      throw new BadRequestError(`Vui lòng chọn ${fieldName}`);
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private resolveScheduleRange(data: AppPayload, fallback?: Partial<IClass>) {
    const courseInfo = data.courseInfo as CourseInfoPayload | undefined;
    const startValue =
      data.startDate ??
      data.start_date ??
      courseInfo?.startDate ??
      fallback?.startDate ??
      fallback?.courseInfo?.startDate;
    const endValue =
      data.endDate ??
      data.end_date ??
      courseInfo?.endDate ??
      fallback?.endDate ??
      fallback?.courseInfo?.endDate;

    const startDate = this.parseScheduleDate(startValue, 'ngày bắt đầu');
    const endDate = this.parseScheduleDate(endValue, 'ngày kết thúc');
    if (endDate < startDate) {
      throw new BadRequestError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    }

    return { startDate, endDate };
  }

  private getClassScheduleRange(cls: Partial<IClass>) {
    return {
      startDate: cls.startDate ?? cls.courseInfo?.startDate ?? null,
      endDate: cls.endDate ?? cls.courseInfo?.endDate ?? null,
    };
  }

  private dateRangesOverlap(
    newStartDate: Date,
    newEndDate: Date,
    existingStartDate?: Date | string | null,
    existingEndDate?: Date | string | null
  ) {
    if (!existingStartDate || !existingEndDate) return true;

    const start = new Date(existingStartDate);
    const end = new Date(existingEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return newStartDate <= end && start <= newEndDate;
  }

  private assertWeeklySchedule(schedule: IWeeklyScheduleSlot[]) {
    if (!schedule.length) {
      throw new BadRequestError('Vui lòng chọn lịch học trong tuần');
    }
    const days = new Set<number>();
    for (const slot of schedule) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestError('Giờ kết thúc phải sau giờ bắt đầu');
      }
      if (days.has(slot.dayOfWeek)) {
        throw new BadRequestError('Mỗi thứ trong tuần chỉ được khai báo một khung giờ');
      }
      days.add(slot.dayOfWeek);
    }
  }

  private normalizeStudentIds(data: AppPayload) {
    const rawStudentIds = data.studentIds ?? data.student_ids ?? [];
    if (!Array.isArray(rawStudentIds)) return [];
    return [...new Set(rawStudentIds.map(String).filter(Boolean))];
  }

  private async getInitialStudents(studentIds: string[], branchId: string, maxStudents?: number) {
    if (!studentIds.length) return [];

    if (studentIds.some(id => !Types.ObjectId.isValid(id))) {
      throw new BadRequestError('Danh sách học sinh không hợp lệ');
    }
    if (maxStudents && studentIds.length > maxStudents) {
      throw new BadRequestError('Số học sinh được chọn vượt quá sĩ số tối đa của lớp');
    }

    const students = await User.find({
      _id: { $in: studentIds.map(id => new Types.ObjectId(id)) },
      role: ROLES.STUDENT,
      branchId: new Types.ObjectId(branchId),
      isActive: true,
      deletedAt: null,
    })
      .select('_id fullName userCode branchId')
      .lean();

    if (students.length !== studentIds.length) {
      throw new BadRequestError(
        'Có học sinh không tồn tại, bị khóa hoặc không thuộc cơ sở của lớp'
      );
    }

    return students;
  }

  private buildSessionDates(
    startDate: Date,
    endDate: Date,
    schedule: IWeeklyScheduleSlot[],
    classId: Types.ObjectId,
    branchId: string,
    teacherId: string | Types.ObjectId | undefined,
    room: IClassroom
  ) {
    const sessions: Partial<IClassSession>[] = [];
    const sortedSchedule = [...schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      for (const slot of sortedSchedule) {
        if (slot.dayOfWeek !== dayOfWeek) continue;
        sessions.push({
          branchId: new Types.ObjectId(branchId),
          classId,
          ...(teacherId && { teacherId: new Types.ObjectId(teacherId) }),
          sessionDate: new Date(current),
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomId: new Types.ObjectId(room._id),
          roomSnapshot: this.buildRoomSnapshot(room),
          roomCode: room.code,
          sessionType: 'regular',
          status: 'scheduled',
          attendanceStatus: 'pending',
          materials: [],
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (!sessions.length) {
      throw new BadRequestError('Khoảng ngày học không có buổi nào khớp với lịch trong tuần');
    }

    return sessions;
  }

  private getLocalDateKey(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  private assertGeneratedSessionsDoNotOverlap(sessions: Partial<IClassSession>[]) {
    const slotsByRoomDate = new Map<string, Partial<IClassSession>[]>();

    for (const session of sessions) {
      if (!session.sessionDate || !session.startTime || !session.endTime || !session.roomId) {
        continue;
      }

      const key = `${session.roomId.toString()}::${this.getLocalDateKey(session.sessionDate)}`;
      const slots = slotsByRoomDate.get(key) ?? [];
      const conflicted = slots.some(
        existing =>
          existing.startTime &&
          existing.endTime &&
          session.startTime! < existing.endTime &&
          existing.startTime < session.endTime!
      );

      if (conflicted) {
        throw new ConflictError('Lịch tự động tạo có tiết học bị trùng phòng trong cùng khung giờ');
      }

      slots.push(session);
      slotsByRoomDate.set(key, slots);
    }
  }

  private async checkGeneratedSessionRoomConflicts(
    branchId: string,
    roomId: string,
    sessions: Partial<IClassSession>[]
  ) {
    this.assertGeneratedSessionsDoNotOverlap(sessions);

    const dates = sessions
      .map(session => session.sessionDate)
      .filter((date): date is Date => Boolean(date));

    if (!dates.length) return;

    const startDate = new Date(Math.min(...dates.map(date => date.getTime())));
    const endDate = new Date(Math.max(...dates.map(date => date.getTime())));
    endDate.setHours(23, 59, 59, 999);

    const existingSessions = await ClassSession.find({
      branchId: new Types.ObjectId(branchId),
      roomId: new Types.ObjectId(roomId),
      deletedAt: null,
      status: { $ne: 'cancelled' },
      sessionDate: { $gte: startDate, $lte: endDate },
    })
      .select('sessionDate startTime endTime')
      .lean();

    const conflicted = existingSessions.some(existing => {
      const existingDateKey = this.getLocalDateKey(new Date(existing.sessionDate));
      return sessions.some(session => {
        if (!session.sessionDate || !session.startTime || !session.endTime) return false;
        const newDateKey = this.getLocalDateKey(new Date(session.sessionDate));
        return (
          existingDateKey === newDateKey &&
          existing.startTime &&
          existing.endTime &&
          session.startTime < existing.endTime &&
          existing.startTime < session.endTime
        );
      });
    });

    if (conflicted) {
      throw new ConflictError('Phòng học đã có buổi học khác trong lịch tự động tạo');
    }
  }

  private async checkRoomScheduleConflict(
    branchId: string,
    roomId: string,
    schedule: IWeeklyScheduleSlot[],
    startDate: Date,
    endDate: Date,
    excludeClassId?: string
  ) {
    if (schedule.length === 0) return false;

    const activeClasses = await Class.find({
      branchId: new Types.ObjectId(branchId),
      roomId: new Types.ObjectId(roomId),
      status: { $in: ['active', 'upcoming'] },
      deletedAt: null,
      ...(excludeClassId && { _id: { $ne: excludeClassId } }),
    })
      .select('weeklySchedule startDate endDate courseInfo name classCode')
      .lean();

    for (const cls of activeClasses) {
      const existingRange = this.getClassScheduleRange(cls);
      if (
        !this.dateRangesOverlap(startDate, endDate, existingRange.startDate, existingRange.endDate)
      ) {
        continue;
      }
      for (const slot of cls.weeklySchedule ?? []) {
        for (const newSlot of schedule) {
          if (
            slot.dayOfWeek === newSlot.dayOfWeek &&
            newSlot.startTime < slot.endTime &&
            slot.startTime < newSlot.endTime
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  async createClass(data: AppPayload, requester: RequestUser) {
    // 1. Kiểm tra classCode unique trong nhánh
    const branchId = requester.role === ROLES.SYSTEM_OWNER ? data.branchId : requester.branchId;
    if (!branchId) throw new ForbiddenError('Không xác định được cơ sở để tạo lớp');
    if (!data.roomId) throw new BadRequestError('Vui lòng chọn phòng học cho lớp');
    const { startDate, endDate } = this.resolveScheduleRange(data);
    this.assertWeeklySchedule(data.weeklySchedule ?? []);
    const initialStudentIds = this.normalizeStudentIds(data);
    const initialStudents = await this.getInitialStudents(
      initialStudentIds,
      branchId,
      data.maxStudents
    );

    const existing = data.classCode
      ? await this.classRepo.findByCode(branchId, data.classCode)
      : null;
    if (existing) throw new ConflictError('Mã lớp học đã tồn tại trong cơ sở này');

    // 2. Check trùng lịch Giáo viên (nếu có)
    let teacherName = 'Chưa phân công';
    if (data.teacherId && data.weeklySchedule) {
      const teacher = await this.assertTeacherInBranch(data.teacherId, branchId);
      teacherName = teacher.fullName ?? teacherName;
      const hasConflict = await this.checkScheduleConflict(
        data.teacherId,
        data.weeklySchedule,
        startDate,
        endDate
      );
      if (hasConflict) throw new ConflictError('Giáo viên bị trùng lịch dạy vào khung giờ này');
    } else if (data.teacherId) {
      const teacher = await this.assertTeacherInBranch(data.teacherId, branchId);
      teacherName = teacher.fullName ?? teacherName;
    }
    const room = await this.assertRoomInBranch(data.roomId, branchId);
    const scheduleWithRoom = (data.weeklySchedule ?? []).map(slot => ({
      ...slot,
      roomId: new Types.ObjectId(data.roomId),
      roomCode: room.code,
    }));
    const hasRoomConflict = await this.checkRoomScheduleConflict(
      branchId,
      data.roomId,
      scheduleWithRoom,
      startDate,
      endDate
    );
    if (hasRoomConflict)
      throw new ConflictError('Phòng học bị trùng lịch trong khoảng thời gian này');

    const { teacherId, roomId, ...classData } = data;
    const newClassId = new Types.ObjectId();
    const generatedSessions = this.buildSessionDates(
      startDate,
      endDate,
      scheduleWithRoom,
      newClassId,
      branchId,
      teacherId,
      room
    );
    await this.checkGeneratedSessionRoomConflicts(branchId, roomId, generatedSessions);

    const courseInfo = data.courseInfo as CourseInfoPayload | undefined;
    const ongoingInfo = data.ongoingInfo as OngoingInfoPayload | undefined;
    delete (classData as { branchId?: unknown }).branchId;
    const newClassData: Partial<IClass> = {
      ...(classData as Partial<IClass>),
      _id: newClassId,
      branchId: new Types.ObjectId(branchId),
      ...(teacherId && { teacherId: new Types.ObjectId(teacherId) }),
      roomId: new Types.ObjectId(roomId),
      roomSnapshot: this.buildRoomSnapshot(room),
      weeklySchedule: scheduleWithRoom,
      startDate,
      endDate,
      ...(data.classType === 'course' && {
        courseInfo: {
          startDate,
          endDate,
          totalSessions: Number(courseInfo?.totalSessions ?? 0),
          completedSessions: Number(courseInfo?.completedSessions ?? 0),
          feePerCourse: Number(courseInfo?.feePerCourse ?? data.tuitionFee ?? 0),
        },
      }),
      ...(data.classType === 'ongoing' && {
        ongoingInfo: {
          feePerSession: Number(ongoingInfo?.feePerSession ?? data.tuitionFee ?? 0),
          billingCycle: ongoingInfo?.billingCycle ?? 'monthly',
        },
      }),
      status: 'active',
      studentCount: initialStudents.length,
    };

    const newClass = await runOptionalTransaction(async session => {
      const newClass = await this.classRepo.createClass(newClassData, session);
      if (initialStudents.length) {
        await Enrollment.insertMany(
          initialStudents.map(student => ({
            studentId: student._id,
            classId: newClass._id,
            branchId: new Types.ObjectId(branchId),
            enrolledAt: new Date(),
            enrolledBy: new Types.ObjectId(requester.id),
            classSnapshot: {
              name: newClass.name,
              subjectName: newClass.subject?.name || '',
              teacherName,
            },
          })),
          { session, ordered: true }
        );
        await User.updateMany(
          { _id: { $in: initialStudents.map(student => student._id) } },
          { $addToSet: { 'studentInfo.activeClassIds': newClass._id } },
          { session }
        );
      }
      await ClassSession.insertMany(generatedSessions, { session, ordered: true });

      // Cập nhật teacherInfo nếu có GV
      if (data.teacherId) {
        await this.classRepo.updateTeacherClasses(
          data.teacherId,
          newClass._id.toString(),
          'push',
          session
        );
      }

      return newClass;
    });

    if (newClass.classType === 'course' && initialStudentIds.length) {
      for (const studentId of initialStudentIds) {
        await this.financeService.createCourseInvoiceForEnrollment(
          studentId,
          newClass._id.toString(),
          requester
        );
      }
    }

    const recipients = await getClassAudienceRecipientIds(newClass, {
      teacher: true,
      branchUsers: true,
    });
    await sendNotifications(recipients, {
      branchId,
      type: NOTIFICATION_TYPES.CLASS_CREATED,
      title: `Lớp mới: ${newClass.name}`,
      content: `Lớp ${newClass.name} đã được tạo.`,
      actionUrl: `/classes/${newClass._id}`,
      metadata: {
        classId: newClass._id.toString(),
        createdBy: requester.id,
        createdByRole: requester.role,
      },
      excludeUserIds: [requester.id],
    });

    return newClass;
  }

  async getClasses(query: AppQuery, requester: RequestUser) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IClass> = { deletedAt: null };

    // RBAC: Enforce Scope
    if (requester.role !== ROLES.SYSTEM_OWNER) filter.branchId = requester.branchId;
    if (query.branchId && requester.role === ROLES.SYSTEM_OWNER) filter.branchId = query.branchId;

    if (requester.role === ROLES.TEACHER)
      filter.teacherId = requester.id; // GV chỉ thấy lớp mình
    else if (query.teacherId) filter.teacherId = query.teacherId;

    if (query.status) filter.status = query.status;
    if (query.subjectCode) filter['subject.code'] = query.subjectCode;
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };

    const { classes, totalItems } = await this.classRepo.findAllPaginated(filter, skip, limit);
    return { classes, totalItems, page, limit };
  }

  async getClassById(id: string, requester: RequestUser) {
    const cls = await this.classRepo.findById(id);
    if (!cls) throw new NotFoundError('Lớp học');

    // Check quyền
    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (requester.role === ROLES.TEACHER && this.getObjectIdValue(cls.teacherId) !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    return cls;
  }

  async updateClass(id: string, data: AppPayload, requester: RequestUser) {
    const cls = await this.classRepo.findById(id);
    if (!cls) throw new NotFoundError('Lớp học');

    // Check nhánh
    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Không có quyền thao tác');
    }
    let room: IClassroom | null = null;
    const nextRoomId = data.roomId ?? this.getRoomIdValue(cls.roomId);
    if (!nextRoomId) throw new BadRequestError('Vui lòng chọn phòng học cho lớp');
    const { startDate, endDate } = this.resolveScheduleRange(data, cls);
    if (data.roomId || data.maxStudents !== undefined) {
      room = await this.assertRoomInBranch(nextRoomId, cls.branchId.toString());
    }
    const scheduleToPersist = data.weeklySchedule
      ? data.weeklySchedule.map(slot => ({
          ...slot,
          roomId: new Types.ObjectId(nextRoomId),
          roomCode: room?.code ?? cls.roomSnapshot?.code ?? slot.roomCode,
        }))
      : undefined;
    const roomConflictSchedule = scheduleToPersist ?? cls.weeklySchedule ?? [];
    this.assertWeeklySchedule(roomConflictSchedule);
    const hasRoomConflict = await this.checkRoomScheduleConflict(
      cls.branchId.toString(),
      nextRoomId,
      roomConflictSchedule,
      startDate,
      endDate,
      id
    );
    if (hasRoomConflict)
      throw new ConflictError('Phòng học bị trùng lịch trong khoảng thời gian này');

    const updatedClass = await runOptionalTransaction(async session => {
      // Xử lý đổi Giáo viên
      const currentTeacherId = this.getObjectIdValue(cls.teacherId);
      if (data.teacherId && data.teacherId !== currentTeacherId) {
        await this.assertTeacherInBranch(data.teacherId, cls.branchId.toString());
        const scheduleToCheck = data.weeklySchedule || cls.weeklySchedule;
        const hasConflict = await this.checkScheduleConflict(
          data.teacherId,
          scheduleToCheck,
          startDate,
          endDate,
          id
        );
        if (hasConflict) throw new ConflictError('Giáo viên mới bị trùng lịch dạy');

        // Gỡ lớp khỏi GV cũ
        if (currentTeacherId)
          await this.classRepo.updateTeacherClasses(currentTeacherId, id, 'pull', session);
        // Thêm lớp vào GV mới
        await this.classRepo.updateTeacherClasses(data.teacherId, id, 'push', session);

        console.log(`[Audit] Đổi giáo viên lớp ${cls.classCode} thành ${data.teacherId}`);
      }

      const updateData: MongoUpdate<IClass> = {
        ...(data as Record<string, unknown>),
        ...(data.teacherId && { teacherId: new Types.ObjectId(data.teacherId) }),
        ...(data.roomId && { roomId: new Types.ObjectId(data.roomId) }),
        ...(room && { roomSnapshot: this.buildRoomSnapshot(room) }),
        ...(scheduleToPersist && { weeklySchedule: scheduleToPersist }),
        startDate,
        endDate,
        ...(data.courseInfo
          ? {
              courseInfo: {
                ...(data.courseInfo as CourseInfoPayload),
                startDate,
                endDate,
              },
            }
          : {}),
      };
      const updatedClass = await this.classRepo.updateById(id, updateData, session);
      if (!updatedClass) throw new NotFoundError('Lớp học');
      return updatedClass;
    });

    const teacherIds = [this.getObjectIdValue(cls.teacherId)].filter(Boolean) as string[];
    const recipients = [
      ...(await getClassAudienceRecipientIds(updatedClass, {
        teacher: true,
        students: true,
        parents: true,
        branchUsers: true,
      })),
      ...teacherIds,
    ];
    await sendNotifications(recipients, {
      branchId: cls.branchId,
      type: NOTIFICATION_TYPES.CLASS_UPDATED,
      title: `Lớp đã cập nhật: ${updatedClass?.name ?? cls.name}`,
      content: `Thông tin lớp ${updatedClass?.name ?? cls.name} đã được cập nhật.`,
      actionUrl: `/classes/${id}`,
      metadata: {
        classId: id,
        updatedBy: requester.id,
        updatedByRole: requester.role,
      },
      excludeUserIds: [requester.id],
    });

    return updatedClass;
  }

  async closeClass(id: string, reason: string, requester: RequestUser) {
    const cls = await this.classRepo.findById(id);
    if (!cls || cls.status === 'completed')
      throw new NotFoundError('Lớp học không tồn tại hoặc đã đóng');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Không có quyền thao tác');
    }

    await runOptionalTransaction(async session => {
      // 1. Đổi status lớp
      await this.classRepo.updateById(id, { status: 'completed' }, session);

      // 2. Chốt học bạ (enrollments) + gỡ activeClassIds học sinh
      await this.classRepo.closeAllEnrollments(id, session);

      // 3. Gỡ lớp khỏi activeClassIds của Giáo viên
      const teacherId = this.getObjectIdValue(cls.teacherId);
      if (teacherId) {
        await this.classRepo.updateTeacherClasses(teacherId, id, 'pull', session);
      }
    });

    return { status: 'completed', reason };
  }

  async getClassStudents(id: string, query: AppQuery, requester: RequestUser) {
    const cls = await this.getClassById(id, requester); // Mượn hàm để check RBAC an toàn

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const status = query.status || 'active'; // active | all

    const { enrollments, totalItems } = await this.classRepo.getEnrollmentsByClassId(
      id,
      cls.branchId.toString(),
      status,
      skip,
      limit
    );
    return { enrollments, totalItems, page, limit };
  }
}
