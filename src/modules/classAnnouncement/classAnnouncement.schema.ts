import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  params: z.object({
    classId: z.string().min(1),
  }),
  body: z.object({
    title: z.string().min(1, 'Tiêu đề là bắt buộc'),
    content: z.string().optional(),
    attachment_urls: z.array(z.string().url()).optional().default([]),
    is_pinned: z.boolean().optional().default(false),
    target_audience: z
      .array(z.enum(['student', 'parent']))
      .optional()
      .default(['student', 'parent']),
  }),
});
