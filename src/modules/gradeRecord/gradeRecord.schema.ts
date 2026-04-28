import { z } from 'zod';

const examScoreItemSchema = z.object({
  exam_id: z.string().min(1, 'exam_id là bắt buộc'),
  title: z.string().min(1),
  score: z.number().min(0),
  total_score: z.number().min(0),
  weight: z.number().min(0).max(1),
  exam_date: z.string().datetime().optional(),
});

// 11.1 Tạo / cập nhật học bạ
export const upsertGradeRecordSchema = z.object({
  body: z.object({
    student_id: z.string().min(1, 'student_id là bắt buộc'),
    class_id: z.string().min(1, 'class_id là bắt buộc'),
    academic_period: z.string().min(1, 'academic_period là bắt buộc'),
    assignment_avg: z.number().min(0).max(10).optional(),
    exam_scores: z.array(examScoreItemSchema).optional().default([]),
    teacher_comment: z.string().optional(),
  }),
});

// 11.2 Publish
export const publishGradeRecordSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
