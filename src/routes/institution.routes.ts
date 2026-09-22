import { Router } from 'express';
import { institutionController } from '../controllers/institution.controller';
import { alertController } from '../controllers/alert.controller';
import { resultController } from '../controllers/result.controller';
import { userController } from '../controllers/user.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  createInstitutionSchema,
  updateInstitutionConfigSchema,
  testAiConfigSchema,
  updateInstitutionStatusSchema,
} from '../dto/institution.dto';
import { createInstitutionUserSchema, setUserActiveSchema, updateUserRoleSchema } from '../dto/user.dto';

export const institutionRouter = Router();

institutionRouter.get('/', requireAuth, requireRole('ADMIN'), institutionController.list.bind(institutionController));
institutionRouter.get('/by-id/:institutionId', requireAuth, institutionController.getById.bind(institutionController));
institutionRouter.get('/:slug', requireAuth, institutionController.getBySlug.bind(institutionController));
institutionRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(createInstitutionSchema),
  institutionController.create.bind(institutionController),
);

institutionRouter.get(
  '/:institutionId/alerts',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  alertController.getByInstitution.bind(alertController),
);

institutionRouter.get(
  '/:institutionId/results',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  resultController.getInstitutionSummary.bind(resultController),
);

institutionRouter.patch(
  '/:institutionId/config',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  validateBody(updateInstitutionConfigSchema),
  institutionController.updateConfig.bind(institutionController),
);

institutionRouter.post(
  '/:institutionId/ai-config/test',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  validateBody(testAiConfigSchema),
  institutionController.testAiConfig.bind(institutionController),
);

institutionRouter.patch(
  '/:institutionId/status',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(updateInstitutionStatusSchema),
  institutionController.updateStatus.bind(institutionController),
);

institutionRouter.get(
  '/:institutionId/ai-usage',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  institutionController.getAiUsage.bind(institutionController),
);

institutionRouter.get(
  '/:institutionId/users',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  userController.listByInstitution.bind(userController),
);
institutionRouter.post(
  '/:institutionId/users',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  validateBody(createInstitutionUserSchema),
  userController.invite.bind(userController),
);
institutionRouter.patch(
  '/:institutionId/users/:userId/role',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  validateBody(updateUserRoleSchema),
  userController.updateRole.bind(userController),
);
institutionRouter.patch(
  '/:institutionId/users/:userId/active',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  validateBody(setUserActiveSchema),
  userController.setActive.bind(userController),
);
