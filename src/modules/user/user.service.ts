import { UserRepository } from './user.repository.js';
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
import { IUser, User } from '../../models/user.model.js';
import { normalizeVietnamPhone } from '../../shared/utils/validators.js';

export class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async createUser(data: AppPayload, creator: RequestUser) {
    if (!data.email || !data.password || !data.role) {
      throw new BadRequestError('Thiếu email, mật khẩu hoặc vai trò');
    }

    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw new ConflictError('Email này đã được sử dụng');

    const phone = normalizeVietnamPhone(data.phone);
    if (phone) {
      const existingPhone = await User.findOne({ phone, deletedAt: null }).lean();
      if (existingPhone) throw new ConflictError('Số điện thoại này đã được sử dụng');
    }

    if (creator.role === ROLES.BRANCH_OWNER) {
      if (
        !([ROLES.STAFF, ROLES.TEACHER, ROLES.STUDENT, ROLES.PARENT] as string[]).includes(data.role)
      ) {
        throw new ForbiddenError(
          'Bạn chỉ có quyền tạo tài khoản Giáo viên, Học sinh, Phụ huynh và Nhân viên'
        );
      }
      data.branchId = creator.branchId;
    }

    if (creator.role === ROLES.STAFF) {
      if (!([ROLES.STUDENT, ROLES.PARENT] as string[]).includes(data.role)) {
        throw new ForbiddenError('Nhân viên chỉ có quyền tạo tài khoản Học sinh và Phụ huynh');
      }
      data.branchId = creator.branchId;
    }

    if (!data.branchId) {
      throw new BadRequestError('Tài khoản nghiệp vụ phải được gán vào một cơ sở');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const userCode = this.generateUserCode(data.role);

    const userData: Partial<IUser> = {
      ...(data as Partial<IUser>),
      branchId: data.branchId ? new Types.ObjectId(data.branchId) : undefined,
      phone,
      passwordHash,
      userCode,
    };
    delete (userData as EntityPatch).password;

    console.log(`[Audit] CREATE_ACCOUNT by ${creator.userId} for ${data.email}`);

    return await this.userRepo.create(userData);
  }

  async getUsers(query: AppQuery, user: RequestUser) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IUser> = { deletedAt: null };

    // Enforce Branch Scope
    if (user.role !== ROLES.SYSTEM_OWNER) {
      if (!user.branchId) throw new ForbiddenError('Tài khoản hiện tại chưa được gán cơ sở');
      filter.branchId = user.branchId;
    } else if (query.branchId) {
      filter.branchId = query.branchId;
    }

    if (query.role) filter.role = query.role;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.search) {
      filter.fullName = { $regex: query.search, $options: 'i' };
    }

    const { users, totalItems } = await this.userRepo.findAllPaginated(filter, skip, limit);
    return { users, totalItems, page, limit };
  }

  async getUserById(id: string, requester: RequestUser) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('Người dùng không tồn tại');

    // Check quyền: SO, BO cùng branch, hoặc chính mình
    const isSelf = requester.id === id;
    const isSameBranch = requester.branchId?.toString() === user.branchId?.toString();

    if (requester.role !== ROLES.SYSTEM_OWNER && !isSelf && !isSameBranch) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin này');
    }

    return user;
  }

  async updateUser(id: string, data: AppPayload, requester: RequestUser) {
    const targetUser = await this.userRepo.findById(id);
    if (!targetUser) throw new NotFoundError('Người dùng không tồn tại');

    const isSelf = requester.id === id;
    const isSystemOwner = requester.role === ROLES.SYSTEM_OWNER;
    const isBranchOwner = requester.role === ROLES.BRANCH_OWNER;

    // Tự cập nhật chỉ được sửa hồ sơ cá nhân, không được thay đổi quyền/cơ sở/trạng thái.
    if (isSelf) {
      const allowedFields = ['fullName', 'phone', 'avatarUrl', 'dateOfBirth', 'gender'];
      const filteredData = Object.keys(data)
        .filter(key => allowedFields.includes(key))
        .reduce<EntityPatch>((obj, key) => {
          obj[key] = data[key];
          return obj;
        }, {});
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
        filteredData.phone = phone ?? null;
      }
      return await this.userRepo.updateById(id, filteredData);
    }

    if (!isSystemOwner && !isBranchOwner) {
      throw new ForbiddenError('Bạn chỉ được cập nhật hồ sơ của chính mình');
    }

    if (isBranchOwner && targetUser.branchId?.toString() !== requester.branchId?.toString()) {
      throw new ForbiddenError('Người dùng không thuộc cơ sở của bạn');
    }
    if (isBranchOwner && targetUser.role === ROLES.SYSTEM_OWNER) {
      throw new ForbiddenError('Không thể cập nhật tài khoản quản trị hệ thống');
    }

    const allowedAdminFields = ['fullName', 'phone', 'avatarUrl', 'dateOfBirth', 'gender'];
    const filteredData = Object.keys(data)
      .filter(key => allowedAdminFields.includes(key))
      .reduce<EntityPatch>((obj, key) => {
        obj[key] = data[key];
        return obj;
      }, {});
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
      filteredData.phone = phone ?? null;
    }

    return await this.userRepo.updateById(id, filteredData as MongoUpdate<IUser>);
  }

  async deactivateUser(id: string, requester: RequestUser) {
    return await this.updateUserStatus(id, false, requester);
  }

  async updateUserStatus(id: string, isActive: boolean, requester: RequestUser) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('Người dùng không tồn tại');

    if (id === requester.id) {
      throw new BadRequestError('Bạn không thể thay đổi trạng thái tài khoản của chính mình');
    }

    if (
      requester.role !== ROLES.SYSTEM_OWNER &&
      user.branchId?.toString() !== requester.branchId?.toString()
    ) {
      throw new ForbiddenError('Người dùng không thuộc cơ sở của bạn');
    }
    if (requester.role !== ROLES.SYSTEM_OWNER && user.role === ROLES.SYSTEM_OWNER) {
      throw new ForbiddenError('Không thể thay đổi tài khoản quản trị hệ thống');
    }

    if (requester.role === ROLES.BRANCH_OWNER && user.role === ROLES.BRANCH_OWNER) {
      throw new ForbiddenError('Chủ cơ sở không thể thay đổi trạng thái của chủ cơ sở khác');
    }

    if (
      requester.role === ROLES.STAFF &&
      !([ROLES.TEACHER, ROLES.STUDENT, ROLES.PARENT] as string[]).includes(user.role)
    ) {
      throw new ForbiddenError(
        'Nhân viên chỉ được thay đổi trạng thái giáo viên, học sinh và phụ huynh'
      );
    }

    if (!isActive) {
      await this.userRepo.revokeAllTokens(id);
    }

    return await this.userRepo.updateById(id, { isActive });
  }

  // ─── HELPER: Sinh mã người dùng bằng Date.now() ─────────────────
  private generateUserCode(role: string): string {
    let prefix = 'NV';
    if (role === ROLES.TEACHER) prefix = 'GV';
    if (role === ROLES.STUDENT) prefix = 'HV';
    if (role === ROLES.PARENT) prefix = 'PH';

    // Kết quả ví dụ: GV1713543600123
    return `${prefix}${Date.now()}`;
  }
}
