import { z } from 'zod';

const scheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ bắt đầu phải có định dạng HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ kết thúc phải có định dạng HH:mm'),
  roomId: z.string().optional(),
  roomCode: z.string().optional(),
}).refine((slot) => slot.startTime < slot.endTime, {
  message: 'Giờ kết thúc phải sau giờ bắt đầu',
  path: ['endTime'],
});

export const createClassSchema = z.object({
  body: z.object({
    branchId: z.string().min(1),
    name: z.string().min(1),
    classCode: z.string().min(1),
    subject: z.object({
      name: z.string(),
      code: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
    }),
    classType: z.enum(['course', 'ongoing']),
    startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
    endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
    courseInfo: z
      .object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        totalSessions: z.number().optional(),
        completedSessions: z.number().optional(),
        feePerCourse: z.number().optional(),
      })
      .optional(),
    ongoingInfo: z
      .object({
        feePerSession: z.number().optional(),
        billingCycle: z.string().optional(),
      })
      .optional(),
    teacherId: z.string().optional(),
    roomId: z.string().min(1, 'Vui lòng chọn phòng học'),
    weeklySchedule: z.array(scheduleSchema).min(1, 'Vui lòng chọn lịch học trong tuần'),
    studentIds: z.array(z.string().min(1)).optional(),
    student_ids: z.array(z.string().min(1)).optional(),
    maxStudents: z.number().optional(),
    description: z.string().optional(),
  }),
});

export const updateClassSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    teacherId: z.string().optional(),
    roomId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    courseInfo: z
      .object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        totalSessions: z.number().optional(),
        completedSessions: z.number().optional(),
        feePerCourse: z.number().optional(),
      })
      .optional(),
    weeklySchedule: z.array(scheduleSchema).optional(),
    maxStudents: z.number().optional(),
  }),
});
