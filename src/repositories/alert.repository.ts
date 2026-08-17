import type { PerformanceAlert as PrismaAlert } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { PerformanceAlert } from '../domain/alert';

type PrismaAlertWithCourse = PrismaAlert & { course: { name: string; teacher: { name: string } } };

function toDomain(record: PrismaAlertWithCourse): PerformanceAlert {
  return {
    id: record.id,
    courseId: record.courseId,
    courseName: record.course.name,
    teacherName: record.course.teacher.name,
    axis: record.axis,
    currentValue: record.currentValue,
    threshold: record.threshold,
    severity: record.severity,
    detectedAt: record.detectedAt,
    message: record.message,
  };
}

export interface AlertRepository {
  findByInstitution(institutionId: string): Promise<PerformanceAlert[]>;
  countOpenByInstitution(institutionId: string): Promise<number>;
}

export class PrismaAlertRepository implements AlertRepository {
  async findByInstitution(institutionId: string): Promise<PerformanceAlert[]> {
    const records = await prisma.performanceAlert.findMany({
      where: { course: { institutionId } },
      include: { course: { select: { name: true, teacher: { select: { name: true } } } } },
    });
    return records.map(toDomain);
  }

  async countOpenByInstitution(institutionId: string): Promise<number> {
    return prisma.performanceAlert.count({
      where: { course: { institutionId }, severity: { not: 'RESUELTA' } },
    });
  }
}

export const alertRepository = new PrismaAlertRepository();
