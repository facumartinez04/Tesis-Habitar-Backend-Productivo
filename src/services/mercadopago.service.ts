import { createHmac, timingSafeEqual } from 'crypto';

/** API de Mercado Pago (se puede apuntar a un simulador en las pruebas con MP_API_URL). */
const MP_API = (process.env.MP_API_URL ?? 'https://api.mercadopago.com').replace(/\/$/, '');

export interface CreatePreferenceInput {
  title: string;
  amountArs: number;
  payerEmail: string;
  payerName?: string;
  externalReference: string;
  notificationUrl?: string;
  backUrls?: {
    success: string;
    failure: string;
    pending: string;
  };
}

export interface PreferenceResult {
  id: string;
  initPoint: string;
  sandboxInitPoint?: string;
}

/** Lo que importa de un pago según Mercado Pago (la fuente de verdad: nunca se confía en lo que llega en el aviso). */
export interface MpPayment {
  id: string;
  status: string;
  statusDetail: string;
  externalReference: string;
  amount: number;
  currency: string;
  payerEmail: string;
  dateApproved: string | null;
}

/**
 * Firma de los avisos de Mercado Pago: el encabezado x-signature trae «ts=…,v1=…», donde v1 es el HMAC-SHA256 (con
 * la clave secreta del webhook) de «id:<data.id>;request-id:<x-request-id>;ts:<ts>;».
 */
export function verifyMpSignature(input: { signature?: string; requestId?: string; dataId: string; secret: string }): boolean {
  if (!input.signature) return false;
  const parts = Object.fromEntries(
    input.signature.split(',').map((kv) => {
      const [k, ...v] = kv.split('=');
      return [k.trim(), v.join('=').trim()];
    }),
  );
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${input.dataId.toLowerCase()};${input.requestId ? `request-id:${input.requestId};` : ''}ts:${parts.ts};`;
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex');
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

export class MercadoPagoService {

  async testConnection(accessToken: string): Promise<{ success: boolean; message: string; user?: any }> {
    if (!accessToken || accessToken.trim() === '') {
      return { success: false, message: 'El Access Token no puede estar vacío.' };
    }

    try {
      const response = await fetch(`${MP_API}/users/me`, {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        },
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        return {
          success: false,
          message: errorData.message || `Error de autenticación en Mercado Pago (HTTP ${response.status})`,
        };
      }

      const userData = (await response.json()) as any;
      return {
        success: true,
        message: `Conexión exitosa. Cuenta: ${userData.nickname || userData.email || userData.id}`,
        user: {
          id: userData.id,
          nickname: userData.nickname,
          email: userData.email,
          countryId: userData.country_id,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Error de red al conectar con Mercado Pago: ${err.message || err}`,
      };
    }
  }

  async createPreference(input: CreatePreferenceInput, accessToken?: string): Promise<PreferenceResult> {
    const token = accessToken?.trim() || process.env.MP_ACCESS_TOKEN?.trim();

    if (!token) {
      throw new Error(
        'No se ha configurado el Access Token de Mercado Pago. Por favor configurá las credenciales en la pestaña de Mercado Pago.'
      );
    }

    const body = {
      items: [
        {
          title: input.title,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: Math.round(input.amountArs),
        },
      ],
      payer: {
        email: input.payerEmail,
        name: input.payerName || '',
      },
      external_reference: input.externalReference,
      back_urls: input.backUrls || {
        success: `${process.env.FRONTEND_URL || 'http://localhost:4321'}/pago/exito`,
        failure: `${process.env.FRONTEND_URL || 'http://localhost:4321'}/pago/error`,
        pending: `${process.env.FRONTEND_URL || 'http://localhost:4321'}/pago/pendiente`,
      },
      auto_return: 'approved',
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
    };

    const response = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as any;
      const errorDetail =
        errData.message ||
        errData.cause?.[0]?.description ||
        `Error al crear preferencia en Mercado Pago (HTTP ${response.status})`;
      throw new Error(errorDetail);
    }

    const data = (await response.json()) as any;
    return {
      id: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    };
  }
}

export async function getMpPayment(paymentId: string, accessToken: string): Promise<MpPayment | null> {
  const response = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status} al consultar el pago`);
  const p = (await response.json()) as Record<string, any>;
  return {
    id: String(p.id),
    status: String(p.status ?? ''),
    statusDetail: String(p.status_detail ?? ''),
    externalReference: String(p.external_reference ?? ''),
    amount: Number(p.transaction_amount ?? 0),
    currency: String(p.currency_id ?? ''),
    payerEmail: String(p.payer?.email ?? ''),
    dateApproved: p.date_approved ?? null,
  };
}

export const mercadoPagoService = new MercadoPagoService();
