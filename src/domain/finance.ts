export type PlatformExpenseCategory =
  | 'INFRAESTRUCTURA'
  | 'IA_SERVICIOS'
  | 'SERVICIOS_CORREO'
  | 'MARKETING'
  | 'LEGAL_CONTABLE'
  | 'SALARIOS'
  | 'OTROS';

export type PaymentStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REEMBOLSADO';
export type PaymentMethod = 'MERCADOPAGO' | 'TRANSFERENCIA' | 'EFECTIVO' | 'DEBITO';
export type PaymentType = 'SUBSCRIPCION_PLATAFORMA' | 'CUOTA_INSTITUCIONAL' | 'MATRICULA' | 'OTRO';

export interface PlatformExpense {
  id: string;
  category: PlatformExpenseCategory;
  title: string;
  description: string;
  amountArs: number;
  currency: string;
  date: string;
  status: 'PAGADO' | 'PENDIENTE' | 'PROGRAMADO';
  supplier: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  institutionId?: string;
  subscriptionId?: string;
  type: PaymentType;
  description: string;
  amountArs: number;
  payerEmail: string;
  payerName: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  externalReference?: string;
  mpPaymentId?: string;
  mpPreferenceId?: string;
  mpInitPoint?: string;
  metadata?: Record<string, unknown>;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionExpense {
  id: string;
  institutionId: string;
  category: string;
  title: string;
  description: string;
  amountArs: number;
  date: string;
  status: 'PAGADO' | 'PENDIENTE';
  supplier: string;
  invoiceNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionFee {
  id: string;
  institutionId: string;
  courseId?: string;
  studentId?: string;
  title: string;
  period: string;
  amountArs: number;
  dueDate: string;
  status: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
  tutorEmail: string;
  tutorName: string;
  mpPreferenceId?: string;
  mpInitPoint?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceConfig {
  id: string;
  institutionId?: string | null;
  mpAccessToken: string;
  mpPublicKey: string;
  mpWebhookSecret: string;
  mpIsSandbox: boolean;
  autoInvoicing: boolean;
  updatedAt: string;
}

export interface PlatformFinanceSummary {
  mrrArs: number;
  arrArs: number;
  totalRevenueArs: number;
  totalExpensesArs: number;
  netProfitArs: number;
  pendingReceivablesArs: number;
  pendingPayablesArs: number;
}

export interface InstitutionFinanceSummary {
  totalCollectedArs: number;
  totalPendingArs: number;
  totalExpensesArs: number;
  netBalanceArs: number;
  feesCount: number;
  paidFeesCount: number;
  overdueFeesCount: number;
}
