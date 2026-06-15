import { z } from 'zod';

const examQuestionOptionSchema = z.object({
  key: z.string().min(1),
  content: z.string().min(1),
});

const trueFalseStatementSchema = z.object({
  key: z.string().min(1),
  content: z.string().min(1),
  answer: z.boolean(),
});

const examQuestionSchema = z.object({
  question_type: z.enum(['multiple_choice', 'true_false', 'short_answer']),
  content: z.string().min(1, 'Nội dung câu hỏi là bắt buộc'),
  image_url: z.string().url().optional().or(z.literal('')),
  options: z.array(examQuestionOptionSchema).optional().default([]),
  statements: z.array(trueFalseStatementSchema).optional().default([]),
  correct_answer: z.unknown().optional(),
  score: z.coerce.number().min(0.25, 'Điểm câu hỏi phải lớn hơn 0'),
});

const answerSchema = z.object({
  question_id: z.string().min(1),
  answer: z.unknown().optional(),
  is_flagged: z.boolean().optional().default(false),
});

export const createExamSchema = z.object({
  params: z.object({
    classId: z.string().min(1, 'classId không hợp lệ'),
  }),
  body: z.object({
    title: z.string().min(1, 'Tiêu đề đề thi là bắt buộc'),
    description: z.string().optional(),
    target_type: z.enum(['class', 'course']).optional().default('class'),
    duration_minutes: z.coerce.number().int().min(1).max(300),
    passing_score: z.coerce.number().min(0).optional(),
    available_from: z.string().datetime().optional(),
    available_to: z.string().datetime().optional(),
    shuffle_questions: z.boolean().optional().default(false),
    shuffle_options: z.boolean().optional().default(false),
    questions: z.array(examQuestionSchema).min(1, 'Đề thi cần tối thiểu 1 câu hỏi'),
  }),
});

export const updateExamSchema = createExamSchema.omit({ params: true }).extend({
  params: z.object({
    examId: z.string().min(1, 'examId không hợp lệ'),
  }),
});

export const examIdParamSchema = z.object({
  params: z.object({
    examId: z.string().min(1, 'examId không hợp lệ'),
  }),
});

export const attemptIdParamSchema = z.object({
  params: z.object({
    attemptId: z.string().min(1, 'attemptId không hợp lệ'),
  }),
});

export const saveExamDraftSchema = z.object({
  params: z.object({
    attemptId: z.string().min(1, 'attemptId không hợp lệ'),
  }),
  body: z.object({
    answers: z.array(answerSchema).default([]),
    tab_switch_count: z.coerce.number().int().min(0).optional(),
  }),
});

export const submitExamAttemptSchema = z.object({
  params: z.object({
    attemptId: z.string().min(1, 'attemptId không hợp lệ'),
  }),
  body: z.object({
    answers: z.array(answerSchema).optional(),
  }),
});
