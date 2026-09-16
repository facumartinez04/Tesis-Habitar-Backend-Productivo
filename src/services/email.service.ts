import { Resend } from 'resend';
import { env } from '../config/env';
import type { Role, OAuthProviderId } from '../domain/enums';

export interface SendInvitationEmailInput {
  to: string;
  name: string;
  role: Role;
  institutionName: string;
  provider?: OAuthProviderId;
}

export interface SendRoleUpdatedEmailInput {
  to: string;
  name: string;
  newRole: Role;
  institutionName: string;
}

export interface EmailSendResult {
  success: boolean;
  simulated?: boolean;
  messageId?: string;
  error?: string;
}

const roleLabels: Record<Role, string> = {
  DOCENTE: 'Docente',
  COORDINADOR: 'Coordinador/a Institucional',
  DIRECTOR: 'Director/a',
  ADMIN: 'Administrador/a',
};

export class EmailService {
  private resendClient: Resend | null = null;

  private getClient(): Resend | null {
    if (!this.resendClient && env.resend.apiKey) {
      this.resendClient = new Resend(env.resend.apiKey);
    }
    return this.resendClient;
  }

  async sendInvitationEmail(input: SendInvitationEmailInput): Promise<EmailSendResult> {
    const { to, name, role, institutionName, provider } = input;
    const client = this.getClient();
    const roleLabel = roleLabels[role] ?? role;
    const isTeacher = role === 'DOCENTE';

    const subject = isTeacher
      ? `Invitación a Habitar — Vinculación docente con ${institutionName}`
      : `Acceso concedido en Habitar (${roleLabel}) — ${institutionName}`;

    const loginUrl = `${env.frontendUrl}/login`;
    const providerHint = provider ? ` mediante tu cuenta de ${provider === 'GOOGLE' ? 'Google' : 'Microsoft'}` : '';

    const html = isTeacher
      ? this.buildTeacherInvitationTemplate({ name, to, institutionName, roleLabel, loginUrl, providerHint })
      : this.buildAdminInvitationTemplate({ name, to, institutionName, roleLabel, loginUrl, providerHint });

    if (!client) {
      console.info(
        `[EmailService] RESEND_API_KEY no configurada. Envío simulado:\n` +
          `  Para: ${to}\n` +
          `  Asunto: ${subject}\n` +
          `  Institución: ${institutionName}\n` +
          `  Rol: ${roleLabel}`,
      );
      return { success: true, simulated: true };
    }

    try {
      const response = await client.emails.send({
        from: env.resend.fromEmail,
        to: [to],
        subject,
        html,
      });

      if (response.error) {
        console.error('[EmailService] Error devuelto por Resend al enviar invitación:', response.error);
        return { success: false, error: response.error.message };
      }

      console.info(`[EmailService] Invitación enviada exitosamente a ${to} (ID: ${response.data?.id})`);
      return { success: true, messageId: response.data?.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[EmailService] Excepción al enviar invitación con Resend:', message);
      return { success: false, error: message };
    }
  }

  async sendRoleUpdatedEmail(input: SendRoleUpdatedEmailInput): Promise<EmailSendResult> {
    const { to, name, newRole, institutionName } = input;
    const client = this.getClient();
    const roleLabel = roleLabels[newRole] ?? newRole;
    const subject = `Actualización de rol en Habitar — ${institutionName}`;
    const loginUrl = `${env.frontendUrl}/login`;

    const html = this.buildRoleUpdatedTemplate({ name, to, institutionName, roleLabel, loginUrl });

    if (!client) {
      console.info(
        `[EmailService] RESEND_API_KEY no configurada. Actualización de rol simulada para ${to} (nuevo rol: ${roleLabel} en ${institutionName})`,
      );
      return { success: true, simulated: true };
    }

    try {
      const response = await client.emails.send({
        from: env.resend.fromEmail,
        to: [to],
        subject,
        html,
      });

      if (response.error) {
        console.error('[EmailService] Error de Resend al enviar actualización de rol:', response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true, messageId: response.data?.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[EmailService] Excepción de Resend al enviar actualización de rol:', message);
      return { success: false, error: message };
    }
  }

  private buildTeacherInvitationTemplate(data: {
    name: string;
    to: string;
    institutionName: string;
    roleLabel: string;
    loginUrl: string;
    providerHint: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a Habitar</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FBF9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FBF9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E0EFEA; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 110, 86, 0.06);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F6E56 0%, #15803D 100%); padding: 32px 32px 28px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Habitar</h1>
              <p style="margin: 6px 0 0; color: #D1FAE5; font-size: 14px; font-weight: 500;">Plataforma de Comprensión Lectora Escolar</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; background-color: #E0EFEA; color: #0F6E56; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px;">
                ${data.roleLabel}
              </div>

              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 700;">
                ¡Hola, ${data.name}!
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                Te confirmamos que tu casilla <strong>${data.to}</strong> ha sido vinculada a la institución educativa:
              </p>

              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
                <span style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Institución Vinculada</span>
                <span style="font-size: 18px; color: #0F6E56; font-weight: 800;">${data.institutionName}</span>
              </div>

              <p style="margin: 0 0 14px; font-size: 15px; color: #374151;">
                A partir de ahora tenés acceso a las herramientas pedagógicas para tus cursos:
              </p>

              <ul style="margin: 0 0 24px; padding-left: 20px; color: #4B5563; font-size: 14px; line-height: 1.8;">
                <li><strong>Aulas asignadas:</strong> Visualizá los cursos y divisiones donde ejercés tu labor docente.</li>
                <li><strong>Acceso seguro con QR:</strong> Mostrá el código en el proyector o pantalla para que los estudiantes ingresen inmediatamente sin contraseñas.</li>
                <li><strong>Actividades pedagógicas:</strong> Creá y asigná lecturas interactivas evaluando comprensión literal, inferencial y crítica.</li>
                <li><strong>Métricas de grupo:</strong> Analizá el progreso y diagnósticos de lectura colectivos protegiendo la privacidad de los menores.</li>
              </ul>

              <div style="text-align: center; margin: 32px 0 24px;">
                <a href="${data.loginUrl}" target="_blank" style="background-color: #0F6E56; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
                  Ingresar a Habitar
                </a>
              </div>

              <p style="margin: 0; font-size: 13px; color: #6B7280; text-align: center;">
                Iniciá sesión${data.providerHint} utilizando tu correo <strong>${data.to}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 32px; border-top: 1px solid #F3F4F6; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                Este correo fue enviado automáticamente por el sistema de gestión de Habitar para <strong>${data.institutionName}</strong>.
              </p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #9CA3AF;">
                Cumple con las directivas pedagógicas y normativas de protección de datos educativos.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildAdminInvitationTemplate(data: {
    name: string;
    to: string;
    institutionName: string;
    roleLabel: string;
    loginUrl: string;
    providerHint: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso Administrativo — Habitar</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FBF9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FBF9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E0EFEA; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 110, 86, 0.06);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #064E3B 0%, #0F6E56 100%); padding: 32px 32px 28px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Habitar</h1>
              <p style="margin: 6px 0 0; color: #D1FAE5; font-size: 14px; font-weight: 500;">Panel de Gestión y Coordinación Institucional</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; background-color: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px;">
                Permisos de ${data.roleLabel}
              </div>

              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 700;">
                Acceso Habilitado para ${data.name}
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                Se ha concedido acceso de <strong>${data.roleLabel}</strong> a tu cuenta de correo <strong>${data.to}</strong> en:
              </p>

              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
                <span style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Institución Asignada</span>
                <span style="font-size: 18px; color: #0F6E56; font-weight: 800;">${data.institutionName}</span>
              </div>

              <p style="margin: 0 0 14px; font-size: 15px; color: #374151;">
                Desde tu consola de gestión podrás administrar los aspectos clave del establecimiento:
              </p>

              <ul style="margin: 0 0 24px; padding-left: 20px; color: #4B5563; font-size: 14px; line-height: 1.8;">
                <li><strong>Gestión de cursos y aulas:</strong> Dar de alta divisiones y asignar a cada docente sus aulas correspondientes.</li>
                <li><strong>Administración de personal:</strong> Gestionar el equipo de docentes y miembros directivos de la institución.</li>
                <li><strong>Configuración pedagógica:</strong> Activar niveles educativos (Primaria / Secundaria) y ejes de comprensión (Literal, Inferencial, Crítico).</li>
                <li><strong>Métricas y cuotas de IA:</strong> Monitorear el consumo de créditos de inteligencia artificial para generación de actividades.</li>
              </ul>

              <div style="text-align: center; margin: 32px 0 24px;">
                <a href="${data.loginUrl}" target="_blank" style="background-color: #0F6E56; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
                  Acceder a la Consola de Gestión
                </a>
              </div>

              <p style="margin: 0; font-size: 13px; color: #6B7280; text-align: center;">
                Para iniciar sesión ingresá con tu cuenta${data.providerHint} registrada como <strong>${data.to}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 32px; border-top: 1px solid #F3F4F6; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                Notificación de seguridad de Habitar para administradores y autoridades de <strong>${data.institutionName}</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildRoleUpdatedTemplate(data: {
    name: string;
    to: string;
    institutionName: string;
    roleLabel: string;
    loginUrl: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Actualización de Rol — Habitar</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FBF9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FBF9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E0EFEA; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 110, 86, 0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #0F6E56 0%, #15803D 100%); padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800;">Habitar</h1>
              <p style="margin: 4px 0 0; color: #D1FAE5; font-size: 13px;">Actualización de Permisos Institucionales</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 19px; font-weight: 700;">
                Hola, ${data.name}
              </h2>
              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                Te informamos que tu perfil de usuario en <strong>${data.institutionName}</strong> ha sido actualizado:
              </p>
              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
                <span style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px;">Nuevo Rol Asignado</span>
                <span style="font-size: 18px; color: #0F6E56; font-weight: 800;">${data.roleLabel}</span>
              </div>
              <p style="margin: 0 0 24px; font-size: 14px; color: #4B5563;">
                Tus permisos y vistas en la plataforma se actualizarán de forma inmediata en tu próximo inicio de sesión.
              </p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${data.loginUrl}" target="_blank" style="background-color: #0F6E56; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
                  Ingresar a la Plataforma
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}

export const emailService = new EmailService();
