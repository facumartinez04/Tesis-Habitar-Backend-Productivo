import type { ComprehensionAxis, EducationLevel, InstitutionStatus } from './enums';

export type AiProvider = 'DEEPSEEK' | 'OPENAI';
export type AiKeySource = 'PLATFORM' | 'CUSTOM';
/** LISTA: el alumno entra con su número de lista (por defecto). NOMBRE: con nombre y apellido, si la institución lo habilita. */
export type StudentIdMode = 'LISTA' | 'NOMBRE';

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
  aiProvider: AiProvider;
  aiKeySource: AiKeySource;
  aiCustomApiKey?: string | null;
  aiCustomApiKeyMasked?: string | null;
  hasCustomApiKey?: boolean;
  aiModel?: string | null;
  studentIdMode: StudentIdMode;
  alertThreshold: number;
  alertEmailsEnabled: boolean;
  createdAt: Date;
}

export interface CreateInstitutionInput {
  name: string;
  domain: string;
  status: InstitutionStatus;
  coordinatorEmail: string;
  levels: EducationLevel[];
  aiProvider?: AiProvider;
  aiKeySource?: AiKeySource;
  aiCustomApiKey?: string | null;
  aiModel?: string | null;
}

export interface UpdateInstitutionConfigInput {
  levels?: EducationLevel[];
  enabledAxes?: ComprehensionAxis[];
  aiProvider?: AiProvider;
  aiKeySource?: AiKeySource;
  aiCustomApiKey?: string | null;
  aiModel?: string | null;
  studentIdMode?: StudentIdMode;
  alertThreshold?: number;
  alertEmailsEnabled?: boolean;
}

