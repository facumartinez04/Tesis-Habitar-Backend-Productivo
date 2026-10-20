import { resultRepository, type RawDiagnosticRow } from '../dal/result.repository';
import { courseRepository } from '../dal/course.repository';
import { institutionRepository } from '../dal/institution.repository';
import { studentRepository } from '../dal/student.repository';
import { userRepository } from '../dal/user.repository';
import { complianceRepository } from '../dal/compliance.repository';
import { alertRepository } from '../dal/alert.repository';
import { NotFoundError, BadRequestError } from '../utils/http-error';
import type {
  AxisRecommendation,
  AxisScores,
  CourseResultSummary,
  DateRange,
  DiagnosticComparison,
  DiagnosticStudentRow,
  InstitutionResultSummary,
  PeriodComparison,
  PerformanceStatus,
  Score,
  StudentDetailResult,
} from '../domain/result';

export function classify(scores: AxisScores | null): PerformanceStatus {
  if (!scores) return 'SIN_DATOS';
  const values = [scores.literal, scores.inferencial, scores.critico].filter((v): v is number => v !== null);
  if (values.length === 0) return 'SIN_DATOS';
  if (values.some((v) => v < 40)) return 'BAJO';
  if (values.some((v) => v < 60)) return 'REGULAR';
  return 'BIEN';
}

function diff(b: Score, a: Score): Score {
  return a === null || b === null ? null : b - a;
}

function deltaOf(a: AxisScores, b: AxisScores): AxisScores {
  return { literal: diff(b.literal, a.literal), inferencial: diff(b.inferencial, a.inferencial), critico: diff(b.critico, a.critico) };
}

function mean(values: Score[]): Score {
  const measured = values.filter((v): v is number => v !== null);
  return measured.length === 0 ? null : Math.round(measured.reduce((s, v) => s + v, 0) / measured.length);
}

function meanScores(rows: AxisScores[]): AxisScores {
  return {
    literal: mean(rows.map((r) => r.literal)),
    inferencial: mean(rows.map((r) => r.inferencial)),
    critico: mean(rows.map((r) => r.critico)),
  };
}

const AXIS_LABEL = { LITERAL: 'literal', INFERENCIAL: 'inferencial', CRITICO: 'crítico' } as const;

export interface ResultService {
  getCourseSummary(courseId: string): Promise<CourseResultSummary>;
  getInstitutionSummary(institutionId: string): Promise<InstitutionResultSummary>;
  getStudentDetail(studentId: string): Promise<StudentDetailResult>;
  comparePeriods(courseId: string, periodA: DateRange, periodB: DateRange): Promise<PeriodComparison>;
  getDiagnostic(courseId: string): Promise<DiagnosticComparison>;
  getRecommendation(courseId: string): Promise<AxisRecommendation>;
  exportCourseReportCsv(courseId: string, performedBy: string, performedById?: string): Promise<string>;
}

export class DefaultResultService implements ResultService {
  async getCourseSummary(courseId: string): Promise<CourseResultSummary> {
    const course = await courseRepository.findById(courseId);
    if (!course) throw new NotFoundError('Curso no encontrado');

    const [teacher, students, averages, activityCount, rawRows, pendingReviews] = await Promise.all([
      userRepository.findById(course.teacherId),
      studentRepository.findByCourse(courseId),
      resultRepository.getCourseAverages(courseId),
      resultRepository.getCourseActivityCount(courseId),
      resultRepository.getCourseLatestScoresPerStudent(courseId),
      resultRepository.countPendingReviewsByCourse(courseId),
    ]);

    const rows = rawRows.map((row) => {
      const measured = row.literal !== null || row.inferencial !== null || row.critico !== null;
      const scores = measured ? { literal: row.literal, inferencial: row.inferencial, critico: row.critico } : null;
      return {
        studentId: row.studentId,
        studentName: row.studentName,
        scores,
        status: classify(scores),
        criticoPending: !row.criticoReviewed,
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
      pendingReviews,
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

    const latestScores = history[0]
      ? { literal: history[0].literal, inferencial: history[0].inferencial, critico: history[0].critico }
      : null;

    const trend = [...history].reverse().map((row) => ({
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
      delta: deltaOf(averagesA, averagesB),
    };
  }

  async getDiagnostic(courseId: string): Promise<DiagnosticComparison> {
    const course = await courseRepository.findById(courseId);
    if (!course) throw new NotFoundError('Curso no encontrado');

    const { inicio, cierre } = await resultRepository.getDiagnosticActivities(courseId);
    const refs = [
      ...(inicio ? [{ id: inicio.activityId, kind: 'INICIO' as const }] : []),
      ...(cierre ? [{ id: cierre.activityId, kind: 'CIERRE' as const }] : []),
    ];
    const rows = await resultRepository.getLatestResultsForActivities(refs);

    const scoresOf = (row: RawDiagnosticRow | undefined): AxisScores | null =>
      row ? { literal: row.literal, inferencial: row.inferencial, critico: row.critico } : null;

    const byStudent = new Map<string, { name: string; inicio?: RawDiagnosticRow; cierre?: RawDiagnosticRow }>();
    for (const row of rows) {
      const entry = byStudent.get(row.studentId) ?? { name: row.studentName };
      if (row.kind === 'INICIO') entry.inicio = row;
      else entry.cierre = row;
      byStudent.set(row.studentId, entry);
    }

    const students: DiagnosticStudentRow[] = [];
    const incomplete: DiagnosticStudentRow[] = [];
    for (const [studentId, entry] of byStudent) {
      const a = scoresOf(entry.inicio);
      const b = scoresOf(entry.cierre);
      const row = { studentId, studentName: entry.name, inicio: a, cierre: b, delta: a && b ? deltaOf(a, b) : null };
      (a && b ? students : incomplete).push(row);
    }
    students.sort((x, y) => x.studentName.localeCompare(y.studentName, 'es', { numeric: true }));
    incomplete.sort((x, y) => x.studentName.localeCompare(y.studentName, 'es', { numeric: true }));

    let courseAverages: DiagnosticComparison['course'] = null;
    if (students.length > 0) {
      const avgInicio = meanScores(students.map((s) => s.inicio!));
      const avgCierre = meanScores(students.map((s) => s.cierre!));
      courseAverages = { inicio: avgInicio, cierre: avgCierre, delta: deltaOf(avgInicio, avgCierre) };
    }

    return { courseId, courseName: course.name, inicio, cierre, course: courseAverages, students, incomplete };
  }

  async getRecommendation(courseId: string): Promise<AxisRecommendation> {
    const course = await courseRepository.findById(courseId);
    if (!course) throw new NotFoundError('Curso no encontrado');
    const institution = await institutionRepository.findById(course.institutionId);
    const threshold = institution?.alertThreshold ?? 60;

    const recent = await alertRepository.recentCourseAverages(courseId, 5);
    const averages: AxisScores = { literal: recent.LITERAL, inferencial: recent.INFERENCIAL, critico: recent.CRITICO };

    const measured = (Object.keys(recent) as (keyof typeof recent)[])
      .filter((axis) => recent[axis] !== null)
      .sort((a, b) => (recent[a] as number) - (recent[b] as number));

    if (measured.length === 0) {
      return { courseId, threshold, averages, focusAxis: null, message: 'Todavía no hay resultados para sugerir un eje.' };
    }
    const lowest = measured[0];
    const value = recent[lowest] as number;
    if (value >= threshold) {
      return {
        courseId,
        threshold,
        averages,
        focusAxis: null,
        message: `El curso supera el umbral de ${threshold} en todos los ejes medidos.`,
      };
    }
    return {
      courseId,
      threshold,
      averages,
      focusAxis: lowest,
      message:
        `El eje ${AXIS_LABEL[lowest]} promedia ${value} en las últimas actividades, debajo del umbral de ${threshold}. ` +
        'Conviene una actividad de refuerzo con ese eje como foco.',
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
        row.criticoPending ? 'pendiente' : row.scores?.critico ?? '',
        row.status,
      ].join(','),
    );

    const course = await courseRepository.findById(courseId);
    await complianceRepository.createAuditLogEntry({
      institutionId: course!.institutionId,
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
