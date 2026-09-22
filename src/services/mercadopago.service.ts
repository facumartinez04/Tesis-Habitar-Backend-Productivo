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

export class MercadoPagoService {

  async testConnection(accessToken: string): Promise<{ success: boolean; message: string; user?: any }> {
    if (!accessToken || accessToken.trim() === '') {
      return { success: false, message: 'El Access Token no puede estar vacío.' };
    }

    try {
      const response = await fetch('https://api.mercadopago.com/users/me', {
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
      notification_url: input.notificationUrl,
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
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

export const mercadoPagoService = new MercadoPagoService();
