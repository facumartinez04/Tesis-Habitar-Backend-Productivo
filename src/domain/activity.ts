import type { ActivityStatus, AttemptPolicy, ComprehensionAxis } from './enums';

export interface Activity {
  id: string;
  code: string;
  name: string;
  educationLevel: string;
  axis: ComprehensionAxis;
  /** El texto se conserva sólo mientras la actividad está abierta; al cerrarse se borra (§8.4). */
  sourceText: string | null;
  sourcePurgedAt: Date | null;
  availableFrom: string;
  startTime: string;
  endTime: string;
  attemptPolicy: AttemptPolicy;
  status: ActivityStatus;
  qrValidUntil: string;
  courseId: string;
  diagnosticType: DiagnosticType | null;
  createdAt: Date;
}

/** Actividad diagnóstica de inicio o de cierre del ciclo lectivo (mejora 1). */
export type DiagnosticType = 'INICIO' | 'CIERRE';

export interface CreateActivityInput {
  name: string;
  educationLevel: string;
  axis: ComprehensionAxis;
  sourceText: string;
  availableFrom: string;
  startTime: string;
  endTime: string;
  attemptPolicy: AttemptPolicy;
  courseId: string;
  questions: CreateQuestionInput[];
  diagnosticType?: DiagnosticType | null;

  status?: ActivityStatus;
}

export interface CreateQuestionInput {
  axis: ComprehensionAxis;
  prompt: string;
  expectedAnswer: string;
  options?: string[];
  correctOption?: string;
  approved: boolean;
  /** true si el docente modificó la pregunta que propuso la IA (métrica de calidad, mejora 4). */
  edited?: boolean;
}
