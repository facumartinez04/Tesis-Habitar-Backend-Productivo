import { Router } from 'express';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import { financeController } from '../controllers/finance.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import {
  requireSameInstitution,
} from '../middlewares/access.middleware';

export const financeRouter = Router();

financeRouter.post('/webhook/mercadopago', financeController.handleMercadoPagoWebhook.bind(financeController));

financeRouter.get(
  '/platform/summary',
  requireAuth,
  requireRole('ADMIN'),
  financeController.getPlatformSummary.bind(financeController)
);

financeRouter.get(
  '/platform/expenses',
  requireAuth,
  requireRole('ADMIN'),
  financeController.listPlatformExpenses.bind(financeController)
);

financeRouter.post(
  '/platform/expenses',
  requireAuth,
  requireRole('ADMIN'),
  financeController.createPlatformExpense.bind(financeController)
);

financeRouter.delete(
  '/platform/expenses/:id',
  requireAuth,
  requireRole('ADMIN'),
  financeController.deletePlatformExpense.bind(financeController)
);

financeRouter.get(
  '/platform/transactions',
  requireAuth,
  requireRole('ADMIN'),
  financeController.listTransactions.bind(financeController)
);

financeRouter.post(
  '/platform/checkout',
  requireAuth,
  requireRole('ADMIN'),
  financeController.createSubscriptionCheckout.bind(financeController)
);

financeRouter.get(
  '/platform/config',
  requireAuth,
  requireRole('ADMIN'),
  financeController.getFinanceConfig.bind(financeController)
);

financeRouter.post(
  '/platform/config',
  requireAuth,
  requireRole('ADMIN'),
  financeController.saveFinanceConfig.bind(financeController)
);

financeRouter.post(
  '/platform/mercadopago/test-payment',
  requireAuth,
  requireRole('ADMIN'),
  financeController.createTestPayment.bind(financeController)
);

// Página de resultado al volver de Mercado Pago (pública: el estado sale de la API de Mercado Pago).
financeRouter.get(
  '/payments/return',
  rateLimit({ windowMs: 10 * 60 * 1000, max: 120, name: 'payment-return' }),
  financeController.paymentReturn.bind(financeController)
);

financeRouter.post(
  '/platform/mercadopago/test',
  requireAuth,
  requireRole('ADMIN'),
  financeController.testMercadoPago.bind(financeController)
);

financeRouter.get(
  '/institution/:institutionId/summary',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.getInstitutionSummary.bind(financeController)
);

financeRouter.get(
  '/institution/:institutionId/expenses',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.listInstitutionExpenses.bind(financeController)
);

financeRouter.post(
  '/institution/:institutionId/expenses',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.createInstitutionExpense.bind(financeController)
);

financeRouter.delete(
  '/institution/:institutionId/expenses/:id',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.deleteInstitutionExpense.bind(financeController)
);

financeRouter.get(
  '/institution/:institutionId/fees',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.listInstitutionFees.bind(financeController)
);

financeRouter.post(
  '/institution/:institutionId/fees',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.createInstitutionFee.bind(financeController)
);

financeRouter.patch(
  '/institution/:institutionId/fees/:id/status',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.updateInstitutionFeeStatus.bind(financeController)
);

financeRouter.get(
  '/institution/:institutionId/config',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.getInstitutionConfig.bind(financeController)
);

financeRouter.post(
  '/institution/:institutionId/config',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'), requireSameInstitution(), financeController.saveInstitutionConfig.bind(financeController)
);
