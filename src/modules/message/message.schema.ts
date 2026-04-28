import { z } from 'zod';

export const sendMessageSchema = z.object({
  body: z.object({
    receiver_id: z.string().min(1, 'receiver_id là bắt buộc'),
    message_type: z.enum(['text', 'file', 'image']).default('text'),
    content: z.string().optional(),
    attachment_url: z.string().url().optional(),
  }).refine(
    d => (d.content ?? '').trim().length > 0 || !!d.attachment_url,
    { message: 'Phải có nội dung hoặc tệp đính kèm' }
  ),
});
