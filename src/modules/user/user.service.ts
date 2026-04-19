import { UserRepository } from './user.repository.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { ConflictError, NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';
import { ROLES } from '../../shared/constants/roles.js';
import bcrypt from 'bcryptjs';

export class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async createUser(data: any, creator: any) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw new ConflictError('Email này đã được sử dụng');

    if (creator.role === ROLES.BRANCH_OWNER) {
      if (![ROLES.STAFF, ROLES.TEACHER].includes(data.role)) {
        throw new ForbiddenError('Bạn chỉ có quyền tạo tài khoản Giáo viên hoặc Nhân viên');
      }
      data.branchId = creator.branchId; 
    }

    const salt = await bcrypt.genSalt(12);
    data.passwordHash = await bcrypt.hash(data.password, salt);
    delete data.password; 
    
    // Tạo mã bằng Date.now() siêu tốc
    data.userCode = this.generateUserCode(data.role);
    
    console.log(`[Audit] CREATE_ACCOUNT by ${creator._id} for ${data.email}`);

    return await this.userRepo.create(data);
  }

  async getUsers(query: any, user: any) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: any = { deletedAt: null };

    // Enforce Branch Scope
    if (user.role !== ROLES.SYSTEM_OWNER) {
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

  async getUserById(id: string, requester: any) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('Người dùng không tồn tại');

    // Check quyền: SO, BO cùng branch, hoặc chính mình
    const isSelf = requester._id === id;
    const isSameBranch = requester.branchId?.toString() === user.branchId?.toString();
    
    if (requester.role !== ROLES.SYSTEM_OWNER && !isSelf && !isSameBranch) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin này');
    }

    return user;
  }

  async updateUser(id: string, data: any, requester: any) {
    const targetUser = await this.userRepo.findById(id);
    if (!targetUser) throw new NotFoundError('Người dùng không tồn tại');

    const isSelf = requester._id === id;
    const isAdmin = [ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER].includes(requester.role);

    // Rule: User thường chỉ sửa thông tin cá nhân cơ bản
    if (isSelf && !isAdmin) {
      const allowedFields = ['phone', 'avatarUrl', 'dateOfBirth', 'gender'];
      const filteredData = Object.keys(data)
        .filter(key => allowedFields.includes(key))
        .reduce((obj: any, key) => { obj[key] = data[key]; return obj; }, {});
      return await this.userRepo.updateById(id, filteredData);
    }

    // Rule: Admin không được đổi role thành SO
    if (data.role === ROLES.SYSTEM_OWNER && requester.role !== ROLES.SYSTEM_OWNER) {
      throw new ForbiddenError('Không thể thay đổi quyền quản trị hệ thống');
    }

    return await this.userRepo.updateById(id, data);
  }

  async deactivateUser(id: string, requester: any) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('Người dùng không tồn tại');

    // Chặn khóa chính mình
    if (id === requester._id) throw new BadRequestError('Bạn không thể tự khóa tài khoản của mình');

    await this.userRepo.revokeAllTokens(id);
    return await this.userRepo.updateById(id, { isActive: false });
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

