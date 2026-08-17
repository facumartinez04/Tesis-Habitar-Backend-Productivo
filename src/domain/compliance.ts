import type { AuditOperation } from './enums';

export interface AuditLogEntry {
  id: string;
  studentId: string | null;
  studentName: string;
  operation: AuditOperation;
  performedBy: string;
  date: Date;
}

export interface ArcoStudentRecord {
  id: string;
  name: string;
  courseName: string;
  activitiesCount: number;
  lastActivityDate: string | null;
}

export interface ConsentDocument {
  version: string;
  publishedAt: string;
  dataController: string;
  dataProcessor: string;
}

export interface ConsentAcceptance {
  institutionId: string;
  acceptedBy: string;
  acceptedAt: Date;
  documentVersion: string;
}

export interface RetentionPolicy {
  institutionId: string;
  retentionMonths: number;
  lastPurgeAt: Date | null;
}

export interface PurgeResult {
  purgedStudentCount: number;
  purgedAt: Date;
}
