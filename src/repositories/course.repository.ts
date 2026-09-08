import { query, queryOne } from '../config/db';
import type { Course, CreateCourseInput } from '../domain/course';

interface CourseRow {
  id: string;
  name: string;
  subject: string;
  institutionId: string;
  teacherId: string;
  qrCode: string;
  room: string | null;
  grade: string | null;
  division: string | null;
  shift: string | null;
  activeActivityId: string | null;
  institutionName: string | null;
  teacherName: string | null;
  studentsCount: string | number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function toDomain(row: CourseRow): Course {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    institutionId: row.institutionId,
    teacherId: row.teacherId,
    qrCode: row.qrCode,
    room: row.room || '',
    grade: row.grade || '',
    division: row.division || '',
    shift: row.shift || 'MAÑANA',
    activeActivityId: row.activeActivityId,
    institutionName: row.institutionName || undefined,
    teacherName: row.teacherName || undefined,
    studentsCount: typeof row.studentsCount === 'string' ? parseInt(row.studentsCount, 10) : Number(row.studentsCount || 0),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

const SELECT = `
  SELECT c."id", c."name", c."subject", c."institutionId", c."teacherId",
         c."qrCode", c."room", c."grade", c."division", c."shift", c."activeActivityId",
         c."createdAt", c."updatedAt",
         i."name" AS "institutionName",
         u."name" AS "teacherName",
         (SELECT COUNT(*) FROM "Student" s WHERE s."courseId" = c."id") AS "studentsCount"
    FROM "Course" c
    LEFT JOIN "Institution" i ON i."id" = c."institutionId"
    LEFT JOIN "User" u ON u."id" = c."teacherId"
`;

export interface CourseRepository {
  findById(id: string): Promise<Course | null>;
  findByQrCode(qrCode: string): Promise<Course | null>;
  findByTeacher(teacherId: string): Promise<Course[]>;
  findByInstitution(institutionId: string): Promise<Course[]>;
  create(input: CreateCourseInput): Promise<Course>;
  setActiveActivity(courseId: string, activityId: string): Promise<void>;
  assignTeacher(courseId: string, teacherId: string): Promise<Course>;
  setTeacherCourses(institutionId: string, teacherId: string, courseIds: string[]): Promise<Course[]>;
}

export class SqlCourseRepository implements CourseRepository {
  async findById(id: string): Promise<Course | null> {
    const row = await queryOne<CourseRow>(`${SELECT} WHERE c."id" = $1`, [id]);
    return row ? toDomain(row) : null;
  }

  async findByQrCode(qrCode: string): Promise<Course | null> {
    const cleanCode = qrCode.trim().toUpperCase();
    const row = await queryOne<CourseRow>(
      `${SELECT} WHERE UPPER(c."qrCode") = $1 OR c."id" = $2`,
      [cleanCode, qrCode.trim()]
    );
    return row ? toDomain(row) : null;
  }

  async findByTeacher(teacherId: string): Promise<Course[]> {
    const rows = await query<CourseRow>(
      `${SELECT}
       WHERE c."teacherId" = $1
          OR c."id" IN (SELECT "courseId" FROM "CourseTeacher" WHERE "teacherId" = $1)
       ORDER BY c."name" ASC`,
      [teacherId]
    );
    return rows.map(toDomain);
  }

  async findByInstitution(institutionId: string): Promise<Course[]> {
    const rows = await query<CourseRow>(`${SELECT} WHERE c."institutionId" = $1 ORDER BY c."name" ASC`, [institutionId]);
    return rows.map(toDomain);
  }

  async create(input: CreateCourseInput): Promise<Course> {
    const cleanDivision = (input.division || 'A').toUpperCase().trim();
    const cleanGrade = (input.grade || '').replace(/\s+/g, '').toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const qrCode =
      input.qrCode ||
      `AULA-${cleanGrade ? cleanGrade + '-' : ''}${cleanDivision}-${randomSuffix}`;

    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO "Course" (
        "name", "subject", "institutionId", "teacherId",
        "qrCode", "room", "grade", "division", "shift"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING "id"`,
      [
        input.name,
        input.subject,
        input.institutionId,
        input.teacherId,
        qrCode,
        input.room || '',
        input.grade || '',
        cleanDivision,
        input.shift || 'MAÑANA',
      ]
    );

    // Sincronizar en CourseTeacher
    await query(
      `INSERT INTO "CourseTeacher" ("courseId", "teacherId", "roleInCourse")
       VALUES ($1, $2, 'TITULAR')
       ON CONFLICT ("courseId", "teacherId") DO NOTHING`,
      [inserted!.id, input.teacherId]
    );

    const full = await this.findById(inserted!.id);
    return full!;
  }

  async setActiveActivity(courseId: string, activityId: string): Promise<void> {
    await query(
      `UPDATE "Course" SET "activeActivityId" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [activityId, courseId]
    );
  }

  async assignTeacher(courseId: string, teacherId: string): Promise<Course> {
    await query(
      `UPDATE "Course" SET "teacherId" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [teacherId, courseId]
    );
    await query(
      `INSERT INTO "CourseTeacher" ("courseId", "teacherId", "roleInCourse")
       VALUES ($1, $2, 'TITULAR')
       ON CONFLICT ("courseId", "teacherId") DO NOTHING`,
      [courseId, teacherId]
    );
    const updated = await this.findById(courseId);
    return updated!;
  }

  async setTeacherCourses(institutionId: string, teacherId: string, courseIds: string[]): Promise<Course[]> {
    // 1. Desvincular cursos previos de este docente en esta institución
    await query(
      `DELETE FROM "CourseTeacher"
        WHERE "teacherId" = $1
          AND "courseId" IN (SELECT "id" FROM "Course" WHERE "institutionId" = $2)`,
      [teacherId, institutionId]
    );

    // 2. Asociar los cursos seleccionados
    for (const courseId of courseIds) {
      await query(
        `INSERT INTO "CourseTeacher" ("courseId", "teacherId", "roleInCourse")
         VALUES ($1, $2, 'TITULAR')
         ON CONFLICT ("courseId", "teacherId") DO NOTHING`,
        [courseId, teacherId]
      );
      await query(
        `UPDATE "Course"
            SET "teacherId" = $1, "updatedAt" = now()
          WHERE "id" = $2 AND "institutionId" = $3`,
        [teacherId, courseId, institutionId]
      );
    }

    return this.findByTeacher(teacherId);
  }
}

export const courseRepository = new SqlCourseRepository();
