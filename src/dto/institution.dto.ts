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
  })
  .refine((data) => data.levels || data.enabledAxes, {
    message: 'Debe enviarse al menos "levels" o "enabledAxes"',
  });

export type UpdateInstitutionConfigDto = z.infer<typeof updateInstitutionConfigSchema>;
