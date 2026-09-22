import type { Request, Response } from 'express';
import { financeService } from '../services/finance.service';
import { BadRequestError, NotFoundError } from '../utils/http-error';

export class FinanceController {

  async getPlatformSummary(_req: Request, res: Response): Promise<void> {
    const summary = await financeService.getPlatformSummary();
    res.json(summary);
  }

  async listPlatformExpenses(_req: Request, res: Response): Promise<void> {
    const expenses = await financeService.listPlatformExpenses();
    res.json(expenses);
  }

  async createPlatformExpense(req: Request, res: Response): Promise<void> {
    const { category, title, description, amountArs, supplier, receiptUrl, status, date } = req.body;
    if (!title || !amountArs) {
      throw new BadRequestError('El título y monto del gasto son obligatorios.');
    }

    const created = await financeService.createPlatformExpense({
      category: category || 'INFRAESTRUCTURA',
      title,
      description,
      amountArs: Number(amountArs),
      supplier,
      receiptUrl,
      status: status || 'PAGADO',
      date,
    });
    res.status(201).json(created);
  }

  async deletePlatformExpense(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const deleted = await financeService.deletePlatformExpense(id);
    if (!deleted) throw new NotFoundError('Gasto no encontrado');
    res.json({ success: true, message: 'Gasto eliminado' });
  }

  async listTransactions(_req: Request, res: Response): Promise<void> {
    const transactions = await financeService.listTransactions();
    res.json(transactions);
  }

  async createSubscriptionCheckout(req: Request, res: Response): Promise<void> {
    const { institutionId, subscriptionId, planName, amountArs, payerEmail, payerName } = req.body;
    if (!planName || !amountArs || !payerEmail) {
      throw new BadRequestError('planName, amountArs y payerEmail son obligatorios.');
    }

    const result = await financeService.createSubscriptionCheckout({
      institutionId,
      subscriptionId,
      planName,
      amountArs: Number(amountArs),
      payerEmail,
      payerName,
    });
    res.status(201).json(result);
  }

  async getFinanceConfig(_req: Request, res: Response): Promise<void> {
    const config = await financeService.getFinanceConfig(null);
    res.json(config || {
      id: 'cfg_platform_global',
      institutionId: null,
      mpAccessToken: '',
      mpPublicKey: '',
      mpWebhookSecret: '',
      mpIsSandbox: true,
      autoInvoicing: false,
    });
  }

  async saveFinanceConfig(req: Request, res: Response): Promise<void> {
    const { mpAccessToken, mpPublicKey, mpWebhookSecret, mpIsSandbox, autoInvoicing } = req.body;
    const saved = await financeService.saveFinanceConfig({
      institutionId: null,
      mpAccessToken: mpAccessToken || '',
      mpPublicKey: mpPublicKey || '',
      mpWebhookSecret,
      mpIsSandbox,
      autoInvoicing,
    });
    res.json(saved);
  }

  async testMercadoPago(req: Request, res: Response): Promise<void> {
    const { accessToken } = req.body;
    if (!accessToken) {
      throw new BadRequestError('Debes proporcionar un Access Token para probar la conexión.');
    }
    const result = await financeService.testMercadoPagoConnection(accessToken);
    res.json(result);
  }

  async getInstitutionSummary(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const summary = await financeService.getInstitutionSummary(institutionId);
    res.json(summary);
  }

  async listInstitutionExpenses(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const expenses = await financeService.listInstitutionExpenses(institutionId);
    res.json(expenses);
  }

  async createInstitutionExpense(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const { category, title, description, amountArs, supplier, invoiceNumber, status, date } = req.body;
    if (!title || !amountArs) {
      throw new BadRequestError('El título y monto son requeridos.');
    }

    const created = await financeService.createInstitutionExpense(institutionId, {
      category: category || 'MANTENIMIENTO',
      title,
      description,
      amountArs: Number(amountArs),
      supplier,
      invoiceNumber,
      status: status || 'PAGADO',
      date,
    });
    res.status(201).json(created);
  }

  async deleteInstitutionExpense(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const id = String(req.params.id);
    const deleted = await financeService.deleteInstitutionExpense(institutionId, id);
    if (!deleted) throw new NotFoundError('Gasto institucional no encontrado');
    res.json({ success: true, message: 'Gasto eliminado' });
  }

  async listInstitutionFees(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const fees = await financeService.listInstitutionFees(institutionId);
    res.json(fees);
  }

  async createInstitutionFee(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const { courseId, studentId, title, period, amountArs, dueDate, tutorEmail, tutorName } = req.body;
    if (!title || !amountArs || !period || !dueDate) {
      throw new BadRequestError('Título, período, monto y fecha de vencimiento son requeridos.');
    }

    const created = await financeService.createInstitutionFeeWithCheckout(institutionId, {
      courseId,
      studentId,
      title,
      period,
      amountArs: Number(amountArs),
      dueDate,
      tutorEmail,
      tutorName,
    });
    res.status(201).json(created);
  }

  async updateInstitutionFeeStatus(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const id = String(req.params.id);
    const { status } = req.body;
    if (!status) throw new BadRequestError('El estado es requerido.');

    const updated = await financeService.updateInstitutionFeeStatus(institutionId, id, status);
    if (!updated) throw new NotFoundError('Cuota no encontrada');
    res.json(updated);
  }

  async getInstitutionConfig(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const config = await financeService.getFinanceConfig(institutionId);
    res.json(config || {
      id: `cfg_${institutionId}`,
      institutionId,
      mpAccessToken: '',
      mpPublicKey: '',
      mpWebhookSecret: '',
      mpIsSandbox: true,
      autoInvoicing: false,
    });
  }

  async saveInstitutionConfig(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.params.institutionId);
    const { mpAccessToken, mpPublicKey, mpWebhookSecret, mpIsSandbox, autoInvoicing } = req.body;

    const saved = await financeService.saveFinanceConfig({
      institutionId,
      mpAccessToken: mpAccessToken || '',
      mpPublicKey: mpPublicKey || '',
      mpWebhookSecret,
      mpIsSandbox,
      autoInvoicing,
    });
    res.json(saved);
  }

  async handleMercadoPagoWebhook(req: Request, res: Response): Promise<void> {
    const { type, data } = req.body;
    console.log('[MercadoPago Webhook] Notificación recibida:', { type, dataId: data?.id });
    res.status(200).json({ received: true });
  }
}

export const financeController = new FinanceController();
