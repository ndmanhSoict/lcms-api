import { ClassSessionRepository } from './classSession.repository.js';
import { Class } from '../../models/class.model.js';
import { User } from '../../models/user.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ConflictError, NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';
import mongoose from 'mongoose';

export class ClassSessionService {
  private sessionRepo: ClassSessionRepository;

  constructor() {
    this.sessionRepo = new ClassSessionRepository();
  }

  // Helper check quyền truy cập Lớp học
  private async checkClassAccess(classId: string, requester: any) {
    const cls = await Class.findById(classId).lean();
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
    return cls;
  }

  // 6.1 Tạo buổi học
  async createSession(classId: string, data: any, requester: any) {
    const cls = await this.checkClassAccess(classId, requester);

    const sessionDate = new Date(data.sessionDate);
    const startOfDay = new Date(sessionDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(sessionDate.setHours(23, 59, 59, 999));

    // Unique: 1 lớp chỉ 1 buổi học mỗi ngày
    const existing = await this.sessionRepo.findSessionByDate(classId, startOfDay, endOfDay);
    if (existing) {
      throw new ConflictError('Lớp này đã có buổi học được xếp vào ngày hôm đó');
    }

    const sessionData = {
      ...data,
      classId,
      branchId: cls.branchId,
      sessionDate: startOfDay,
      status: 'scheduled',
      attendanceStatus: 'pending'
    };

    return await this.sessionRepo.create(sessionData);
  }

  // 6.2 Lấy lịch buổi học của Lớp
  async getClassSessions(classId: string, query: any, requester: any) {
    await this.checkClassAccess(classId, requester);

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.from && query.to) {
      filter.sessionDate = {
        $gte: new Date(query.from),
        $lte: new Date(query.to)
      };
    }

    return await this.sessionRepo.findSessionsByClass(classId, filter);
  }

  // 6.3 Lấy lịch dạy của Giáo viên
  async getTeacherSchedule(teacherId: string, query: any, requester: any) {
    if (requester.role === ROLES.TEACHER && requester.id !== teacherId) {
      throw new ForbiddenError('Bạn chỉ có thể xem lịch dạy của chính mình');
    }

    if (!query.from || !query.to) {
      throw new BadRequestError('Vui lòng cung cấp khoảng thời gian (from, to)');
    }

    const fromDate = new Date(query.from);
    const toDate = new Date(new Date(query.to).setHours(23, 59, 59, 999));

    return await this.sessionRepo.findTeacherSchedule(teacherId, fromDate, toDate);
  }

  // 6.4 Lấy lịch học của Học sinh (Có lấy trạng thái điểm danh)
  async getStudentSchedule(studentId: string, query: any, requester: any) {
    const student = await User.findById(studentId).lean();
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    // RBAC
    const isSelf = requester.id === studentId;
    const isParent = requester.role === ROLES.PARENT && student.studentInfo?.parentIds?.map(String).includes(requester.id);
    const isAdminSameBranch = [ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF].includes(requester.role) 
      && (requester.role === ROLES.SYSTEM_OWNER || student.branchId?.toString() === requester.branchId);

    if (!isSelf && !isParent && !isAdminSameBranch) {
      throw new ForbiddenError('Không có quyền xem lịch học của học sinh này');
    }

    if (!query.from || !query.to) throw new BadRequestError('Cần khoảng thời gian (from, to)');
    
    // 1. Lấy danh sách classId học sinh đang tham gia
    const enrollments = await this.sessionRepo.findStudentEnrollments(studentId);
    const activeClassIds = enrollments.filter(e => !e.leftAt).map(e => e.classId.toString());

    if (activeClassIds.length === 0) return [];

    // 2. Lấy danh sách Session của các class đó
    const fromDate = new Date(query.from);
    const toDate = new Date(new Date(query.to).setHours(23, 59, 59, 999));
    const sessions = await this.sessionRepo.findSessionsByClasses(activeClassIds, fromDate, toDate);

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
        attendanceStatus: attRecord ? attRecord.status : 'pending' // Điểm danh của riêng HS
      };
    });
  }
}