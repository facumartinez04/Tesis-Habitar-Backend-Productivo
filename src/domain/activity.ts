import type { ActivityStatus, AttemptPolicy, ComprehensionAxis } from './enums';

export interface Activity {
  id: string;
  code: string;
  name: string;
  educationLevel: string;
  axis: ComprehensionAxis;
  sourceText: string;
  availableFrom: string;
  startTime: string;
  endTime: string;
  attemptPolicy: AttemptPolicy;
  status: ActivityStatus;
  qrValidUntil: string;
  courseId: string;
  createdAt: Date;
}

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

  status?: ActivityStatus;
}

export interface CreateQuestionInput {
  axis: ComprehensionAxis;
  prompt: string;
  expectedAnswer: string;
  options?: string[];
  correctOption?: string;
  approved: boolean;
}
