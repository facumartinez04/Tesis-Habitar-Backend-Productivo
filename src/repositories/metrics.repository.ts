import { query, queryOne } from '../config/db';

export interface WeeklyActiveTeachers {
  weekStart: string;
  teachers: number;
}

export interface UsageMetrics {
  /** Docentes con al menos una actividad creada o respondida en la semana, últimas 8 semanas. */
  weeklyActiveTeachers: WeeklyActiveTeachers[];
  activeTeachersLast30: number;
  activitiesLast30: number;
  activitiesPerActiveTeacherLast30: number | null;
  /** Alumnos que respondieron sobre alumnos registrados en el curso, en las actividades de los últimos 30 días. */
  completionRate: number | null;
  /** Preguntas aprobadas sin que el docente las modificara, sobre el total de aprobadas (últimos 90 días). */
  questionsApprovedUnedited: number | null;
  questionsApproved: number;
  /** Correcciones de la IA que el docente confirmó sin cambiar el puntaje, sobre las revisadas. */
  aiGradesConfirmed: number | null;
  aiGradesReviewed: number;
  aiCallsLast30: { generation: number; grading: number; failed: number };
  aiCallsPerActivityLast30: number | null;
}

/** Filtro por institución, o toda la plataforma si es null. */
function scope(institutionId: string | null, alias: string, param: number): { sql: string; params: unknown[] } {
  return institutionId ? { sql: ` AND ${alias}."institutionId" = $${param}`, params: [institutionId] } : { sql: '', params: [] };
}

function ratio(num: number, den: number): number | null {
  return den === 0 ? null : Math.round((num / den) * 1000) / 10;
}

export class SqlMetricsRepository {
  async usage(institutionId: string | null): Promise<UsageMetrics> {
    const c1 = scope(institutionId, 'c', 1);

    const weekly = await query<{ weekStart: string; teachers: string }>(
      `WITH eventos AS (
         SELECT c."teacherId", a."createdAt" AS at
           FROM "Activity" a JOIN "Course" c ON c."id" = a."courseId"
          WHERE a."createdAt" >= date_trunc('week', now()) - interval '7 weeks'${c1.sql}
         UNION ALL
         SELECT c."teacherId", r."submittedAt" AS at
           FROM "Response" r JOIN "Activity" a ON a."id" = r."activityId" JOIN "Course" c ON c."id" = a."courseId"
          WHERE r."submittedAt" >= date_trunc('week', now()) - interval '7 weeks'${c1.sql}
       )
       SELECT to_char(date_trunc('week', at), 'YYYY-MM-DD') AS "weekStart", COUNT(DISTINCT "teacherId") AS teachers
         FROM eventos GROUP BY 1 ORDER BY 1`,
      c1.params,
    );

    const last30 = await queryOne<{ teachers: string; activities: string }>(
      `SELECT COUNT(DISTINCT c."teacherId") AS teachers, COUNT(*) AS activities
         FROM "Activity" a JOIN "Course" c ON c."id" = a."courseId"
        WHERE a."createdAt" >= now() - interval '30 days'${c1.sql}`,
      c1.params,
    );

    const completion = await queryOne<{ answered: string; expected: string }>(
      `SELECT COALESCE(SUM(respondieron), 0) AS answered, COALESCE(SUM(inscriptos), 0) AS expected
         FROM (
           SELECT a."id",
                  (SELECT COUNT(DISTINCT r."studentId") FROM "Response" r WHERE r."activityId" = a."id") AS respondieron,
                  (SELECT COUNT(*) FROM "Student" s WHERE s."courseId" = a."courseId") AS inscriptos
             FROM "Activity" a JOIN "Course" c ON c."id" = a."courseId"
            WHERE a."createdAt" >= now() - interval '30 days' AND a."status" <> 'BORRADOR'${c1.sql}
         ) t`,
      c1.params,
    );

    const questions = await queryOne<{ approved: string; unedited: string }>(
      `SELECT COUNT(*) FILTER (WHERE q."approved") AS approved,
              COUNT(*) FILTER (WHERE q."approved" AND NOT q."edited") AS unedited
         FROM "Question" q JOIN "Activity" a ON a."id" = q."activityId" JOIN "Course" c ON c."id" = a."courseId"
        WHERE a."createdAt" >= now() - interval '90 days'${c1.sql}`,
      c1.params,
    );

    const grades = await queryOne<{ reviewed: string; confirmed: string }>(
      `SELECT COUNT(*) AS reviewed, COUNT(*) FILTER (WHERE an."aiScore" = an."teacherScore") AS confirmed
         FROM "Answer" an
         JOIN "Response" r ON r."id" = an."responseId"
         JOIN "Activity" a ON a."id" = r."activityId"
         JOIN "Course" c ON c."id" = a."courseId"
        WHERE an."aiScore" IS NOT NULL AND an."teacherScore" IS NOT NULL AND an."reviewedById" IS NOT NULL${c1.sql}`,
      c1.params,
    );

    const ai = scope(institutionId, 'e', 1);
    const calls = await queryOne<{ generation: string; grading: string; failed: string }>(
      `SELECT COUNT(*) FILTER (WHERE e."kind" = 'GENERACION' AND e."success") AS generation,
              COUNT(*) FILTER (WHERE e."kind" = 'CORRECCION' AND e."success") AS grading,
              COUNT(*) FILTER (WHERE NOT e."success") AS failed
         FROM "AiUsageEvent" e
        WHERE e."createdAt" >= now() - interval '30 days'${ai.sql}`,
      ai.params,
    );

    const teachers30 = Number(last30?.teachers ?? 0);
    const activities30 = Number(last30?.activities ?? 0);
    const generation = Number(calls?.generation ?? 0);
    const grading = Number(calls?.grading ?? 0);

    return {
      weeklyActiveTeachers: weekly.map((w) => ({ weekStart: w.weekStart, teachers: Number(w.teachers) })),
      activeTeachersLast30: teachers30,
      activitiesLast30: activities30,
      activitiesPerActiveTeacherLast30: teachers30 === 0 ? null : Math.round((activities30 / teachers30) * 10) / 10,
      completionRate: ratio(Number(completion?.answered ?? 0), Number(completion?.expected ?? 0)),
      questionsApprovedUnedited: ratio(Number(questions?.unedited ?? 0), Number(questions?.approved ?? 0)),
      questionsApproved: Number(questions?.approved ?? 0),
      aiGradesConfirmed: ratio(Number(grades?.confirmed ?? 0), Number(grades?.reviewed ?? 0)),
      aiGradesReviewed: Number(grades?.reviewed ?? 0),
      aiCallsLast30: { generation, grading, failed: Number(calls?.failed ?? 0) },
      aiCallsPerActivityLast30: activities30 === 0 ? null : Math.round(((generation + grading) / activities30) * 10) / 10,
    };
  }
}

export const metricsRepository = new SqlMetricsRepository();
