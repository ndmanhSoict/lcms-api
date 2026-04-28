import { z } from 'zod';

const attendanceStatusEnum = z.enum(['present', 'absent']);

// 7.1 Điểm danh toàn bộ buổi học
export const markSessionAttendanceSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, 'sessionId không hợp lệ'),
  }),
  body: z.object({
    records: z
      .array(
        z.object({
          student_id: z.string().min(1, 'student_id là bắt buộc'),
          status: attendanceStatusEnum,
        })
      )
      .min(1, 'Danh sách điểm danh không được rỗng'),
  }),
});

// 7.2 Sửa điểm danh
export const updateAttendanceSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1),
    studentId: z.string().min(1),
  }),
  body: z.object({
    status: attendanceStatusEnum,
    reason: z.string().optional(),
  }),
});
