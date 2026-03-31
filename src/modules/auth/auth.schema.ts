import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, { message: 'Vui lòng cung cấp email' })
      .email({ message: 'Định dạng email không hợp lệ' }),
    password: z
      .string()
      .min(6, { message: 'Vui lòng cung cấp mật khẩu' }),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, { message: 'Vui lòng cung cấp refresh token' }),
  }),
});