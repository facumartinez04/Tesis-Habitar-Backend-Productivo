import type { Request, Response } from 'express';
import { z } from 'zod';
import { aiUsageRepository, currentMonthAR } from '../repositories/aiUsage.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { BadRequestError, NotFoundError } from '../utils/http-error';

const budgetSchema = z.object({ budgetUsd: z.number().min(0).max(100000).nullable() });
const priceSchema = z.object({
  provider: z.enum(['DEEPSEEK', 'OPENAI']),
  model: z.string().min(1).max(80),
  inputPerMTokUsd: z.number().min(0).max(1000),
  outputPerMTokUsd: z.number().min(0).max(1000),
});

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/** Costo y gasto de IA por institución, para el administrador de la plataforma. */
export class AdminAiController {
  async costs(req: Request, res: Response): Promise<void> {
    const month = String(req.query.month ?? currentMonthAR());
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestError('El mes tiene que tener el formato AAAA-MM');
    const [rows, history, prices, models] = await Promise.all([
      aiUsageRepository.costByInstitution(month),
      aiUsageRepository.monthlyTotals(6),
      aiUsageRepository.listPrices(),
      aiUsageRepository.modelsUsed(month),
    ]);
    const institutions = rows.map((r) => ({
      ...r,
      platformCostUsd: round(r.platformCostUsd),
      ownCostUsd: round(r.ownCostUsd),
      generationCostUsd: round(r.generationCostUsd),
      gradingCostUsd: round(r.gradingCostUsd),
      helpCostUsd: round(r.helpCostUsd),
      budgetUsedPct: r.budgetUsd ? Math.round((r.platformCostUsd / r.budgetUsd) * 1000) / 10 : null,
      overBudget: r.budgetUsd !== null && r.platformCostUsd >= r.budgetUsd,
    }));
    const sum = (k: keyof (typeof institutions)[number]) => institutions.reduce((acc, i) => acc + Number(i[k] ?? 0), 0);
    res.json({
      month,
      currentMonth: currentMonthAR(),
      totals: {
        platformCostUsd: round(sum('platformCostUsd')),
        ownCostUsd: round(sum('ownCostUsd')),
        calls: sum('calls'),
        failed: sum('failed'),
        promptTokens: sum('promptTokens'),
        completionTokens: sum('completionTokens'),
        generationCostUsd: round(sum('generationCostUsd')),
        gradingCostUsd: round(sum('gradingCostUsd')),
        helpCostUsd: round(sum('helpCostUsd')),
      },
      history: history.map((h) => ({ ...h, costUsd: round(h.costUsd) })),
      institutions,
      prices,
      /** Modelos del mes; los que no tienen precio propio se cobran con el último precio cargado de su proveedor. */
      models,
    });
  }

  async setBudget(req: Request, res: Response): Promise<void> {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('El tope tiene que ser un monto en dólares (o vacío para no tener tope)');
    const id = String(req.params.institutionId);
    if (!(await institutionRepository.findById(id))) throw new NotFoundError('Institución no encontrada');
    await aiUsageRepository.setBudget(id, parsed.data.budgetUsd);
    res.json({ institutionId: id, budgetUsd: parsed.data.budgetUsd });
  }

  async prices(_req: Request, res: Response): Promise<void> {
    res.json(await aiUsageRepository.listPrices());
  }

  async upsertPrice(req: Request, res: Response): Promise<void> {
    const parsed = priceSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('Revisá el proveedor, el modelo y los precios por millón de tokens');
    await aiUsageRepository.upsertPrice(parsed.data);
    res.json(await aiUsageRepository.listPrices());
  }

  async deletePrice(req: Request, res: Response): Promise<void> {
    await aiUsageRepository.deletePrice(String(req.params.provider), String(req.params.model));
    res.json(await aiUsageRepository.listPrices());
  }
}

export const adminAiController = new AdminAiController();
