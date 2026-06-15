import { Request, Response, NextFunction } from 'express';
import { ParentService } from './parent.service.js';
import { sendCreated, sendPaginated, sendSuccess } from '../../shared/utils/response.helper.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';

export class ParentController {
  private service: ParentService;

  constructor() {
    this.service = new ParentService();
  }

  createParent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createParent(req.body, req.user);
      sendCreated(res, result, 'Tạo phụ huynh thành công');
    } catch (error) {
      next(error);
    }
  };

  getParents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getParents(req.query, req.user);
      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
      sendPaginated(res, result.parents, meta, 'Lấy danh sách phụ huynh thành công');
    } catch (error) {
      next(error);
    }
  };

  getParentById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getParentById(req.params.id, req.user);
      sendSuccess(res, result, 'Lấy chi tiết phụ huynh thành công');
    } catch (error) {
      next(error);
    }
  };

  getMyOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMyOverview(req.user);
      sendSuccess(res, result, 'Lấy tổng quan phụ huynh thành công');
    } catch (error) {
      next(error);
    }
  };

  getMyAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMyAttendance(req.query, req.user);
      sendSuccess(res, result, 'Lấy điểm danh học sinh của phụ huynh thành công');
    } catch (error) {
      next(error);
    }
  };

  updateParent = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.updateParent(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Cập nhật phụ huynh thành công');
    } catch (error) {
      next(error);
    }
  };

  deleteParent = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.deleteParent(req.params.id, req.user);
      sendSuccess(res, result, 'Xóa phụ huynh thành công');
    } catch (error) {
      next(error);
    }
  };
}
