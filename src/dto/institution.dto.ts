import { z } from 'zod';

export const createInstitutionSchema = z.object({
  name: z.string().min(2),
  domain: z.string().min(3),
  status: z.enum(['ACTIVO', 'PILOTO_NO_CONFIRMADO']),
  coordinatorEmail: z.string().email(),
  levels: z.array(z.enum(['PRIMARIO', 'SECUNDARIO'])).min(1),
});

export type CreateInstitutionDto = z.infer<typeof createInstitutionSchema>;

export const updateInstitutionConfigSchema = z
  .object({
    levels: z.array(z.enum(['PRIMARIO', 'SECUNDARIO'])).min(1).optional(),
    enabledAxes: z.array(z.enum(['LITERAL', 'INFERENCIAL', 'CRITICO'])).min(1).optional(),
    aiProvider: z.enum(['DEEPSEEK', 'OPENAI']).optional(),
    aiKeySource: z.enum(['PLATFORM', 'CUSTOM']).optional(),
    aiCustomApiKey: z.string().nullable().optional(),
    aiModel: z.string().nullable().optional(),
    studentIdMode: z.enum(['LISTA', 'NOMBRE']).optional(),
    alertThreshold: z.number().int().min(0).max(100).optional(),
    alertEmailsEnabled: z.boolean().optional(),
    defaultLanguage: z.enum(['es', 'en']).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Debe enviarse al menos un campo de configuración para actualizar',
  });

export type UpdateInstitutionConfigDto = z.infer<typeof updateInstitutionConfigSchema>;

export const testAiConfigSchema = z.object({
  provider: z.enum(['DEEPSEEK', 'OPENAI']),
  keySource: z.enum(['PLATFORM', 'CUSTOM']),
  apiKey: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
});

export type TestAiConfigDto = z.infer<typeof testAiConfigSchema>;

export const updateInstitutionStatusSchema = z.object({
  status: z.enum(['ACTIVO', 'PILOTO_NO_CONFIRMADO']),
});

export type UpdateInstitutionStatusDto = z.infer<typeof updateInstitutionStatusSchema>;
