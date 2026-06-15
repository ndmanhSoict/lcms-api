import { z } from 'zod';

const examScoreItemSchema = z.object({
  exam_id: z.string().optional(),
  title: z.string().min(1),
  score: z.number().min(0),
  total_score: z.number().min(0),
  weight: z.number().min(0).max(1),
  exam_date: z.string().datetime().optional(),
});

const attendanceSummarySchema = z.object({
  total_sessions: z.number().min(0).optional(),
  present_count: z.number().min(0).optional(),
  absent_count: z.number().min(0).optional(),
  attendance_rate: z.number().min(0).max(100).optional(),
  note: z.string().optional(),
});

const homeworkScoreItemSchema = z.object({
  assignment_id: z.string().optional(),
  title: z.string().min(1),
  score: z.number().min(0).optional(),
  max_score: z.number().min(0).optional(),
  weight: z.number().min(0).max(1).optional(),
  due_date: z.string().datetime().optional(),
  submitted_at: z.string().datetime().optional(),
  feedback: z.string().optional(),
});

const testScoreItemSchema = z.object({
  exam_id: z.string().optional(),
  title: z.string().min(1),
  score: z.number().min(0),
  total_score: z.number().min(0),
  weight: z.number().min(0).max(1).optional(),
  test_date: z.string().datetime().optional(),
  note: z.string().optional(),
});

const sessionCommentItemSchema = z.object({
  session_id: z.string().optional(),
  session_date: z.string().datetime(),
  topic: z.string().optional(),
  attendance_status: z.string().optional(),
  attitude_score: z.number().min(1).max(5).optional(),
  comment: z.string().min(1),
});

const monthlyCommentItemSchema = z.object({
  month: z.string().min(1),
  comment: z.string().min(1),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
});

// 11.1 Tạo / cập nhật học bạ
export const upsertGradeRecordSchema = z.object({
  body: z.object({
    student_id: z.string().min(1, 'student_id là bắt buộc'),
    class_id: z.string().min(1, 'class_id là bắt buộc'),
    academic_period: z.string().min(1, 'academic_period là bắt buộc'),
    attendance_summary: attendanceSummarySchema.optional(),
    homework_scores: z.array(homeworkScoreItemSchema).optional(),
    assignment_avg: z.number().min(0).max(10).optional(),
    test_scores: z.array(testScoreItemSchema).optional(),
    exam_scores: z.array(examScoreItemSchema).optional().default([]),
    regular_comment: z.string().optional(),
    teacher_comment: z.string().optional(),
    course_comment: z.string().optional(),
    session_comments: z.array(sessionCommentItemSchema).optional(),
    monthly_comments: z.array(monthlyCommentItemSchema).optional(),
  }),
});

// 11.2 Publish
export const publishGradeRecordSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const getClassGradeRecordsSchema = z.object({
  params: z.object({
    classId: z.string().min(1),
  }),
  query: z.object({
    academic_period: z.string().optional(),
    include_unpublished: z.enum(['true', 'false']).optional(),
  }),
});
