import { z } from 'zod';
import { GENDERS, RELATIONSHIPS } from '../../shared/constants/roles.js';

const passwordSchema = z.string()
  .min(8, 'Mật khẩu phải ít nhất 8 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải có chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu phải có chữ thường')
  .regex(/[0-9]/, 'Mật khẩu phải có chữ số')
  .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải có ký tự đặc biệt');

const parentInfoSchema = z.object({
  studentIds: z.array(z.string()).optional().default([]),
  relationship: z.enum([
    RELATIONSHIPS.FATHER,
    RELATIONSHIPS.MOTHER,
    RELATIONSHIPS.GUARDIAN,
    RELATIONSHIPS.OTHER,
  ]).optional(),
}).optional();

export const createParentSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Họ tên không được để trống'),
    email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
    phone: z.string().min(10, 'Số điện thoại không hợp lệ'),
    password: passwordSchema.optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).optional(),
    avatarUrl: z.string().url('avatarUrl phải là URL hợp lệ').optional(),
    isActive: z.boolean().optional(),
    parentInfo: parentInfoSchema,
  }),
});

export const updateParentSchema = z.object({
  body: z.object({
    fullName: z.string().min(1).optional(),
    email: z.string().email('Email không hợp lệ').optional(),
    phone: z.string().min(10, 'Số điện thoại không hợp lệ').optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum([GENDERS.MALE, GENDERS.FEMALE, GENDERS.OTHER]).optional(),
    avatarUrl: z.string().url('avatarUrl phải là URL hợp lệ').optional(),
    isActive: z.boolean().optional(),
    parentInfo: parentInfoSchema,
  }),
});

export const getParentsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    studentId: z.string().optional(),
    relationship: z.enum([
      RELATIONSHIPS.FATHER,
      RELATIONSHIPS.MOTHER,
      RELATIONSHIPS.GUARDIAN,
      RELATIONSHIPS.OTHER,
    ]).optional(),
  }),
});
