import { env } from '../config/env';
import { financeRepository } from '../repositories/finance.repository';
import { getMpPayment, mercadoPagoService, verifyMpSignature } from './mercadopago.service';
import { subscriptionService } from './subscription.service';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/http-error';

/**
 * Referencia que viaja en cada pago de Mercado Pago (external_reference) y que vuelve en el aviso:
 * «tx:<id>» para una transacción de la plataforma (suscripción o pago de prueba) y «fee:<institución>:<id>» para una
 * cuota escolar. Así el aviso sabe qué registro actualizar.
 */
type PaymentRef = { kind: 'tx'; id: string } | { kind: 'fee'; institutionId: string; id: string };

function parseRef(ref: string): PaymentRef | null {
  const [kind, a, b] = ref.split(':');
  if (kind === 'tx' && a) return { kind: 'tx', id: a };
  if (kind === 'fee' && a && b) return { kind: 'fee', institutionId: a, id: b };
  return null;
}

/** Estado de Mercado Pago → estado de la transacción y de la cuota. */
function mapStatus(mpStatus: string): { tx: string; fee: string | null } {
  switch (mpStatus) {
    case 'approved':
      return { tx: 'APROBADO', fee: 'PAGADO' };
    case 'refunded':
    case 'charged_back':
      return { tx: 'REEMBOLSADO', fee: 'PENDIENTE' };
    case 'rejected':
    case 'cancelled':
      return { tx: 'RECHAZADO', fee: null };
    default:
      return { tx: 'PENDIENTE', fee: null };
  }
}

function notificationUrl(institutionId?: string | null): string {
  const url = `${env.apiPublicUrl}/api/finances/webhook/mercadopago`;
  return institutionId ? `${url}?inst=${encodeURIComponent(institutionId)}` : url;
}

function backUrls() {
  const base = env.frontendUrl.replace(/\/$/, '');
  return { success: `${base}/pago/exito`, failure: `${base}/pago/error`, pending: `${base}/pago/pendiente` };
}

export interface PaymentStatusView {
  reference: string;
  status: 'APROBADO' | 'PENDIENTE' | 'RECHAZADO' | 'REEMBOLSADO';
  description: string;
  amountArs: number;
  mpStatusDetail: string | null;
}

export class PaymentsService {
  /** Credenciales con las que se cobra: las del colegio si tiene, si no las de la plataforma. */
  private async tokenFor(institutionId?: string | null): Promise<{ token: string; sandbox: boolean; secret: string }> {
    const own = institutionId ? await financeRepository.getFinanceConfig(institutionId) : null;
    const global = await financeRepository.getFinanceConfig(null);
    const cfg = own?.mpAccessToken ? own : global;
    const token = cfg?.mpAccessToken?.trim() || process.env.MP_ACCESS_TOKEN?.trim() || '';
    if (!token) throw new ConflictError('Mercado Pago todavía no está configurado: cargá el Access Token en Finanzas → Mercado Pago.');
    return { token, sandbox: cfg?.mpIsSandbox ?? true, secret: cfg?.mpWebhookSecret?.trim() ?? '' };
  }

  /** Link de pago: en modo de prueba, el del entorno de pruebas de Mercado Pago. */
  private link(pref: { initPoint: string; sandboxInitPoint?: string }, sandbox: boolean): string {
    return sandbox && pref.sandboxInitPoint ? pref.sandboxInitPoint : pref.initPoint;
  }

  /** Cobro de la plataforma (suscripción o pago de prueba): primero la transacción, después el link con su referencia. */
  async platformCheckout(input: {
    institutionId?: string;
    subscriptionId?: string;
    type: 'SUBSCRIPCION_PLATAFORMA' | 'OTRO';
    title: string;
    amountArs: number;
    payerEmail: string;
    payerName?: string;
  }) {
    if (!Number.isFinite(input.amountArs) || input.amountArs < 1) throw new BadRequestError('El monto tiene que ser de al menos $ 1');
    const { token, sandbox } = await this.tokenFor(null);
    const tx = await financeRepository.createTransaction({
      institutionId: input.institutionId,
      subscriptionId: input.subscriptionId,
      type: input.type,
      description: input.title,
      amountArs: Math.round(input.amountArs),
      payerEmail: input.payerEmail,
      payerName: input.payerName,
      status: 'PENDIENTE',
      paymentMethod: 'MERCADOPAGO',
    });
    const reference = `tx:${tx.id}`;
    const pref = await mercadoPagoService.createPreference(
      {
        title: input.title,
        amountArs: input.amountArs,
        payerEmail: input.payerEmail,
        payerName: input.payerName,
        externalReference: reference,
        notificationUrl: notificationUrl(null),
        backUrls: backUrls(),
      },
      token,
    );
    const url = this.link(pref, sandbox);
    const transaction = await financeRepository.setTransactionPreference(tx.id, pref.id, url, reference);
    return { transaction, preferenceUrl: url, sandbox };
  }

  /** Cuota escolar con su link de pago. */
  async feeCheckout(
    institutionId: string,
    data: { courseId?: string; studentId?: string; title: string; period: string; amountArs: number; dueDate: string; tutorEmail?: string; tutorName?: string },
  ) {
    const { token, sandbox } = await this.tokenFor(institutionId);
    const fee = await financeRepository.createInstitutionFee(institutionId, data);
    const pref = await mercadoPagoService.createPreference(
      {
        title: `${data.title} (${data.period})`,
        amountArs: data.amountArs,
        payerEmail: data.tutorEmail || 'tutor@escuela.edu.ar',
        payerName: data.tutorName || '',
        externalReference: `fee:${institutionId}:${fee.id}`,
        notificationUrl: notificationUrl(institutionId),
        backUrls: backUrls(),
      },
      token,
    );
    return financeRepository.setFeePreference(fee.id, pref.id, this.link(pref, sandbox));
  }

  /**
   * Aviso de Mercado Pago. Se verifica la firma (si hay clave secreta configurada) y el pago se consulta a la API de
   * Mercado Pago: el estado y el monto salen de ahí, no del aviso.
   */
  async handleWebhook(input: {
    query: Record<string, unknown>;
    body: Record<string, any>;
    signature?: string;
    requestId?: string;
  }): Promise<{ handled: boolean; reason?: string }> {
    const type = String(input.body?.type ?? input.query.type ?? input.query.topic ?? '');
    const paymentId = String(input.body?.data?.id ?? input.query['data.id'] ?? input.query.id ?? '');
    if (type !== 'payment' || !paymentId) return { handled: false, reason: `aviso ignorado (${type || 'sin tipo'})` };
    const institutionId = input.query.inst ? String(input.query.inst) : null;
    const { token, secret } = await this.tokenFor(institutionId);
    if (secret && !verifyMpSignature({ signature: input.signature, requestId: input.requestId, dataId: paymentId, secret })) {
      throw new UnauthorizedError('Firma de Mercado Pago inválida');
    }
    const result = await this.applyPayment(paymentId, token);
    return { handled: Boolean(result), reason: result ? undefined : 'pago no encontrado o sin referencia de Habitar' };
  }

  /**
   * Al volver de Mercado Pago, la página de resultado pide sincronizar el pago (sirve aunque el aviso no llegue,
   * por ejemplo en pruebas locales). También consulta a Mercado Pago: el navegador no puede marcar nada como pagado.
   */
  async syncFromReturn(paymentId: string, reference: string): Promise<PaymentStatusView | null> {
    const ref = parseRef(reference);
    if (!ref) throw new BadRequestError('Referencia de pago inválida');
    const { token } = await this.tokenFor(ref.kind === 'fee' ? ref.institutionId : null);
    const applied = paymentId ? await this.applyPayment(paymentId, token, reference) : null;
    return applied ?? this.statusOf(ref, reference);
  }

  private async applyPayment(paymentId: string, token: string, expectedRef?: string): Promise<PaymentStatusView | null> {
    const payment = await getMpPayment(paymentId, token);
    if (!payment) return null;
    if (expectedRef && payment.externalReference !== expectedRef) throw new BadRequestError('El pago no corresponde a esta referencia');
    const ref = parseRef(payment.externalReference);
    if (!ref) return null;
    const mapped = mapStatus(payment.status);

    if (ref.kind === 'tx') {
      const tx = await financeRepository.findTransaction(ref.id);
      if (!tx) return null;
      // Un pago aprobado por otro monto no aprueba la transacción: queda pendiente para revisarla.
      const amountOk = Math.round(payment.amount) === Math.round(Number(tx.amountArs));
      const status = mapped.tx === 'APROBADO' && !amountOk ? 'PENDIENTE' : mapped.tx;
      if (tx.status !== status || tx.mpPaymentId !== payment.id) {
        await financeRepository.updateTransactionStatus(tx.id, status, payment.id);
        if (status === 'APROBADO' && tx.status !== 'APROBADO' && tx.subscriptionId) {
          await subscriptionService.renew(tx.subscriptionId).catch((err: Error) => console.error('[payments] No se pudo renovar la suscripción:', err.message));
        }
      }
      if (!amountOk) console.warn(`[payments] El pago ${payment.id} es de ${payment.amount} y la transacción ${tx.id} de ${tx.amountArs}`);
    } else {
      const fee = await financeRepository.findFee(ref.id);
      if (!fee || fee.institutionId !== ref.institutionId) return null;
      const amountOk = Math.round(payment.amount) === Math.round(Number(fee.amountArs));
      if (mapped.fee && amountOk && fee.status !== mapped.fee) {
        await financeRepository.updateInstitutionFeeStatus(ref.institutionId, fee.id, mapped.fee);
      }
    }
    return this.statusOf(ref, payment.externalReference, payment.statusDetail);
  }

  private async statusOf(ref: PaymentRef, reference: string, detail: string | null = null): Promise<PaymentStatusView | null> {
    if (ref.kind === 'tx') {
      const tx = await financeRepository.findTransaction(ref.id);
      if (!tx) return null;
      return { reference, status: tx.status as PaymentStatusView['status'], description: tx.description, amountArs: Number(tx.amountArs), mpStatusDetail: detail };
    }
    const fee = await financeRepository.findFee(ref.id);
    if (!fee) return null;
    return {
      reference,
      status: fee.status === 'PAGADO' ? 'APROBADO' : 'PENDIENTE',
      description: `${fee.title} (${fee.period})`,
      amountArs: Number(fee.amountArs),
      mpStatusDetail: detail,
    };
  }
}

export const paymentsService = new PaymentsService();
