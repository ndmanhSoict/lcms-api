import { Types } from 'mongoose';
import { Branch, IBranch } from '../../models/branch.model.js';
import { Class } from '../../models/class.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { User, IUser } from '../../models/user.model.js';

interface CountBucket {
  _id: string | null;
  count: number;
}

interface UserCountBucket {
  _id: {
    role: string;
    isActive: boolean;
    isDeleted: boolean;
  };
  count: number;
}

export class BranchRepository {
  /**
   * Tìm chi nhánh theo mã code
   */
  async findByCode(branchCode: string) {
    return await Branch.findOne({ branchCode }).lean();
  }

  /**
   * Tạo mới một chi nhánh
   */
  async create(data: Partial<IBranch>) {
    const branch = new Branch(data);
    return await branch.save();
  }

  async findUserByEmail(email: string) {
    return await User.findOne({ email }).lean();
  }

  async createOwner(data: Partial<IUser>) {
    const user = new User(data);
    return await user.save();
  }

  /**
   * Lấy danh sách chi nhánh (có phân trang và bộ lọc)
   */
  async findAllPaginated(filter: MongoFilter<IBranch>, skip: number, limit: number) {
    const [branches, totalItems] = await Promise.all([
      Branch.find(filter)
        .select('_id branchCode name address phone email isActive ownerId')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Branch.countDocuments(filter),
    ]);

    return { branches, totalItems };
  }

  /**
   * Tìm chi nhánh theo ID
   */
  async findById(id: string) {
    return await Branch.findById(id).lean();
  }

  async getOverviewById(id: string) {
    const branchObjectId = new Types.ObjectId(id);

    const [branch, userBuckets, classStatusBuckets, invoiceStatusBuckets, revenueThisMonth] =
      await Promise.all([
        Branch.findById(branchObjectId)
          .populate('ownerId', '_id fullName email phone isActive role')
          .lean(),
        User.aggregate<UserCountBucket>([
          { $match: { branchId: branchObjectId } },
          {
            $group: {
              _id: {
                role: '$role',
                isActive: '$isActive',
                isDeleted: { $ne: [{ $ifNull: ['$deletedAt', null] }, null] },
              },
              count: { $sum: 1 },
            },
          },
        ]),
        Class.aggregate<CountBucket>([
          { $match: { branchId: branchObjectId, deletedAt: null } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Invoice.aggregate<CountBucket>([
          { $match: { branchId: branchObjectId, deletedAt: null } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Invoice.aggregate<{ total: number }>([
          {
            $match: {
              branchId: branchObjectId,
              deletedAt: null,
              status: 'paid',
              billingPeriod: this.getCurrentBillingPeriod(),
            },
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
      ]);

    return {
      branch,
      userBuckets,
      classStatusBuckets,
      invoiceStatusBuckets,
      revenueThisMonth: revenueThisMonth[0]?.total ?? 0,
    };
  }

  /**
   * Cập nhật thông tin chi nhánh
   */
  async updateById(id: string, updateData: Partial<IBranch>) {
    // { new: true } để trả về document sau khi đã update
    return await Branch.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }

  private getCurrentBillingPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
