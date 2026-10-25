import type { Request, Response } from 'express';
import { resultService } from '../bll/result.service';
import { authService } from '../bll/auth.service';
import type { CompareResultsQueryDto } from '../dto/result.dto';

export class ResultController {
  async getCourseSummary(req: Request, res: Response): Promise<void> {
    const summary = await resultService.getCourseSummary(String(req.params.courseId));
    res.json(summary);
  }

  async getInstitutionSummary(req: Request, res: Response): Promise<void> {
    const summary = await resultService.getInstitutionSummary(String(req.params.institutionId));
    res.json(summary);
  }

  async getStudentDetail(req: Request, res: Response): Promise<void> {
    const detail = await resultService.getStudentDetail(String(req.params.studentId));
    res.json(detail);
  }

  async comparePeriods(req: Request, res: Response): Promise<void> {
    const { fromA, toA, fromB, toB } = req.query as unknown as CompareResultsQueryDto;
    const comparison = await resultService.comparePeriods(
      String(req.params.courseId),
      { from: fromA, to: toA },
      { from: fromB, to: toB },
    );
    res.json(comparison);
  }

  async getDiagnostic(req: Request, res: Response): Promise<void> {
    res.json(await resultService.getDiagnostic(String(req.params.courseId)));
  }

  async getRecommendation(req: Request, res: Response): Promise<void> {
    res.json(await resultService.getRecommendation(String(req.params.courseId)));
  }

  async exportCourseReport(req: Request, res: Response): Promise<void> {
    const actor = await authService.getSessionUser(req.auth!.sub);
    const csv = await resultService.exportCourseReportCsv(String(req.params.courseId), actor.name, actor.id, req.locale);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-desempeno-${req.params.courseId}.csv"`);
    res.send(csv);
  }
}

export const resultController = new ResultController();
