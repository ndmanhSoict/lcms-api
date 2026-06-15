import { Request, Response, NextFunction } from 'express';
import { ReportService } from './report.service.js';
import { sendSuccess } from '../../shared/utils/response.helper.js';

export class ReportController {
  private service: ReportService;

  constructor() {
    this.service = new ReportService();
  }

  getBranchDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getBranchDashboard(req.query, req.user);
      sendSuccess(res, result, 'Lấy dashboard cơ sở thành công');
    } catch (error) {
      next(error);
    }
  };

  getRevenueReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getRevenueReport(req.query, req.user);
      sendSuccess(res, result, 'Lấy báo cáo doanh thu thành công');
    } catch (error) {
      next(error);
    }
  };

  getAtRiskStudents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getAtRiskStudents(req.query, req.user);
      sendSuccess(res, result, 'Lấy danh sách học sinh có nguy cơ bỏ học thành công');
    } catch (error) {
      next(error);
    }
  };

  getSystemDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getSystemDashboard(req.user);
      sendSuccess(res, result, 'Lấy dashboard hệ thống thành công');
    } catch (error) {
      next(error);
    }
  };

  getBranchAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getBranchAnalytics(req.query, req.user);
      sendSuccess(res, result, 'Lấy báo cáo thống kê cơ sở thành công');
    } catch (error) {
      next(error);
    }
  };
}
