import type { QueryResultRow } from 'pg';
import { pool } from '../src/config/db';

const biodiversidadText =
  'La biodiversidad es el conjunto de formas de vida que habitan nuestro planeta. Cada ecosistema alberga especies que dependen entre sí para sobrevivir. Cuando una especie desaparece, las consecuencias se propagan en cadena hacia el resto del sistema. Proteger la biodiversidad no es solo una cuestión ambiental, sino también cultural y económica.';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of [
      'Answer',
      'StudentResult',
      'Response',
      'Question',
      'Activity',
      'PerformanceAlert',
      'AuditLogEntry',
      'ConsentAcceptance',
      'Feedback',
      'RetentionPolicy',
      'AiUsageEvent',
      'Student',
      'Course',
      'Subscription',
      'OAuthIntegration',
      'User',
      'InstitutionLevel',
      'Institution',
      'Plan',
      'ConsentDocument',
      'MonitoringComponent',
      'Incident',
    ]) {
      await client.query(`DELETE FROM "${table}"`);
    }

    const one = async <T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[]): Promise<T> => {
      const { rows } = await client.query<T>(text, params);
      return rows[0];
    };

    const belgranoNorte = await one<{ id: string }>(
      `INSERT INTO "Institution" ("slug", "name", "domain", "status", "coordinatorEmail")
       VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
      ['belgrano-norte', 'Colegio Belgrano Norte', 'colegiobelgranonorte.edu.ar', 'ACTIVO', 'coordinacion@colegiobelgranonorte.edu.ar'],
    );
    for (const level of ['PRIMARIO', 'SECUNDARIO']) {
      await client.query('INSERT INTO "InstitutionLevel" ("institutionId", "level") VALUES ($1, $2)', [belgranoNorte.id, level]);
    }

    const sanMartin = await one<{ id: string }>(
      `INSERT INTO "Institution" ("slug", "name", "domain", "status", "coordinatorEmail")
       VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
      ['san-martin', 'Instituto San Martín', 'institutosanmartin.edu.ar', 'ACTIVO', 'coordinacion@institutosanmartin.edu.ar'],
    );
    await client.query('INSERT INTO "InstitutionLevel" ("institutionId", "level") VALUES ($1, $2)', [sanMartin.id, 'SECUNDARIO']);

    const createUser = (name: string, initials: string, email: string, role: string, provider: string, institutionId: string) =>
      one<{ id: string }>(
        `INSERT INTO "User" ("name", "initials", "email", "role", "provider", "institutionId")
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
        [name, initials, email, role, provider, institutionId],
      );

    const teacherLopez = await createUser('López, Paula', 'LP', 'paula.lopez@colegiobelgranonorte.edu.ar', 'DOCENTE', 'GOOGLE', belgranoNorte.id);
    const coordinatorMartinez = await createUser('Martínez, Carla', 'MC', 'coordinacion@colegiobelgranonorte.edu.ar', 'COORDINADOR', 'MICROSOFT', belgranoNorte.id);
    await createUser('Admin Habitar', 'AH', 'plataforma@habitar.com.ar', 'ADMIN', 'GOOGLE', belgranoNorte.id);
    const teacherGarcia = await createUser('García, M.', 'GM', 'm.garcia@colegiobelgranonorte.edu.ar', 'DOCENTE', 'MICROSOFT', belgranoNorte.id);
    const teacherRuiz = await createUser('Ruiz, T.', 'RT', 't.ruiz@colegiobelgranonorte.edu.ar', 'DOCENTE', 'MICROSOFT', belgranoNorte.id);
    const teacherMolina = await createUser('Molina, S.', 'MS', 's.molina@colegiobelgranonorte.edu.ar', 'DOCENTE', 'MICROSOFT', belgranoNorte.id);

    const createCourse = (name: string, teacherId: string) =>
      one<{ id: string }>(
        `INSERT INTO "Course" ("name", "subject", "institutionId", "teacherId")
         VALUES ($1, 'Lengua y Literatura', $2, $3) RETURNING "id"`,
        [name, belgranoNorte.id, teacherId],
      );

    const course4b = await createCourse('4°B', teacherLopez.id);
    await createCourse('4°A', teacherLopez.id);
    const course5a = await createCourse('5°A', teacherGarcia.id);
    await createCourse('5°B', teacherLopez.id);
    const course3c = await createCourse('3°C', teacherRuiz.id);
    await createCourse('6°B', teacherMolina.id);

    const studentDefs = [
      { name: 'García, Valentina', initials: 'GV' },
      { name: 'López, Marcos', initials: 'LM' },
      { name: 'Rodríguez, Sofía', initials: 'RS' },
      { name: 'Torres, Emiliano', initials: 'ET' },
      { name: 'Fernández, Lucía', initials: 'FL' },
    ];
    const students4b: { id: string; name: string }[] = [];
    for (const s of studentDefs) {
      const row = await one<{ id: string }>(
        `INSERT INTO "Student" ("name", "initials", "courseId") VALUES ($1, $2, $3) RETURNING "id"`,
        [s.name, s.initials, course4b.id],
      );
      students4b.push({ id: row.id, name: s.name });
    }

    const activity = await one<{ id: string }>(
      `INSERT INTO "Activity"
         ("code", "name", "educationLevel", "axis", "sourceText", "availableFrom", "startTime", "endTime", "attemptPolicy", "status", "courseId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING "id"`,
      [
        'HAB-4B29',
        'Comprensión lectora — Biodiversidad',
        'Secundario — 4°',
        'INFERENCIAL',
        biodiversidadText,
        '2026-06-18',
        '08:00',
        '12:00',
        'UNICO',
        'PUBLICADA',
        course4b.id,
      ],
    );

    const questions = [
      {
        axis: 'LITERAL',
        prompt: '¿Qué es la biodiversidad según el texto?',
        expectedAnswer: 'El conjunto de formas de vida que habitan el planeta',
        options: ['El conjunto de formas de vida del planeta', 'La cantidad de ecosistemas', 'Solo los animales en peligro'],
        correctOption: 'El conjunto de formas de vida del planeta',
        edited: false,
        approved: true,
      },
      {
        axis: 'INFERENCIAL',
        prompt: '¿Por qué la desaparición de una especie afecta a otras del mismo ecosistema?',
        expectedAnswer: 'Porque las especies dependen entre sí, generando efectos en cadena',
        options: [
          'Porque las especies dependen entre sí y se generan efectos en cadena',
          'Porque cada especie vive de forma aislada',
          'Porque solo afecta a especies de la misma familia',
        ],
        correctOption: 'Porque las especies dependen entre sí y se generan efectos en cadena',
        edited: true,
        approved: true,
      },
      {
        axis: 'CRITICO',
        prompt: '¿Estás de acuerdo con que proteger la biodiversidad es responsabilidad de todos? Justificá.',
        expectedAnswer: '(respuesta abierta — justificación con argumentos del texto)',
        options: null,
        correctOption: null,
        edited: false,
        approved: false,
      },
      {
        axis: 'INFERENCIAL',
        prompt: '¿Qué relación establece el texto entre biodiversidad y economía?',
        expectedAnswer: 'La protección de la biodiversidad tiene también una dimensión económica, no solo ambiental',
        options: ['Es también una cuestión económica, no solo ambiental', 'No existe ninguna relación', 'La economía depende únicamente del turismo'],
        correctOption: 'Es también una cuestión económica, no solo ambiental',
        edited: false,
        approved: false,
      },
      {
        axis: 'INFERENCIAL',
        prompt: '¿Qué consecuencia tendría ignorar la interdependencia entre especies de un ecosistema?',
        expectedAnswer: 'Se propagarían efectos en cadena que podrían colapsar el equilibrio del ecosistema',
        options: [
          'Se propagarían efectos en cadena que afectan al ecosistema completo',
          'No tendría ninguna consecuencia',
          'Solo afectaría a la especie que desaparece',
        ],
        correctOption: 'Se propagarían efectos en cadena que afectan al ecosistema completo',
        edited: false,
        approved: true,
      },
    ];

    for (const [index, q] of questions.entries()) {
      await client.query(
        `INSERT INTO "Question"
           ("activityId", "axis", "prompt", "expectedAnswer", "optionsJson", "correctOption", "edited", "approved", "order")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          activity.id,
          q.axis,
          q.prompt,
          q.expectedAnswer,
          q.options ? JSON.stringify(q.options) : null,
          q.correctOption,
          q.edited,
          q.approved,
          index,
        ],
      );
    }

    const historicalScores: Record<string, { literal: number; inferencial: number; critico: number }> = {
      'García, Valentina': { literal: 85, inferencial: 74, critico: 62 },
      'López, Marcos': { literal: 70, inferencial: 55, critico: 38 },
      'Rodríguez, Sofía': { literal: 90, inferencial: 80, critico: 70 },
      'Torres, Emiliano': { literal: 45, inferencial: 30, critico: 20 },
    };

    for (const student of students4b) {
      const scores = historicalScores[student.name];
      if (!scores) continue;

      const response = await one<{ id: string }>(
        `INSERT INTO "Response" ("activityId", "studentId", "studentDisplayName") VALUES ($1, $2, $3) RETURNING "id"`,
        [activity.id, student.id, student.name],
      );

      await client.query(
        `INSERT INTO "StudentResult" ("studentId", "activityId", "responseId", "literalScore", "inferencialScore", "criticoScore")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [student.id, activity.id, response.id, scores.literal, scores.inferencial, scores.critico],
      );
    }

    await client.query(
      `INSERT INTO "PerformanceAlert" ("courseId", "axis", "currentValue", "threshold", "severity", "detectedAt", "message")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [course3c.id, 'CRITICO', 21, 40, 'CRITICA', '2026-06-17', 'Comprensión crítica bajo umbral'],
    );
    await client.query(
      `INSERT INTO "PerformanceAlert" ("courseId", "axis", "currentValue", "threshold", "severity", "detectedAt", "message")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [course4b.id, 'INFERENCIAL', 58, 60, 'ADVERTENCIA', '2026-06-18', 'Comprensión inferencial en descenso'],
    );
    await client.query(
      `INSERT INTO "PerformanceAlert" ("courseId", "axis", "currentValue", "threshold", "severity", "detectedAt", "message")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [course5a.id, 'CRITICO', 65, 60, 'RESUELTA', '2026-06-15', 'Recuperación sostenida — todos los ejes superan el umbral por segunda semana consecutiva'],
    );

    await client.query(
      `INSERT INTO "AuditLogEntry" ("studentId", "studentName", "operation", "performedBy", "performedById", "date")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [students4b[0].id, 'García, V.', 'EXPORTACION', 'coord.martinez', coordinatorMartinez.id, new Date('2026-06-10')],
    );
    await client.query(
      `INSERT INTO "AuditLogEntry" ("studentId", "studentName", "operation", "performedBy", "performedById", "date")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [null, 'López, M.', 'ELIMINACION', 'coord.martinez', coordinatorMartinez.id, new Date('2026-05-02')],
    );

    await client.query(
      `INSERT INTO "ConsentDocument" ("version", "publishedAt", "dataController", "dataProcessor")
       VALUES ($1, $2, $3, $4)`,
      ['1.2', '2026-06-01', 'Colegio Belgrano Norte', 'Habitar (Operador)'],
    );

    const planEstandar = await one<{ id: string }>(
      `INSERT INTO "Plan" ("name", "monthlyPriceArs") VALUES ($1, $2) RETURNING "id"`,
      ['Estándar', 150000],
    );
    await client.query(`INSERT INTO "Plan" ("name", "monthlyPriceArs") VALUES ($1, $2)`, ['Premium', 220000]);

    await client.query(
      `INSERT INTO "Subscription" ("institutionId", "planId", "monthlyPriceArs", "expiresAt", "managementStatus", "durationMonths")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [belgranoNorte.id, planEstandar.id, 130000, '2026-06-30', 'EN_NEGOCIACION', 12],
    );
    await client.query(
      `INSERT INTO "Subscription" ("institutionId", "planId", "monthlyPriceArs", "expiresAt", "managementStatus", "durationMonths")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sanMartin.id, planEstandar.id, 130000, '2026-08-15', 'EN_NEGOCIACION', 12],
    );

    for (const c of [
      { name: 'API Backend (AWS ECS)', health: 'OPERATIVO', uptimePercent: 99.7 },
      { name: 'Base de datos PostgreSQL (RDS)', health: 'OPERATIVO', uptimePercent: 100 },
      { name: 'API OpenAI (GPT-4o)', health: 'OPERATIVO', uptimePercent: 98.5 },
      { name: 'Auth OAuth (Google/Microsoft)', health: 'DEGRADADO', uptimePercent: 95 },
    ]) {
      await client.query(`INSERT INTO "MonitoringComponent" ("name", "health", "uptimePercent") VALUES ($1, $2, $3)`, [
        c.name,
        c.health,
        c.uptimePercent,
      ]);
    }

    for (const i of [
      { date: '12 jun · 03:14', component: 'API Backend', duration: '8 min', status: 'RESUELTO' },
      { date: 'Mantenimiento programado · 04:00–04:30', component: 'Todos', duration: '30 min', status: 'PLANIFICADO' },
    ]) {
      await client.query(`INSERT INTO "Incident" ("date", "component", "duration", "status") VALUES ($1, $2, $3, $4)`, [
        i.date,
        i.component,
        i.duration,
        i.status,
      ]);
    }

    await client.query('COMMIT');
    console.log('Seed completado');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
