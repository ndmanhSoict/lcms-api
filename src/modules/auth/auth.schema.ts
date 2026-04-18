import { z } from 'zod';

// Regex: ≥ 8 ký tự, ít nhất 1 hoa, 1 số, 1 ký tự đặc biệt
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token không được để trống'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z.string().regex(passwordRegex, 'Mật khẩu mới phải ≥ 8 ký tự, có chữ hoa, số và ký tự đặc biệt'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    newPassword: z.string().regex(passwordRegex, 'Mật khẩu mới phải ≥ 8 ký tự, có chữ hoa, số và ký tự đặc biệt'),
  }),
  params: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID người dùng không hợp lệ'),
  }),
});