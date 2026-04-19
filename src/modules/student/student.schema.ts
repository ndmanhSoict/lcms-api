import { z } from 'zod';

export const createStudentSchema = z.object({
  body: z.object({
    branchId: z.string(),
    fullName: z.string().min(1),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    schoolName: z.string().optional(),
    grade: z.number().optional(),
    parent: z.object({
      fullName: z.string().min(1),
      phone: z.string().min(10),
      email: z.string().email().optional().or(z.literal('')),
      relationship: z.string(),
      password: z.string().min(6).optional()
    })
  })
});

export const updateStudentSchema = z.object({
  body: z.object({
    schoolName: z.string().optional(),
    grade: z.number().optional(),
    phone: z.string().optional()
  })
});