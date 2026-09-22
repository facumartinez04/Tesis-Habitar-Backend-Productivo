import { complianceRepository } from '../repositories/compliance.repository';
import { studentRepository } from '../repositories/student.repository';
import { retentionRepository } from '../repositories/retention.repository';
import { NotFoundError } from '../utils/http-error';
import type { ArcoStudentRecord, AuditLogEntry, ConsentAcceptance, ConsentDocument, PurgeResult, RetentionPolicy } from '../domain/compliance';

export interface ComplianceService {
  searchArcoStudents(institutionId: string, query: string): Promise<ArcoStudentRecord[]>;
  getAuditLog(institutionId: string): Promise<AuditLogEntry[]>;
  exportStudentData(institutionId: string, studentId: string, performedBy: string, performedById?: string): Promise<ArcoStudentRecord>;
  deleteStudentData(institutionId: string, studentId: string, performedBy: string, performedById?: string): Promise<void>;
  getConsentDocument(): Promise<ConsentDocument>;
  acceptConsent(institutionId: string, acceptedBy: string): Promise<ConsentAcceptance>;
  getRetentionPolicy(institutionId: string): Promise<RetentionPolicy>;
  updateRetentionPolicy(institutionId: string, retentionMonths: number): Promise<RetentionPolicy>;
  purgeExpiredData(institutionId: string, performedBy: string, performedById?: string): Promise<PurgeResult>;
}

export class DefaultComplianceService implements ComplianceService {
  async searchArcoStudents(institutionId: string, query: string): Promise<ArcoStudentRecord[]> {
    return complianceRepository.searchArcoStudents(institutionId, query);
  }

  async getAuditLog(institutionId: string): Promise<AuditLogEntry[]> {
    return complianceRepository.getAuditLog(institutionId);
  }

  async exportStudentData(institutionId: string, studentId: string, performedBy: string, performedById?: string): Promise<ArcoStudentRecord> {
    const students = await complianceRepository.searchArcoStudents(institutionId, '');
    const student = students.find((s) => s.id === studentId);
    if (!student) throw new NotFoundError('Alumno no encontrado');

    await complianceRepository.createAuditLogEntry({
      studentId,
      studentName: student.name,
      operation: 'EXPORTACION',
      performedBy,
      performedById,
    });

    return student;
  }

  async deleteStudentData(_institutionId: string, studentId: string, performedBy: string, performedById?: string): Promise<void> {
    const student = await studentRepository.findById(studentId);
    if (!student) throw new NotFoundError('Alumno no encontrado');

    await complianceRepository.createAuditLogEntry({
      studentId: null,
      studentName: student.name,
      operation: 'ELIMINACION',
      performedBy,
      performedById,
    });

    await complianceRepository.deleteStudent(studentId);
  }

  async getConsentDocument(): Promise<ConsentDocument> {
    const document = await complianceRepository.getConsentDocument();
    if (!document) throw new NotFoundError('No hay documento de consentimiento publicado');
    return document;
  }

  async acceptConsent(institutionId: string, acceptedBy: string): Promise<ConsentAcceptance> {
    const document = await this.getConsentDocument();
    const acceptance = await complianceRepository.createConsentAcceptance(institutionId, acceptedBy, document.version);

    await complianceRepository.createAuditLogEntry({
      studentId: null,
      studentName: acceptedBy,
      operation: 'CONSENTIMIENTO',
      performedBy: acceptedBy,
    });

    return acceptance;
  }

  async getRetentionPolicy(institutionId: string) {
    return retentionRepository.get(institutionId);
  }

  async updateRetentionPolicy(institutionId: string, retentionMonths: number) {
    return retentionRepository.setRetentionMonths(institutionId, retentionMonths);
  }

  async purgeExpiredData(institutionId: string, performedBy: string, performedById?: string): Promise<PurgeResult> {
    const policy = await retentionRepository.get(institutionId);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - policy.retentionMonths);

    const eligible = await retentionRepository.findStudentsEligibleForPurge(institutionId, cutoff);

    for (const student of eligible) {
      await complianceRepository.createAuditLogEntry({
        studentId: null,
        studentName: student.name,
        operation: 'ELIMINACION',
        performedBy: `${performedBy} (purga por retención)`,
        performedById,
      });
    }

    const purgedStudentCount = await retentionRepository.deleteStudents(eligible.map((s) => s.id));
    await retentionRepository.markPurged(institutionId);

    return { purgedStudentCount, purgedAt: new Date() };
  }
}

export const complianceService = new DefaultComplianceService();
