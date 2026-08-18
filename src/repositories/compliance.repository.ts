import { queryOne, query } from '../config/db';
import type { ArcoStudentRecord, AuditLogEntry, ConsentAcceptance, ConsentDocument } from '../domain/compliance';
import type { AuditOperation } from '../domain/enums';

export interface CreateAuditLogInput {
  studentId: string | null;
  studentName: string;
  operation: AuditOperation;
  performedBy: string;
  performedById?: string;
}

export interface ComplianceRepository {
  searchArcoStudents(institutionId: string, query: string): Promise<ArcoStudentRecord[]>;
  getAuditLog(institutionId: string): Promise<AuditLogEntry[]>;
  createAuditLogEntry(input: CreateAuditLogInput): Promise<AuditLogEntry>;
  deleteStudent(studentId: string): Promise<void>;
  getConsentDocument(): Promise<ConsentDocument | null>;
  createConsentAcceptance(institutionId: string, acceptedBy: string, documentVersion: string): Promise<ConsentAcceptance>;
}

interface AuditLogRow {
  id: string;
  studentId: string | null;
  studentName: string;
  operation: AuditOperation;
  performedBy: string;
  date: Date;
}

export class SqlComplianceRepository implements ComplianceRepository {
  async searchArcoStudents(institutionId: string, search: string): Promise<ArcoStudentRecord[]> {
    const rows = await query<{
      id: string;
      name: string;
      courseName: string;
      activitiesCount: string;
      lastActivityDate: Date | null;
    }>(
      `SELECT s."id", s."name", c."name" AS "courseName",
              COALESCE(rc."cnt", 0) AS "activitiesCount",
              lr."createdAt" AS "lastActivityDate"
         FROM "Student" s
         JOIN "Course" c ON c."id" = s."courseId"
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS cnt FROM "StudentResult" sr WHERE sr."studentId" = s."id"
         ) rc ON true
         LEFT JOIN LATERAL (
           SELECT "createdAt" FROM "StudentResult" sr2 WHERE sr2."studentId" = s."id"
            ORDER BY "createdAt" DESC LIMIT 1
         ) lr ON true
        WHERE c."institutionId" = $1
          AND ($2 = '' OR s."name" LIKE '%' || $2 || '%')`,
      [institutionId, search ?? ''],
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      courseName: row.courseName,
      activitiesCount: Number(row.activitiesCount),
      lastActivityDate: row.lastActivityDate ? row.lastActivityDate.toISOString().slice(0, 10) : null,
    }));
  }

  async getAuditLog(institutionId: string): Promise<AuditLogEntry[]> {
    const rows = await query<AuditLogRow>(
      `SELECT DISTINCT ale.* FROM "AuditLogEntry" ale
         LEFT JOIN "Student" s ON s."id" = ale."studentId"
         LEFT JOIN "Course" c ON c."id" = s."courseId"
         LEFT JOIN "User" u ON u."id" = ale."performedById"
        WHERE c."institutionId" = $1 OR u."institutionId" = $1
        ORDER BY ale."date" DESC`,
      [institutionId],
    );
    return rows;
  }

  async createAuditLogEntry(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    const row = await queryOne<AuditLogRow>(
      `INSERT INTO "AuditLogEntry" ("studentId", "studentName", "operation", "performedBy", "performedById")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.studentId, input.studentName, input.operation, input.performedBy, input.performedById ?? null],
    );
    return row!;
  }

  async deleteStudent(studentId: string): Promise<void> {
    await query('DELETE FROM "Student" WHERE "id" = $1', [studentId]);
  }

  async getConsentDocument(): Promise<ConsentDocument | null> {
    return queryOne<ConsentDocument>('SELECT * FROM "ConsentDocument" ORDER BY "publishedAt" DESC LIMIT 1');
  }

  async createConsentAcceptance(institutionId: string, acceptedBy: string, documentVersion: string): Promise<ConsentAcceptance> {
    const row = await queryOne<ConsentAcceptance>(
      `INSERT INTO "ConsentAcceptance" ("institutionId", "acceptedBy", "documentVersion")
       VALUES ($1, $2, $3)
       RETURNING *`,
      [institutionId, acceptedBy, documentVersion],
    );
    return row!;
  }
}

export const complianceRepository = new SqlComplianceRepository();
