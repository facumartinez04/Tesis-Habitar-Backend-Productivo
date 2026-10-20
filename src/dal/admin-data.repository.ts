import type { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '../config/db';

export interface AdminActivityRow {
  id: string;
  code: string;
  name: string;
  status: string;
  courseId: string;
  courseName: string;
  createdAt: Date;
  responses: number;
}

export interface AdminCourseRow {
  id: string;
  name: string;
  subject: string;
  teacherName: string | null;
  students: number;
  activities: number;
  responses: number;
}

export interface AdminStudentRow {
  id: string;
  name: string;
  courseName: string;
  results: number;
  createdAt: Date;
}

export interface AdminDeletionRow {
  id: string;
  institutionId: string;
  kind: 'ACTIVIDAD' | 'AULA' | 'ALUMNO';
  targetId: string;
  targetName: string;
  detailsJson: string;
  performedBy: string;
  createdAt: Date;
}

interface PageArgs {
  limit: number;
  offset: number;
  q: string;
}

async function paged<T>(select: string, from: string, order: string, params: unknown[], page: PageArgs) {
  const n = params.length;
  const [rows, count] = await Promise.all([
    query<T & { [key: string]: unknown }>(`${select} ${from} ORDER BY ${order} LIMIT $${n + 1} OFFSET $${n + 2}`, [
      ...params,
      page.limit,
      page.offset,
    ]),
    queryOne<{ total: string }>(`SELECT COUNT(*) AS "total" ${from}`, params),
  ]);
  return { items: rows as T[], total: Number(count?.total ?? 0) };
}

async function deleteActivityTx(client: PoolClient, activityId: string): Promise<number> {
  const { rowCount } = await client.query('DELETE FROM "Response" WHERE "activityId" = $1', [activityId]);
  await client.query('DELETE FROM "StudentResult" WHERE "activityId" = $1', [activityId]);
  await client.query('DELETE FROM "Activity" WHERE "id" = $1', [activityId]);
  return rowCount ?? 0;
}

export class SqlAdminDataRepository {
  async listActivities(institutionId: string, page: PageArgs) {
    return paged<AdminActivityRow>(
      `SELECT a."id", a."code", a."name", a."status", a."courseId", c."name" AS "courseName", a."createdAt",
              (SELECT COUNT(*)::int FROM "Response" r WHERE r."activityId" = a."id") AS "responses"`,
      `FROM "Activity" a JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."institutionId" = $1
          AND ($2 = '' OR a."name" ILIKE '%' || $2 || '%' OR a."code" ILIKE '%' || $2 || '%' OR c."name" ILIKE '%' || $2 || '%')`,
      'a."createdAt" DESC',
      [institutionId, page.q],
      page,
    );
  }

  async listCourses(institutionId: string, page: PageArgs) {
    return paged<AdminCourseRow>(
      `SELECT c."id", c."name", c."subject", u."name" AS "teacherName",
              (SELECT COUNT(*)::int FROM "Student" s WHERE s."courseId" = c."id") AS "students",
              (SELECT COUNT(*)::int FROM "Activity" a WHERE a."courseId" = c."id") AS "activities",
              (SELECT COUNT(*)::int FROM "Response" r JOIN "Activity" a ON a."id" = r."activityId" WHERE a."courseId" = c."id") AS "responses"`,
      `FROM "Course" c LEFT JOIN "User" u ON u."id" = c."teacherId"
        WHERE c."institutionId" = $1
          AND ($2 = '' OR c."name" ILIKE '%' || $2 || '%' OR c."subject" ILIKE '%' || $2 || '%')`,
      'c."name" ASC',
      [institutionId, page.q],
      page,
    );
  }

  async listStudents(institutionId: string, page: PageArgs) {
    return paged<AdminStudentRow>(
      `SELECT s."id", s."name", c."name" AS "courseName", s."createdAt",
              (SELECT COUNT(*)::int FROM "StudentResult" sr WHERE sr."studentId" = s."id") AS "results"`,
      `FROM "Student" s JOIN "Course" c ON c."id" = s."courseId"
        WHERE c."institutionId" = $1
          AND ($2 = '' OR s."name" ILIKE '%' || $2 || '%' OR c."name" ILIKE '%' || $2 || '%')`,
      'c."name" ASC, s."name" ASC',
      [institutionId, page.q],
      page,
    );
  }

  async listDeletions(institutionId: string, page: PageArgs) {
    return paged<AdminDeletionRow>(
      'SELECT *',
      `FROM "AdminDeletion" WHERE "institutionId" = $1
         AND ($2 = '' OR "targetName" ILIKE '%' || $2 || '%' OR "performedBy" ILIKE '%' || $2 || '%')`,
      '"createdAt" DESC',
      [institutionId, page.q],
      page,
    );
  }

  async findActivity(id: string) {
    return queryOne<{ id: string; name: string; code: string; status: string; courseId: string; institutionId: string }>(
      `SELECT a."id", a."name", a."code", a."status", a."courseId", c."institutionId"
         FROM "Activity" a JOIN "Course" c ON c."id" = a."courseId" WHERE a."id" = $1`,
      [id],
    );
  }

  async findCourse(id: string) {
    return queryOne<{ id: string; name: string; institutionId: string; qrCode: string | null }>(
      'SELECT "id", "name", "institutionId", "qrCode" FROM "Course" WHERE "id" = $1',
      [id],
    );
  }

  async findStudent(id: string) {
    return queryOne<{ id: string; name: string; courseName: string; institutionId: string }>(
      `SELECT s."id", s."name", c."name" AS "courseName", c."institutionId"
         FROM "Student" s JOIN "Course" c ON c."id" = s."courseId" WHERE s."id" = $1`,
      [id],
    );
  }

  async deleteActivity(
    activity: { id: string; name: string; institutionId: string },
    actor: { name: string; id: string },
  ): Promise<{ responses: number }> {
    return withTransaction(async (client) => {
      const responses = await deleteActivityTx(client, activity.id);
      await this.logTx(client, activity.institutionId, 'ACTIVIDAD', activity.id, activity.name, { responses }, actor);
      return { responses };
    });
  }

  async deleteCourse(
    course: { id: string; name: string; institutionId: string },
    actor: { name: string; id: string },
  ): Promise<{ activities: number; responses: number; students: number }> {
    return withTransaction(async (client) => {
      const { rows: activities } = await client.query<{ id: string }>('SELECT "id" FROM "Activity" WHERE "courseId" = $1', [course.id]);
      let responses = 0;
      for (const a of activities) responses += await deleteActivityTx(client, a.id);
      await client.query('DELETE FROM "PerformanceAlert" WHERE "courseId" = $1', [course.id]);
      const { rows: students } = await client.query<{ name: string }>('SELECT "name" FROM "Student" WHERE "courseId" = $1', [course.id]);
      for (const s of students) await this.auditTx(client, course.institutionId, s.name, actor);
      await client.query('DELETE FROM "Course" WHERE "id" = $1', [course.id]);
      const details = { activities: activities.length, responses, students: students.length };
      await this.logTx(client, course.institutionId, 'AULA', course.id, course.name, details, actor);
      return details;
    });
  }

  async deleteStudent(
    student: { id: string; name: string; courseName: string; institutionId: string },
    actor: { name: string; id: string },
  ): Promise<{ results: number }> {
    return withTransaction(async (client) => {
      const { rows } = await client.query<{ n: number }>('SELECT COUNT(*)::int AS "n" FROM "StudentResult" WHERE "studentId" = $1', [student.id]);
      await this.auditTx(client, student.institutionId, student.name, actor);
      await client.query('DELETE FROM "Student" WHERE "id" = $1', [student.id]);
      const details = { results: rows[0]?.n ?? 0, course: student.courseName };
      await this.logTx(client, student.institutionId, 'ALUMNO', student.id, student.name, details, actor);
      return { results: details.results };
    });
  }

  private async auditTx(client: PoolClient, institutionId: string, studentName: string, actor: { name: string; id: string }): Promise<void> {
    await client.query(
      `INSERT INTO "AuditLogEntry" ("institutionId", "studentId", "studentName", "operation", "performedBy", "performedById")
       VALUES ($1, NULL, $2, 'ELIMINACION', $3, $4)`,
      [institutionId, studentName, `${actor.name} (administración de plataforma)`, actor.id],
    );
  }

  private async logTx(
    client: PoolClient,
    institutionId: string,
    kind: AdminDeletionRow['kind'],
    targetId: string,
    targetName: string,
    details: Record<string, unknown>,
    actor: { name: string; id: string },
  ): Promise<void> {
    await client.query(
      `INSERT INTO "AdminDeletion" ("institutionId", "kind", "targetId", "targetName", "detailsJson", "performedBy", "performedById")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [institutionId, kind, targetId, targetName, JSON.stringify(details), actor.name, actor.id],
    );
  }
}

export const adminDataRepository = new SqlAdminDataRepository();
