import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../shared/utils/response.helper.js';
import { BranchService } from './branch.service.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';

export class BranchController {
  private branchService: BranchService;

  constructor() {
    this.branchService = new BranchService();
  }

  createBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const branch = await this.branchService.createBranch(req.body, req.user);
      sendCreated(res, branch, 'Khởi tạo cơ sở và tài khoản chủ cơ sở thành công');
    } catch (error) {
      next(error);
    }
  };

  getBranches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Truyền cả query và user để thực hiện phân quyền và lọc
      const result = await this.branchService.getBranches(req.query, req.user);

      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);

      sendPaginated(res, result.branches, meta, 'Lấy danh sách chi nhánh thành công');
    } catch (error) {
      next(error);
    }
  };

  getBranchById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const branch = await this.branchService.getBranchById(req.params.id, req.user);

      // Sử dụng sendSuccess để chuẩn hóa response
      sendSuccess(res, branch, 'Lấy thông tin chi nhánh thành công');
    } catch (error) {
      next(error);
    }
  };

  getBranchOverview = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const overview = await this.branchService.getBranchOverview(req.params.id, req.user);

      sendSuccess(res, overview, 'Lấy tổng quan chi nhánh thành công');
    } catch (error) {
      next(error);
    }
  };

  getMyBranchOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const overview = await this.branchService.getMyBranchOverview(req.user);

      sendSuccess(res, overview, 'Lấy tổng quan cơ sở hiện tại thành công');
    } catch (error) {
      next(error);
    }
  };

  updateBranch = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const branch = await this.branchService.updateBranch(req.params.id, req.body, req.user);

      sendSuccess(res, branch, 'Cập nhật thông tin chi nhánh thành công');
    } catch (error) {
      next(error);
    }
  };

  toggleActive = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const branch = await this.branchService.toggleActive(req.params.id);

      sendSuccess(res, { isActive: branch.isActive }, 'Thay đổi trạng thái hoạt động thành công');
    } catch (error) {
      next(error);
    }
  };
}
