import { Router } from 'express';
import { complianceController } from '../controllers/compliance.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import {
  requireSameInstitution,
  requireStudentAccess,
} from '../middlewares/access.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { updateRetentionPolicySchema } from '../dto/compliance.dto';

export const complianceRouter = Router();

complianceRouter.get(
  '/students',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  complianceController.searchStudents.bind(complianceController),
);

complianceRouter.get(
  '/audit-log',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  complianceController.getAuditLog.bind(complianceController),
);

complianceRouter.post(
  '/students/:studentId/export',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  requireStudentAccess('studentId'), complianceController.exportStudent.bind(complianceController),
);

complianceRouter.delete(
  '/students/:studentId',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  requireStudentAccess('studentId'), complianceController.deleteStudent.bind(complianceController),
);

complianceRouter.get('/consent', complianceController.getConsentDocument.bind(complianceController));

complianceRouter.post(
  '/consent/accept',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  complianceController.acceptConsent.bind(complianceController),
);

complianceRouter.get(
  '/retention/:institutionId',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  requireSameInstitution(), complianceController.getRetentionPolicy.bind(complianceController),
);

complianceRouter.patch(
  '/retention/:institutionId',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  validateBody(updateRetentionPolicySchema),
  requireSameInstitution(), complianceController.updateRetentionPolicy.bind(complianceController),
);

complianceRouter.post(
  '/retention/:institutionId/purge',
  requireAuth,
  requireRole('COORDINADOR', 'ADMIN'),
  requireSameInstitution(), complianceController.purgeExpiredData.bind(complianceController),
);
