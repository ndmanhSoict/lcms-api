import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { EvaluationFormController } from './evaluationForm.controller.js';
import {
  classEvaluationFormsSchema,
  createEvaluationFormSchema,
  listEvaluationFormsSchema,
  publishEvaluationFormSchema,
  studentEvaluationFormsSchema,
} from './evaluationForm.schema.js';

export const evaluationFormRouter = Router();
const controller = new EvaluationFormController();

evaluationFormRouter.use(authenticate);

evaluationFormRouter.post(
  '/evaluations',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  validate(createEvaluationFormSchema),
  controller.createEvaluation
);

evaluationFormRouter.get(
  '/evaluations',
  validate(listEvaluationFormsSchema),
  controller.listEvaluations
);

evaluationFormRouter.patch(
  '/evaluations/:id/publish',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  validate(publishEvaluationFormSchema),
  controller.publishEvaluation
);

evaluationFormRouter.get(
  '/students/:studentId/evaluations',
  validate(studentEvaluationFormsSchema),
  controller.getStudentEvaluations
);

evaluationFormRouter.get(
  '/classes/:classId/evaluations',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER),
  validate(classEvaluationFormsSchema),
  controller.getClassEvaluations
);
