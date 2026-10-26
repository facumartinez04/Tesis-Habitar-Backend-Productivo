import { aiUsageRepository, currentMonthAR } from '../dal/aiUsage.repository';
import { BadRequestError, NotFoundError } from '../utils/http-error';
import type { AiCostKindSummary, AiCostModelSummary, InstitutionAiCostDetail } from '../domain/aiCost';
import type { AiUsageKind } from '../domain/aiUsage';

const KINDS: AiUsageKind[] = ['GENERACION', 'CORRECCION', 'AYUDA', 'DOCUMENTO'];
const HISTORY_MONTHS = 6;

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

function resolveMonth(month?: string): string {
  const value = month ?? currentMonthAR();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new BadRequestError('El mes tiene que tener el formato AAAA-MM');
  return value;
}

export class AiCostService {
  async overview(month?: string) {
    const m = resolveMonth(month);
    const [rows, history, prices, models] = await Promise.all([
      aiUsageRepository.costByInstitution(m),
      aiUsageRepository.monthlyTotals(HISTORY_MONTHS),
      aiUsageRepository.listPrices(),
      aiUsageRepository.modelsUsed(m),
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
    return {
      month: m,
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
      models,
    };
  }

  async institutionDetail(institutionId: string, month?: string): Promise<InstitutionAiCostDetail> {
    const m = resolveMonth(month);
    const institution = await aiUsageRepository.institution(institutionId);
    if (!institution) throw new NotFoundError('Institución no encontrada');
    const [rows, history] = await Promise.all([
      aiUsageRepository.institutionBreakdown(institutionId, m),
      aiUsageRepository.institutionHistory(institutionId, HISTORY_MONTHS),
    ]);

    const platformCostUsd = rows.filter((r) => r.keySource === 'PLATAFORMA').reduce((a, r) => a + r.costUsd, 0);
    const ownCostUsd = rows.filter((r) => r.keySource === 'PROPIA').reduce((a, r) => a + r.costUsd, 0);
    const totalCost = platformCostUsd + ownCostUsd;

    const byKind: AiCostKindSummary[] = KINDS.map((kind) => {
      const of = rows.filter((r) => r.kind === kind);
      const platform = of.filter((r) => r.keySource === 'PLATAFORMA').reduce((a, r) => a + r.costUsd, 0);
      const own = of.filter((r) => r.keySource === 'PROPIA').reduce((a, r) => a + r.costUsd, 0);
      return {
        kind,
        calls: of.reduce((a, r) => a + r.calls, 0),
        failed: of.reduce((a, r) => a + r.failed, 0),
        tokens: of.reduce((a, r) => a + r.promptTokens + r.completionTokens, 0),
        platformCostUsd: round(platform),
        ownCostUsd: round(own),
        sharePct: totalCost > 0 ? Math.round(((platform + own) / totalCost) * 1000) / 10 : 0,
      };
    });

    const models = new Map<string, AiCostModelSummary>();
    for (const r of rows) {
      const model = r.model ?? 'sin modelo informado';
      const key = `${r.provider}|${model}|${r.keySource}`;
      const acc = models.get(key) ?? { provider: r.provider, model, keySource: r.keySource, calls: 0, tokens: 0, costUsd: 0 };
      acc.calls += r.calls;
      acc.tokens += r.promptTokens + r.completionTokens;
      acc.costUsd += r.costUsd;
      models.set(key, acc);
    }

    return {
      institution,
      month: m,
      currentMonth: currentMonthAR(),
      totals: {
        calls: rows.reduce((a, r) => a + r.calls, 0),
        failed: rows.reduce((a, r) => a + r.failed, 0),
        promptTokens: rows.reduce((a, r) => a + r.promptTokens, 0),
        completionTokens: rows.reduce((a, r) => a + r.completionTokens, 0),
        platformCostUsd: round(platformCostUsd),
        ownCostUsd: round(ownCostUsd),
      },
      budgetUsedPct: institution.budgetUsd ? Math.round((platformCostUsd / institution.budgetUsd) * 1000) / 10 : null,
      overBudget: institution.budgetUsd !== null && platformCostUsd >= institution.budgetUsd,
      byKind,
      byModel: [...models.values()].map((x) => ({ ...x, costUsd: round(x.costUsd) })).sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
      history: history.map((h) => ({ ...h, platformCostUsd: round(h.platformCostUsd), ownCostUsd: round(h.ownCostUsd) })),
    };
  }

  async setBudget(institutionId: string, budgetUsd: number | null) {
    if (!(await aiUsageRepository.institution(institutionId))) throw new NotFoundError('Institución no encontrada');
    await aiUsageRepository.setBudget(institutionId, budgetUsd);
    return { institutionId, budgetUsd };
  }

  listPrices() {
    return aiUsageRepository.listPrices();
  }

  async upsertPrice(input: { provider: string; model: string; inputPerMTokUsd: number; outputPerMTokUsd: number }) {
    await aiUsageRepository.upsertPrice(input);
    return aiUsageRepository.listPrices();
  }

  async deletePrice(provider: string, model: string) {
    await aiUsageRepository.deletePrice(provider, model);
    return aiUsageRepository.listPrices();
  }
}

export const aiCostService = new AiCostService();
