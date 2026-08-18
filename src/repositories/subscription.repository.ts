import { query, queryOne } from '../config/db';
import type { Plan, Subscription, UpdateSubscriptionInput } from '../domain/subscription';

interface SubscriptionRow {
  id: string;
  institutionId: string;
  institutionName: string;
  planId: string;
  monthlyPriceArs: number;
  expiresAt: string;
  managementStatus: Subscription['managementStatus'];
  durationMonths: number;
}

function daysUntil(dateString: string): number {
  const diffMs = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function toDomain(row: SubscriptionRow): Subscription {
  return { ...row, daysUntilExpiration: daysUntil(row.expiresAt) };
}

const SELECT = `
  SELECT s."id", s."institutionId", i."name" AS "institutionName", s."planId", s."monthlyPriceArs",
         s."expiresAt", s."managementStatus", s."durationMonths"
    FROM "Subscription" s
    JOIN "Institution" i ON i."id" = s."institutionId"
`;

export interface SubscriptionRepository {
  findAll(): Promise<Subscription[]>;
  findById(id: string): Promise<Subscription | null>;
  update(id: string, input: UpdateSubscriptionInput, plans: Plan[]): Promise<Subscription | null>;
  listPlans(): Promise<Plan[]>;
  getMaxUsersForInstitution(institutionId: string): Promise<number>;
}

export class SqlSubscriptionRepository implements SubscriptionRepository {
  async findAll(): Promise<Subscription[]> {
    const rows = await query<SubscriptionRow>(`${SELECT} ORDER BY s."expiresAt" ASC`);
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Subscription | null> {
    const row = await queryOne<SubscriptionRow>(`${SELECT} WHERE s."id" = $1`, [id]);
    return row ? toDomain(row) : null;
  }

  async update(id: string, input: UpdateSubscriptionInput, plans: Plan[]): Promise<Subscription | null> {
    const plan = input.planId ? plans.find((p) => p.id === input.planId) : undefined;

    await query(
      `UPDATE "Subscription"
          SET "planId" = COALESCE($1, "planId"),
              "monthlyPriceArs" = COALESCE($2, "monthlyPriceArs"),
              "durationMonths" = COALESCE($3, "durationMonths"),
              "managementStatus" = COALESCE($4, "managementStatus")
        WHERE "id" = $5`,
      [input.planId ?? null, plan?.monthlyPriceArs ?? null, input.durationMonths ?? null, input.managementStatus ?? null, id],
    );

    return this.findById(id);
  }

  async listPlans(): Promise<Plan[]> {
    return query<Plan>('SELECT "id", "name", "monthlyPriceArs", "maxUsers" FROM "Plan"');
  }

  async getMaxUsersForInstitution(institutionId: string): Promise<number> {
    const row = await queryOne<{ maxUsers: number }>(
      `SELECT p."maxUsers" FROM "Subscription" s JOIN "Plan" p ON p."id" = s."planId" WHERE s."institutionId" = $1`,
      [institutionId],
    );
    return row?.maxUsers ?? 50;
  }
}

export const subscriptionRepository = new SqlSubscriptionRepository();
