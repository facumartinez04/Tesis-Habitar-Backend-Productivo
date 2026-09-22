import { z } from 'zod';

export const planFeaturesSchema = z.object({
  hasAiAnalytics: z.boolean().optional(),
  hasEarlyAlerts: z.boolean().optional(),
  hasArcoCompliance: z.boolean().optional(),
  hasCustomDomain: z.boolean().optional(),
  hasApiAccess: z.boolean().optional(),
  hasSlaSupport: z.boolean().optional(),
  hasExportReports: z.boolean().optional(),
  bullets: z.array(z.string()).optional(),
});

export const createPlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre del plan es obligatorio'),
  description: z.string().optional(),
  monthlyPriceArs: z.number().int().min(0),
  annualPriceArs: z.number().int().min(0).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxStudents: z.number().int().min(1).optional(),
  maxCourses: z.number().int().min(1).optional(),
  storageGb: z.number().int().min(1).optional(),
  features: planFeaturesSchema.optional(),
  badge: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  monthlyPriceArs: z.number().int().min(0).optional(),
  annualPriceArs: z.number().int().min(0).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxStudents: z.number().int().min(1).optional(),
  maxCourses: z.number().int().min(1).optional(),
  storageGb: z.number().int().min(1).optional(),
  features: planFeaturesSchema.optional(),
  badge: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  monthlyPriceArs: z.number().int().min(0).optional(),
  durationMonths: z.number().int().positive().optional(),
  managementStatus: z.enum(['EN_NEGOCIACION', 'CONFIRMADO']).optional(),
  customMaxUsers: z.number().int().nullable().optional(),
  customMaxStudents: z.number().int().nullable().optional(),
  customMaxCourses: z.number().int().nullable().optional(),
  customStorageGb: z.number().int().nullable().optional(),
  customFeatures: planFeaturesSchema.nullable().optional(),
  customNotes: z.string().nullable().optional(),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
});

export type CreatePlanDto = z.infer<typeof createPlanSchema>;
export type UpdatePlanDto = z.infer<typeof updatePlanSchema>;
export type UpdateSubscriptionDto = z.infer<typeof updateSubscriptionSchema>;
