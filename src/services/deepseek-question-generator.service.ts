import { z } from 'zod';
import type { CreateQuestionInput } from '../domain/activity';
import { UpstreamError } from '../utils/http-error';
import { env } from '../config/env';
import type { QuestionGenerator } from './question-generator.service';

const deepseekQuestionSchema = z.object({
  axis: z.enum(['LITERAL', 'INFERENCIAL', 'CRITICO']),
  prompt: z.string().min(3),
  expectedAnswer: z.string().min(1),
  options: z.array(z.string().min(1)).min(3).max(4).optional(),
  correctOption: z.string().min(1).optional(),
});

const deepseekResponseSchema = z.object({
  questions: z.array(deepseekQuestionSchema).min(3),
});

function buildPrompt(sourceText: string): { system: string; user: string } {
  return {
    system:
      'Sos un asistente pedagógico que diseña preguntas de comprensión lectora para docentes de nivel ' +
      'primario y secundario. Trabajás siempre en español rioplatense, con consignas claras y breves.',
    user: [
      'A partir del siguiente texto fuente, generá EXACTAMENTE 5 preguntas de comprensión lectora:',
      '- 1 pregunta de eje LITERAL (la respuesta aparece textualmente en el material). Es de opción múltiple:',
      '  incluí "options" con 3 alternativas (la correcta + 2 distractores plausibles) y "correctOption" igual a una de ellas.',
      '- 3 preguntas de eje INFERENCIAL (requieren relacionar ideas que no están dichas explícitamente). También de',
      '  opción múltiple, con "options" (3 alternativas) y "correctOption".',
      '- 1 pregunta de eje CRITICO (respuesta abierta, pide opinión fundamentada). NO incluyas "options" ni "correctOption",',
      '  y en "expectedAnswer" describí brevemente qué debería justificar una buena respuesta.',
      '',
      'Devolvé ÚNICAMENTE un JSON con esta forma exacta, sin texto adicional:',
      '{"questions": [{"axis": "LITERAL" | "INFERENCIAL" | "CRITICO", "prompt": string, "expectedAnswer": string, "options"?: string[], "correctOption"?: string}]}',
      '',
      'Texto fuente:',
      '"""',
      sourceText,
      '"""',
    ].join('\n'),
  };
}

interface DeepSeekChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

export class DeepSeekQuestionGenerator implements QuestionGenerator {
  async generate(sourceText: string): Promise<CreateQuestionInput[]> {
    const { system, user } = buildPrompt(sourceText);

    let res: Response;
    try {
      res = await fetch(env.deepseek.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.deepseek.apiKey}`,
        },
        body: JSON.stringify({
          model: env.deepseek.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });
    } catch (err) {
      throw new UpstreamError(`No se pudo contactar a DeepSeek: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new UpstreamError(`DeepSeek respondió ${res.status}: ${body.slice(0, 300)}`);
    }

    const payload = (await res.json()) as DeepSeekChatCompletion;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new UpstreamError('DeepSeek no devolvió contenido en la respuesta');

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new UpstreamError('DeepSeek devolvió un JSON inválido');
    }

    const parsed = deepseekResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new UpstreamError(`La respuesta de DeepSeek no tiene la forma esperada: ${parsed.error.message}`);
    }

    return parsed.data.questions.map((q) => ({
      axis: q.axis,
      prompt: q.prompt,
      expectedAnswer: q.expectedAnswer,
      options: q.options,
      correctOption: q.correctOption,
      approved: q.axis !== 'CRITICO',
    }));
  }
}
