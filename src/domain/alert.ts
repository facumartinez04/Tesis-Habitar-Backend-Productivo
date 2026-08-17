import type { AlertSeverity, ComprehensionAxis } from './enums';

export interface PerformanceAlert {
  id: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  axis: ComprehensionAxis;
  currentValue: number;
  threshold: number;
  severity: AlertSeverity;
  detectedAt: string;
  message: string;
}
