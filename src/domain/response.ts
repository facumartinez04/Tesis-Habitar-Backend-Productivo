export interface AnswerInput {
  questionId: string;
  /** Preguntas de opción múltiple (literal e inferencial). */
  selectedOption?: string;
  /** Preguntas abiertas (eje crítico). */
  textAnswer?: string;
}

export interface SubmitResponseInput {
  activityId: string;
  studentDisplayName: string;
  studentId?: string;
  deviceId?: string;
  answers: AnswerInput[];
}

export interface Response {
  id: string;
  activityId: string;
  studentId: string | null;
  studentDisplayName: string;
  submittedAt: Date;
  answers: AnswerInput[];
}
