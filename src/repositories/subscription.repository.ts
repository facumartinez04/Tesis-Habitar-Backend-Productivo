import type { Subscription as PrismaSubscription } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { Plan, Subscription, UpdateSubscriptionInput } from '../domain/subscription';

type PrismaSubscriptionWithRelations = PrismaSubscription & { institution: { name: string } };

function daysUntil(dateString: string): number {
  const diffMs = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function toDomain(record: PrismaSubscriptionWithRelations): Subscription {
  return {
    id: record.id,
    institutionId: record.institutionId,
    institutionName: record.institution.name,
    planId: record.planId,
    monthlyPriceArs: record.monthlyPriceArs,
    expiresAt: record.expiresAt,
    daysUntilExpiration: daysUntil(record.expiresAt),
    managementStatus: record.managementStatus,
    durationMonths: record.durationMonths,
  };
}

export interface SubscriptionRepository {
  findAll(): Promise<Subscription[]>;
  findById(id: string): Promise<Subscription | null>;
  update(id: string, input: UpdateSubscriptionInput, plans: Plan[]): Promise<Subscription | null>;
  listPlans(): Promise<Plan[]>;
  getMaxUsersForInstitution(institutionId: string): Promise<number>;
}

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  async findAll(): Promise<Subscription[]> {
    const records = await prisma.subscription.findMany({
      include: { institution: { select: { name: true } } },
      orderBy: { expiresAt: 'asc' },
    });
    return records.map(toDomain);
  }

  async findById(id: string): Promise<Subscription | null> {
    const record = await prisma.subscription.findUnique({
      where: { id },
      include: { institution: { select: { name: true } } },
    });
    return record ? toDomain(record) : null;
  }

  async update(id: string, input: UpdateSubscriptionInput, plans: Plan[]): Promise<Subscription | null> {
    const plan = input.planId ? plans.find((p) => p.id === input.planId) : undefined;

    const record = await prisma.subscription.update({
      where: { id },
      data: {
        planId: input.planId,
        monthlyPriceArs: plan?.monthlyPriceArs,
        durationMonths: input.durationMonths,
        managementStatus: input.managementStatus,
      },
      include: { institution: { select: { name: true } } },
    });

    return toDomain(record);
  }

  async listPlans(): Promise<Plan[]> {
    const records = await prisma.plan.findMany();
    return records.map((r) => ({ id: r.id, name: r.name, monthlyPriceArs: r.monthlyPriceArs, maxUsers: r.maxUsers }));
  }

  async getMaxUsersForInstitution(institutionId: string): Promise<number> {
    const subscription = await prisma.subscription.findUnique({
      where: { institutionId },
      include: { plan: { select: { maxUsers: true } } },
    });
    return subscription?.plan.maxUsers ?? 50;
  }
}

export const subscriptionRepository = new PrismaSubscriptionRepository();
