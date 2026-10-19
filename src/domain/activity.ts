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
  /** Fecha de cierre (AAAA-MM-DD); null = el mismo día que abre. */
  endDate: string | null;
  endTime: string;
  attemptPolicy: AttemptPolicy;
  status: ActivityStatus;
  qrValidUntil: string;
  courseId: string;
  diagnosticType: DiagnosticType | null;
  /** Cómo empieza el alumno: lee primero (por defecto), espera que el docente habilite, o todo junto. */
  readingMode: ReadingMode;
  /** Cuándo el docente pasó a todos a las preguntas. */
  questionsReleasedAt: Date | null;
  /** Si los alumnos pueden preguntarle a la IA qué significa algo del texto (por defecto, sí). */
  readingHelp: boolean;
  createdAt: Date;
}

export type ReadingMode = 'LECTURA_PRIMERO' | 'DOCENTE_HABILITA' | 'LIBRE';

/** Actividad diagnóstica de inicio o de cierre del ciclo lectivo (mejora 1). */
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
