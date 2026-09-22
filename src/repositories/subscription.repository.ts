import { query, queryOne } from '../config/db';
import type {
  CreatePlanInput,
  Plan,
  PlanFeatures,
  Subscription,
  UpdatePlanInput,
  UpdateSubscriptionInput,
} from '../domain/subscription';

const DEFAULT_FEATURES: PlanFeatures = {
  hasAiAnalytics: false,
  hasEarlyAlerts: true,
  hasArcoCompliance: true,
  hasCustomDomain: false,
  hasApiAccess: false,
  hasSlaSupport: false,
  hasExportReports: true,
  bullets: [],
};

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  monthlyPriceArs: number;
  annualPriceArs: number | null;
  maxUsers: number;
  maxStudents: number | null;
  maxCourses: number | null;
  storageGb: number | null;
  features: any;
  badge: string | null;
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function toPlanDomain(row: PlanRow): Plan {
  const parsedFeatures =
    typeof row.features === 'string'
      ? JSON.parse(row.features)
      : row.features || {};

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    monthlyPriceArs: row.monthlyPriceArs,
    annualPriceArs: row.annualPriceArs ?? Math.round(row.monthlyPriceArs * 10),
    maxUsers: row.maxUsers ?? 50,
    maxStudents: row.maxStudents ?? 500,
    maxCourses: row.maxCourses ?? 20,
    storageGb: row.storageGb ?? 10,
    features: {
      ...DEFAULT_FEATURES,
      ...parsedFeatures,
      bullets: Array.isArray(parsedFeatures.bullets) ? parsedFeatures.bullets : [],
    },
    badge: row.badge || '',
    isActive: row.isActive ?? true,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

interface SubscriptionRow {
  id: string;
  institutionId: string;
  institutionName: string;
  planId: string;
  planName: string | null;
  monthlyPriceArs: number;
  expiresAt: string;
  managementStatus: Subscription['managementStatus'];
  durationMonths: number;
  customMaxUsers: number | null;
  customMaxStudents: number | null;
  customMaxCourses: number | null;
  customStorageGb: number | null;
  customFeatures: any;
  customNotes: string | null;
  billingCycle: 'MONTHLY' | 'ANNUAL' | null;

  planMaxUsers: number | null;
  planMaxStudents: number | null;
  planMaxCourses: number | null;
  planStorageGb: number | null;
  planFeatures: any;
}

function daysUntil(dateString: string): number {
  const diffMs = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function toSubscriptionDomain(row: SubscriptionRow): Subscription {
  const basePlanFeatures: PlanFeatures = {
    ...DEFAULT_FEATURES,
    ...(typeof row.planFeatures === 'string'
      ? JSON.parse(row.planFeatures)
      : row.planFeatures || {}),
  };

  const customFeatures =
    typeof row.customFeatures === 'string'
      ? JSON.parse(row.customFeatures)
      : row.customFeatures || null;

  const effectiveFeatures: PlanFeatures = {
    ...basePlanFeatures,
    ...(customFeatures || {}),
    bullets: basePlanFeatures.bullets || [],
  };

  return {
    id: row.id,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    planId: row.planId,
    planName: row.planName || 'Plan Estándar',
    monthlyPriceArs: row.monthlyPriceArs,
    expiresAt: row.expiresAt,
    daysUntilExpiration: daysUntil(row.expiresAt),
    managementStatus: row.managementStatus,
    durationMonths: row.durationMonths,

    customMaxUsers: row.customMaxUsers,
    customMaxStudents: row.customMaxStudents,
    customMaxCourses: row.customMaxCourses,
    customStorageGb: row.customStorageGb,
    customFeatures,
    customNotes: row.customNotes || '',
    billingCycle: row.billingCycle || 'MONTHLY',

    effectiveMaxUsers: row.customMaxUsers ?? row.planMaxUsers ?? 50,
    effectiveMaxStudents: row.customMaxStudents ?? row.planMaxStudents ?? 500,
    effectiveMaxCourses: row.customMaxCourses ?? row.planMaxCourses ?? 20,
    effectiveStorageGb: row.customStorageGb ?? row.planStorageGb ?? 10,
    effectiveFeatures,
  };
}

const SELECT_SUBSCRIPTION = `
  SELECT s."id", s."institutionId", i."name" AS "institutionName", s."planId", p."name" AS "planName",
         s."monthlyPriceArs", s."expiresAt", s."managementStatus", s."durationMonths",
         s."customMaxUsers", s."customMaxStudents", s."customMaxCourses", s."customStorageGb",
         s."customFeatures", s."customNotes", s."billingCycle",
         p."maxUsers" AS "planMaxUsers", p."maxStudents" AS "planMaxStudents",
         p."maxCourses" AS "planMaxCourses", p."storageGb" AS "planStorageGb",
         p."features" AS "planFeatures"
    FROM "Subscription" s
    JOIN "Institution" i ON i."id" = s."institutionId"
    LEFT JOIN "Plan" p ON p."id" = s."planId"
`;

export interface SubscriptionRepository {
  findAll(): Promise<Subscription[]>;
  findById(id: string): Promise<Subscription | null>;
  findByInstitutionId(institutionId: string): Promise<Subscription | null>;
  update(id: string, input: UpdateSubscriptionInput, plans: Plan[]): Promise<Subscription | null>;
  listPlans(includeInactive?: boolean): Promise<Plan[]>;
  getPlanById(id: string): Promise<Plan | null>;
  createPlan(input: CreatePlanInput): Promise<Plan>;
  updatePlan(id: string, input: UpdatePlanInput): Promise<Plan | null>;
  deletePlan(id: string): Promise<boolean>;
  getMaxUsersForInstitution(institutionId: string): Promise<number>;
}

export class SqlSubscriptionRepository implements SubscriptionRepository {
  async findAll(): Promise<Subscription[]> {
    const rows = await query<SubscriptionRow>(`${SELECT_SUBSCRIPTION} ORDER BY s."expiresAt" ASC`);
    return rows.map(toSubscriptionDomain);
  }

  async findById(id: string): Promise<Subscription | null> {
    const row = await queryOne<SubscriptionRow>(`${SELECT_SUBSCRIPTION} WHERE s."id" = $1`, [id]);
    return row ? toSubscriptionDomain(row) : null;
  }

  async findByInstitutionId(institutionId: string): Promise<Subscription | null> {
    const row = await queryOne<SubscriptionRow>(`${SELECT_SUBSCRIPTION} WHERE s."institutionId" = $1`, [institutionId]);
    return row ? toSubscriptionDomain(row) : null;
  }

  async update(id: string, input: UpdateSubscriptionInput, plans: Plan[]): Promise<Subscription | null> {
    const plan = input.planId ? plans.find((p) => p.id === input.planId) : undefined;
    const computedPrice =
      input.monthlyPriceArs !== undefined
        ? input.monthlyPriceArs
        : plan
        ? input.billingCycle === 'ANNUAL' && plan.annualPriceArs > 0
          ? Math.round(plan.annualPriceArs / 12)
          : plan.monthlyPriceArs
        : null;

    const customFeaturesJson =
      input.customFeatures !== undefined
        ? input.customFeatures === null
          ? null
          : JSON.stringify(input.customFeatures)
        : undefined;

    await query(
      `UPDATE "Subscription"
          SET "planId" = COALESCE($1, "planId"),
              "monthlyPriceArs" = COALESCE($2, "monthlyPriceArs"),
              "durationMonths" = COALESCE($3, "durationMonths"),
              "managementStatus" = COALESCE($4, "managementStatus"),
              "customMaxUsers" = CASE WHEN $5::boolean THEN $6::integer ELSE "customMaxUsers" END,
              "customMaxStudents" = CASE WHEN $7::boolean THEN $8::integer ELSE "customMaxStudents" END,
              "customMaxCourses" = CASE WHEN $9::boolean THEN $10::integer ELSE "customMaxCourses" END,
              "customStorageGb" = CASE WHEN $11::boolean THEN $12::integer ELSE "customStorageGb" END,
              "customFeatures" = CASE WHEN $13::boolean THEN $14::jsonb ELSE "customFeatures" END,
              "customNotes" = CASE WHEN $15::boolean THEN $16::text ELSE "customNotes" END,
              "billingCycle" = COALESCE($17, "billingCycle")
        WHERE "id" = $18`,
      [
        input.planId ?? null,
        computedPrice,
        input.durationMonths ?? null,
        input.managementStatus ?? null,
        input.customMaxUsers !== undefined,
        input.customMaxUsers ?? null,
        input.customMaxStudents !== undefined,
        input.customMaxStudents ?? null,
        input.customMaxCourses !== undefined,
        input.customMaxCourses ?? null,
        input.customStorageGb !== undefined,
        input.customStorageGb ?? null,
        input.customFeatures !== undefined,
        customFeaturesJson ?? null,
        input.customNotes !== undefined,
        input.customNotes ?? null,
        input.billingCycle ?? null,
        id,
      ]
    );

    return this.findById(id);
  }

  async listPlans(includeInactive = false): Promise<Plan[]> {
    const where = includeInactive ? '' : 'WHERE "isActive" = true';
    const rows = await query<PlanRow>(`SELECT * FROM "Plan" ${where} ORDER BY "monthlyPriceArs" ASC`);
    return rows.map(toPlanDomain);
  }

  async getPlanById(id: string): Promise<Plan | null> {
    const row = await queryOne<PlanRow>('SELECT * FROM "Plan" WHERE "id" = $1', [id]);
    return row ? toPlanDomain(row) : null;
  }

  async createPlan(input: CreatePlanInput): Promise<Plan> {
    const id =
      input.id ||
      input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/^_+|_+$/g, '') ||
      `plan_${Date.now()}`;

    const featuresJson = JSON.stringify({
      ...DEFAULT_FEATURES,
      ...(input.features || {}),
    });

    const row = await queryOne<PlanRow>(
      `INSERT INTO "Plan" (
        "id", "name", "description", "monthlyPriceArs", "annualPriceArs",
        "maxUsers", "maxStudents", "maxCourses", "storageGb",
        "features", "badge", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, NOW(), NOW()
      ) RETURNING *`,
      [
        id,
        input.name,
        input.description || '',
        input.monthlyPriceArs,
        input.annualPriceArs ?? Math.round(input.monthlyPriceArs * 10),
        input.maxUsers ?? 50,
        input.maxStudents ?? 500,
        input.maxCourses ?? 20,
        input.storageGb ?? 10,
        featuresJson,
        input.badge || '',
        input.isActive ?? true,
      ]
    );

    return toPlanDomain(row!);
  }

  async updatePlan(id: string, input: UpdatePlanInput): Promise<Plan | null> {
    const existing = await this.getPlanById(id);
    if (!existing) return null;

    const mergedFeatures = input.features
      ? { ...existing.features, ...input.features }
      : existing.features;

    const row = await queryOne<PlanRow>(
      `UPDATE "Plan"
          SET "name" = COALESCE($1, "name"),
              "description" = COALESCE($2, "description"),
              "monthlyPriceArs" = COALESCE($3, "monthlyPriceArs"),
              "annualPriceArs" = COALESCE($4, "annualPriceArs"),
              "maxUsers" = COALESCE($5, "maxUsers"),
              "maxStudents" = COALESCE($6, "maxStudents"),
              "maxCourses" = COALESCE($7, "maxCourses"),
              "storageGb" = COALESCE($8, "storageGb"),
              "features" = $9,
              "badge" = COALESCE($10, "badge"),
              "isActive" = COALESCE($11, "isActive"),
              "updatedAt" = NOW()
        WHERE "id" = $12
        RETURNING *`,
      [
        input.name ?? null,
        input.description ?? null,
        input.monthlyPriceArs ?? null,
        input.annualPriceArs ?? null,
        input.maxUsers ?? null,
        input.maxStudents ?? null,
        input.maxCourses ?? null,
        input.storageGb ?? null,
        JSON.stringify(mergedFeatures),
        input.badge ?? null,
        input.isActive ?? null,
        id,
      ]
    );

    return row ? toPlanDomain(row) : null;
  }

  async deletePlan(id: string): Promise<boolean> {

    const checkInUse = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM "Subscription" WHERE "planId" = $1',
      [id]
    );
    const count = parseInt(checkInUse?.count || '0', 10);
    if (count > 0) {

      await query('UPDATE "Plan" SET "isActive" = false, "updatedAt" = NOW() WHERE "id" = $1', [id]);
      return true;
    }

    await query('DELETE FROM "Plan" WHERE "id" = $1', [id]);
    return true;
  }

  async getMaxUsersForInstitution(institutionId: string): Promise<number> {
    const row = await queryOne<{ maxUsers: number }>(
      `SELECT COALESCE(s."customMaxUsers", p."maxUsers", 50) AS "maxUsers"
         FROM "Subscription" s
         LEFT JOIN "Plan" p ON p."id" = s."planId"
        WHERE s."institutionId" = $1`,
      [institutionId]
    );
    return row?.maxUsers ?? 50;
  }
}

export const subscriptionRepository = new SqlSubscriptionRepository();
