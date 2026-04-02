import { Branch, IBranch } from '../../models/branch.model.js';
import { getPagination } from '../../shared/constants/pagination.helper.js';
import { ConflictError } from '../../shared/errors/AllErrors.js';

export class BranchService {
  async createBranch(data: Partial<IBranch>): Promise<IBranch> {
    // Kiểm tra xem branchCode đã tồn tại chưa
    const existingBranch = await Branch.findOne({ branchCode: data.branchCode });
    
    if (existingBranch) {
      throw new ConflictError(`Mã chi nhánh '${data.branchCode}' đã tồn tại trong hệ thống`);
    }

    const branch = new Branch(data);
    return await branch.save();
  }

  async getBranches(query: any) {
    const { page, limit, skip } = getPagination(query.page, query.limit);

    const filter: any = { deletedAt: null };

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { branchCode: { $regex: query.search, $options: 'i' } }
      ];
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }

    const [branches, totalItems] = await Promise.all([
      Branch.find(filter)
        .select('_id branchCode name address phone email isActive')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Branch.countDocuments(filter)
    ]);

    return { branches, totalItems, page, limit };
  }
}