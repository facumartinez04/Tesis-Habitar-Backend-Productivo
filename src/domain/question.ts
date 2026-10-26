import type { ComprehensionAxis } from './enums';

export type QuestionType = 'OPCION_UNICA' | 'OPCION_MULTIPLE' | 'VERDADERO_FALSO' | 'COMPLETAR' | 'ABIERTA';

export interface Question {
  id: string;
  activityId: string;
  axis: ComprehensionAxis;
  type: QuestionType;
  prompt: string;
  expectedAnswer: string;
  options: string[] | null;
  correctOption: string | null;
  correctOptions: string[] | null;
  acceptedAnswers: string[] | null;
  edited: boolean;
  approved: boolean;
  order: number;
}
