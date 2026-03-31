import { z } from 'zod';

export const createBranchSchema = z.object({
  body: z.object({
    branchCode: z.string().min(1, { message: 'Vui lòng cung cấp mã chi nhánh' }),
    name: z.string().min(1, { message: 'Vui lòng cung cấp tên chi nhánh' }),
    address: z.string().min(1, { message: 'Vui lòng cung cấp địa chỉ' }),
    phone: z.string().optional(),
    email: z.string().email({ message: 'Email không hợp lệ' }).optional().or(z.literal('')),
    isActive: z.boolean().optional(),
    defaultSessionSlots: z.array(z.string()).optional()
  }),
});