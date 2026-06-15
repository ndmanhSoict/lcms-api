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

export const createStudentSchema = z.object({
  body: z.object({
    branchId: z.string(),
    fullName: z.string().min(1),
    email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
    phone: phoneSchema.optional().or(z.literal('')),
    password: passwordSchema,
    dateOfBirth: z.string().optional(),
    gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).optional(),
    schoolName: z.string().optional(),
    grade: z.coerce.number().int().min(1).max(12).optional(),
    parent: z
      .object({
        fullName: z.string().min(1),
        phone: phoneSchema,
        email: z.string().email().optional().or(z.literal('')),
        relationship: z.string(),
        password: z.string().min(6).optional(),
      })
      .optional(),
  }),
});

export const updateStudentSchema = z.object({
  body: z.object({
    schoolName: z.string().optional(),
    grade: z.number().optional(),
    phone: phoneSchema.optional().or(z.literal('')),
  }),
});

export const addStudentParentSchema = z.object({
  body: z.object({
    fullName: z.string().min(1),
    phone: phoneSchema,
    email: z.string().email().optional().or(z.literal('')),
    relationship: z.string(),
    password: z.string().min(6).optional(),
  }),
});
