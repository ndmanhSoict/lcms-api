import { Types } from 'mongoose';
import { ClassroomRepository } from './classroom.repository.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AllErrors.js';
import { IClassroom } from '../../models/classroom.model.js';

export class ClassroomService {
  private repo: ClassroomRepository;

  constructor() {
    this.repo = new ClassroomRepository();
  }

  private getBranchId(data: AppPayload, requester: RequestUser) {
    const branchId = requester.role === ROLES.SYSTEM_OWNER ? data.branchId : requester.branchId;
    if (!branchId) throw new ForbiddenError('Không xác định được cơ sở');
    return branchId;
  }

  private assertBranchScope(classroom: Pick<IClassroom, 'branchId'>, requester: RequestUser) {
    if (
      requester.role !== ROLES.SYSTEM_OWNER &&
      classroom.branchId?.toString() !== requester.branchId?.toString()
    ) {
      throw new ForbiddenError('Phòng học không thuộc cơ sở của bạn');
    }
  }

  async createClassroom(data: AppPayload, requester: RequestUser) {
    const branchId = this.getBranchId(data, requester);
    const code = String(data.code ?? '').trim().toUpperCase();
    if (!code) throw new BadRequestError('Vui lòng nhập mã phòng');

    const existing = await this.repo.findByCode(branchId, code);
    if (existing) throw new ConflictError('Mã phòng đã tồn tại trong cơ sở này');

    return await this.repo.create({
      branchId: new Types.ObjectId(branchId),
      code,
      capacity: Number(data.capacity),
      detail: data.detail ? String(data.detail).trim() : undefined,
      isActive: data.isActive ?? true,
      createdBy: new Types.ObjectId(requester.id),
    });
  }

  async getClassrooms(query: AppQuery, requester: RequestUser) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IClassroom> = { deletedAt: null };

    if (requester.role !== ROLES.SYSTEM_OWNER) filter.branchId = requester.branchId;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.search) filter.code = { $regex: query.search, $options: 'i' };

    const { classrooms, totalItems } = await this.repo.findPaginated(filter, skip, limit);
    return { classrooms, totalItems, page, limit };
  }

  async getClassroomById(id: string, requester: RequestUser) {
    const classroom = await this.repo.findById(id);
    if (!classroom) throw new NotFoundError('Phòng học');
    this.assertBranchScope(classroom, requester);
    return classroom;
  }

  async updateClassroom(id: string, data: AppPayload, requester: RequestUser) {
    const classroom = await this.getClassroomById(id, requester);
    const updateData: EntityPatch = {};

    if (data.code !== undefined) {
      const code = String(data.code).trim().toUpperCase();
      const existing = await this.repo.findByCode(classroom.branchId, code, id);
      if (existing) throw new ConflictError('Mã phòng đã tồn tại trong cơ sở này');
      updateData.code = code;
    }
    if (data.capacity !== undefined) updateData.capacity = Number(data.capacity);
    if (data.detail !== undefined) updateData.detail = String(data.detail).trim();
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    const updated = await this.repo.updateById(id, { $set: updateData });
    if (!updated) throw new NotFoundError('Phòng học');
    return updated;
  }

  async deleteClassroom(id: string, requester: RequestUser) {
    const classroom = await this.getClassroomById(id, requester);
    const hasActiveClass = await this.repo.hasActiveClassUsage(id);
    const hasFutureSession = await this.repo.hasFutureSessionUsage(id);
    if (hasActiveClass || hasFutureSession) {
      throw new ConflictError('Phòng học đang được dùng bởi lớp hoặc buổi học sắp tới');
    }

    const deleted = await this.repo.updateById(id, {
      $set: { deletedAt: new Date(), isActive: false },
    });
    if (!deleted) throw new NotFoundError('Phòng học');
    return { id, code: classroom.code, deleted: true };
  }
}
