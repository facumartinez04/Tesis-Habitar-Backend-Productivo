import type { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service';
import type { CreatePlanDto, UpdatePlanDto, UpdateSubscriptionDto } from '../dto/subscription.dto';

export class SubscriptionController {
  async list(_req: Request, res: Response): Promise<void> {
    const subscriptions = await subscriptionService.list();
    res.json(subscriptions);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const subscription = await subscriptionService.findById(String(req.params.id));
    res.json(subscription);
  }

  async getByInstitution(req: Request, res: Response): Promise<void> {
    const subscription = await subscriptionService.findByInstitutionId(String(req.params.institutionId));
    res.json({ subscription });
  }

  async listPlans(req: Request, res: Response): Promise<void> {
    const includeInactive = req.query.includeInactive === 'true';
    const plans = await subscriptionService.listPlans(includeInactive);
    res.json(plans);
  }

  async getPlan(req: Request, res: Response): Promise<void> {
    const plan = await subscriptionService.getPlanById(String(req.params.id));
    res.json(plan);
  }

  async createPlan(req: Request, res: Response): Promise<void> {
    const input = req.body as CreatePlanDto;
    const plan = await subscriptionService.createPlan(input);
    res.status(201).json(plan);
  }

  async updatePlan(req: Request, res: Response): Promise<void> {
    const input = req.body as UpdatePlanDto;
    const plan = await subscriptionService.updatePlan(String(req.params.id), input);
    res.json(plan);
  }

  async deletePlan(req: Request, res: Response): Promise<void> {
    await subscriptionService.deletePlan(String(req.params.id));
    res.json({ success: true, message: 'Plan procesado con éxito' });
  }

  async update(req: Request, res: Response): Promise<void> {
    const input = req.body as UpdateSubscriptionDto;
    const subscription = await subscriptionService.update(String(req.params.id), input);
    res.json(subscription);
  }

  async renew(req: Request, res: Response): Promise<void> {
    const subscription = await subscriptionService.renew(String(req.params.id));
    res.json(subscription);
  }
}

export const subscriptionController = new SubscriptionController();
