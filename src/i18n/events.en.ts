const ROLE_EN: Record<string, string> = {
  Docente: 'Teacher',
  Coordinador: 'Coordinator',
  Director: 'Principal',
  Administrador: 'Administrator',
};

const role = (value: string): string => ROLE_EN[value] ?? value;

export const enEventMessages: Record<string, string> = {
  'Cerró sesión.': 'Signed out.',
  'Deshabilitó el acceso OAuth de la institución.': "Disabled the institution's OAuth access.",
  'Desvinculó el dispositivo de un alumno.': "Unlinked a student's device.",
  'Editó una pregunta de una actividad en curso.': 'Edited a question of an ongoing activity.',
  'Eliminó un plan.': 'Deleted a plan.',
  'Eliminó un rol personalizado.': 'Deleted a custom role.',
  'Habilitó el acceso OAuth de la institución.': "Enabled the institution's OAuth access.",
  'Modificó el presupuesto mensual de IA de la institución.': "Changed the institution's monthly AI budget.",
  'Modificó la configuración de cobros de la institución.': "Changed the institution's billing settings.",
  'Modificó la configuración de cobros de la plataforma.': "Changed the platform's billing settings.",
  'Modificó la configuración de la institución.': "Changed the institution's settings.",
  'Modificó los cursos asignados a un docente.': 'Changed the courses assigned to a teacher.',
  'Modificó los docentes asignados a un curso.': 'Changed the teachers assigned to a course.',
  'Modificó una suscripción.': 'Changed a subscription.',
  'Reasignó el docente de un curso.': "Reassigned a course's teacher.",
  'Renovó una suscripción.': 'Renewed a subscription.',
  'Revocó un token de API para agentes.': 'Revoked an API token for agents.',
  'Se reutilizó un token de sesión ya renovado: se cerró la sesión en ese dispositivo.':
    'An already renewed session token was reused: the session on that device was closed.',
};

const SENTENCE_PREFIX: Record<string, string> = {
  'Cerró la actividad': 'Closed the activity',
  'Creó el curso': 'Created the course',
  'Creó el plan': 'Created the plan',
  'Creó la actividad': 'Created the activity',
  'Creó un token de API para agentes': 'Created an API token for agents',
  'Dio de alta la institución': 'Registered the institution',
  'Liberó las preguntas de la actividad': 'Released the questions of the activity',
  'Modificó el plan': 'Changed the plan',
  'Publicó la actividad': 'Published the activity',
};

const prefixes = Object.keys(SENTENCE_PREFIX)
  .sort((a, b) => b.length - a.length)
  .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

export const enEventPatterns: Array<[RegExp, (...groups: string[]) => string]> = [
  [new RegExp(`^(${prefixes})( .+)?\\.$`, 's'), (prefix, rest) => `${SENTENCE_PREFIX[prefix]}${rest ?? ''}.`],
  [/^Invitó a (.*) como (.*)\.$/, (email, r) => `Invited ${email} as ${role(r)}.`],
  [/^Cambió el rol de (.*) a (.*)\.$/, (who, r) => `Changed the role of ${who === 'un usuario' ? 'a user' : who} to ${role(r)}.`],
  [/^(Activó|Desactivó) la cuenta de (.*)\.$/, (verb, who) => `${verb === 'Activó' ? 'Activated' : 'Deactivated'} the account of ${who === 'un usuario' ? 'a user' : who}.`],
  [/^(Creó|Modificó) el rol (.*)\.$/, (verb, name) => `${verb === 'Creó' ? 'Created' : 'Changed'} the ${name === 'personalizado' ? 'custom' : name} role.`],
  [/^Cambió el estado de la institución a (.*)\.$/, (s) => `Changed the institution status to ${s}.`],
  [/^Fijó la retención de datos en (.*) meses\.$/, (n) => `Set data retention to ${n} months.`],
  [/^Duplicó una actividad como (.*)\.$/, (name) => `Duplicated an activity as ${name === 'una nueva' ? 'a new one' : name}.`],
  [/^Ejecutó la purga por retención: (\d+) alumnos eliminados\.$/, (n) => `Ran the retention purge: ${n} students deleted.`],
  [/^Cambió el estado de una cuota a (.*)\.$/, (s) => `Changed the status of a fee to ${s}.`],
  [/^Inició sesión con (\S+)\.$/, (p) => `Signed in with ${p}.`],
  [/^Inicio de sesión rechazado con (\S+) \((.*)\)\.$/, (p, code) => `Sign-in rejected with ${p} (${code}).`],
  [/^Intento sin permiso: (.*)\.$/, (what) => `Attempt without permission: ${what}.`],
  [/^El administrador de plataforma operó como (.*) en la institución\.$/, (r) => `The platform administrator acted as ${role(r)} in the institution.`],
];
