import { query, queryOne } from '../config/db';
import type { Course, CourseStudentDevice, CourseTeacher, CreateCourseInput } from '../domain/course';
import { randomUUID } from 'crypto';

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
  findStudentDevice(courseId: string, normalizedStudentName: string): Promise<CourseStudentDevice | null>;
  findDeviceById(courseId: string, deviceRecordId: string): Promise<CourseStudentDevice | null>;
  bindStudentDevice(input: { courseId: string; studentName: string; normalizedStudentName: string; deviceId: string; userAgent?: string; ipAddress?: string }): Promise<CourseStudentDevice>;
  updateDeviceLastActive(id: string): Promise<void>;
  listStudentDevices(courseId: string): Promise<CourseStudentDevice[]>;
  unlinkStudentDevice(courseId: string, deviceRecordId: string): Promise<boolean>;
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
    const division = (input.division || 'A').toUpperCase().trim();
    const gradeNum = (input.grade || '').replace(/[^0-9]/g, '') || '0';
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const qrCode =
      input.qrCode ||
      `AULA-${gradeNum}${division}-${randomSuffix}`;

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
        division,
        input.shift || 'MAÑANA',
      ]
    );

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

    await query(
      `DELETE FROM "CourseTeacher"
        WHERE "teacherId" = $1
          AND "courseId" IN (SELECT "id" FROM "Course" WHERE "institutionId" = $2)`,
      [teacherId, institutionId]
    );

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

  async listCourseTeachers(courseId: string): Promise<CourseTeacher[]> {
    const rows = await query<CourseTeacher>(
      `SELECT ct."id", ct."courseId", ct."teacherId", ct."roleInCourse",
              ct."assignedAt"::text,
              u."name" AS "teacherName", u."email" AS "teacherEmail"
         FROM "CourseTeacher" ct
         JOIN "User" u ON u."id" = ct."teacherId"
        WHERE ct."courseId" = $1
        ORDER BY ct."assignedAt" ASC`,
      [courseId]
    );
    return rows;
  }

  async setCourseTeachers(courseId: string, teacherIds: string[]): Promise<CourseTeacher[]> {
    await query(`DELETE FROM "CourseTeacher" WHERE "courseId" = $1`, [courseId]);

    for (const teacherId of teacherIds) {
      await query(
        `INSERT INTO "CourseTeacher" ("courseId", "teacherId", "roleInCourse")
         VALUES ($1, $2, 'TITULAR')
         ON CONFLICT ("courseId", "teacherId") DO NOTHING`,
        [courseId, teacherId]
      );
    }

    const primary = teacherIds[0] || null;
    await query(
      `UPDATE "Course" SET "teacherId" = $1, "updatedAt" = now() WHERE "id" = $2`,
      [primary, courseId]
    );

    return this.listCourseTeachers(courseId);
  }

  async findStudentDevice(courseId: string, normalizedStudentName: string): Promise<CourseStudentDevice | null> {
    const row = await queryOne<CourseStudentDevice>(
      `SELECT "id", "courseId", "studentName", "normalizedStudentName", "deviceId", "userAgent", "ipAddress",
              "linkedAt"::text, "lastActiveAt"::text
         FROM "CourseStudentDevice"
        WHERE "courseId" = $1 AND "normalizedStudentName" = $2`,
      [courseId, normalizedStudentName]
    );
    return row || null;
  }

  async findDeviceById(courseId: string, deviceRecordId: string): Promise<CourseStudentDevice | null> {
    const row = await queryOne<CourseStudentDevice>(
      `SELECT "id", "courseId", "studentName", "normalizedStudentName", "deviceId", "userAgent", "ipAddress",
              "linkedAt"::text, "lastActiveAt"::text
         FROM "CourseStudentDevice"
        WHERE "courseId" = $1 AND "id" = $2`,
      [courseId, deviceRecordId]
    );
    return row || null;
  }

  async bindStudentDevice(input: {
    courseId: string;
    studentName: string;
    normalizedStudentName: string;
    deviceId: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<CourseStudentDevice> {
    const id = `csd_${randomUUID()}`;
    const row = await queryOne<CourseStudentDevice>(
      `INSERT INTO "CourseStudentDevice" (
         "id", "courseId", "studentName", "normalizedStudentName", "deviceId", "userAgent", "ipAddress"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING "id", "courseId", "studentName", "normalizedStudentName", "deviceId", "userAgent", "ipAddress",
                 "linkedAt"::text, "lastActiveAt"::text`,
      [
        id,
        input.courseId,
        input.studentName,
        input.normalizedStudentName,
        input.deviceId,
        input.userAgent || '',
        input.ipAddress || '',
      ]
    );
    return row!;
  }

  async updateDeviceLastActive(id: string): Promise<void> {
    await query(
      `UPDATE "CourseStudentDevice" SET "lastActiveAt" = now() WHERE "id" = $1`,
      [id]
    );
  }

  async listStudentDevices(courseId: string): Promise<CourseStudentDevice[]> {
    const rows = await query<CourseStudentDevice>(
      `SELECT "id", "courseId", "studentName", "normalizedStudentName", "deviceId", "userAgent", "ipAddress",
              "linkedAt"::text, "lastActiveAt"::text
         FROM "CourseStudentDevice"
        WHERE "courseId" = $1
        ORDER BY "studentName" ASC`,
      [courseId]
    );
    return rows;
  }

  async unlinkStudentDevice(courseId: string, deviceRecordId: string): Promise<boolean> {
    const deleted = await queryOne<{ id: string }>(
      `DELETE FROM "CourseStudentDevice" WHERE "courseId" = $1 AND "id" = $2 RETURNING "id"`,
      [courseId, deviceRecordId]
    );
    return Boolean(deleted);
  }
}

export const courseRepository = new SqlCourseRepository();
