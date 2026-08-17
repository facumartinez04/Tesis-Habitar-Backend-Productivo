import { z } from 'zod';

export const updateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  durationMonths: z.number().int().positive().optional(),
  managementStatus: z.enum(['EN_NEGOCIACION', 'CONFIRMADO']).optional(),
});

export type UpdateSubscriptionDto = z.infer<typeof updateSubscriptionSchema>;
