import { BranchRepository } from './branch.repository.js';
import { IBranch } from '../../models/branch.model.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { ConflictError, NotFoundError, ForbiddenError } from '../../shared/errors/AllErrors.js';
import { ROLES } from '../../shared/constants/roles.js';

export class BranchService {
  private branchRepo: BranchRepository;

  constructor() {
    this.branchRepo = new BranchRepository();
  }

  // ─── HELPER: Chuẩn hóa dữ liệu rooms ──────────────────────────────
  private formatRooms(rooms?: any[]) {
    if (!rooms || !Array.isArray(rooms)) return rooms;
    return rooms.map(room => 
      typeof room === 'string' ? { code: room, name: room } : room
    );
  }

  async createBranch(data: Partial<IBranch>) {
    const existingBranch = await this.branchRepo.findByCode(data.branchCode!);
    if (existingBranch) {
      throw new ConflictError(`Mã chi nhánh '${data.branchCode}' đã tồn tại trong hệ thống`);
    }

    // Transform rooms string[] -> object[] trước khi lưu
    if (data.rooms) {
      data.rooms = this.formatRooms(data.rooms) as any;
    }

    const newBranchData = { ...data, isActive: true };
    return await this.branchRepo.create(newBranchData);
  }

  async getBranches(query: any, user: any) {
    const { page, limit, skip } = getPagination(query.page, query.limit);

    const filter: any = {
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } }
      ]
    };

    if (user.role === ROLES.BRANCH_OWNER) {
      filter.ownerId = user._id;
    }

    if (query.search) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { name: { $regex: query.search, $options: 'i' } },
          { branchCode: { $regex: query.search, $options: 'i' } }
        ]
      });
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }

    const { branches, totalItems } = await this.branchRepo.findAllPaginated(filter, skip, limit);

    return { branches, totalItems, page, limit };
  }

  async getBranchById(id: string, user: any) {
    const branch = await this.branchRepo.findById(id);
    
    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    if (user.role !== ROLES.SYSTEM_OWNER && branch.ownerId?.toString() !== user._id.toString()) {
      throw new ForbiddenError('Bạn không có quyền truy cập chi nhánh này');
    }

    return branch;
  }

  async updateBranch(id: string, data: Partial<IBranch>, user: any) {
    const branch = await this.branchRepo.findById(id);
    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    if (user.role !== ROLES.SYSTEM_OWNER && branch.ownerId?.toString() !== user._id.toString()) {
      throw new ForbiddenError('Bạn không có quyền chỉnh sửa chi nhánh này');
    }

    // Transform rooms string[] -> object[] trước khi update
    if (data.rooms) {
      data.rooms = this.formatRooms(data.rooms) as any;
    }

    return await this.branchRepo.updateById(id, data);
  }

  async toggleActive(id: string) {
    const branch = await this.branchRepo.findById(id);
    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    return await this.branchRepo.updateById(id, { isActive: !branch.isActive });
  }
}