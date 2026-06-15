import { z } from 'zod';
import { EVALUATION_PERIOD_TYPES, EVALUATION_STATUSES } from '../../shared/constants/roles.js';

const criteriaSchema = z.object({
  label: z.string().min(1, 'Tên tiêu chí là bắt buộc'),
  score: z.number().min(0).optional(),
  max_score: z.number().min(0).optional(),
  comment: z.string().optional(),
});

export const createEvaluationFormSchema = z.object({
  body: z.object({
    student_id: z.string().min(1, 'student_id là bắt buộc'),
    class_id: z.string().min(1, 'class_id là bắt buộc'),
    session_id: z.string().optional(),
    period_type: z.enum(Object.values(EVALUATION_PERIOD_TYPES)),
    period_label: z.string().optional(),
    month: z.string().optional(),
    title: z.string().min(1, 'Tiêu đề là bắt buộc'),
    content: z.string().min(1, 'Nội dung đánh giá là bắt buộc'),
    strengths: z.string().optional(),
    improvements: z.string().optional(),
    recommendations: z.string().optional(),
    attitude_score: z.number().min(0).max(10).optional(),
    study_score: z.number().min(0).max(10).optional(),
    homework_score: z.number().min(0).max(10).optional(),
    criteria: z.array(criteriaSchema).optional(),
    status: z.enum(Object.values(EVALUATION_STATUSES)).optional(),
    publish: z.boolean().optional(),
  }),
});

export const publishEvaluationFormSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const listEvaluationFormsSchema = z.object({
  query: z.object({
    student_id: z.string().optional(),
    class_id: z.string().optional(),
    period_type: z.enum(Object.values(EVALUATION_PERIOD_TYPES)).optional(),
    status: z.enum(Object.values(EVALUATION_STATUSES)).optional(),
  }),
});

export const studentEvaluationFormsSchema = z.object({
  params: z.object({
    studentId: z.string().min(1),
  }),
  query: z.object({
    class_id: z.string().optional(),
    period_type: z.enum(Object.values(EVALUATION_PERIOD_TYPES)).optional(),
  }),
});

export const classEvaluationFormsSchema = z.object({
  params: z.object({
    classId: z.string().min(1),
  }),
  query: z.object({
    student_id: z.string().optional(),
    period_type: z.enum(Object.values(EVALUATION_PERIOD_TYPES)).optional(),
    status: z.enum(Object.values(EVALUATION_STATUSES)).optional(),
  }),
});
