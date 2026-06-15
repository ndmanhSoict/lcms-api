import { z } from 'zod';
import { GENDERS } from '../../shared/constants/roles.js';
import {
  VIETNAM_MOBILE_PHONE_MESSAGE,
  VIETNAM_MOBILE_PHONE_REGEX,
} from '../../shared/utils/validators.js';

const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải ít nhất 8 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải có chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu phải có chữ thường')
  .regex(/[0-9]/, 'Mật khẩu phải có chữ số')
  .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải có ký tự đặc biệt');

const phoneSchema = z
  .string()
  .trim()
  .regex(VIETNAM_MOBILE_PHONE_REGEX, VIETNAM_MOBILE_PHONE_MESSAGE);

export const createTeacherSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Họ tên không được để trống'),
    email: z.string().email('Email không hợp lệ'),
    phone: phoneSchema.optional().or(z.literal('')),
    password: passwordSchema,
    dateOfBirth: z.string().optional(),
    gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).optional(),
    teacherInfo: z
      .object({
        subjects: z.array(z.string()).optional().default([]),
        joinDate: z.string().optional(),
      })
      .optional(),
  }),
});

export const updateTeacherSchema = z.object({
  body: z.object({
    fullName: z.string().min(1).optional(),
    phone: phoneSchema.optional().or(z.literal('')),
    dateOfBirth: z.string().optional(),
    gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).optional(),
    avatarUrl: z.string().url('avatarUrl phải là URL hợp lệ').optional(),
    teacherInfo: z
      .object({
        subjects: z.array(z.string()).optional(),
        joinDate: z.string().optional(),
      })
      .optional(),
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

export const calculateTeacherSalarySchema = z.object({
  query: z.object({
    teacher_id: z.string().optional(),
    billing_period: z.string().regex(/^\d{4}-\d{2}$/, 'billing_period phải là YYYY-MM'),
    rate_per_session: z.coerce.number().min(0).default(0),
    bonus_amount: z.coerce.number().min(0).default(0),
    deduction_amount: z.coerce.number().min(0).default(0),
    note: z.string().optional(),
  }),
});

export const getTeacherSalaryOverviewSchema = z.object({
  query: z.object({
    teacher_id: z.string().optional(),
    billing_period: z.string().regex(/^\d{4}-\d{2}$/, 'billing_period phải là YYYY-MM'),
  }),
});
