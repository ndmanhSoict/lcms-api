import { z } from 'zod';

export const createClassroomSchema = z.object({
  body: z.object({
    branchId: z.string().optional(),
    code: z.string().min(1, 'Mã phòng không được để trống'),
    capacity: z.coerce.number().int().min(1, 'Sức chứa phải lớn hơn 0'),
    detail: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateClassroomSchema = z.object({
  body: z
    .object({
      code: z.string().min(1, 'Mã phòng không được để trống').optional(),
      capacity: z.coerce.number().int().min(1, 'Sức chứa phải lớn hơn 0').optional(),
      detail: z.string().optional(),
      isActive: z.boolean().optional(),
    })
    .refine(body => Object.keys(body).length > 0, 'Cần ít nhất một trường để cập nhật'),
});

export const getClassroomsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  }),
});
