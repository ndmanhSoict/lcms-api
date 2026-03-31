import { Request, Response, NextFunction } from 'express';
import { sendCreated } from '../../shared/utils/response.helper.js';
import { BranchService } from './branch.service.js';

export class BranchController {
  private branchService: BranchService;

  constructor() {
    this.branchService = new BranchService();
  }

  createBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Dữ liệu lúc này đã an toàn vì đã đi qua lớp middleware validate
      const branch = await this.branchService.createBranch(req.body);
      
      sendCreated(res, branch, 'Tạo chi nhánh mới thành công');
    } catch (error) {
      next(error); // Chuyển lỗi xuống global error handler
    }
  };
}