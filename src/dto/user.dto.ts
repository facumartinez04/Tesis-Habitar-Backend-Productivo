import { z } from 'zod';

export const createInstitutionUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['DOCENTE', 'COORDINADOR', 'ADMIN']),
  provider: z.enum(['GOOGLE', 'MICROSOFT']),
});

export type CreateInstitutionUserDto = z.infer<typeof createInstitutionUserSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(['DOCENTE', 'COORDINADOR', 'ADMIN']),
});

export type UpdateUserRoleDto = z.infer<typeof updateUserRoleSchema>;

export const setUserActiveSchema = z.object({
  active: z.boolean(),
});

export type SetUserActiveDto = z.infer<typeof setUserActiveSchema>;
