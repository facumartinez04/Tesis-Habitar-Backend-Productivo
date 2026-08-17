import { prisma } from '../config/prisma';
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

export class PrismaComplianceRepository implements ComplianceRepository {
  async searchArcoStudents(institutionId: string, query: string): Promise<ArcoStudentRecord[]> {
    const students = await prisma.student.findMany({
      where: {
        course: { institutionId },
        ...(query ? { name: { contains: query } } : {}),
      },
      include: {
        course: { select: { name: true } },
        results: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { results: true } },
      },
    });

    return students.map((student) => ({
      id: student.id,
      name: student.name,
      courseName: student.course.name,
      activitiesCount: student._count.results,
      lastActivityDate: student.results[0]?.createdAt.toISOString().slice(0, 10) ?? null,
    }));
  }

  async getAuditLog(institutionId: string): Promise<AuditLogEntry[]> {
    const records = await prisma.auditLogEntry.findMany({
      where: {
        OR: [{ student: { course: { institutionId } } }, { performer: { institutionId } }],
      },
      orderBy: { date: 'desc' },
    });

    return records.map((record) => ({
      id: record.id,
      studentId: record.studentId,
      studentName: record.studentName,
      operation: record.operation,
      performedBy: record.performedBy,
      date: record.date,
    }));
  }

  async createAuditLogEntry(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    const record = await prisma.auditLogEntry.create({
      data: {
        studentId: input.studentId,
        studentName: input.studentName,
        operation: input.operation,
        performedBy: input.performedBy,
        performedById: input.performedById,
      },
    });

    return {
      id: record.id,
      studentId: record.studentId,
      studentName: record.studentName,
      operation: record.operation,
      performedBy: record.performedBy,
      date: record.date,
    };
  }

  async deleteStudent(studentId: string): Promise<void> {
    await prisma.student.delete({ where: { id: studentId } });
  }

  async getConsentDocument(): Promise<ConsentDocument | null> {
    const record = await prisma.consentDocument.findFirst({ orderBy: { publishedAt: 'desc' } });
    if (!record) return null;
    return {
      version: record.version,
      publishedAt: record.publishedAt,
      dataController: record.dataController,
      dataProcessor: record.dataProcessor,
    };
  }

  async createConsentAcceptance(institutionId: string, acceptedBy: string, documentVersion: string): Promise<ConsentAcceptance> {
    const record = await prisma.consentAcceptance.create({
      data: { institutionId, acceptedBy, documentVersion },
    });

    return {
      institutionId: record.institutionId,
      acceptedBy: record.acceptedBy,
      acceptedAt: record.acceptedAt,
      documentVersion: record.documentVersion,
    };
  }
}

export const complianceRepository = new PrismaComplianceRepository();
