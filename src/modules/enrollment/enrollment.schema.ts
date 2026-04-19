import { z } from 'zod';

export const enrollStudentSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, 'Vui lòng cung cấp ID học sinh'),
    classId: z.string().min(1, 'Vui lòng cung cấp ID lớp học')
  })
});

export const leaveClassSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Vui lòng cung cấp lý do (ví dụ: dropped, transferred)'),
    note: z.string().optional()
  })
});