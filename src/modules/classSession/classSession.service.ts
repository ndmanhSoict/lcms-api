import { Types } from 'mongoose';
import { ClassSessionRepository } from './classSession.repository.js';
import { Class, IClass } from '../../models/class.model.js';
import { User } from '../../models/user.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { IClassSession, IMaterial } from '../../models/classSession.model.js';
import { Classroom, IClassroom } from '../../models/classroom.model.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
  getActiveClassStudentIds,
  getBranchOwnerAndStaffIds,
  getRelatedParentIds,
  NOTIFICATION_TYPES,
  sendNotifications,
} from '../../shared/utils/notification.helper.js';
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../shared/errors/AllErrors.js';

export class ClassSessionService {
  private sessionRepo: ClassSessionRepository;

  constructor() {
    this.sessionRepo = new ClassSessionRepository();
  }

  // Helper check quyền truy cập Lớp học
  private async checkClassAccess(classId: string, requester: RequestUser) {
    const cls = await Class.findById(classId).lean();
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
    return cls as IClass;
  }

  private async assertTeacherInBranch(teacherId: string, branchId: Types.ObjectId) {
    const teacher = await User.findOne({
      _id: teacherId,
      role: ROLES.TEACHER,
      branchId,
      isActive: true,
      deletedAt: null,
    })
      .select('_id')
      .lean();

    if (!teacher) {
      throw new ForbiddenError('Giáo viên không thuộc cơ sở của lớp học');
    }
  }

  private async assertRoomInBranch(roomId: string, cls: IClass) {
    const room = await Classroom.findOne({
      _id: roomId,
      branchId: cls.branchId,
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

  private assertValidTimeRange(startTime?: string | null, endTime?: string | null) {
    if (!startTime || !endTime) return;
    if (startTime >= endTime) {
      throw new BadRequestError('Giờ kết thúc phải sau giờ bắt đầu');
    }
  }

  private async assertRoomAvailable(params: {
    roomId: string;
    branchId: Types.ObjectId;
    sessionDate: Date;
    startTime?: string;
    endTime?: string;
    excludeSessionId?: string;
  }) {
    if (!params.startTime || !params.endTime) return;

    const startOfDay = new Date(params.sessionDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(params.sessionDate);
    endOfDay.setHours(23, 59, 59, 999);

    const sessions = await this.sessionRepo.findRoomSessionsByDate(
      params.roomId,
      params.branchId.toString(),
      startOfDay,
      endOfDay,
      params.excludeSessionId
    );

    const conflicted = sessions.some(
      session =>
        session.startTime &&
        session.endTime &&
        params.startTime! < session.endTime &&
        session.startTime < params.endTime!
    );

    if (conflicted) throw new ConflictError('Phòng học bị trùng lịch trong khung giờ này');
  }

  private formatSessionTime(sessionDate: Date, startTime?: string | null, endTime?: string | null) {
    const dateText = sessionDate.toLocaleDateString('vi-VN');
    const timeText = startTime && endTime ? ` từ ${startTime} đến ${endTime}` : '';
    return `${dateText}${timeText}`;
  }

  private async sendSessionChangeNotifications(
    session: IClassSession,
    cls: IClass,
    requester: RequestUser,
    isUpdate = false
  ) {
    const studentIds = await getActiveClassStudentIds(cls._id);
    const recipientIds = new Set<string>();

    const sessionTimeText = this.formatSessionTime(
      session.sessionDate,
      session.startTime,
      session.endTime
    );
    const parentIds = requester.role === ROLES.TEACHER ? [] : await getRelatedParentIds(studentIds);

    if (requester.role === ROLES.TEACHER) {
      const branchUserIds = await getBranchOwnerAndStaffIds(cls.branchId);
      branchUserIds.forEach(id => recipientIds.add(id));
      studentIds.forEach(id => recipientIds.add(id));
    } else {
      const teacherId = session.teacherId ?? cls.teacherId;
      if (teacherId) recipientIds.add(teacherId.toString());
      studentIds.forEach(id => recipientIds.add(id));
      parentIds.forEach(id => recipientIds.add(id));
    }

    const title = isUpdate ? `Buổi học đã cập nhật: ${cls.name}` : `Buổi học mới: ${cls.name}`;
    const roomText = session.roomCode ? ` tại phòng ${session.roomCode}` : '';
    const content = `Lớp ${cls.name} ${isUpdate ? 'đã cập nhật buổi học' : 'có buổi học mới'} vào ${sessionTimeText}${roomText}.`;

    await sendNotifications([...recipientIds], {
      branchId: cls.branchId,
      type: isUpdate ? NOTIFICATION_TYPES.CLASS_SESSION_UPDATED : NOTIFICATION_TYPES.CLASS_SESSION,
      title,
      content,
      actionUrl: `/classes/${cls._id}/sessions`,
      metadata: {
        classId: cls._id.toString(),
        sessionId: session._id.toString(),
        createdBy: requester.id,
        createdByRole: requester.role,
      },
      excludeUserIds: [requester.id],
    });
  }

  private async sendSessionMaterialNotifications(
    session: IClassSession,
    cls: IClass,
    material: IMaterial,
    requester: RequestUser
  ) {
    const studentIds = await getActiveClassStudentIds(cls._id);
    if (studentIds.length === 0) return;

    const sessionTimeText = this.formatSessionTime(
      session.sessionDate,
      session.startTime,
      session.endTime
    );

    await sendNotifications(studentIds, {
      branchId: cls.branchId,
      type: NOTIFICATION_TYPES.CLASS_SESSION_MATERIAL,
      title: `Tài liệu mới: ${cls.name}`,
      content: `Giáo viên đã tải lên tài liệu "${material.name}" cho buổi học ${sessionTimeText}.`,
      actionUrl: '/student/schedule',
      metadata: {
        classId: cls._id.toString(),
        sessionId: session._id.toString(),
        materialName: material.name,
        materialUrl: material.url,
        uploadedBy: requester.id,
      },
    });
  }

  // 6.1 Tạo buổi học
  async createSession(classId: string, data: AppPayload, requester: RequestUser) {
    const cls = await this.checkClassAccess(classId, requester);

    if (!data.sessionDate) throw new BadRequestError('Vui lòng chọn ngày học');
    if (!data.roomId) throw new BadRequestError('Vui lòng chọn phòng học cho buổi học');
    this.assertValidTimeRange(data.startTime, data.endTime);

    const sessionDate = new Date(data.sessionDate);
    const startOfDay = new Date(sessionDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(sessionDate.setHours(23, 59, 59, 999));

    // Unique: 1 lớp chỉ 1 buổi học mỗi ngày
    const existing = await this.sessionRepo.findSessionByDate(classId, startOfDay, endOfDay);
    if (existing) {
      throw new ConflictError('Lớp này đã có buổi học được xếp vào ngày hôm đó');
    }
    if (data.teacherId) {
      await this.assertTeacherInBranch(data.teacherId, cls.branchId);
    }
    const room = await this.assertRoomInBranch(data.roomId, cls);
    await this.assertRoomAvailable({
      roomId: data.roomId,
      branchId: cls.branchId,
      sessionDate: startOfDay,
      startTime: data.startTime,
      endTime: data.endTime,
    });

    const sessionData: Partial<IClassSession> = {
      ...(data as Partial<IClassSession>),
      classId: new Types.ObjectId(classId),
      branchId: cls.branchId,
      teacherId: data.teacherId ? new Types.ObjectId(data.teacherId) : cls.teacherId,
      roomId: new Types.ObjectId(data.roomId),
      roomSnapshot: this.buildRoomSnapshot(room),
      roomCode: room.code,
      sessionDate: startOfDay,
      status: 'scheduled',
      attendanceStatus: 'pending',
    };

    const session = await this.sessionRepo.create(sessionData);
    await this.sendSessionChangeNotifications(session, cls, requester);

    return session;
  }

  // 6.1b Chỉnh sửa buổi học
  async updateSession(sessionId: string, data: AppPayload, requester: RequestUser) {
    const existing = await this.sessionRepo.findById(sessionId);
    if (!existing) throw new NotFoundError('Buổi học');

    const cls = await this.checkClassAccess(existing.classId.toString(), requester);
    const nextRoomId = data.roomId ?? existing.roomId?.toString();
    if (!nextRoomId) throw new BadRequestError('Vui lòng chọn phòng học cho buổi học');
    const room = await this.assertRoomInBranch(nextRoomId, cls);
    this.assertValidTimeRange(data.startTime ?? existing.startTime, data.endTime ?? existing.endTime);

    const updateData: Partial<IClassSession> = {
      ...(data as Partial<IClassSession>),
      ...(data.teacherId && { teacherId: new Types.ObjectId(data.teacherId) }),
      ...(data.roomId && {
        roomId: new Types.ObjectId(data.roomId),
        roomSnapshot: this.buildRoomSnapshot(room),
        roomCode: room.code,
      }),
    };
    if (data.teacherId) {
      await this.assertTeacherInBranch(data.teacherId, cls.branchId);
    }
    if (data.sessionDate) {
      const sessionDate = new Date(data.sessionDate);
      const startOfDay = new Date(sessionDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(sessionDate.setHours(23, 59, 59, 999));
      const duplicated = await this.sessionRepo.findSessionByDate(
        existing.classId.toString(),
        startOfDay,
        endOfDay,
        sessionId
      );
      if (duplicated) {
        throw new ConflictError('Lớp này đã có buổi học được xếp vào ngày hôm đó');
      }
      updateData.sessionDate = startOfDay;
    }
    await this.assertRoomAvailable({
      roomId: nextRoomId,
      branchId: cls.branchId,
      sessionDate: updateData.sessionDate ?? existing.sessionDate,
      startTime: data.startTime ?? existing.startTime,
      endTime: data.endTime ?? existing.endTime,
      excludeSessionId: sessionId,
    });

    const updated = await this.sessionRepo.updateById(sessionId, updateData);
    if (!updated) throw new NotFoundError('Buổi học');

    await this.sendSessionChangeNotifications(updated, cls, requester, true);
    return updated;
  }

  async uploadSessionMaterial(
    sessionId: string,
    file: Express.Multer.File | undefined,
    body: AppPayload,
    requester: RequestUser
  ) {
    if (!file) throw new BadRequestError('Vui lòng chọn file ảnh, PDF hoặc Word');

    const existing = await this.sessionRepo.findById(sessionId);
    if (!existing) throw new NotFoundError('Buổi học');

    const cls = await this.checkClassAccess(existing.classId.toString(), requester);
    const material: IMaterial = {
      name: (typeof body?.name === 'string' && body.name.trim()) || file.originalname,
      url: `/uploads/session-materials/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
      uploadedBy: requester.userId,
    };

    const updated = await this.sessionRepo.addMaterial(sessionId, material);
    if (!updated) throw new NotFoundError('Buổi học');

    await this.sendSessionMaterialNotifications(updated, cls, material, requester);

    return { material, session: updated };
  }

  // 6.2 Lấy lịch buổi học của Lớp
  async getClassSessions(classId: string, query: AppQuery, requester: RequestUser) {
    const cls = await this.checkClassAccess(classId, requester);

    const filter: MongoFilter<IClassSession> = { branchId: cls.branchId };
    if (query.status) filter.status = query.status;
    if (query.from && query.to) {
      filter.sessionDate = {
        $gte: new Date(query.from),
        $lte: new Date(query.to),
      };
    }

    return await this.sessionRepo.findSessionsByClass(classId, filter);
  }

  // 6.3 Lấy lịch dạy của Giáo viên
  async getTeacherSchedule(teacherId: string, query: AppQuery, requester: RequestUser) {
    const teacher = await User.findOne({
      _id: teacherId,
      role: ROLES.TEACHER,
      isActive: true,
      deletedAt: null,
    })
      .select('_id branchId')
      .lean();
    if (!teacher) throw new NotFoundError('Giáo viên');

    if (requester.role === ROLES.TEACHER && requester.id !== teacherId) {
      throw new ForbiddenError('Bạn chỉ có thể xem lịch dạy của chính mình');
    }
    if (
      requester.role !== ROLES.SYSTEM_OWNER &&
      requester.role !== ROLES.TEACHER &&
      !([ROLES.BRANCH_OWNER, ROLES.STAFF] as string[]).includes(requester.role)
    ) {
      throw new ForbiddenError('Bạn không có quyền xem lịch dạy của giáo viên');
    }
    if (
      requester.role !== ROLES.SYSTEM_OWNER &&
      teacher.branchId?.toString() !== requester.branchId?.toString()
    ) {
      throw new ForbiddenError('Giáo viên không thuộc cơ sở của bạn');
    }

    if (!query.from || !query.to) {
      throw new BadRequestError('Vui lòng cung cấp khoảng thời gian (from, to)');
    }

    const fromDate = new Date(query.from);
    const toDate = new Date(new Date(query.to).setHours(23, 59, 59, 999));

    return await this.sessionRepo.findTeacherSchedule(
      teacherId,
      fromDate,
      toDate,
      teacher.branchId?.toString()
    );
  }

  // 6.4 Lấy lịch học của Học sinh (Có lấy trạng thái điểm danh)
  async getStudentSchedule(studentId: string, query: AppQuery, requester: RequestUser) {
    const student = await User.findById(studentId).lean();
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    // RBAC
    const isSelf = requester.id === studentId;
    const isParent =
      requester.role === ROLES.PARENT &&
      student.branchId?.toString() === requester.branchId?.toString() &&
      student.studentInfo?.parentIds?.map(String).includes(requester.id);
    const isAdminSameBranch =
      ([ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF] as string[]).includes(
        requester.role
      ) &&
      (requester.role === ROLES.SYSTEM_OWNER ||
        student.branchId?.toString() === requester.branchId);

    if (!isSelf && !isParent && !isAdminSameBranch) {
      throw new ForbiddenError('Không có quyền xem lịch học của học sinh này');
    }

    if (!query.from || !query.to) throw new BadRequestError('Cần khoảng thời gian (from, to)');

    // 1. Lấy danh sách classId học sinh đang tham gia
    const enrollments = await this.sessionRepo.findStudentEnrollments(
      studentId,
      student.branchId?.toString()
    );
    const activeClassIds = enrollments.filter(e => !e.leftAt).map(e => e.classId.toString());

    if (activeClassIds.length === 0) return [];

    // 2. Lấy danh sách Session của các class đó
    const fromDate = new Date(query.from);
    const toDate = new Date(new Date(query.to).setHours(23, 59, 59, 999));
    const sessions = await this.sessionRepo.findSessionsByClasses(
      activeClassIds,
      fromDate,
      toDate,
      student.branchId?.toString()
    );

    // 3. (Mock Module 7) Lấy điểm danh của học sinh cho các session này
    const sessionIds = sessions.map(s => s._id);
    const attendances = await Attendance.find({ studentId, sessionId: { $in: sessionIds } }).lean();

    return sessions.map(session => {
      const attRecord = attendances.find(a => a.sessionId.toString() === session._id.toString());
      return {
        sessionId: session._id,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        roomCode: session.roomCode,
        class: session.classId, // Đã populate name, subject
        teacher: session.teacherId, // Đã populate fullName
        attendanceStatus: attRecord ? attRecord.status : 'pending', // Điểm danh của riêng HS
        materials: session.materials ?? [],
      };
    });
  }
}
