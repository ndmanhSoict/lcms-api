import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const branchAnalyticsSchema = z.object({
  query: z
    .object({
      mode: z.enum(['month', 'year']).default('month'),
      year: z.coerce
        .number()
        .int()
        .min(2020)
        .max(currentYear + 1)
        .default(currentYear),
      month: z.coerce.number().int().min(1).max(12).optional(),
    })
    .superRefine((query, context) => {
      if (query.mode === 'month' && query.month === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['month'],
          message: 'Vui lòng chọn tháng báo cáo',
        });
      }
    }),
});
