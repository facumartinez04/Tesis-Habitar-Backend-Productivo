import { financeRepository } from '../dal/finance.repository';
import { mercadoPagoService } from '../services/mercadopago.service';
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

  async updateInstitutionFeeStatus(institutionId: string, id: string, status: string): Promise<InstitutionFee | null> {
    return financeRepository.updateInstitutionFeeStatus(institutionId, id, status);
  }
}

export const financeService = new FinanceService();
