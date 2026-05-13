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

  private canAccessBranch(branch: IBranch, user: any) {
    if (user.role === ROLES.SYSTEM_OWNER) return true;

    const ownerId = branch.ownerId?.toString();
    const branchId = branch._id?.toString();
    const requesterId = user._id?.toString();
    const requesterBranchId = user.branchId?.toString();

    return ownerId === requesterId || branchId === requesterBranchId;
  }

  private emptyStatusCounts() {
    return { total: 0, active: 0, inactive: 0, deleted: 0 };
  }

  private buildUserSummary(userBuckets: Awaited<ReturnType<BranchRepository['getOverviewById']>>['userBuckets']) {
    const byRole: Record<string, ReturnType<BranchService['emptyStatusCounts']>> = {};
    const byStatus = this.emptyStatusCounts();

    for (const role of Object.values(ROLES)) {
      if (role !== ROLES.SYSTEM_OWNER) byRole[role] = this.emptyStatusCounts();
    }

    for (const bucket of userBuckets) {
      const role = bucket._id.role;
      if (!byRole[role]) byRole[role] = this.emptyStatusCounts();

      const target = byRole[role];
      target.total += bucket.count;
      byStatus.total += bucket.count;

      if (bucket._id.isDeleted) {
        target.deleted += bucket.count;
        byStatus.deleted += bucket.count;
      } else if (bucket._id.isActive) {
        target.active += bucket.count;
        byStatus.active += bucket.count;
      } else {
        target.inactive += bucket.count;
        byStatus.inactive += bucket.count;
      }
    }

    return {
      total_members: byStatus.active + byStatus.inactive,
      total_accounts: byStatus.total,
      by_status: byStatus,
      by_role: byRole,
    };
  }

  private buildCountMap(buckets: Awaited<ReturnType<BranchRepository['getOverviewById']>>['classStatusBuckets']) {
    return buckets.reduce<Record<string, number>>((acc, bucket) => {
      if (bucket._id) acc[bucket._id] = bucket.count;
      return acc;
    }, {});
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

    if (!this.canAccessBranch(branch as IBranch, user)) {
      throw new ForbiddenError('Bạn không có quyền truy cập chi nhánh này');
    }

    return branch;
  }

  async getBranchOverview(id: string, user: any) {
    const branch = await this.branchRepo.findById(id);

    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    if (!this.canAccessBranch(branch as IBranch, user)) {
      throw new ForbiddenError('Bạn không có quyền truy cập tổng quan chi nhánh này');
    }

    const overview = await this.branchRepo.getOverviewById(id);
    if (!overview.branch) throw new NotFoundError('Không tìm thấy chi nhánh');

    const owner = overview.branch.ownerId as any;
    const classByStatus = this.buildCountMap(overview.classStatusBuckets);
    const invoiceByStatus = this.buildCountMap(overview.invoiceStatusBuckets);

    return {
      branch_id: overview.branch._id,
      branch_code: overview.branch.branchCode,
      name: overview.branch.name,
      owner: owner
        ? {
            _id: owner._id,
            full_name: owner.fullName,
            email: owner.email,
            phone: owner.phone,
            is_active: owner.isActive,
          }
        : null,
      contact: {
        email: overview.branch.email,
        phone: overview.branch.phone,
        address: overview.branch.address,
      },
      status: {
        is_active: overview.branch.isActive,
        deleted_at: overview.branch.deletedAt,
      },
      settings: {
        timezone: overview.branch.timezone,
        default_fee_per_session: overview.branch.defaultFeePerSession,
        default_session_slots: overview.branch.defaultSessionSlots,
        rooms: overview.branch.rooms,
      },
      member_summary: this.buildUserSummary(overview.userBuckets),
      class_summary: {
        total: overview.classStatusBuckets.reduce((sum, bucket) => sum + bucket.count, 0),
        by_status: classByStatus,
      },
      finance_summary: {
        revenue_this_month: overview.revenueThisMonth,
        invoices_total: overview.invoiceStatusBuckets.reduce((sum, bucket) => sum + bucket.count, 0),
        invoices_by_status: invoiceByStatus,
      },
      created_at: overview.branch.createdAt,
      updated_at: overview.branch.updatedAt,
      as_of: new Date().toISOString(),
    };
  }

  async getMyBranchOverview(user: any) {
    if (!user?.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại không thuộc cơ sở nào');
    }

    return this.getBranchOverview(user.branchId, user);
  }

  async updateBranch(id: string, data: Partial<IBranch>, user: any) {
    const branch = await this.branchRepo.findById(id);
    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    if (!this.canAccessBranch(branch as IBranch, user)) {
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
