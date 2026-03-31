import { Branch, IBranch } from '../../models/branch.model.js';
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
}