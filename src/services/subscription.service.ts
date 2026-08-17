import { subscriptionRepository } from '../repositories/subscription.repository';
import { NotFoundError } from '../utils/http-error';
import type { Plan, Subscription, UpdateSubscriptionInput } from '../domain/subscription';

export interface SubscriptionService {
  list(): Promise<Subscription[]>;
  listPlans(): Promise<Plan[]>;
  update(id: string, input: UpdateSubscriptionInput): Promise<Subscription>;
  renew(id: string): Promise<Subscription>;
}

export class DefaultSubscriptionService implements SubscriptionService {
  async list(): Promise<Subscription[]> {
    return subscriptionRepository.findAll();
  }

  async listPlans(): Promise<Plan[]> {
    return subscriptionRepository.listPlans();
  }

  async update(id: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const plans = await subscriptionRepository.listPlans();
    const updated = await subscriptionRepository.update(id, input, plans);
    if (!updated) throw new NotFoundError('Suscripción no encontrada');
    return updated;
  }

  async renew(id: string): Promise<Subscription> {
    return this.update(id, { managementStatus: 'CONFIRMADO' });
  }
}

export const subscriptionService = new DefaultSubscriptionService();
