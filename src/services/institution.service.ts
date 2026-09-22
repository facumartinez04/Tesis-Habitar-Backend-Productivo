import { institutionRepository } from '../repositories/institution.repository';
import { NotFoundError } from '../utils/http-error';
import type { CreateInstitutionInput, Institution, UpdateInstitutionConfigInput } from '../domain/institution';

export interface InstitutionService {
  list(): Promise<Institution[]>;
  getBySlug(slug: string): Promise<Institution>;
  getById(id: string): Promise<Institution>;
  create(input: CreateInstitutionInput): Promise<Institution>;
  updateConfig(id: string, input: UpdateInstitutionConfigInput): Promise<Institution>;
  updateStatus(id: string, status: Institution['status']): Promise<Institution>;
}

export class DefaultInstitutionService implements InstitutionService {
  async list(): Promise<Institution[]> {
    return institutionRepository.findAll();
  }

  async getBySlug(slug: string): Promise<Institution> {
    const institution = await institutionRepository.findBySlug(slug);
    if (!institution) throw new NotFoundError('Institución no encontrada');
    return institution;
  }

  async getById(id: string): Promise<Institution> {
    const institution = await institutionRepository.findById(id);
    if (!institution) throw new NotFoundError('Institución no encontrada');
    return institution;
  }

  async create(input: CreateInstitutionInput): Promise<Institution> {
    return institutionRepository.create(input);
  }

  async updateConfig(id: string, input: UpdateInstitutionConfigInput): Promise<Institution> {
    const existing = await institutionRepository.findById(id);
    if (!existing) throw new NotFoundError('Institución no encontrada');
    return institutionRepository.updateConfig(id, input);
  }

  async updateStatus(id: string, status: Institution['status']): Promise<Institution> {
    const existing = await institutionRepository.findById(id);
    if (!existing) throw new NotFoundError('Institución no encontrada');
    return institutionRepository.updateStatus(id, status);
  }
}

export const institutionService = new DefaultInstitutionService();
