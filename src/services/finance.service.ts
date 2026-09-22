import { financeRepository } from '../repositories/finance.repository';
import { mercadoPagoService } from './mercadopago.service';
import type {
  FinanceConfig,
  InstitutionExpense,
  InstitutionFee,
  InstitutionFinanceSummary,
  PaymentTransaction,
  PlatformExpense,
  PlatformFinanceSummary,
} from '../domain/finance';

export class FinanceService {

  async getPlatformSummary(): Promise<PlatformFinanceSummary> {
    return financeRepository.getPlatformSummary();
  }

  async listPlatformExpenses(): Promise<PlatformExpense[]> {
    return financeRepository.listPlatformExpenses();
  }

  async createPlatformExpense(data: {
    category: string;
    title: string;
    description?: string;
    amountArs: number;
    supplier?: string;
    receiptUrl?: string;
    status?: string;
    date?: string;
  }): Promise<PlatformExpense> {
    return financeRepository.createPlatformExpense(data);
  }

  async deletePlatformExpense(id: string): Promise<boolean> {
    return financeRepository.deletePlatformExpense(id);
  }

  async listTransactions(): Promise<PaymentTransaction[]> {
    return financeRepository.listTransactions();
  }

  async createSubscriptionCheckout(data: {
    institutionId?: string;
    subscriptionId?: string;
    planName: string;
    amountArs: number;
    payerEmail: string;
    payerName?: string;
  }): Promise<{ transaction: PaymentTransaction; preferenceUrl: string }> {
    const config = await financeRepository.getFinanceConfig(null);

    const preference = await mercadoPagoService.createPreference(
      {
        title: `Suscripción Habitar — ${data.planName}`,
        amountArs: data.amountArs,
        payerEmail: data.payerEmail,
        payerName: data.payerName,
        externalReference: `sub_${Date.now()}`,
      },
      config?.mpAccessToken
    );

    const transaction = await financeRepository.createTransaction({
      institutionId: data.institutionId,
      subscriptionId: data.subscriptionId,
      type: 'SUBSCRIPCION_PLATAFORMA',
      description: `Suscripción Habitar: ${data.planName}`,
      amountArs: data.amountArs,
      payerEmail: data.payerEmail,
      payerName: data.payerName,
      status: 'PENDIENTE',
      paymentMethod: 'MERCADOPAGO',
      mpPreferenceId: preference.id,
      mpInitPoint: preference.initPoint,
    });

    return {
      transaction,
      preferenceUrl: preference.initPoint,
    };
  }

  async getFinanceConfig(institutionId?: string | null): Promise<FinanceConfig | null> {
    return financeRepository.getFinanceConfig(institutionId);
  }

  async saveFinanceConfig(data: {
    institutionId?: string | null;
    mpAccessToken: string;
    mpPublicKey: string;
    mpWebhookSecret?: string;
    mpIsSandbox?: boolean;
    autoInvoicing?: boolean;
  }): Promise<FinanceConfig> {
    return financeRepository.saveFinanceConfig(data);
  }

  async testMercadoPagoConnection(accessToken: string): Promise<{ success: boolean; message: string; user?: any }> {
    return mercadoPagoService.testConnection(accessToken);
  }

  async getInstitutionSummary(institutionId: string): Promise<InstitutionFinanceSummary> {
    return financeRepository.getInstitutionSummary(institutionId);
  }

  async listInstitutionExpenses(institutionId: string): Promise<InstitutionExpense[]> {
    return financeRepository.listInstitutionExpenses(institutionId);
  }

  async createInstitutionExpense(institutionId: string, data: {
    category: string;
    title: string;
    description?: string;
    amountArs: number;
    supplier?: string;
    invoiceNumber?: string;
    status?: string;
    date?: string;
  }): Promise<InstitutionExpense> {
    return financeRepository.createInstitutionExpense(institutionId, data);
  }

  async deleteInstitutionExpense(institutionId: string, id: string): Promise<boolean> {
    return financeRepository.deleteInstitutionExpense(institutionId, id);
  }

  async listInstitutionFees(institutionId: string): Promise<InstitutionFee[]> {
    return financeRepository.listInstitutionFees(institutionId);
  }

  async createInstitutionFeeWithCheckout(institutionId: string, data: {
    courseId?: string;
    studentId?: string;
    title: string;
    period: string;
    amountArs: number;
    dueDate: string;
    tutorEmail?: string;
    tutorName?: string;
  }): Promise<InstitutionFee> {

    const schoolConfig = await financeRepository.getFinanceConfig(institutionId);
    const globalConfig = await financeRepository.getFinanceConfig(null);
    const activeToken = schoolConfig?.mpAccessToken || globalConfig?.mpAccessToken;

    const preference = await mercadoPagoService.createPreference(
      {
        title: `${data.title} (${data.period})`,
        amountArs: data.amountArs,
        payerEmail: data.tutorEmail || 'tutor@escuela.edu.ar',
        payerName: data.tutorName || '',
        externalReference: `fee_${institutionId}_${Date.now()}`,
      },
      activeToken
    );

    return financeRepository.createInstitutionFee(institutionId, {
      ...data,
      mpPreferenceId: preference.id,
      mpInitPoint: preference.initPoint,
    });
  }

  async updateInstitutionFeeStatus(institutionId: string, id: string, status: string): Promise<InstitutionFee | null> {
    return financeRepository.updateInstitutionFeeStatus(institutionId, id, status);
  }
}

export const financeService = new FinanceService();
