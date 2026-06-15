import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  uploadAssignmentAttachments,
  uploadSubmissionAttachments,
} from '../../middleware/upload.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { AssignmentController } from './assignment.controller.js';
import { gradeSubmissionSchema } from './assignment.schema.js';

export const assignmentRouter = Router();
const controller = new AssignmentController();

assignmentRouter.use(authenticate);

// 8.1 GV tạo bài tập — chỉ GV của lớp
assignmentRouter.post(
  '/classes/:classId/assignments',
  authorize(ROLES.TEACHER),
  uploadAssignmentAttachments.array('attachments', 10),
  controller.createAssignment
);

// 8.2 Lấy danh sách bài tập — GV, HS, PH (RBAC check trong service)
assignmentRouter.get('/classes/:classId/assignments', controller.getAssignments);

// 8.2b Lấy chi tiết bài tập
assignmentRouter.get('/assignments/:assignmentId', controller.getAssignment);

// 8.3 HS nộp bài — chỉ HS
assignmentRouter.post(
  '/assignments/:assignmentId/submissions',
  authorize(ROLES.STUDENT),
  uploadSubmissionAttachments.array('attachments', 10),
  controller.submitAssignment
);

// 8.4 GV chấm điểm — GV của lớp + SO/BO
assignmentRouter.patch(
  '/submissions/:submissionId/grade',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.TEACHER),
  validate(gradeSubmissionSchema),
  controller.gradeSubmission
);

// 8.5 GV xem danh sách bài nộp — GV, SO, BO
assignmentRouter.get(
  '/assignments/:assignmentId/submissions',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.TEACHER),
  controller.getSubmissions
);
