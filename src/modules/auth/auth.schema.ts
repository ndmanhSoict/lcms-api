import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    // Đổi email thành phone làm login identifier chính
    phone: z
      .string()
      .min(9, { message: 'Số điện thoại không hợp lệ' })
      .max(15, { message: 'Số điện thoại quá dài' }),
    password: z.string().min(6, { message: 'Vui lòng cung cấp mật khẩu' }),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, { message: 'Vui lòng cung cấp refresh token' }),
  }),
});