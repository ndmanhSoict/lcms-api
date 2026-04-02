import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendPaginated } from '../../shared/utils/response.helper.js';
import { BranchService } from './branch.service.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';

export class BranchController {
  private branchService: BranchService;

  constructor() {
    this.branchService = new BranchService();
  }

  createBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const branch = await this.branchService.createBranch(req.body);
      
      sendCreated(res, branch, 'Tạo chi nhánh mới thành công');
    } catch (error) {
      next(error);
    }
  };

  getBranches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.branchService.getBranches(req.query);
      
      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);

      sendPaginated(res, result.branches, meta as unknown as Record<string, unknown>, 'Lấy danh sách chi nhánh thành công');
    } catch (error) {
      next(error);
    }
  };
}