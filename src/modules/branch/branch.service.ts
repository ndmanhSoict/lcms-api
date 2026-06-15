import { BranchRepository } from './branch.repository.js';
import { IBranch, IRoom, ISessionSlot } from '../../models/branch.model.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../shared/errors/AllErrors.js';
import { ROLES } from '../../shared/constants/roles.js';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';

type BranchPayload = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  defaultFeePerSession?: number | null;
  defaultSessionSlots?: ISessionSlot[];
  rooms?: Array<string | IRoom>;
};

type CreateBranchPayload = {
  ownerEmail?: string;
  password?: string;
};

export class BranchService {
  private branchRepo: BranchRepository;

  constructor() {
    this.branchRepo = new BranchRepository();
  }

  // ─── HELPER: Chuẩn hóa dữ liệu rooms ──────────────────────────────
  private formatRooms(rooms?: Array<string | IRoom>): IRoom[] | undefined {
    if (!rooms || !Array.isArray(rooms)) return rooms;
    return rooms.map(room => (typeof room === 'string' ? { code: room, name: room } : room));
  }

  private normalizeEmail(email?: string) {
    return email?.trim().toLowerCase();
  }

  private async generateBranchCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `CS-${randomUUID().slice(0, 8).toUpperCase()}`;
      const existing = await this.branchRepo.findByCode(code);
      if (!existing) return code;
    }

    throw new ConflictError('Không thể tạo mã cơ sở tự động, vui lòng thử lại');
  }

  private generateOwnerUserCode() {
    return `BO-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private canAccessBranch(branch: IBranch, user: RequestUser) {
    if (user.role === ROLES.SYSTEM_OWNER) return true;

    const branchId = branch._id?.toString();
    const requesterBranchId = user.branchId?.toString();

    return Boolean(requesterBranchId && branchId === requesterBranchId);
  }

  private emptyStatusCounts() {
    return { total: 0, active: 0, inactive: 0, deleted: 0 };
  }

  private buildUserSummary(
    userBuckets: Awaited<ReturnType<BranchRepository['getOverviewById']>>['userBuckets']
  ) {
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

  private buildCountMap(
    buckets: Awaited<ReturnType<BranchRepository['getOverviewById']>>['classStatusBuckets']
  ) {
    return buckets.reduce<Record<string, number>>((acc, bucket) => {
      if (bucket._id) acc[bucket._id] = bucket.count;
      return acc;
    }, {});
  }

  async createBranch(data: CreateBranchPayload, creator: RequestUser) {
    const ownerEmail = this.normalizeEmail(data.ownerEmail);
    if (!ownerEmail || !data.password) {
      throw new BadRequestError('Vui lòng nhập email và mật khẩu tài khoản chủ cơ sở');
    }

    const existingOwner = await this.branchRepo.findUserByEmail(ownerEmail);
    if (existingOwner) throw new ConflictError('Email này đã được sử dụng');

    const branchCode = await this.generateBranchCode();
    const passwordHash = await bcrypt.hash(data.password, 12);

    const branch = await this.branchRepo.create({
      branchCode,
      name: 'Cơ sở mới',
      email: ownerEmail,
      rooms: [],
      defaultSessionSlots: [],
      isActive: true,
    });
    const branchId = branch._id as Types.ObjectId;

    const owner = await this.branchRepo.createOwner({
      email: ownerEmail,
      passwordHash,
      role: ROLES.BRANCH_OWNER,
      branchId,
      fullName: 'Chủ cơ sở',
      isActive: true,
      userCode: this.generateOwnerUserCode(),
      createdBy: creator.userId,
    });

    const createdBranch = await this.branchRepo.updateById(branchId.toString(), {
      ownerId: owner._id as Types.ObjectId,
    });
    if (!createdBranch) throw new NotFoundError('Cơ sở vừa tạo');

    return createdBranch;
  }

  async getBranches(query: AppQuery, user: RequestUser) {
    const { page, limit, skip } = getPagination(query.page, query.limit);

    const filter: MongoFilter<IBranch> & { $and?: MongoFilter<IBranch>[] } = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };

    if (user.role !== ROLES.SYSTEM_OWNER) {
      if (!user.branchId) {
        throw new ForbiddenError('Tài khoản hiện tại không thuộc cơ sở nào');
      }
      filter._id = new Types.ObjectId(user.branchId);
    }

    if (query.search) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { name: { $regex: query.search, $options: 'i' } },
          { branchCode: { $regex: query.search, $options: 'i' } },
        ],
      });
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }

    const { branches, totalItems } = await this.branchRepo.findAllPaginated(filter, skip, limit);

    return { branches, totalItems, page, limit };
  }

  async getBranchById(id: string, user: RequestUser) {
    const branch = await this.branchRepo.findById(id);

    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    if (!this.canAccessBranch(branch as IBranch, user)) {
      throw new ForbiddenError('Bạn không có quyền truy cập chi nhánh này');
    }

    return branch;
  }

  async getBranchOverview(id: string, user: RequestUser) {
    const branch = await this.branchRepo.findById(id);

    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    if (!this.canAccessBranch(branch as IBranch, user)) {
      throw new ForbiddenError('Bạn không có quyền truy cập tổng quan chi nhánh này');
    }

    const overview = await this.branchRepo.getOverviewById(id);
    if (!overview.branch) throw new NotFoundError('Không tìm thấy chi nhánh');

    const owner = overview.branch.ownerId as PopulatedUserSummary | undefined;
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
        invoices_total: overview.invoiceStatusBuckets.reduce(
          (sum, bucket) => sum + bucket.count,
          0
        ),
        invoices_by_status: invoiceByStatus,
      },
      created_at: overview.branch.createdAt,
      updated_at: overview.branch.updatedAt,
      as_of: new Date().toISOString(),
    };
  }

  async getMyBranchOverview(user: RequestUser) {
    if (!user?.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại không thuộc cơ sở nào');
    }

    return this.getBranchOverview(user.branchId, user);
  }

  async updateBranch(id: string, data: BranchPayload, user: RequestUser) {
    const branch = await this.branchRepo.findById(id);
    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    if (!this.canAccessBranch(branch as IBranch, user)) {
      throw new ForbiddenError('Bạn không có quyền chỉnh sửa chi nhánh này');
    }

    if (user.role === ROLES.BRANCH_OWNER && data.rooms !== undefined) {
      throw new ForbiddenError('Vui lòng quản lý phòng học tại chức năng Phòng học');
    }

    const {
      name,
      address,
      phone,
      email,
      timezone,
      defaultFeePerSession,
      defaultSessionSlots,
      rooms,
    } = data;
    const updateData: Partial<IBranch> = {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email: this.normalizeEmail(email) || '' }),
      ...(timezone !== undefined && { timezone }),
      ...(defaultFeePerSession !== undefined && { defaultFeePerSession }),
      ...(defaultSessionSlots !== undefined && { defaultSessionSlots }),
      ...(rooms !== undefined && { rooms: this.formatRooms(rooms) }),
    };

    return await this.branchRepo.updateById(id, updateData);
  }

  async toggleActive(id: string) {
    const branch = await this.branchRepo.findById(id);
    if (!branch || branch.deletedAt) {
      throw new NotFoundError('Không tìm thấy chi nhánh');
    }

    return await this.branchRepo.updateById(id, { isActive: !branch.isActive });
  }
}
