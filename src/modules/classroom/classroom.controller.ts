import { Request, Response, NextFunction } from 'express';
import { ClassroomService } from './classroom.service.js';
import { sendCreated, sendPaginated, sendSuccess } from '../../shared/utils/response.helper.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';

export class ClassroomController {
  private service: ClassroomService;

  constructor() {
    this.service = new ClassroomService();
  }

  createClassroom = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createClassroom(req.body, req.user);
      sendCreated(res, result, 'Tạo phòng học thành công');
    } catch (error) {
      next(error);
    }
  };

  getClassrooms = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getClassrooms(req.query, req.user);
      const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
      sendPaginated(res, result.classrooms, meta, 'Lấy danh sách phòng học thành công');
    } catch (error) {
      next(error);
    }
  };

  getClassroomById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getClassroomById(req.params.id, req.user);
      sendSuccess(res, result, 'Lấy chi tiết phòng học thành công');
    } catch (error) {
      next(error);
    }
  };

  updateClassroom = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.updateClassroom(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Cập nhật phòng học thành công');
    } catch (error) {
      next(error);
    }
  };

  deleteClassroom = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.deleteClassroom(req.params.id, req.user);
      sendSuccess(res, result, 'Xóa phòng học thành công');
    } catch (error) {
      next(error);
    }
  };
}
