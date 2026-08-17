import type { ComprehensionAxis } from './enums';

export interface Question {
  id: string;
  activityId: string;
  axis: ComprehensionAxis;
  prompt: string;
  expectedAnswer: string;
  options: string[] | null;
  correctOption: string | null;
  edited: boolean;
  approved: boolean;
  order: number;
}
