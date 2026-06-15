import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import { AssignmentService } from './assignment.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class AssignmentController {
  private service: AssignmentService;

  constructor() {
    this.service = new AssignmentService();
  }

  // 8.1 GV tạo bài tập
  createAssignment = async (
    req: Request<{ classId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.createAssignment(
        req.params.classId,
        req.body,
        req.user,
        req.files as Express.Multer.File[] | undefined
      );
      sendCreated(res, result, 'Tạo bài tập thành công');
    } catch (error) {
      await this.removeUploadedFiles(req.files);
      next(error);
    }
  };

  // 8.2 Lấy danh sách bài tập
  getAssignments = async (req: Request<{ classId: string }>, res: Response, next: NextFunction) => {
    try {
      const { data, meta } = await this.service.getAssignments(
        req.params.classId,
        req.query,
        req.user
      );
      sendSuccess(res, data, 'Lấy danh sách bài tập thành công', 200, meta);
    } catch (error) {
      next(error);
    }
  };

  getAssignment = async (
    req: Request<{ assignmentId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.getAssignment(req.params.assignmentId, req.user);
      sendSuccess(res, result, 'Lấy chi tiết bài tập thành công');
    } catch (error) {
      next(error);
    }
  };

  // 8.3 HS nộp bài
  submitAssignment = async (
    req: Request<{ assignmentId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.submitAssignment(
        req.params.assignmentId,
        req.body,
        req.user,
        req.files as Express.Multer.File[] | undefined
      );
      sendCreated(res, result, 'Nộp bài thành công');
    } catch (error) {
      await this.removeUploadedFiles(req.files);
      next(error);
    }
  };

  // 8.4 GV chấm điểm
  gradeSubmission = async (
    req: Request<{ submissionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.gradeSubmission(
        req.params.submissionId,
        req.body,
        req.user,
        req.files as Express.Multer.File[] | undefined
      );
      sendSuccess(res, result, 'Chấm điểm thành công');
    } catch (error) {
      await this.removeUploadedFiles(req.files);
      next(error);
    }
  };

  releaseAnswers = async (
    req: Request<{ assignmentId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.service.releaseAnswers(req.params.assignmentId, req.user);
      sendSuccess(res, result, 'Mở đáp án thành công');
    } catch (error) {
      next(error);
    }
  };

  // 8.5 GV xem danh sách bài nộp
  getSubmissions = async (
    req: Request<{ assignmentId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { data, meta } = await this.service.getSubmissions(
        req.params.assignmentId,
        req.query,
        req.user
      );
      sendSuccess(res, data, 'Lấy danh sách bài nộp thành công', 200, meta);
    } catch (error) {
      next(error);
    }
  };

  private async removeUploadedFiles(files: unknown) {
    const uploadedFiles = Array.isArray(files) ? (files as Express.Multer.File[]) : [];
    await Promise.all(uploadedFiles.map(file => fs.unlink(file.path).catch(() => undefined)));
  }
}
