import type { ActivityStatus, AttemptPolicy, ComprehensionAxis } from './enums';

export interface Activity {
  id: string;
  code: string;
  name: string;
  educationLevel: string;
  axis: ComprehensionAxis;
  sourceText: string | null;
  sourcePurgedAt: Date | null;
  availableFrom: string;
  startTime: string;
  endDate: string | null;
  endTime: string;
  attemptPolicy: AttemptPolicy;
  status: ActivityStatus;
  qrValidUntil: string;
  courseId: string;
  diagnosticType: DiagnosticType | null;
  readingMode: ReadingMode;
  questionsReleasedAt: Date | null;
  readingHelp: boolean;
  showFeedback: boolean;
  createdAt: Date;
}

export type ReadingMode = 'LECTURA_PRIMERO' | 'DOCENTE_HABILITA' | 'LIBRE';

export type DiagnosticType = 'INICIO' | 'CIERRE';

export interface CreateActivityInput {
  name: string;
  educationLevel: string;
  axis: ComprehensionAxis;
  sourceText: string;
  availableFrom: string;
  startTime: string;
  endDate?: string | null;
  endTime: string;
  attemptPolicy: AttemptPolicy;
  courseId: string;
  questions: CreateQuestionInput[];
  diagnosticType?: DiagnosticType | null;
  readingMode?: ReadingMode;
  readingHelp?: boolean;
  showFeedback?: boolean;

  status?: ActivityStatus;
}

export interface CreateQuestionInput {
  axis: ComprehensionAxis;
  prompt: string;
  expectedAnswer: string;
  options?: string[];
  correctOption?: string;
  approved: boolean;
  edited?: boolean;
}
