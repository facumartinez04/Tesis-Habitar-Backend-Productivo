import { query, queryOne } from '../config/db';
import { courseRepository } from '../repositories/course.repository';
import { classify } from './result.service';
import { BadRequestError, ForbiddenError } from '../utils/http-error';
import type { Role } from '../domain/enums';

export interface DashboardFilters {
  courseId?: string;
  studentId?: string;
  /** Rango de días en hora argentina (AAAA-MM-DD), inclusive. */
  from?: string;
  to?: string;
}

type Avg = { literal: number | null; inferencial: number | null; critico: number | null };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Día en hora argentina de una marca guardada en UTC. */
const AR_DAY = `(sr."createdAt" - interval '3 hours')::date`;

const n = (v: unknown) => Number(v ?? 0);
const avgOf = (r: Record<string, unknown>): Avg => ({
  literal: r.literal === null || r.literal === undefined ? null : Math.round(Number(r.literal)),
  inferencial: r.inferencial === null || r.inferencial === undefined ? null : Math.round(Number(r.inferencial)),
  critico: r.critico === null || r.critico === undefined ? null : Math.round(Number(r.critico)),
});
const AVGS = `AVG(sr."literalScore") AS "literal", AVG(sr."inferencialScore") AS "inferencial",
              AVG(sr."criticoScore") FILTER (WHERE sr."criticoReviewed") AS "critico"`;

/**
 * Tablero de resultados con filtros por aula, alumno y días. El docente ve sus aulas; la coordinación, la dirección
 * y el administrador (viendo como la institución), todas las de la institución.
 */
export class DashboardService {
  private async allowedCourses(auth: { sub: string; role: Role; institutionId: string }) {
    const courses = auth.role === 'DOCENTE' ? await courseRepository.findByTeacher(auth.sub) : await courseRepository.findByInstitution(auth.institutionId);
    return courses.map((c) => ({ id: c.id, name: c.name }));
  }

  async get(auth: { sub: string; role: Role; institutionId: string }, filters: DashboardFilters) {
    for (const d of [filters.from, filters.to]) if (d && !DAY.test(d)) throw new BadRequestError('Las fechas tienen que tener el formato AAAA-MM-DD');
    const courses = await this.allowedCourses(auth);
    const allowed = courses.map((c) => c.id);
    if (filters.courseId && !allowed.includes(filters.courseId)) throw new ForbiddenError('No tenés acceso a esa aula');
    const scope = filters.courseId ? [filters.courseId] : allowed;

    // Alumnos para el filtro: los del aula elegida (o de todas las aulas visibles).
    const students = scope.length
      ? await query<{ id: string; name: string; courseName: string }>(
          `SELECT s."id", s."name", c."name" AS "courseName" FROM "Student" s JOIN "Course" c ON c."id" = s."courseId"
            WHERE s."courseId" = ANY($1) ORDER BY c."name", s."name" LIMIT 2000`,
          [scope],
        )
      : [];
    if (filters.studentId && !students.some((s) => s.id === filters.studentId)) throw new ForbiddenError('No tenés acceso a ese alumno');

    const params: unknown[] = [scope, filters.studentId ?? null, filters.from ?? null, filters.to ?? null];
    const where = `a."courseId" = ANY($1)
      AND ($2::text IS NULL OR sr."studentId" = $2)
      AND ($3::date IS NULL OR ${AR_DAY} >= $3::date)
      AND ($4::date IS NULL OR ${AR_DAY} <= $4::date)`;
    const from = `FROM "StudentResult" sr JOIN "Activity" a ON a."id" = sr."activityId" JOIN "Student" s ON s."id" = sr."studentId"
      JOIN "Course" c ON c."id" = a."courseId" WHERE ${where}`;

    if (scope.length === 0) {
      return { filters, courses, students: [], kpis: null, byDay: [], byCourse: [], byStudent: [], byActivity: [] };
    }

    const [kpi, byDay, byCourse, byStudent, byActivity, help, pending] = await Promise.all([
      queryOne(`SELECT COUNT(*) AS "responses", COUNT(DISTINCT sr."studentId") AS "students", COUNT(DISTINCT sr."activityId") AS "activities",
                       COUNT(*) FILTER (WHERE NOT sr."criticoReviewed") AS "criticoPending", ${AVGS} ${from}`, params),
      query(`SELECT to_char(${AR_DAY}, 'YYYY-MM-DD') AS "day", COUNT(*) AS "responses", ${AVGS} ${from} GROUP BY 1 ORDER BY 1`, params),
      query(`SELECT c."id", c."name", COUNT(*) AS "responses", COUNT(DISTINCT sr."studentId") AS "students",
                    COUNT(DISTINCT sr."activityId") AS "activities", ${AVGS} ${from} GROUP BY c."id", c."name" ORDER BY c."name"`, params),
      query(`SELECT s."id", s."name", c."name" AS "courseName", COUNT(*) AS "responses",
                    to_char(MAX(${AR_DAY}), 'YYYY-MM-DD') AS "lastDay", ${AVGS} ${from}
              GROUP BY s."id", s."name", c."name" ORDER BY c."name", s."name" LIMIT 2000`, params),
      query(`SELECT a."id", a."name", a."code", c."name" AS "courseName", a."availableFrom" AS "date", COUNT(*) AS "responses", ${AVGS} ${from}
              GROUP BY a."id", a."name", a."code", c."name", a."availableFrom" ORDER BY a."availableFrom" DESC, a."name" LIMIT 1000`, params),
      queryOne(`SELECT COUNT(*) AS "n" FROM "ReadingHelpMessage" h JOIN "Activity" a ON a."id" = h."activityId"
                 WHERE a."courseId" = ANY($1)
                   AND ($3::date IS NULL OR (h."createdAt" - interval '3 hours')::date >= $3::date)
                   AND ($4::date IS NULL OR (h."createdAt" - interval '3 hours')::date <= $4::date)
                   AND ($2::text IS NULL OR h."studentDisplayName" IN (SELECT s2."name" FROM "Student" s2 WHERE s2."id" = $2))`, params),
      queryOne(`SELECT COUNT(*) AS "n" FROM "Answer" an JOIN "StudentResult" sr ON sr."responseId" = an."responseId"
                 JOIN "Activity" a ON a."id" = sr."activityId"
                WHERE ${where} AND an."textAnswer" IS NOT NULL AND an."teacherScore" IS NULL`, params),
    ]);

    return {
      filters,
      courses,
      students,
      kpis: {
        responses: n(kpi?.responses),
        students: n(kpi?.students),
        activities: n(kpi?.activities),
        averages: avgOf(kpi ?? {}),
        criticoPending: n(kpi?.criticoPending),
        pendingReviews: n(pending?.n),
        helpQuestions: n(help?.n),
      },
      byDay: byDay.map((r: Record<string, unknown>) => ({ day: String(r.day), responses: n(r.responses), averages: avgOf(r) })),
      byCourse: byCourse.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: String(r.name),
        responses: n(r.responses),
        students: n(r.students),
        activities: n(r.activities),
        averages: avgOf(r),
      })),
      byStudent: byStudent.map((r: Record<string, unknown>) => {
        const averages = avgOf(r);
        return {
          id: String(r.id),
          name: String(r.name),
          courseName: String(r.courseName),
          responses: n(r.responses),
          lastDay: String(r.lastDay),
          averages,
          status: classify(averages),
        };
      }),
      byActivity: byActivity.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: String(r.name),
        code: String(r.code),
        courseName: String(r.courseName),
        date: String(r.date),
        responses: n(r.responses),
        averages: avgOf(r),
      })),
    };
  }
}

export const dashboardService = new DashboardService();
