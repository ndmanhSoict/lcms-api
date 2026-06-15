import { Router } from 'express';
import { TeacherController } from './teacher.controller.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import {
  createTeacherSchema,
  updateTeacherSchema,
  getTeachersSchema,
  calculateTeacherSalarySchema,
  getTeacherSalaryOverviewSchema,
} from './teacher.schema.js';

export const teacherRouter = Router();
const controller = new TeacherController();

teacherRouter.use(authenticate);

// T.0 Tổng quan cho giáo viên đang đăng nhập
teacherRouter.get('/my-overview', authorize(ROLES.TEACHER), controller.getMyOverview);

// T.0b Giáo viên tự xem/tính lương của mình
teacherRouter.get(
  '/my-salary',
  authorize(ROLES.TEACHER),
  validate(calculateTeacherSalarySchema),
  controller.calculateSalary
);

// T.0c Giáo viên xem tổng quan kỳ lương của mình
teacherRouter.get(
  '/my-salary/overview',
  authorize(ROLES.TEACHER),
  validate(getTeacherSalaryOverviewSchema),
  controller.getSalaryOverview
);

teacherRouter.use(authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF));

// T.0d Quản lý xem tổng quan kỳ lương giáo viên
teacherRouter.get(
  '/salary/overview',
  validate(getTeacherSalaryOverviewSchema),
  controller.getSalaryOverview
);

// T.0e Quản lý tính lương giáo viên
teacherRouter.get(
  '/salary/calculate',
  validate(calculateTeacherSalarySchema),
  controller.calculateSalary
);

// T.1 Tạo giáo viên
teacherRouter.post('/', validate(createTeacherSchema), controller.createTeacher);

// T.2 Danh sách giáo viên
teacherRouter.get('/', validate(getTeachersSchema), controller.getTeachers);

// T.3 Chi tiết giáo viên
teacherRouter.get('/:id', controller.getTeacherById);

// T.4 Cập nhật giáo viên
teacherRouter.patch('/:id', validate(updateTeacherSchema), controller.updateTeacher);

// T.5 Xóa mềm giáo viên
teacherRouter.delete('/:id', controller.deleteTeacher);
