import { z } from 'zod';

export const compareResultsQuerySchema = z.object({
  fromA: z.string().min(1),
  toA: z.string().min(1),
  fromB: z.string().min(1),
  toB: z.string().min(1),
});

export type CompareResultsQueryDto = z.infer<typeof compareResultsQuerySchema>;
