import type { Request, Response } from 'express';
import { institutionService } from '../services/institution.service';
import { aiUsageService } from '../services/aiUsage.service';
import { aiQuestionGenerator } from '../services/ai-question-generator.service';
import type { CreateInstitutionDto, UpdateInstitutionConfigDto, UpdateInstitutionStatusDto, TestAiConfigDto } from '../dto/institution.dto';

export class InstitutionController {
  async list(_req: Request, res: Response): Promise<void> {
    const institutions = await institutionService.list();
    res.json(institutions);
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const institution = await institutionService.getBySlug(String(req.params.slug));
    res.json(institution);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const institution = await institutionService.getById(String(req.params.institutionId));
    res.json(institution);
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateInstitutionDto;
    const institution = await institutionService.create(input);
    res.status(201).json(institution);
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    const input = req.body as UpdateInstitutionConfigDto;
    const institution = await institutionService.updateConfig(String(req.params.institutionId), input);
    res.json(institution);
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
    res.json(institution);
  }

  async getAiUsage(req: Request, res: Response): Promise<void> {
    const snapshot = await aiUsageService.getSnapshot(String(req.params.institutionId));
    res.json(snapshot);
  }
}

export const institutionController = new InstitutionController();

