import { z } from 'zod';

export const createSessionSchema = z.object({
  body: z.object({
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày phải là YYYY-MM-DD'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Thời gian phải là HH:mm'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Thời gian phải là HH:mm'),
    roomCode: z.string().optional(),
    sessionType: z.enum(['regular', 'extra', 'makeup', 'cancelled']).optional().default('regular'),
    teacherId: z.string().optional(),
    note: z.string().optional()
  })
});

export const updateSessionSchema = z.object({
  body: z.object({
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày phải là YYYY-MM-DD').optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Thời gian phải là HH:mm').optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Thời gian phải là HH:mm').optional(),
    roomCode: z.string().optional(),
    sessionType: z.enum(['regular', 'extra', 'makeup', 'cancelled']).optional(),
    status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
    teacherId: z.string().optional(),
    note: z.string().optional(),
    onlineMeetingUrl: z.string().url().optional()
  }).refine(body => Object.keys(body).length > 0, 'Cần ít nhất một trường để cập nhật')
});
