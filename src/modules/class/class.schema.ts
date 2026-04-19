import { z } from 'zod';

const scheduleSchema = z.object({
  dayOfWeek: z.number().min(2).max(8),
  startTime: z.string(),
  endTime: z.string(),
  roomCode: z.string().optional()
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
      icon: z.string().optional()
    }),
    classType: z.enum(['course', 'ongoing']),
    ongoingInfo: z.object({
      feePerSession: z.number().optional(),
      billingCycle: z.string().optional()
    }).optional(),
    teacherId: z.string().optional(),
    weeklySchedule: z.array(scheduleSchema).optional(),
    maxStudents: z.number().optional(),
    description: z.string().optional()
  })
});

export const updateClassSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    teacherId: z.string().optional(),
    weeklySchedule: z.array(scheduleSchema).optional(),
    maxStudents: z.number().optional()
  })
});