import { prisma } from '../config/prisma';
import type { RetentionPolicy } from '../domain/compliance';

function toDomain(record: { institutionId: string; retentionMonths: number; lastPurgeAt: Date | null }): RetentionPolicy {
  return { institutionId: record.institutionId, retentionMonths: record.retentionMonths, lastPurgeAt: record.lastPurgeAt };
}

export interface RetentionRepository {
  get(institutionId: string): Promise<RetentionPolicy>;
  setRetentionMonths(institutionId: string, months: number): Promise<RetentionPolicy>;
  markPurged(institutionId: string): Promise<void>;

  findStudentsEligibleForPurge(institutionId: string, cutoff: Date): Promise<{ id: string; name: string }[]>;
  deleteStudents(ids: string[]): Promise<number>;
}

const DEFAULT_RETENTION_MONTHS = 24;

export class PrismaRetentionRepository implements RetentionRepository {
  async get(institutionId: string): Promise<RetentionPolicy> {
    const record = await prisma.retentionPolicy.upsert({
      where: { institutionId },
      create: { institutionId, retentionMonths: DEFAULT_RETENTION_MONTHS },
      update: {},
    });
    return toDomain(record);
  }

  async setRetentionMonths(institutionId: string, months: number): Promise<RetentionPolicy> {
    const record = await prisma.retentionPolicy.upsert({
      where: { institutionId },
      create: { institutionId, retentionMonths: months },
      update: { retentionMonths: months },
    });
    return toDomain(record);
  }

  async markPurged(institutionId: string): Promise<void> {
    await prisma.retentionPolicy.update({ where: { institutionId }, data: { lastPurgeAt: new Date() } });
  }

  async findStudentsEligibleForPurge(institutionId: string, cutoff: Date): Promise<{ id: string; name: string }[]> {
    return prisma.student.findMany({
      where: { course: { institutionId }, createdAt: { lt: cutoff } },
      select: { id: true, name: true },
    });
  }

  async deleteStudents(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await prisma.student.deleteMany({ where: { id: { in: ids } } });
    return result.count;
  }
}

export const retentionRepository = new PrismaRetentionRepository();
