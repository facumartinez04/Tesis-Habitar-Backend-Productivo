import { query, queryOne } from '../config/db';
import type { PerformanceAlert } from '../domain/alert';

interface AlertRow {
  id: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  axis: PerformanceAlert['axis'];
  currentValue: number;
  threshold: number;
  severity: PerformanceAlert['severity'];
  detectedAt: string;
  message: string;
}

function toDomain(row: AlertRow): PerformanceAlert {
  return { ...row };
}

export interface AlertRepository {
  findByInstitution(institutionId: string): Promise<PerformanceAlert[]>;
  countOpenByInstitution(institutionId: string): Promise<number>;
}

export class SqlAlertRepository implements AlertRepository {
  async findByInstitution(institutionId: string): Promise<PerformanceAlert[]> {
    const rows = await query<AlertRow>(
      `SELECT pa.*, c."name" AS "courseName", u."name" AS "teacherName"
         FROM "PerformanceAlert" pa
         JOIN "Course" c ON c."id" = pa."courseId"
         JOIN "User" u ON u."id" = c."teacherId"
        WHERE c."institutionId" = $1`,
      [institutionId],
    );
    return rows.map(toDomain);
  }

  async countOpenByInstitution(institutionId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM "PerformanceAlert" pa
         JOIN "Course" c ON c."id" = pa."courseId"
        WHERE c."institutionId" = $1 AND pa."severity" <> 'RESUELTA'`,
      [institutionId],
    );
    return Number(row?.count ?? 0);
  }
}

export const alertRepository = new SqlAlertRepository();
