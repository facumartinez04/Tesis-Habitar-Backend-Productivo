import type { Request, Response } from 'express';
import { sendList } from '../utils/pagination';
import { institutionService } from '../bll/institution.service';
import { aiUsageService } from '../bll/aiUsage.service';
import { aiQuestionGenerator } from '../services/ai-question-generator.service';
import { assertSameInstitution } from '../middlewares/access.middleware';
import type { Institution } from '../domain/institution';
import type { CreateInstitutionDto, UpdateInstitutionConfigDto, UpdateInstitutionStatusDto, TestAiConfigDto } from '../dto/institution.dto';

export function toPublicInstitution(institution: Institution): Omit<Institution, 'aiCustomApiKey'> {
  const { aiCustomApiKey: _secreto, ...publica } = institution;
  return publica;
}

export class InstitutionController {
  async list(req: Request, res: Response): Promise<void> {
    const institutions = await institutionService.list();
    sendList(req, res, institutions.map(toPublicInstitution));
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const institution = await institutionService.getBySlug(String(req.params.slug));
    assertSameInstitution(req, institution.id);
    res.json(toPublicInstitution(institution));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const institution = await institutionService.getById(String(req.params.institutionId));
    res.json(toPublicInstitution(institution));
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateInstitutionDto;
    const institution = await institutionService.create(input);
    res.status(201).json(toPublicInstitution(institution));
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    const input = req.body as UpdateInstitutionConfigDto;
    const institution = await institutionService.updateConfig(String(req.params.institutionId), input);
    res.json(toPublicInstitution(institution));
  }

  async testAiConfig(req: Request, res: Response): Promise<void> {
    const input = req.body as TestAiConfigDto;
    const institution = await institutionService.getById(String(req.params.institutionId));
    const result = await aiQuestionGenerator.testConnection(input, institution.aiCustomApiKey);
    res.json(result);
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const input = req.body as UpdateInstitutionStatusDto;
    const institution = await institutionService.updateStatus(String(req.params.institutionId), input.status);
    res.json(toPublicInstitution(institution));
  }

  async getAiUsage(req: Request, res: Response): Promise<void> {
    const snapshot = await aiUsageService.getSnapshot(String(req.params.institutionId));
    res.json(snapshot);
  }
}

export const institutionController = new InstitutionController();
