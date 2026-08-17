import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { updateSubscriptionSchema } from '../dto/subscription.dto';

export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth, requireRole('ADMIN'));

subscriptionRouter.get('/', subscriptionController.list.bind(subscriptionController));
subscriptionRouter.get('/plans', subscriptionController.listPlans.bind(subscriptionController));
subscriptionRouter.patch('/:id', validateBody(updateSubscriptionSchema), subscriptionController.update.bind(subscriptionController));
subscriptionRouter.post('/:id/renew', subscriptionController.renew.bind(subscriptionController));
