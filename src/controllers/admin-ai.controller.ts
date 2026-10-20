import type { Request, Response } from 'express';
import { z } from 'zod';
import { aiCostService } from '../bll/ai-cost.service';
import { BadRequestError } from '../utils/http-error';

const budgetSchema = z.object({ budgetUsd: z.number().min(0).max(100000).nullable() });
const priceSchema = z.object({
  provider: z.enum(['DEEPSEEK', 'OPENAI']),
  model: z.string().min(1).max(80),
  inputPerMTokUsd: z.number().min(0).max(1000),
  outputPerMTokUsd: z.number().min(0).max(1000),
});

const monthOf = (req: Request) => (req.query.month === undefined ? undefined : String(req.query.month));

export class AdminAiController {
  async costs(req: Request, res: Response): Promise<void> {
    res.json(await aiCostService.overview(monthOf(req)));
  }

  async institutionCosts(req: Request, res: Response): Promise<void> {
    res.json(await aiCostService.institutionDetail(String(req.params.institutionId), monthOf(req)));
  }

  async setBudget(req: Request, res: Response): Promise<void> {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('El tope tiene que ser un monto en dólares (o vacío para no tener tope)');
    res.json(await aiCostService.setBudget(String(req.params.institutionId), parsed.data.budgetUsd));
  }

  async prices(_req: Request, res: Response): Promise<void> {
    res.json(await aiCostService.listPrices());
  }

  async upsertPrice(req: Request, res: Response): Promise<void> {
    const parsed = priceSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('Revisá el proveedor, el modelo y los precios por millón de tokens');
    res.json(await aiCostService.upsertPrice(parsed.data));
  }

  async deletePrice(req: Request, res: Response): Promise<void> {
    res.json(await aiCostService.deletePrice(String(req.params.provider), String(req.params.model)));
  }
}

export const adminAiController = new AdminAiController();
