import { z } from 'zod';
const sessionSlotSchema = z.object({
    name: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1)
});
const roomSchema = z.union([
    // Tự động map string thành object {code, name}
    z.string().transform((val) => ({ code: val, name: val })),
    z.object({ code: z.string(), name: z.string() })
]);
export const createBranchSchema = z.object({
    body: z.object({
        branchCode: z.string().min(1, { message: 'Vui lòng cung cấp mã chi nhánh' }),
        name: z.string().min(1, { message: 'Vui lòng cung cấp tên chi nhánh' }),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email({ message: 'Email không hợp lệ' }).optional().or(z.literal('')),
        timezone: z.string().optional(),
        defaultFeePerSession: z.number().optional(),
        defaultSessionSlots: z.array(sessionSlotSchema).optional(),
        rooms: z.array(roomSchema).optional(),
        isActive: z.boolean().optional()
    }),
});
export const getBranchesSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        search: z.string().optional(),
        // Chấp nhận string 'true' hoặc 'false' từ query params
        isActive: z.enum(['true', 'false']).optional(),
    }),
});
export const updateBranchSchema = z.object({
    body: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        timezone: z.string().optional(),
        defaultFeePerSession: z.number().optional(),
        defaultSessionSlots: z.array(sessionSlotSchema).optional(),
        rooms: z.array(roomSchema).optional(),
    }),
});
//# sourceMappingURL=branch.schema.js.map