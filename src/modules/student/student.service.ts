import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { StudentRepository } from './student.repository.js';
import { ROLES, RELATIONSHIPS } from '../../shared/constants/roles.js';
import { ConflictError, NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/AllErrors.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';

export class StudentService {
  private studentRepo: StudentRepository;

  constructor() {
    this.studentRepo = new StudentRepository();
  }

  private generateUserCode(role: string): string {
    const prefix = role === ROLES.STUDENT ? 'HS' : 'PH';
    return `${prefix}${Date.now()}`; // Theo ý bạn: dùng Date.now() cho nhanh và unique
  }

  async createStudent(data: any, creator: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { parent: parentData, ...studentData } = data;

      // 1. Tạo tài khoản Phụ huynh
      const parentEmail = parentData.email || `ph.${parentData.phone}@lcms.internal`;
      const salt = await bcrypt.genSalt(10);
      const parentPasswordHash = await bcrypt.hash(parentData.password || 'TempPass@123', salt);

      const parentDoc = await this.studentRepo.createUserWithSession({
        fullName: parentData.fullName,
        email: parentEmail,
        phone: parentData.phone,
        passwordHash: parentPasswordHash,
        role: ROLES.PARENT,
        branchId: studentData.branchId,
        isActive: true,
        userCode: this.generateUserCode(ROLES.PARENT),
        parentInfo: {
          studentIds: [], // Sẽ cập nhật sau khi có ID học sinh
          relationship: parentData.relationship
        }
      }, session);

      // 2. Tạo tài khoản Học sinh
      const studentPasswordHash = await bcrypt.hash('123456aA@', salt); // Mật khẩu mặc định HS
      const studentDoc = await this.studentRepo.createUserWithSession({
        ...studentData,
        passwordHash: studentPasswordHash,
        role: ROLES.STUDENT,
        isActive: true,
        userCode: this.generateUserCode(ROLES.STUDENT),
        studentInfo: {
          activeClassIds: [],
          parentIds: [parentDoc._id],
          schoolName: studentData.schoolName,
          grade: studentData.grade,
          enrollmentDate: new Date()
        }
      }, session);

      // 3. Cập nhật ngược lại ID học sinh cho phụ huynh
      await this.studentRepo.updateById(parentDoc._id, {
        $push: { 'parentInfo.studentIds': studentDoc._id }
      }, session);

      await session.commitTransaction();
      return { student: studentDoc, parent: parentDoc };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async addSecondParent(studentId: string, parentData: any) {
    const student = await this.studentRepo.findById(studentId);
    if (!student) throw new NotFoundError('Học sinh');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(parentData.password, salt);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const newParent = await this.studentRepo.createUserWithSession({
        ...parentData,
        passwordHash,
        role: ROLES.PARENT,
        branchId: student.branchId,
        isActive: true,
        userCode: this.generateUserCode(ROLES.PARENT),
        parentInfo: {
          studentIds: [student._id],
          relationship: parentData.relationship
        }
      }, session);

      await this.studentRepo.updateById(studentId, {
        $push: { 'studentInfo.parentIds': newParent._id }
      }, session);

      await session.commitTransaction();
      return newParent;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getStudents(query: any, user: any) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: any = { role: ROLES.STUDENT, deletedAt: null };

    if (user.role !== ROLES.SYSTEM_OWNER) filter.branchId = user.branchId;
    if (query.classId) filter['studentInfo.activeClassIds'] = query.classId;
    if (query.grade) filter['studentInfo.grade'] = parseInt(query.grade);
    if (query.search) filter.fullName = { $regex: query.search, $options: 'i' };
    
    // Xử lý status
    if (query.status === 'no_class') filter['studentInfo.activeClassIds'] = { $size: 0 };

    const { students, totalItems } = await this.studentRepo.findAllStudents(filter, skip, limit);
    return { students, totalItems, page, limit };
  }

  async getStudentById(id: string) {
    const student = await this.studentRepo.getStudentDetail(id);
    if (!student) throw new NotFoundError('Học sinh');
    return student;
  }

  async updateStudent(id: string, data: any, requester: any) {
    const student = await this.studentRepo.findById(id);
    if (!student || student.role !== ROLES.STUDENT) {
      throw new NotFoundError('Học sinh không tồn tại');
    }

    // Kiểm tra quyền (Enforce Branch Scope): 
    // STAFF và BO chỉ được sửa học sinh thuộc cơ sở của mình
    if (requester.role !== ROLES.SYSTEM_OWNER && student.branchId?.toString() !== requester.branchId?.toString()) {
      throw new ForbiddenError('Bạn không có quyền chỉnh sửa hồ sơ học sinh ở cơ sở khác');
    }

    // Mapping dữ liệu để cập nhật (vì schoolName và grade nằm trong object studentInfo)
    const updateData: any = {};
    if (data.phone) updateData.phone = data.phone;
    if (data.schoolName) updateData['studentInfo.schoolName'] = data.schoolName;
    if (data.grade !== undefined) updateData['studentInfo.grade'] = data.grade;

    // Sử dụng $set để chỉ cập nhật đúng các trường truyền lên, không làm mất dữ liệu cũ của studentInfo
    return await this.studentRepo.updateById(id, { $set: updateData });
  }
}