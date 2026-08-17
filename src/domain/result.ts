export interface AxisScores {
  literal: number;
  inferencial: number;
  critico: number;
}

export type PerformanceStatus = 'BIEN' | 'REGULAR' | 'BAJO' | 'SIN_DATOS';

export interface StudentResultRow {
  studentId: string;
  studentName: string;
  scores: AxisScores | null;
  status: PerformanceStatus;
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
  literal: number;
  inferencial: number;
  critico: number;
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
