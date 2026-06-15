import { Request, Response, NextFunction } from 'express';
import { ExamService } from './exam.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class ExamController {
  private service: ExamService;

  constructor() {
    this.service = new ExamService();
  }

  createExam = async (req: Request<{ classId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createExam(req.params.classId, req.body, req.user);
      sendCreated(res, result, 'Tạo đề thi thành công');
    } catch (error) {
      next(error);
    }
  };

  updateExam = async (req: Request<{ examId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.updateExam(req.params.examId, req.body, req.user);
      sendSuccess(res, result, 'Cập nhật đề thi thành công');
    } catch (error) {
      next(error);
    }
  };

  publishExam = async (req: Request<{ examId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.publishExam(req.params.examId, req.user);
      sendSuccess(res, result, 'Công bố đề thi thành công');
    } catch (error) {
      next(error);
    }
  };

  publishResults = async (req: Request<{ examId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.publishResults(req.params.examId, req.user);
      sendSuccess(res, result, 'Công bố kết quả bài thi thành công');
    } catch (error) {
      next(error);
    }
  };

  getTeacherExams = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getTeacherExams(req.user);
      sendSuccess(res, result, 'Lấy danh sách đề thi của giáo viên thành công');
    } catch (error) {
      next(error);
    }
  };

  getStudentExams = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getStudentExams(req.user);
      sendSuccess(res, result, 'Lấy danh sách bài thi của học sinh thành công');
    } catch (error) {
      next(error);
    }
  };

  getClassExams = async (req: Request<{ classId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getClassExams(req.params.classId, req.user);
      sendSuccess(res, result, 'Lấy danh sách đề thi của lớp thành công');
    } catch (error) {
      next(error);
    }
  };

  getExamDetail = async (req: Request<{ examId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getExamDetail(req.params.examId, req.user);
      sendSuccess(res, result, 'Lấy chi tiết đề thi thành công');
    } catch (error) {
      next(error);
    }
  };

  startAttempt = async (req: Request<{ examId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.startAttempt(req.params.examId, req.user, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendCreated(res, result, 'Bắt đầu bài thi thành công');
    } catch (error) {
      next(error);
    }
  };

  getAttempt = async (req: Request<{ attemptId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getAttempt(req.params.attemptId, req.user);
      sendSuccess(res, result, 'Lấy bài làm thành công');
    } catch (error) {
      next(error);
    }
  };

  saveDraft = async (req: Request<{ attemptId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.saveDraft(req.params.attemptId, req.body, req.user);
      sendSuccess(res, result, 'Lưu nháp bài làm thành công');
    } catch (error) {
      next(error);
    }
  };

  submitAttempt = async (req: Request<{ attemptId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.submitAttempt(req.params.attemptId, req.body, req.user);
      sendSuccess(res, result, 'Nộp bài thi thành công');
    } catch (error) {
      next(error);
    }
  };

  getResult = async (req: Request<{ attemptId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getResult(req.params.attemptId, req.user);
      sendSuccess(res, result, 'Lấy kết quả bài thi thành công');
    } catch (error) {
      next(error);
    }
  };

  getExamAttempts = async (req: Request<{ examId: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getExamAttempts(req.params.examId, req.user);
      sendSuccess(res, result, 'Lấy danh sách bài làm của đề thi thành công');
    } catch (error) {
      next(error);
    }
  };
}
