import type { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service';
import type { UpdateSubscriptionDto } from '../dto/subscription.dto';

export class SubscriptionController {
  async list(_req: Request, res: Response): Promise<void> {
    const subscriptions = await subscriptionService.list();
    res.json(subscriptions);
  }

  async listPlans(_req: Request, res: Response): Promise<void> {
    const plans = await subscriptionService.listPlans();
    res.json(plans);
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
