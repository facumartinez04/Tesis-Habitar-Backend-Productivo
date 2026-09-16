import { pool } from '../config/db';
import type {
  FinanceConfig,
  InstitutionExpense,
  InstitutionFee,
  InstitutionFinanceSummary,
  PaymentTransaction,
  PlatformExpense,
  PlatformFinanceSummary,
} from '../domain/finance';

export class FinanceRepository {

  async listPlatformExpenses(): Promise<PlatformExpense[]> {
    const res = await pool.query(
      `SELECT * FROM "PlatformExpense" ORDER BY "date" DESC, "createdAt" DESC`
    );
    return res.rows;
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
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dateVal = data.date ? new Date(data.date) : new Date();

    const res = await pool.query(
      `INSERT INTO "PlatformExpense" ("id", "category", "title", "description", "amountArs", "supplier", "receiptUrl", "status", "date")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        data.category,
        data.title,
        data.description || '',
        data.amountArs,
        data.supplier || '',
        data.receiptUrl || '',
        data.status || 'PAGADO',
        dateVal,
      ]
    );
    return res.rows[0];
  }

  async deletePlatformExpense(id: string): Promise<boolean> {
    const res = await pool.query(`DELETE FROM "PlatformExpense" WHERE "id" = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async listTransactions(limit = 100): Promise<PaymentTransaction[]> {
    const res = await pool.query(
      `SELECT * FROM "PaymentTransaction" ORDER BY "createdAt" DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  async createTransaction(data: {
    institutionId?: string;
    subscriptionId?: string;
    type: string;
    description: string;
    amountArs: number;
    payerEmail?: string;
    payerName?: string;
    paymentMethod?: string;
    status?: string;
    externalReference?: string;
    mpPreferenceId?: string;
    mpInitPoint?: string;
  }): Promise<PaymentTransaction> {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const status = data.status || 'PENDIENTE';
    const paidAt = status === 'APROBADO' ? new Date() : null;

    const res = await pool.query(
      `INSERT INTO "PaymentTransaction"
       ("id", "institutionId", "subscriptionId", "type", "description", "amountArs", "payerEmail", "payerName", "paymentMethod", "status", "externalReference", "mpPreferenceId", "mpInitPoint", "paidAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        id,
        data.institutionId || null,
        data.subscriptionId || null,
        data.type,
        data.description,
        data.amountArs,
        data.payerEmail || '',
        data.payerName || '',
        data.paymentMethod || 'MERCADOPAGO',
        status,
        data.externalReference || id,
        data.mpPreferenceId || '',
        data.mpInitPoint || '',
        paidAt,
      ]
    );
    return res.rows[0];
  }

  async updateTransactionStatus(id: string, status: string, mpPaymentId?: string): Promise<PaymentTransaction | null> {
    const paidAt = status === 'APROBADO' ? new Date() : null;
    const res = await pool.query(
      `UPDATE "PaymentTransaction"
       SET "status" = $1, "mpPaymentId" = COALESCE($2, "mpPaymentId"), "paidAt" = COALESCE($3, "paidAt"), "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $4
       RETURNING *`,
      [status, mpPaymentId || null, paidAt, id]
    );
    return res.rows[0] || null;
  }

  async getPlatformSummary(): Promise<PlatformFinanceSummary> {
    const revRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN "status" = 'APROBADO' THEN "amountArs" ELSE 0 END), 0) as total_approved,
         COALESCE(SUM(CASE WHEN "status" = 'PENDIENTE' THEN "amountArs" ELSE 0 END), 0) as total_pending
       FROM "PaymentTransaction"`
    );

    const expRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN "status" = 'PAGADO' THEN "amountArs" ELSE 0 END), 0) as total_paid,
         COALESCE(SUM(CASE WHEN "status" = 'PENDIENTE' THEN "amountArs" ELSE 0 END), 0) as total_pending
       FROM "PlatformExpense"`
    );

    const subRes = await pool.query(
      `SELECT COALESCE(SUM("monthlyPriceArs"), 0) as mrr FROM "Subscription"`
    );

    const totalRevenue = parseInt(revRes.rows[0]?.total_approved || '0', 10);
    const totalExpenses = parseInt(expRes.rows[0]?.total_paid || '0', 10);
    const mrr = parseInt(subRes.rows[0]?.mrr || '0', 10);

    return {
      mrrArs: mrr,
      arrArs: mrr * 12,
      totalRevenueArs: totalRevenue,
      totalExpensesArs: totalExpenses,
      netProfitArs: totalRevenue - totalExpenses,
      pendingReceivablesArs: parseInt(revRes.rows[0]?.total_pending || '0', 10),
      pendingPayablesArs: parseInt(expRes.rows[0]?.total_pending || '0', 10),
    };
  }

  async listInstitutionExpenses(institutionId: string): Promise<InstitutionExpense[]> {
    const res = await pool.query(
      `SELECT * FROM "InstitutionExpense" WHERE "institutionId" = $1 ORDER BY "date" DESC`,
      [institutionId]
    );
    return res.rows;
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
    const id = `insexp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dateVal = data.date ? new Date(data.date) : new Date();

    const res = await pool.query(
      `INSERT INTO "InstitutionExpense"
       ("id", "institutionId", "category", "title", "description", "amountArs", "supplier", "invoiceNumber", "status", "date")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        institutionId,
        data.category,
        data.title,
        data.description || '',
        data.amountArs,
        data.supplier || '',
        data.invoiceNumber || '',
        data.status || 'PAGADO',
        dateVal,
      ]
    );
    return res.rows[0];
  }

  async deleteInstitutionExpense(institutionId: string, id: string): Promise<boolean> {
    const res = await pool.query(
      `DELETE FROM "InstitutionExpense" WHERE "id" = $1 AND "institutionId" = $2`,
      [id, institutionId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listInstitutionFees(institutionId: string): Promise<InstitutionFee[]> {
    const res = await pool.query(
      `SELECT * FROM "InstitutionFee" WHERE "institutionId" = $1 ORDER BY "dueDate" ASC, "createdAt" DESC`,
      [institutionId]
    );
    return res.rows;
  }

  async createInstitutionFee(institutionId: string, data: {
    courseId?: string;
    studentId?: string;
    title: string;
    period: string;
    amountArs: number;
    dueDate: string;
    tutorEmail?: string;
    tutorName?: string;
    mpPreferenceId?: string;
    mpInitPoint?: string;
  }): Promise<InstitutionFee> {
    const id = `fee_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dueVal = new Date(data.dueDate);

    const res = await pool.query(
      `INSERT INTO "InstitutionFee"
       ("id", "institutionId", "courseId", "studentId", "title", "period", "amountArs", "dueDate", "tutorEmail", "tutorName", "mpPreferenceId", "mpInitPoint")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        institutionId,
        data.courseId || null,
        data.studentId || null,
        data.title,
        data.period,
        data.amountArs,
        dueVal,
        data.tutorEmail || '',
        data.tutorName || '',
        data.mpPreferenceId || '',
        data.mpInitPoint || '',
      ]
    );
    return res.rows[0];
  }

  async updateInstitutionFeeStatus(institutionId: string, id: string, status: string): Promise<InstitutionFee | null> {
    const paidAt = status === 'PAGADO' ? new Date() : null;
    const res = await pool.query(
      `UPDATE "InstitutionFee"
       SET "status" = $1, "paidAt" = COALESCE($2, "paidAt"), "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $3 AND "institutionId" = $4
       RETURNING *`,
      [status, paidAt, id, institutionId]
    );
    return res.rows[0] || null;
  }

  async getInstitutionSummary(institutionId: string): Promise<InstitutionFinanceSummary> {
    const feeRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN "status" = 'PAGADO' THEN "amountArs" ELSE 0 END), 0) as total_collected,
         COALESCE(SUM(CASE WHEN "status" = 'PENDIENTE' THEN "amountArs" ELSE 0 END), 0) as total_pending,
         COUNT(*) as total_count,
         COUNT(CASE WHEN "status" = 'PAGADO' THEN 1 END) as paid_count,
         COUNT(CASE WHEN "status" = 'VENCIDO' THEN 1 END) as overdue_count
       FROM "InstitutionFee"
       WHERE "institutionId" = $1`,
      [institutionId]
    );

    const expRes = await pool.query(
      `SELECT COALESCE(SUM("amountArs"), 0) as total_expenses
       FROM "InstitutionExpense"
       WHERE "institutionId" = $1 AND "status" = 'PAGADO'`,
      [institutionId]
    );

    const totalCollected = parseInt(feeRes.rows[0]?.total_collected || '0', 10);
    const totalPending = parseInt(feeRes.rows[0]?.total_pending || '0', 10);
    const totalExpenses = parseInt(expRes.rows[0]?.total_expenses || '0', 10);

    return {
      totalCollectedArs: totalCollected,
      totalPendingArs: totalPending,
      totalExpensesArs: totalExpenses,
      netBalanceArs: totalCollected - totalExpenses,
      feesCount: parseInt(feeRes.rows[0]?.total_count || '0', 10),
      paidFeesCount: parseInt(feeRes.rows[0]?.paid_count || '0', 10),
      overdueFeesCount: parseInt(feeRes.rows[0]?.overdue_count || '0', 10),
    };
  }

  async getFinanceConfig(institutionId?: string | null): Promise<FinanceConfig | null> {
    const res = institutionId
      ? await pool.query(`SELECT * FROM "FinanceConfig" WHERE "institutionId" = $1`, [institutionId])
      : await pool.query(`SELECT * FROM "FinanceConfig" WHERE "institutionId" IS NULL`);

    return res.rows[0] || null;
  }

  async saveFinanceConfig(data: {
    institutionId?: string | null;
    mpAccessToken: string;
    mpPublicKey: string;
    mpWebhookSecret?: string;
    mpIsSandbox?: boolean;
    autoInvoicing?: boolean;
  }): Promise<FinanceConfig> {
    const id = data.institutionId ? `cfg_${data.institutionId}` : 'cfg_platform_global';
    const isSandbox = data.mpIsSandbox ?? true;
    const autoInvoicing = data.autoInvoicing ?? false;

    const res = await pool.query(
      `INSERT INTO "FinanceConfig" ("id", "institutionId", "mpAccessToken", "mpPublicKey", "mpWebhookSecret", "mpIsSandbox", "autoInvoicing", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET
         "mpAccessToken" = EXCLUDED."mpAccessToken",
         "mpPublicKey" = EXCLUDED."mpPublicKey",
         "mpWebhookSecret" = EXCLUDED."mpWebhookSecret",
         "mpIsSandbox" = EXCLUDED."mpIsSandbox",
         "autoInvoicing" = EXCLUDED."autoInvoicing",
         "updatedAt" = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        id,
        data.institutionId || null,
        data.mpAccessToken,
        data.mpPublicKey,
        data.mpWebhookSecret || '',
        isSandbox,
        autoInvoicing,
      ]
    );

    return res.rows[0];
  }
}

export const financeRepository = new FinanceRepository();
