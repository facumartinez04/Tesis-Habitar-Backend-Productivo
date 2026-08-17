import type { SubscriptionManagementStatus } from './enums';

export interface Plan {
  id: string;
  name: string;
  monthlyPriceArs: number;

  maxUsers: number;
}

export interface Subscription {
  id: string;
  institutionId: string;
  institutionName: string;
  planId: string;
  monthlyPriceArs: number;
  expiresAt: string;
  daysUntilExpiration: number;
  managementStatus: SubscriptionManagementStatus;
  durationMonths: number;
}

export interface UpdateSubscriptionInput {
  planId?: string;
  durationMonths?: number;
  managementStatus?: SubscriptionManagementStatus;
}
