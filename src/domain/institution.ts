import type { ComprehensionAxis, EducationLevel, InstitutionStatus } from './enums';

export interface Institution {
  id: string;
  slug: string;
  name: string;
  domain: string;
  status: InstitutionStatus;
  coordinatorEmail: string;
  levels: EducationLevel[];

  enabledAxes: ComprehensionAxis[];

  aiMonthlyQuota: number;
  createdAt: Date;
}

export interface CreateInstitutionInput {
  name: string;
  domain: string;
  status: InstitutionStatus;
  coordinatorEmail: string;
  levels: EducationLevel[];
}

export interface UpdateInstitutionConfigInput {
  levels?: EducationLevel[];
  enabledAxes?: ComprehensionAxis[];
}
