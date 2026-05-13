import { z } from 'zod';
import { GENDERS } from '../../shared/constants/roles.js';

const passwordSchema = z.string()
  .min(8, 'Mật khẩu phải ít nhất 8 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải có chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu phải có chữ thường')
  .regex(/[0-9]/, 'Mật khẩu phải có chữ số')
  .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải có ký tự đặc biệt');

export const createTeacherSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Họ tên không được để trống'),
    email: z.string().email('Email không hợp lệ'),
    phone: z.string().optional(),
    password: passwordSchema,
    dateOfBirth: z.string().optional(),
    gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).optional(),
    teacherInfo: z.object({
      subjects: z.array(z.string()).optional().default([]),
      joinDate: z.string().optional(),
    }).optional(),
  }),
});

export const updateTeacherSchema = z.object({
  body: z.object({
    fullName: z.string().min(1).optional(),
    phone: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).optional(),
    avatarUrl: z.string().url('avatarUrl phải là URL hợp lệ').optional(),
    teacherInfo: z.object({
      subjects: z.array(z.string()).optional(),
      joinDate: z.string().optional(),
    }).optional(),
  }),
});

export const getTeachersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    subject: z.string().optional(),
  }),
});
