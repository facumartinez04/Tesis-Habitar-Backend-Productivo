import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { createPlanSchema, updatePlanSchema, updateSubscriptionSchema } from '../dto/subscription.dto';

export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth, requireRole('ADMIN'));

// Gestión de Planes de Suscripción
subscriptionRouter.get('/plans', subscriptionController.listPlans.bind(subscriptionController));
subscriptionRouter.post('/plans', validateBody(createPlanSchema), subscriptionController.createPlan.bind(subscriptionController));
subscriptionRouter.get('/plans/:id', subscriptionController.getPlan.bind(subscriptionController));
subscriptionRouter.patch('/plans/:id', validateBody(updatePlanSchema), subscriptionController.updatePlan.bind(subscriptionController));
subscriptionRouter.delete('/plans/:id', subscriptionController.deletePlan.bind(subscriptionController));

// Suscripciones por institución
subscriptionRouter.get('/institution/:institutionId', subscriptionController.getByInstitution.bind(subscriptionController));

// Suscripciones generales
subscriptionRouter.get('/', subscriptionController.list.bind(subscriptionController));
subscriptionRouter.get('/:id', subscriptionController.getById.bind(subscriptionController));
subscriptionRouter.patch('/:id', validateBody(updateSubscriptionSchema), subscriptionController.update.bind(subscriptionController));
subscriptionRouter.post('/:id/renew', subscriptionController.renew.bind(subscriptionController));
