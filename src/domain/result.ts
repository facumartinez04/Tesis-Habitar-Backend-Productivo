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
  delta: AxisScores | null;
}

export interface DiagnosticComparison {
  courseId: string;
  courseName: string;
  inicio: { activityId: string; name: string; date: string } | null;
  cierre: { activityId: string; name: string; date: string } | null;
  course: { inicio: AxisScores; cierre: AxisScores; delta: AxisScores } | null;
  students: DiagnosticStudentRow[];
  incomplete: DiagnosticStudentRow[];
}

export interface AxisRecommendation {
  courseId: string;
  threshold: number;
  averages: AxisScores;
  focusAxis: 'LITERAL' | 'INFERENCIAL' | 'CRITICO' | null;
  message: string;
}
