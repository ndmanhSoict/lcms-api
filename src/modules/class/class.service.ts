import mongoose from 'mongoose';
import { ClassRepository } from './class.repository.js';
import { ConflictError, NotFoundError, ForbiddenError } from '../../shared/errors/AllErrors.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { ROLES } from '../../shared/constants/roles.js';
import { Class } from '../../models/class.model.js'; // Import để query conflict

export class ClassService {
  private classRepo: ClassRepository;

  constructor() {
    this.classRepo = new ClassRepository();
  }

  // Kiểm tra trùng lịch của Giáo viên
  private async checkScheduleConflict(teacherId: string, newSchedule: any[], excludeClassId?: string) {
    const activeClasses = await Class.find({
      teacherId,
      status: 'active',
      ...(excludeClassId && { _id: { $ne: excludeClassId } })
    }).lean();

    for (const cls of activeClasses) {
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

  async createClass(data: any, requester: any) {
    // 1. Kiểm tra classCode unique trong nhánh
    const branchId = requester.role === ROLES.SYSTEM_OWNER ? data.branchId : requester.branchId;
    const existing = await this.classRepo.findByCode(branchId, data.classCode);
    if (existing) throw new ConflictError('Mã lớp học đã tồn tại trong cơ sở này');

    // 2. Check trùng lịch Giáo viên (nếu có)
    if (data.teacherId && data.weeklySchedule) {
      const hasConflict = await this.checkScheduleConflict(data.teacherId, data.weeklySchedule);
      if (hasConflict) throw new ConflictError('Giáo viên bị trùng lịch dạy vào khung giờ này');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const newClassData = { ...data, branchId, status: 'active', studentCount: 0 };
      const newClass = await this.classRepo.createClass(newClassData, session);

      // Cập nhật teacherInfo nếu có GV
      if (data.teacherId) {
        await this.classRepo.updateTeacherClasses(data.teacherId, newClass._id.toString(), 'push', session);
      }

      await session.commitTransaction();
      return newClass;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getClasses(query: any, requester: any) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: any = { deletedAt: null };

    // RBAC: Enforce Scope
    if (requester.role !== ROLES.SYSTEM_OWNER) filter.branchId = requester.branchId;
    if (query.branchId && requester.role === ROLES.SYSTEM_OWNER) filter.branchId = query.branchId;

    if (requester.role === ROLES.TEACHER) filter.teacherId = requester.id; // GV chỉ thấy lớp mình
    else if (query.teacherId) filter.teacherId = query.teacherId;

    if (query.status) filter.status = query.status;
    if (query.subjectCode) filter['subject.code'] = query.subjectCode;
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };

    const { classes, totalItems } = await this.classRepo.findAllPaginated(filter, skip, limit);
    return { classes, totalItems, page, limit };
  }

  async getClassById(id: string, requester: any) {
    const cls = await this.classRepo.findById(id);
    if (!cls) throw new NotFoundError('Lớp học');

    // Check quyền
    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId.toString()) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    return cls;
  }

  async updateClass(id: string, data: any, requester: any) {
    const cls = await this.classRepo.findById(id);
    if (!cls) throw new NotFoundError('Lớp học');

    // Check nhánh
    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId.toString()) {
      throw new ForbiddenError('Không có quyền thao tác');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Xử lý đổi Giáo viên
      if (data.teacherId && data.teacherId !== cls.teacherId?.toString()) {
        const scheduleToCheck = data.weeklySchedule || cls.weeklySchedule;
        const hasConflict = await this.checkScheduleConflict(data.teacherId, scheduleToCheck, id);
        if (hasConflict) throw new ConflictError('Giáo viên mới bị trùng lịch dạy');

        // Gỡ lớp khỏi GV cũ
        if (cls.teacherId) await this.classRepo.updateTeacherClasses(cls.teacherId.toString(), id, 'pull', session);
        // Thêm lớp vào GV mới
        await this.classRepo.updateTeacherClasses(data.teacherId, id, 'push', session);
        
        console.log(`[Audit] Đổi giáo viên lớp ${cls.classCode} thành ${data.teacherId}`);
      }

      const updatedClass = await this.classRepo.updateById(id, data, session);
      await session.commitTransaction();
      return updatedClass;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async closeClass(id: string, reason: string, requester: any) {
    const cls = await this.classRepo.findById(id);
    if (!cls || cls.status === 'completed') throw new NotFoundError('Lớp học không tồn tại hoặc đã đóng');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId.toString()) {
      throw new ForbiddenError('Không có quyền thao tác');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Đổi status lớp
      await this.classRepo.updateById(id, { status: 'completed' }, session);

      // 2. Chốt học bạ (enrollments) + gỡ activeClassIds học sinh
      await this.classRepo.closeAllEnrollments(id, session);

      // 3. Gỡ lớp khỏi activeClassIds của Giáo viên
      if (cls.teacherId) {
        await this.classRepo.updateTeacherClasses(cls.teacherId.toString(), id, 'pull', session);
      }

      await session.commitTransaction();
      return { status: 'completed', reason };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getClassStudents(id: string, query: any, requester: any) {
    await this.getClassById(id, requester); // Mượn hàm để check RBAC an toàn
    
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const status = query.status || 'active'; // active | all

    const { enrollments, totalItems } = await this.classRepo.getEnrollmentsByClassId(id, status, skip, limit);
    return { enrollments, totalItems, page, limit };
  }
}