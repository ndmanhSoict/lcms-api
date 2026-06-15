import { z } from 'zod';
const sessionSlotSchema = z
    .object({
    name: z.string().trim().min(1, 'Tên ca học không được để trống').max(80),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ bắt đầu không hợp lệ'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ kết thúc không hợp lệ'),
})
    .refine(slot => slot.startTime < slot.endTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
    path: ['endTime'],
});
const roomSchema = z.union([
    // Tự động map string thành object {code, name}
    z.string().transform(val => ({ code: val, name: val })),
    z.object({ code: z.string(), name: z.string() }),
]);
const passwordSchema = z
    .string()
    .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Mật khẩu phải có ít nhất 8 ký tự, 1 chữ hoa, 1 số và 1 ký tự đặc biệt');
export const createBranchSchema = z.object({
    body: z.object({
        ownerEmail: z.string().email({ message: 'Email chủ cơ sở không hợp lệ' }),
        password: passwordSchema,
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
    body: z
        .object({
        name: z.string().trim().min(1, 'Tên cơ sở không được để trống').max(150).optional(),
        address: z.string().trim().max(500).optional(),
        phone: z
            .string()
            .trim()
            .max(30)
            .regex(/^[0-9+().\s-]*$/, 'Số điện thoại không hợp lệ')
            .optional(),
        email: z.string().trim().email('Email liên hệ không hợp lệ').optional().or(z.literal('')),
        timezone: z.string().trim().min(1).max(100).optional(),
        defaultFeePerSession: z.number().min(0, 'Học phí không được âm').nullable().optional(),
        defaultSessionSlots: z.array(sessionSlotSchema).max(20).optional(),
        rooms: z.array(roomSchema).optional(),
    })
        .refine(body => Object.keys(body).length > 0, 'Cần ít nhất một trường để cập nhật'),
});
//# sourceMappingURL=branch.schema.js.map