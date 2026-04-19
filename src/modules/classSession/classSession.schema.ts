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