import { Router, type Request, type Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { dashboardService } from '../bll/dashboard.service';

// Tablero de resultados con filtros (aula, alumno, días).
export const dashboardRouter = Router();

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

dashboardRouter.get('/', requireAuth, requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'), async (req: Request, res: Response) => {
  const auth = req.auth!;
  res.json(
    await dashboardService.get(
      { sub: auth.sub, role: auth.role, institutionId: auth.institutionId },
      { courseId: text(req.query.courseId), studentId: text(req.query.studentId), from: text(req.query.from), to: text(req.query.to) },
    ),
  );
});
