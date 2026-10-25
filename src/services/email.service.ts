import { Resend } from 'resend';
import { env } from '../config/env';
import type { Role, OAuthProviderId } from '../domain/enums';
import type { Locale } from '../i18n/locale';

export interface SendInvitationEmailInput {
  to: string;
  name: string;
  role: Role;
  institutionName: string;
  provider?: OAuthProviderId;
  language?: Locale;
}

export interface SendRoleUpdatedEmailInput {
  to: string;
  name: string;
  newRole: Role;
  institutionName: string;
  language?: Locale;
}

export interface SendPerformanceAlertEmailInput {
  to: string;
  institutionName: string;
  courseName: string;
  axis: 'LITERAL' | 'INFERENCIAL' | 'CRITICO';
  currentValue: number;
  threshold: number;
  severity: 'CRITICA' | 'ADVERTENCIA';
  language?: Locale;
}

export interface EmailSendResult {
  success: boolean;
  simulated?: boolean;
  messageId?: string;
  error?: string;
}

const roleLabels: Record<Locale, Record<Role, string>> = {
  es: {
    DOCENTE: 'Docente',
    COORDINADOR: 'Coordinador/a Institucional',
    DIRECTOR: 'Director/a',
    ADMIN: 'Administrador/a',
  },
  en: {
    DOCENTE: 'Teacher',
    COORDINADOR: 'Institutional Coordinator',
    DIRECTOR: 'Principal',
    ADMIN: 'Administrator',
  },
};

const COPY = {
  es: {
    teacherSubject: (institution: string) => `Invitación a Habitar — Vinculación docente con ${institution}`,
    adminSubject: (role: string, institution: string) => `Acceso concedido en Habitar (${role}) — ${institution}`,
    roleSubject: (institution: string) => `Actualización de rol en Habitar — ${institution}`,
    providerHint: (provider: string) => ` mediante tu cuenta de ${provider}`,
    alertSubject: (course: string, axis: string) => `Habitar — ${course}: el eje ${axis} quedó debajo del umbral`,
    axis: { LITERAL: 'literal', INFERENCIAL: 'inferencial', CRITICO: 'crítico' },
    alertTitle: 'Alerta de rendimiento',
    alertBody: (institution: string, course: string, value: number, axis: string, threshold: number) =>
      `En <strong>${institution}</strong>, el curso <strong>${course}</strong>
promedia <strong>${value}</strong> en el eje <strong>${axis}</strong>, debajo del umbral de
${threshold} configurado por la institución.`,
    severityLabel: 'Gravedad',
    severity: { CRITICA: 'crítica', ADVERTENCIA: 'advertencia' },
    alertLink: 'Ver las alertas en Habitar',
    alertFooter: `Podés desactivar estos correos desde la configuración de la institución.
La alerta igual queda registrada en Habitar.`,
    teacher: {
      title: 'Invitación a Habitar',
      tagline: 'Plataforma de Comprensión Lectora Escolar',
      greeting: (name: string) => `¡Hola, ${name}!`,
      linked: (email: string) => `Te confirmamos que tu casilla <strong>${email}</strong> ha sido vinculada a la institución educativa:`,
      boxLabel: 'Institución Vinculada',
      intro: 'A partir de ahora tenés acceso a las herramientas pedagógicas para tus cursos:',
      items: [
        '<strong>Aulas asignadas:</strong> Visualizá los cursos y divisiones donde ejercés tu labor docente.',
        '<strong>Acceso seguro con QR:</strong> Mostrá el código en el proyector o pantalla para que los estudiantes ingresen inmediatamente sin contraseñas.',
        '<strong>Actividades pedagógicas:</strong> Creá y asigná lecturas interactivas evaluando comprensión literal, inferencial y crítica.',
        '<strong>Métricas de grupo:</strong> Analizá el progreso y diagnósticos de lectura colectivos protegiendo la privacidad de los menores.',
      ],
      button: 'Ingresar a Habitar',
      signIn: (hint: string, email: string) => `Iniciá sesión${hint} utilizando tu correo <strong>${email}</strong>.`,
      footer: (institution: string) =>
        `Este correo fue enviado automáticamente por el sistema de gestión de Habitar para <strong>${institution}</strong>.`,
      footerNote: 'Cumple con las directivas pedagógicas y normativas de protección de datos educativos.',
    },
    admin: {
      title: 'Acceso Administrativo — Habitar',
      tagline: 'Panel de Gestión y Coordinación Institucional',
      badge: (role: string) => `Permisos de ${role}`,
      heading: (name: string) => `Acceso Habilitado para ${name}`,
      granted: (role: string, email: string) =>
        `Se ha concedido acceso de <strong>${role}</strong> a tu cuenta de correo <strong>${email}</strong> en:`,
      boxLabel: 'Institución Asignada',
      intro: 'Desde tu consola de gestión podrás administrar los aspectos clave del establecimiento:',
      items: [
        '<strong>Gestión de cursos y aulas:</strong> Dar de alta divisiones y asignar a cada docente sus aulas correspondientes.',
        '<strong>Administración de personal:</strong> Gestionar el equipo de docentes y miembros directivos de la institución.',
        '<strong>Configuración pedagógica:</strong> Activar niveles educativos (Primaria / Secundaria) y ejes de comprensión (Literal, Inferencial, Crítico).',
        '<strong>Métricas y cuotas de IA:</strong> Monitorear el consumo de créditos de inteligencia artificial para generación de actividades.',
      ],
      button: 'Acceder a la Consola de Gestión',
      signIn: (hint: string, email: string) =>
        `Para iniciar sesión ingresá con tu cuenta${hint} registrada como <strong>${email}</strong>.`,
      footer: (institution: string) =>
        `Notificación de seguridad de Habitar para administradores y autoridades de <strong>${institution}</strong>.`,
    },
    role: {
      title: 'Actualización de Rol — Habitar',
      tagline: 'Actualización de Permisos Institucionales',
      greeting: (name: string) => `Hola, ${name}`,
      updated: (institution: string) =>
        `Te informamos que tu perfil de usuario en <strong>${institution}</strong> ha sido actualizado:`,
      boxLabel: 'Nuevo Rol Asignado',
      note: 'Tus permisos y vistas en la plataforma se actualizarán de forma inmediata en tu próximo inicio de sesión.',
      button: 'Ingresar a la Plataforma',
    },
  },
  en: {
    teacherSubject: (institution: string) => `Invitation to Habitar — Teacher access at ${institution}`,
    adminSubject: (role: string, institution: string) => `Access granted in Habitar (${role}) — ${institution}`,
    roleSubject: (institution: string) => `Role update in Habitar — ${institution}`,
    providerHint: (provider: string) => ` with your ${provider} account`,
    alertSubject: (course: string, axis: string) => `Habitar — ${course}: the ${axis} axis fell below the threshold`,
    axis: { LITERAL: 'literal', INFERENCIAL: 'inferential', CRITICO: 'critical' },
    alertTitle: 'Performance alert',
    alertBody: (institution: string, course: string, value: number, axis: string, threshold: number) =>
      `At <strong>${institution}</strong>, the course <strong>${course}</strong>
averages <strong>${value}</strong> on the <strong>${axis}</strong> axis, below the
${threshold} threshold set by the institution.`,
    severityLabel: 'Severity',
    severity: { CRITICA: 'critical', ADVERTENCIA: 'warning' },
    alertLink: 'See the alerts in Habitar',
    alertFooter: `You can turn off these emails from the institution settings.
The alert is still recorded in Habitar.`,
    teacher: {
      title: 'Invitation to Habitar',
      tagline: 'School Reading Comprehension Platform',
      greeting: (name: string) => `Hi, ${name}!`,
      linked: (email: string) => `We confirm that your address <strong>${email}</strong> has been linked to the school:`,
      boxLabel: 'Linked Institution',
      intro: 'From now on you have access to the teaching tools for your courses:',
      items: [
        '<strong>Assigned classrooms:</strong> See the courses and sections where you teach.',
        '<strong>Secure QR access:</strong> Show the code on the projector or screen so students can join right away without passwords.',
        '<strong>Learning activities:</strong> Create and assign interactive readings that assess literal, inferential and critical comprehension.',
        "<strong>Group metrics:</strong> Analyze the class's reading progress and diagnostics while protecting minors' privacy.",
      ],
      button: 'Sign in to Habitar',
      signIn: (hint: string, email: string) => `Sign in${hint} using your email <strong>${email}</strong>.`,
      footer: (institution: string) =>
        `This email was sent automatically by the Habitar management system for <strong>${institution}</strong>.`,
      footerNote: 'It complies with educational guidelines and student data protection regulations.',
    },
    admin: {
      title: 'Administrative Access — Habitar',
      tagline: 'Institutional Management and Coordination Panel',
      badge: (role: string) => `${role} permissions`,
      heading: (name: string) => `Access Enabled for ${name}`,
      granted: (role: string, email: string) =>
        `<strong>${role}</strong> access has been granted to your email account <strong>${email}</strong> at:`,
      boxLabel: 'Assigned Institution',
      intro: "From your management console you will be able to handle the school's key areas:",
      items: [
        '<strong>Courses and classrooms:</strong> Create sections and assign each teacher their classrooms.',
        "<strong>Staff management:</strong> Manage the institution's teachers and leadership team.",
        '<strong>Teaching settings:</strong> Enable education levels (Primary / Secondary) and comprehension axes (Literal, Inferential, Critical).',
        '<strong>AI metrics and quotas:</strong> Monitor the artificial intelligence credits used to generate activities.',
      ],
      button: 'Open the Management Console',
      signIn: (hint: string, email: string) => `To sign in, use your account${hint} registered as <strong>${email}</strong>.`,
      footer: (institution: string) =>
        `Habitar security notice for administrators and authorities of <strong>${institution}</strong>.`,
    },
    role: {
      title: 'Role Update — Habitar',
      tagline: 'Institutional Permissions Update',
      greeting: (name: string) => `Hi, ${name}`,
      updated: (institution: string) => `We let you know that your user profile at <strong>${institution}</strong> has been updated:`,
      boxLabel: 'New Assigned Role',
      note: 'Your permissions and views on the platform will be updated as soon as you next sign in.',
      button: 'Sign in to the Platform',
    },
  },
};

type Copy = (typeof COPY)['es'];

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
    const language = input.language ?? 'es';
    const copy = COPY[language];
    const client = this.getClient();
    const roleLabel = roleLabels[language][role] ?? role;
    const isTeacher = role === 'DOCENTE';

    const subject = isTeacher ? copy.teacherSubject(institutionName) : copy.adminSubject(roleLabel, institutionName);

    const loginUrl = `${env.frontendUrl}/login`;
    const providerHint = provider ? copy.providerHint(provider === 'GOOGLE' ? 'Google' : 'Microsoft') : '';

    const html = isTeacher
      ? this.buildTeacherInvitationTemplate(copy, language, { name, to, institutionName, roleLabel, loginUrl, providerHint })
      : this.buildAdminInvitationTemplate(copy, language, { name, to, institutionName, roleLabel, loginUrl, providerHint });

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
    const language = input.language ?? 'es';
    const copy = COPY[language];
    const client = this.getClient();
    const roleLabel = roleLabels[language][newRole] ?? newRole;
    const subject = copy.roleSubject(institutionName);
    const loginUrl = `${env.frontendUrl}/login`;

    const html = this.buildRoleUpdatedTemplate(copy, language, { name, to, institutionName, roleLabel, loginUrl });

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

  async sendPerformanceAlertEmail(input: SendPerformanceAlertEmailInput): Promise<EmailSendResult> {
    const language = input.language ?? 'es';
    const copy = COPY[language];
    const client = this.getClient();
    const axisLabel = copy.axis[input.axis];
    const subject = copy.alertSubject(input.courseName, axisLabel);
    const alertsUrl = `${env.frontendUrl}/institucional/alertas`;
    const html = `<!DOCTYPE html>
<html lang="${language}"><body style="font-family:Arial,sans-serif;color:#1f2933;max-width:560px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 12px">${copy.alertTitle}</h2>
<p>${copy.alertBody(escapeHtml(input.institutionName), escapeHtml(input.courseName), input.currentValue, axisLabel, input.threshold)}</p>
<p>${copy.severityLabel}: <strong>${copy.severity[input.severity]}</strong>.</p>
<p><a href="${alertsUrl}">${copy.alertLink}</a></p>
<p style="color:#6b7280;font-size:12px">${copy.alertFooter}</p>
</body></html>`;

    if (!client) {
      console.info(`[EmailService] RESEND_API_KEY no configurada. Alerta simulada para ${input.to}: ${subject}`);
      return { success: true, simulated: true };
    }

    try {
      const response = await client.emails.send({ from: env.resend.fromEmail, to: [input.to], subject, html });
      if (response.error) {
        console.error('[EmailService] Error de Resend al enviar alerta:', response.error);
        return { success: false, error: response.error.message };
      }
      return { success: true, messageId: response.data?.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[EmailService] Excepción de Resend al enviar alerta:', message);
      return { success: false, error: message };
    }
  }

  private buildTeacherInvitationTemplate(
    copy: Copy,
    language: Locale,
    data: {
      name: string;
      to: string;
      institutionName: string;
      roleLabel: string;
      loginUrl: string;
      providerHint: string;
    },
  ): string {
    const t = copy.teacher;
    return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
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
              <p style="margin: 6px 0 0; color: #D1FAE5; font-size: 14px; font-weight: 500;">${t.tagline}</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; background-color: #E0EFEA; color: #0F6E56; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px;">
                ${data.roleLabel}
              </div>

              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 700;">
                ${t.greeting(data.name)}
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                ${t.linked(data.to)}
              </p>

              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
                <span style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">${t.boxLabel}</span>
                <span style="font-size: 18px; color: #0F6E56; font-weight: 800;">${data.institutionName}</span>
              </div>

              <p style="margin: 0 0 14px; font-size: 15px; color: #374151;">
                ${t.intro}
              </p>

              <ul style="margin: 0 0 24px; padding-left: 20px; color: #4B5563; font-size: 14px; line-height: 1.8;">
                ${t.items.map((item) => `<li>${item}</li>`).join('\n                ')}
              </ul>

              <div style="text-align: center; margin: 32px 0 24px;">
                <a href="${data.loginUrl}" target="_blank" style="background-color: #0F6E56; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
                  ${t.button}
                </a>
              </div>

              <p style="margin: 0; font-size: 13px; color: #6B7280; text-align: center;">
                ${t.signIn(data.providerHint, data.to)}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 32px; border-top: 1px solid #F3F4F6; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                ${t.footer(data.institutionName)}
              </p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #9CA3AF;">
                ${t.footerNote}
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

  private buildAdminInvitationTemplate(
    copy: Copy,
    language: Locale,
    data: {
      name: string;
      to: string;
      institutionName: string;
      roleLabel: string;
      loginUrl: string;
      providerHint: string;
    },
  ): string {
    const t = copy.admin;
    return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
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
              <p style="margin: 6px 0 0; color: #D1FAE5; font-size: 14px; font-weight: 500;">${t.tagline}</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; background-color: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px;">
                ${t.badge(data.roleLabel)}
              </div>

              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 700;">
                ${t.heading(data.name)}
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                ${t.granted(data.roleLabel, data.to)}
              </p>

              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
                <span style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">${t.boxLabel}</span>
                <span style="font-size: 18px; color: #0F6E56; font-weight: 800;">${data.institutionName}</span>
              </div>

              <p style="margin: 0 0 14px; font-size: 15px; color: #374151;">
                ${t.intro}
              </p>

              <ul style="margin: 0 0 24px; padding-left: 20px; color: #4B5563; font-size: 14px; line-height: 1.8;">
                ${t.items.map((item) => `<li>${item}</li>`).join('\n                ')}
              </ul>

              <div style="text-align: center; margin: 32px 0 24px;">
                <a href="${data.loginUrl}" target="_blank" style="background-color: #0F6E56; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(15, 110, 86, 0.25);">
                  ${t.button}
                </a>
              </div>

              <p style="margin: 0; font-size: 13px; color: #6B7280; text-align: center;">
                ${t.signIn(data.providerHint, data.to)}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 32px; border-top: 1px solid #F3F4F6; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                ${t.footer(data.institutionName)}
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

  private buildRoleUpdatedTemplate(
    copy: Copy,
    language: Locale,
    data: {
      name: string;
      to: string;
      institutionName: string;
      roleLabel: string;
      loginUrl: string;
    },
  ): string {
    const t = copy.role;
    return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FBF9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FBF9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E0EFEA; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 110, 86, 0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #0F6E56 0%, #15803D 100%); padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800;">Habitar</h1>
              <p style="margin: 4px 0 0; color: #D1FAE5; font-size: 13px;">${t.tagline}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 19px; font-weight: 700;">
                ${t.greeting(data.name)}
              </h2>
              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                ${t.updated(data.institutionName)}
              </p>
              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
                <span style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px;">${t.boxLabel}</span>
                <span style="font-size: 18px; color: #0F6E56; font-weight: 800;">${data.roleLabel}</span>
              </div>
              <p style="margin: 0 0 24px; font-size: 14px; color: #4B5563;">
                ${t.note}
              </p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${data.loginUrl}" target="_blank" style="background-color: #0F6E56; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
                  ${t.button}
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const emailService = new EmailService();
