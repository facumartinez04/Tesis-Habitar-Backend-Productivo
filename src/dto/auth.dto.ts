import { z } from 'zod';

export const loginSchema = z.object({
  provider: z.enum(['GOOGLE', 'MICROSOFT']),
});

export type LoginDto = z.infer<typeof loginSchema>;
