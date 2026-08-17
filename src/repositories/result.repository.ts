import { prisma } from '../config/prisma';

export interface RawAxisAverages {
  literal: number;
  inferencial: number;
  critico: number;
}

export interface RawStudentResult {
  studentId: string;
  studentName: string;
  literal: number | null;
  inferencial: number | null;
  critico: number | null;
}

export interface RawResultHistoryRow {
  activityName: string;
  date: Date;
  literal: number;
  inferencial: number;
  critico: number;
}

export interface ResultRepository {
  getCourseAverages(courseId: string): Promise<RawAxisAverages>;
  getCourseActivityCount(courseId: string): Promise<number>;
  getCourseLatestScoresPerStudent(courseId: string): Promise<RawStudentResult[]>;
  getInstitutionAverages(institutionId: string): Promise<RawAxisAverages>;
  getInstitutionActivityCount(institutionId: string): Promise<number>;
  getStudentHistory(studentId: string): Promise<RawResultHistoryRow[]>;

  getCourseAveragesBetween(courseId: string, from: Date, to: Date): Promise<RawAxisAverages>;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export class PrismaResultRepository implements ResultRepository {
  async getCourseAverages(courseId: string): Promise<RawAxisAverages> {
    const results = await prisma.studentResult.findMany({
      where: { activity: { courseId } },
      select: { literalScore: true, inferencialScore: true, criticoScore: true },
    });
    return {
      literal: average(results.map((r) => r.literalScore)),
      inferencial: average(results.map((r) => r.inferencialScore)),
      critico: average(results.map((r) => r.criticoScore)),
    };
  }

  async getCourseActivityCount(courseId: string): Promise<number> {
    return prisma.activity.count({ where: { courseId } });
  }

  async getCourseLatestScoresPerStudent(courseId: string): Promise<RawStudentResult[]> {
    const students = await prisma.student.findMany({
      where: { courseId },
      include: {
        results: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return students.map((student) => {
      const latest = student.results[0];
      return {
        studentId: student.id,
        studentName: student.name,
        literal: latest?.literalScore ?? null,
        inferencial: latest?.inferencialScore ?? null,
        critico: latest?.criticoScore ?? null,
      };
    });
  }

  async getInstitutionAverages(institutionId: string): Promise<RawAxisAverages> {
    const results = await prisma.studentResult.findMany({
      where: { activity: { course: { institutionId } } },
      select: { literalScore: true, inferencialScore: true, criticoScore: true },
    });
    return {
      literal: average(results.map((r) => r.literalScore)),
      inferencial: average(results.map((r) => r.inferencialScore)),
      critico: average(results.map((r) => r.criticoScore)),
    };
  }

  async getInstitutionActivityCount(institutionId: string): Promise<number> {
    return prisma.activity.count({ where: { course: { institutionId } } });
  }

  async getCourseAveragesBetween(courseId: string, from: Date, to: Date): Promise<RawAxisAverages> {
    const results = await prisma.studentResult.findMany({
      where: { activity: { courseId }, createdAt: { gte: from, lte: to } },
      select: { literalScore: true, inferencialScore: true, criticoScore: true },
    });
    return {
      literal: average(results.map((r) => r.literalScore)),
      inferencial: average(results.map((r) => r.inferencialScore)),
      critico: average(results.map((r) => r.criticoScore)),
    };
  }

  async getStudentHistory(studentId: string): Promise<RawResultHistoryRow[]> {
    const results = await prisma.studentResult.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: { activity: { select: { name: true } } },
    });

    return results.map((result) => ({
      activityName: result.activity.name,
      date: result.createdAt,
      literal: result.literalScore,
      inferencial: result.inferencialScore,
      critico: result.criticoScore,
    }));
  }
}

export const resultRepository = new PrismaResultRepository();
