import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { complianceService } from '../services/compliance.service';
import type { UpdateRetentionPolicyDto } from '../dto/compliance.dto';

export class ComplianceController {
  async searchStudents(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.query.institutionId ?? '');
    const query = String(req.query.q ?? '');
    const students = await complianceService.searchArcoStudents(institutionId, query);
    res.json(students);
  }

  async getAuditLog(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.query.institutionId ?? '');
    const log = await complianceService.getAuditLog(institutionId);
    res.json(log);
  }

  async exportStudent(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.query.institutionId ?? '');
    const actor = await authService.getSessionUser(req.auth!.sub);
    const record = await complianceService.exportStudentData(institutionId, String(req.params.studentId), actor.name, actor.id);
    res.json(record);
  }

  async deleteStudent(req: Request, res: Response): Promise<void> {
    const institutionId = String(req.query.institutionId ?? '');
    const actor = await authService.getSessionUser(req.auth!.sub);
    await complianceService.deleteStudentData(institutionId, String(req.params.studentId), actor.name, actor.id);
    res.status(204).send();
  }

  async getConsentDocument(_req: Request, res: Response): Promise<void> {
    const document = await complianceService.getConsentDocument();
    res.json(document);
  }

  async acceptConsent(req: Request, res: Response): Promise<void> {
    const actor = await authService.getSessionUser(req.auth!.sub);
    const acceptance = await complianceService.acceptConsent(req.auth!.institutionId, actor.name);
    res.status(201).json(acceptance);
  }

  async getRetentionPolicy(req: Request, res: Response): Promise<void> {
    const policy = await complianceService.getRetentionPolicy(String(req.params.institutionId));
    res.json(policy);
  }

  async updateRetentionPolicy(req: Request, res: Response): Promise<void> {
    const { retentionMonths } = req.body as UpdateRetentionPolicyDto;
    const policy = await complianceService.updateRetentionPolicy(String(req.params.institutionId), retentionMonths);
    res.json(policy);
  }

  async purgeExpiredData(req: Request, res: Response): Promise<void> {
    const actor = await authService.getSessionUser(req.auth!.sub);
    const result = await complianceService.purgeExpiredData(String(req.params.institutionId), actor.name, actor.id);
    res.json(result);
  }
}

export const complianceController = new ComplianceController();
