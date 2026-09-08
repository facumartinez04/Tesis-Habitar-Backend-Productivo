import { subscriptionRepository } from '../repositories/subscription.repository';
import { NotFoundError } from '../utils/http-error';
import type {
  CreatePlanInput,
  Plan,
  Subscription,
  UpdatePlanInput,
  UpdateSubscriptionInput,
} from '../domain/subscription';

export interface SubscriptionService {
  list(): Promise<Subscription[]>;
  findById(id: string): Promise<Subscription>;
  findByInstitutionId(institutionId: string): Promise<Subscription | null>;
  update(id: string, input: UpdateSubscriptionInput): Promise<Subscription>;
  renew(id: string): Promise<Subscription>;

  listPlans(includeInactive?: boolean): Promise<Plan[]>;
  getPlanById(id: string): Promise<Plan>;
  createPlan(input: CreatePlanInput): Promise<Plan>;
  updatePlan(id: string, input: UpdatePlanInput): Promise<Plan>;
  deletePlan(id: string): Promise<boolean>;
}

export class DefaultSubscriptionService implements SubscriptionService {
  async list(): Promise<Subscription[]> {
    return subscriptionRepository.findAll();
  }

  async findById(id: string): Promise<Subscription> {
    const sub = await subscriptionRepository.findById(id);
    if (!sub) throw new NotFoundError('Suscripción no encontrada');
    return sub;
  }

  async findByInstitutionId(institutionId: string): Promise<Subscription | null> {
    return subscriptionRepository.findByInstitutionId(institutionId);
  }

  async listPlans(includeInactive = false): Promise<Plan[]> {
    return subscriptionRepository.listPlans(includeInactive);
  }

  async getPlanById(id: string): Promise<Plan> {
    const plan = await subscriptionRepository.getPlanById(id);
    if (!plan) throw new NotFoundError('Plan no encontrado');
    return plan;
  }

  async createPlan(input: CreatePlanInput): Promise<Plan> {
    return subscriptionRepository.createPlan(input);
  }

  async updatePlan(id: string, input: UpdatePlanInput): Promise<Plan> {
    const updated = await subscriptionRepository.updatePlan(id, input);
    if (!updated) throw new NotFoundError('Plan no encontrado');
    return updated;
  }

  async deletePlan(id: string): Promise<boolean> {
    return subscriptionRepository.deletePlan(id);
  }

  async update(id: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const plans = await subscriptionRepository.listPlans(true);
    const updated = await subscriptionRepository.update(id, input, plans);
    if (!updated) throw new NotFoundError('Suscripción no encontrada');
    return updated;
  }

  async renew(id: string): Promise<Subscription> {
    return this.update(id, { managementStatus: 'CONFIRMADO' });
  }
}

export const subscriptionService = new DefaultSubscriptionService();
