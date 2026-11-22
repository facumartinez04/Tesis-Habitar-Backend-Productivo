/**
 * Límite de correos por destinatario y por tipo, para que un error de la interfaz,
 * un doble clic o un uso indebido no inunden la casilla de una persona ni consuman
 * la cuota de envío de Resend.
 */
export type EmailKind = 'INVITACION' | 'CAMBIO_ROL' | 'ALERTA';

export interface EmailLimitPolicy {
  max: number;
  windowMs: number;
}

const HORA = 60 * 60 * 1000;

export const EMAIL_LIMITS: Record<EmailKind, EmailLimitPolicy> = {
  INVITACION: { max: 3, windowMs: 24 * HORA },
  CAMBIO_ROL: { max: 5, windowMs: HORA },
  ALERTA: { max: 10, windowMs: 24 * HORA },
};

export class EmailLimiter {
  private readonly sent = new Map<string, number[]>();

  constructor(private readonly limits: Record<EmailKind, EmailLimitPolicy> = EMAIL_LIMITS) {}

  /** Registra el envío y devuelve true si todavía está dentro del límite. */
  allow(kind: EmailKind, to: string, now = Date.now()): boolean {
    const { max, windowMs } = this.limits[kind];
    const key = `${kind}:${to.trim().toLowerCase()}`;
    const recent = (this.sent.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      this.sent.set(key, recent);
      return false;
    }
    recent.push(now);
    this.sent.set(key, recent);
    return true;
  }
}

export const emailLimiter = new EmailLimiter();
