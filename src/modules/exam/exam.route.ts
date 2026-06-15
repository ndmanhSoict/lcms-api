import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ExamController } from './exam.controller.js';
import {
  attemptIdParamSchema,
  createExamSchema,
  examIdParamSchema,
  saveExamDraftSchema,
  submitExamAttemptSchema,
  updateExamSchema,
} from './exam.schema.js';

export const examRouter = Router();
const controller = new ExamController();

examRouter.use(authenticate);

// Giáo viên quản lý đề thi
examRouter.get('/teacher/exams', authorize(ROLES.TEACHER), controller.getTeacherExams);
examRouter.post(
  '/classes/:classId/exams',
  authorize(ROLES.TEACHER),
  validate(createExamSchema),
  controller.createExam
);
examRouter.patch(
  '/exams/:examId',
  authorize(ROLES.TEACHER),
  validate(updateExamSchema),
  controller.updateExam
);
examRouter.patch(
  '/exams/:examId/publish',
  authorize(ROLES.TEACHER),
  validate(examIdParamSchema),
  controller.publishExam
);
examRouter.patch(
  '/exams/:examId/results/publish',
  authorize(ROLES.TEACHER),
  validate(examIdParamSchema),
  controller.publishResults
);
examRouter.get(
  '/exams/:examId/attempts',
  authorize(ROLES.TEACHER),
  validate(examIdParamSchema),
  controller.getExamAttempts
);

// Danh sách/chi tiết đề
examRouter.get('/student/exams', authorize(ROLES.STUDENT), controller.getStudentExams);
examRouter.get('/classes/:classId/exams', controller.getClassExams);
examRouter.get('/exams/:examId', validate(examIdParamSchema), controller.getExamDetail);

// Học sinh làm bài
examRouter.post(
  '/exams/:examId/attempts/start',
  authorize(ROLES.STUDENT),
  validate(examIdParamSchema),
  controller.startAttempt
);
examRouter.get(
  '/exam-attempts/:attemptId',
  authorize(ROLES.STUDENT),
  validate(attemptIdParamSchema),
  controller.getAttempt
);
examRouter.patch(
  '/exam-attempts/:attemptId/draft',
  authorize(ROLES.STUDENT),
  validate(saveExamDraftSchema),
  controller.saveDraft
);
examRouter.post(
  '/exam-attempts/:attemptId/submit',
  authorize(ROLES.STUDENT),
  validate(submitExamAttemptSchema),
  controller.submitAttempt
);
examRouter.get(
  '/exam-attempts/:attemptId/result',
  authorize(ROLES.STUDENT),
  validate(attemptIdParamSchema),
  controller.getResult
);
