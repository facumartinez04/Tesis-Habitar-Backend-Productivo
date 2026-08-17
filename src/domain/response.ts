export interface AnswerInput {
  questionId: string;
  selectedOption: string;
}

export interface SubmitResponseInput {
  activityId: string;
  studentDisplayName: string;
  studentId?: string;
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
