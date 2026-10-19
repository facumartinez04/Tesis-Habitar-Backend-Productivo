/** Puntaje de 0 a 100, o null si el eje no se midió en ese intento. */
export type Score = number | null;

export interface AxisScores {
  literal: Score;
  inferencial: Score;
  critico: Score;
}

export type PerformanceStatus = 'BIEN' | 'REGULAR' | 'BAJO' | 'SIN_DATOS';

export interface StudentResultRow {
  studentId: string;
  studentName: string;
  scores: AxisScores | null;
  status: PerformanceStatus;
  /** El eje crítico del último intento espera la revisión del docente. */
  criticoPending: boolean;
}

export interface CourseResultSummary {
  courseId: string;
  courseName: string;
  teacherName: string;
  studentCount: number;
  activityCount: number;
  averages: AxisScores;
  status: PerformanceStatus;
  rows: StudentResultRow[];
  /** Respuestas abiertas del curso que esperan la revisión del docente. */
  pendingReviews: number;
}

export interface InstitutionResultSummary {
  institutionId: string;
  institutionName: string;
  averages: AxisScores;
  totalActivities: number;
  courses: CourseResultSummary[];
}

export interface StudentTrendPoint {
  label: string;
  literal: Score;
  inferencial: Score;
  critico: Score;
}

export interface StudentActivityHistoryRow {
  activityName: string;
  date: string;
  scores: AxisScores;
}

export interface StudentDetailResult {
  studentId: string;
  name: string;
  initials: string;
  courseId: string;
  courseName: string;
  activitiesAnswered: number;
  status: PerformanceStatus;
  trend: StudentTrendPoint[];
  history: StudentActivityHistoryRow[];
}

export interface DateRange {
  from: string;
  to: string;
}

export interface PeriodComparison {
  courseId: string;
  courseName: string;
  periodA: { range: DateRange; averages: AxisScores };
  periodB: { range: DateRange; averages: AxisScores };
  delta: AxisScores;
}

export interface DiagnosticStudentRow {
  studentId: string;
  studentName: string;
  inicio: AxisScores | null;
  cierre: AxisScores | null;
  /** cierre − inicio por eje; null si falta alguna de las dos o el eje no se midió. */
  delta: AxisScores | null;
}

export interface DiagnosticComparison {
  courseId: string;
  courseName: string;
  inicio: { activityId: string; name: string; date: string } | null;
  cierre: { activityId: string; name: string; date: string } | null;
  /** Promedio del curso entre los alumnos que respondieron las dos diagnósticas. */
  course: { inicio: AxisScores; cierre: AxisScores; delta: AxisScores } | null;
  /** Alumnos con las dos diagnósticas respondidas. */
  students: DiagnosticStudentRow[];
  /** Alumnos que respondieron sólo una: se muestran aparte, sin inventar el dato que falta. */
  incomplete: DiagnosticStudentRow[];
}

export interface AxisRecommendation {
  courseId: string;
  threshold: number;
  averages: AxisScores;
  /** Eje más bajo, si está debajo del umbral; null si todos lo superan o no hay datos. */
  focusAxis: 'LITERAL' | 'INFERENCIAL' | 'CRITICO' | null;
  message: string;
}
