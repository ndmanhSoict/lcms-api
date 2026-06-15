import { z } from 'zod';

// 8.1 GV tạo bài tập
export const createAssignmentSchema = z.object({
  params: z.object({
    classId: z.string().min(1, 'classId không hợp lệ'),
  }),
  body: z.object({
    title: z.string().min(1, 'Tiêu đề là bắt buộc'),
    description: z.string().optional(),
    assignment_type: z.enum(['homework', 'practice', 'project']).optional().default('homework'),
    due_date: z.string().datetime({ message: 'due_date phải là ISO 8601' }).optional(),
    max_score: z.number().min(0).optional(),
    is_graded: z.boolean().optional().default(true),
    auto_grade: z.boolean().optional().default(false),
    release_score_after_due_date: z.boolean().optional().default(false),
    visible_to_parent: z.boolean().optional().default(true),
    attachment_urls: z.array(z.string().url()).optional().default([]),
    submission_config: z
      .object({
        allow_late: z.boolean().optional().default(true),
        allow_text: z.boolean().optional().default(true),
        allow_file: z.boolean().optional().default(true),
        accept_file_types: z.array(z.string()).optional().default([]),
      })
      .optional(),
  }),
});

// 8.3 HS nộp bài
export const submitAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().min(1, 'assignmentId không hợp lệ'),
  }),
  body: z
    .object({
      content_text: z.string().optional(),
      attachment_urls: z.array(z.string().url()).optional().default([]),
    })
    .refine(
      data =>
        (data.content_text ?? '').trim().length > 0 || (data.attachment_urls ?? []).length > 0,
      { message: 'Phải có nội dung hoặc tệp đính kèm' }
    ),
});

// 8.4 GV chấm điểm
export const gradeSubmissionSchema = z.object({
  params: z.object({
    submissionId: z.string().min(1, 'submissionId không hợp lệ'),
  }),
  body: z.object({
    score: z.number().min(0, 'Điểm phải >= 0'),
    feedback: z.string().optional(),
  }),
});
