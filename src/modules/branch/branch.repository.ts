import { Branch, IBranch } from '../../models/branch.model.js';

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

  /**
   * Lấy danh sách chi nhánh (có phân trang và bộ lọc)
   */
  async findAllPaginated(filter: any, skip: number, limit: number) {
    const [branches, totalItems] = await Promise.all([
      Branch.find(filter)
        .select('_id branchCode name address phone email isActive ownerId')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Branch.countDocuments(filter)
    ]);

    return { branches, totalItems };
  }

  /**
   * Tìm chi nhánh theo ID
   */
  async findById(id: string) {
    return await Branch.findById(id).lean();
  }

  /**
   * Cập nhật thông tin chi nhánh
   */
  async updateById(id: string, updateData: Partial<IBranch>) {
    // { new: true } để trả về document sau khi đã update
    return await Branch.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }
}