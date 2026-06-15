import { z } from 'zod';
import { ROLES, GENDERS } from '../../shared/constants/roles.js';
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

export const createUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Họ tên không được để trống'),
    email: z.string().email('Email không hợp lệ'),
    phone: phoneSchema.optional().or(z.literal('')),
    role: z.enum([ROLES.TEACHER, ROLES.STAFF, ROLES.STUDENT, ROLES.PARENT]),
    branchId: z.string().optional(),
    password: passwordSchema,
    dateOfBirth: z.string().optional(),
    gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).optional(),
    teacherInfo: z
      .object({
        subjects: z.array(z.string()).optional(),
        joinDate: z.string().optional(),
      })
      .optional(),
  }),
});

export const getUsersSchema = z.object({
  query: z.object({
    role: z.string().optional(),
    branchId: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z
    .object({
      fullName: z.string().min(1).optional(),
      phone: phoneSchema.nullable().optional().or(z.literal('')),
      dateOfBirth: z.string().nullable().optional(),
      gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).nullable().optional(),
      avatarUrl: z.string().nullable().optional(),
    })
    .refine(body => Object.keys(body).length > 0, 'Cần ít nhất một trường để cập nhật'),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});
