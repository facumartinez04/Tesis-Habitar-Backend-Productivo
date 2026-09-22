import { resultRepository } from '../repositories/result.repository';
import { courseRepository } from '../repositories/course.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { studentRepository } from '../repositories/student.repository';
import { userRepository } from '../repositories/user.repository';
import { complianceRepository } from '../repositories/compliance.repository';
import { NotFoundError, BadRequestError } from '../utils/http-error';
import type {
  AxisScores,
  CourseResultSummary,
  DateRange,
  InstitutionResultSummary,
  PeriodComparison,
  PerformanceStatus,
  StudentDetailResult,
} from '../domain/result';

function classify(scores: AxisScores | null): PerformanceStatus {
  if (!scores) return 'SIN_DATOS';
  const values = [scores.literal, scores.inferencial, scores.critico];
  if (values.some((v) => v < 40)) return 'BAJO';
  if (values.some((v) => v < 60)) return 'REGULAR';
  return 'BIEN';
}

export interface ResultService {
  getCourseSummary(courseId: string): Promise<CourseResultSummary>;
  getInstitutionSummary(institutionId: string): Promise<InstitutionResultSummary>;
  getStudentDetail(studentId: string): Promise<StudentDetailResult>;

  comparePeriods(courseId: string, periodA: DateRange, periodB: DateRange): Promise<PeriodComparison>;

  exportCourseReportCsv(courseId: string, performedBy: string, performedById?: string): Promise<string>;
}

export class DefaultResultService implements ResultService {
  async getCourseSummary(courseId: string): Promise<CourseResultSummary> {
    const course = await courseRepository.findById(courseId);
    if (!course) throw new NotFoundError('Curso no encontrado');

    const [teacher, students, averages, activityCount, rawRows] = await Promise.all([
      userRepository.findById(course.teacherId),
      studentRepository.findByCourse(courseId),
      resultRepository.getCourseAverages(courseId),
      resultRepository.getCourseActivityCount(courseId),
      resultRepository.getCourseLatestScoresPerStudent(courseId),
    ]);

    const rows = rawRows.map((row) => {
      const scores = row.literal === null ? null : { literal: row.literal, inferencial: row.inferencial ?? 0, critico: row.critico ?? 0 };
      return {
        studentId: row.studentId,
        studentName: row.studentName,
        scores,
        status: classify(scores),
      };
    });

    return {
      courseId: course.id,
      courseName: course.name,
      teacherName: teacher?.name ?? '',
      studentCount: students.length,
      activityCount,
      averages,
      status: activityCount === 0 ? 'SIN_DATOS' : classify(averages),
      rows,
    };
  }

  async getInstitutionSummary(institutionId: string): Promise<InstitutionResultSummary> {
    const institution = await institutionRepository.findById(institutionId);
    if (!institution) throw new NotFoundError('Institución no encontrada');

    const courses = await courseRepository.findByInstitution(institutionId);
    const [averages, totalActivities, courseSummaries] = await Promise.all([
      resultRepository.getInstitutionAverages(institutionId),
      resultRepository.getInstitutionActivityCount(institutionId),
      Promise.all(courses.map((course) => this.getCourseSummary(course.id))),
    ]);

    return {
      institutionId,
      institutionName: institution.name,
      averages,
      totalActivities,
      courses: courseSummaries,
    };
  }

  async getStudentDetail(studentId: string): Promise<StudentDetailResult> {
    const student = await studentRepository.findById(studentId);
    if (!student) throw new NotFoundError('Alumno no encontrado');

    const course = await courseRepository.findById(student.courseId);
    const history = await resultRepository.getStudentHistory(studentId);

    const latestScores = history[0] ? { literal: history[0].literal, inferencial: history[0].inferencial, critico: history[0].critico } : null;

    const trend = [...history]
      .reverse()
      .map((row) => ({
        label: row.date.toLocaleDateString('es-AR', { month: 'short', day: '2-digit' }),
        literal: row.literal,
        inferencial: row.inferencial,
        critico: row.critico,
      }));

    return {
      studentId: student.id,
      name: student.name,
      initials: student.initials,
      courseId: student.courseId,
      courseName: course?.name ?? '',
      activitiesAnswered: history.length,
      status: classify(latestScores),
      trend,
      history: history.map((row) => ({
        activityName: row.activityName,
        date: row.date.toISOString().slice(0, 10),
        scores: { literal: row.literal, inferencial: row.inferencial, critico: row.critico },
      })),
    };
  }

  async comparePeriods(courseId: string, periodA: DateRange, periodB: DateRange): Promise<PeriodComparison> {
    const course = await courseRepository.findById(courseId);
    if (!course) throw new NotFoundError('Curso no encontrado');

    const [fromA, toA, fromB, toB] = [periodA.from, periodA.to, periodB.from, periodB.to].map((d) => new Date(d));
    if ([fromA, toA, fromB, toB].some((d) => Number.isNaN(d.getTime()))) {
      throw new BadRequestError('Las fechas de los períodos a comparar son inválidas');
    }

    const [averagesA, averagesB] = await Promise.all([
      resultRepository.getCourseAveragesBetween(courseId, fromA, toA),
      resultRepository.getCourseAveragesBetween(courseId, fromB, toB),
    ]);

    return {
      courseId,
      courseName: course.name,
      periodA: { range: periodA, averages: averagesA },
      periodB: { range: periodB, averages: averagesB },
      delta: {
        literal: averagesB.literal - averagesA.literal,
        inferencial: averagesB.inferencial - averagesA.inferencial,
        critico: averagesB.critico - averagesA.critico,
      },
    };
  }

  async exportCourseReportCsv(courseId: string, performedBy: string, performedById?: string): Promise<string> {
    const summary = await this.getCourseSummary(courseId);

    const header = 'Alumno,Literal,Inferencial,Crítico,Estado';
    const rows = summary.rows.map((row) =>
      [
        csvEscape(row.studentName),
        row.scores?.literal ?? '',
        row.scores?.inferencial ?? '',
        row.scores?.critico ?? '',
        row.status,
      ].join(','),
    );

    await complianceRepository.createAuditLogEntry({
      studentId: null,
      studentName: `Curso ${summary.courseName} (reporte de desempeño)`,
      operation: 'EXPORTACION',
      performedBy,
      performedById,
    });

    return [header, ...rows].join('\n');
  }
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const resultService = new DefaultResultService();
