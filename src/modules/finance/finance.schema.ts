import { z } from 'zod';

// 12.1 Tạo phiếu học phí thủ công
export const createInvoiceSchema = z.object({
  body: z.object({
    student_id: z.string().min(1),
    class_id: z.string().min(1),
    invoice_type: z.enum(['monthly', 'course']).default('monthly'),
    billing_period: z.string().regex(/^\d{4}-\d{2}$/, 'billing_period phải là YYYY-MM'),
    sessions_attended: z.number().int().min(0),
    fee_per_session: z.number().min(0),
    discount_amount: z.number().min(0).default(0),
    discount_note: z.string().optional(),
    due_date: z.string().datetime({ message: 'due_date phải là ISO 8601' }).optional(),
    note: z.string().optional(),
  }),
});

// 12.2 Batch generate
export const batchGenerateInvoiceSchema = z.object({
  body: z.object({
    branch_id: z.string().min(1),
    billing_period: z.string().regex(/^\d{4}-\d{2}$/, 'billing_period phải là YYYY-MM'),
    due_date: z.string().datetime({ message: 'due_date phải là ISO 8601' }).optional(),
  }),
});

// 12.5 Thu tiền mặt
export const payCashSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    amount: z.number().positive('Số tiền phải > 0'),
    note: z.string().optional(),
  }),
});

// 12.6 Tạo link VNPay
export const vnpayCreatePaymentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    bank_code: z.string().optional().default(''),
    return_url: z.string().url('return_url phải là URL hợp lệ'),
  }),
});
