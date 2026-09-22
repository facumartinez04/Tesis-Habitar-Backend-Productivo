import { z } from 'zod';

export const updateRetentionPolicySchema = z.object({
  retentionMonths: z.number().int().min(1).max(120),
});

export type UpdateRetentionPolicyDto = z.infer<typeof updateRetentionPolicySchema>;
