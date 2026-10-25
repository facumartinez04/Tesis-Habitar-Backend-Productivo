import { z } from 'zod';

export const loginSchema = z.object({
  provider: z.enum(['GOOGLE', 'MICROSOFT']),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const updateLanguageSchema = z.object({
  language: z.enum(['es', 'en']).nullable(),
});

export type UpdateLanguageDto = z.infer<typeof updateLanguageSchema>;
