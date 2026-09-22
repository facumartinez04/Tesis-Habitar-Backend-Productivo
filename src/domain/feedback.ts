
export interface Feedback {
  id: string;
  studentId: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: Date;
}

export interface CreateFeedbackInput {
  studentId: string;
  authorId: string;
  message: string;
}
