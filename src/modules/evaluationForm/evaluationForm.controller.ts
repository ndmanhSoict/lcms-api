import { Request, Response, NextFunction } from 'express';
import { EvaluationFormService } from './evaluationForm.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class EvaluationFormController {
  private service: EvaluationFormService;

  constructor() {
    this.service = new EvaluationFormService();
  }

  createEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createEvaluation(req.body, req.user);
      sendCreated(res, result, 'Tạo phiếu đánh giá thành công');
    } catch (error) {
      next(error);
    }
  };

  publishEvaluation = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.publishEvaluation(req.params.id, req.user);
      sendSuccess(res, result, 'Công bố phiếu đánh giá thành công');
    } catch (error) {
      next(error);
    }
  };

  listEvaluations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.listEvaluations(req.query, req.user);
      sendSuccess(res, result, 'Lấy danh sách phiếu đánh giá thành công');
    } catch (error) {
      next(error);
    }
  };

  getStudentEvaluations = async (
    req: Request<{ studentId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.getStudentEvaluations(
        req.params.studentId,
        req.query,
        req.user
      );
      sendSuccess(res, result, 'Lấy phiếu đánh giá học sinh thành công');
    } catch (error) {
      next(error);
    }
  };

  getClassEvaluations = async (
    req: Request<{ classId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.getClassEvaluations(
        req.params.classId,
        req.query,
        req.user
      );
      sendSuccess(res, result, 'Lấy phiếu đánh giá lớp học thành công');
    } catch (error) {
      next(error);
    }
  };
}
