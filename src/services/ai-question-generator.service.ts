import { z } from 'zod';
import type { CreateQuestionInput } from '../domain/activity';
import { UpstreamError } from '../utils/http-error';
import { env } from '../config/env';
import type { AiProvider, AiKeySource } from '../domain/institution';

export interface GenerateWithAiOptions {
  provider: AiProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
}

export interface TestAiConnectionInput {
  provider: AiProvider;
  keySource: AiKeySource;
  apiKey?: string | null;
  model?: string | null;
}

export interface TestAiConnectionResult {
  success: boolean;
  modelUsed: string;
  provider: AiProvider;
  message?: string;
  error?: string;
}

const aiQuestionSchema = z.object({
  axis: z.enum(['LITERAL', 'INFERENCIAL', 'CRITICO']),
  prompt: z.string().min(3),
  expectedAnswer: z.string().min(1),
  options: z.array(z.string().min(1)).min(3).max(4).optional(),
  correctOption: z.string().min(1).optional(),
});

const aiResponseSchema = z.object({
  questions: z.array(aiQuestionSchema).min(3),
});

function buildPedagogicalPrompt(sourceText: string): { system: string; user: string } {
  return {
    system:
      'Sos un asistente pedagógico de la plataforma Habitar que diseña actividades de comprensión lectora para ' +
      'docentes de nivel primario y secundario. Trabajás en español rioplatense, con consignas claras, directas y rigurosas.',
    user: [
      'A partir del siguiente texto fuente, generá EXACTAMENTE 5 preguntas de comprensión lectora:',
      '- 1 pregunta de eje LITERAL (la respuesta aparece textualmente en el material). De opción múltiple:',
      '  incluí "options" con 3 alternativas (la correcta + 2 distractores plausibles) y "correctOption" idéntica a una de ellas.',
      '- 3 preguntas de eje INFERENCIAL (requieren relacionar ideas implícitas, deducciones o intenciones del autor).',
      '  También de opción múltiple, con "options" (3 alternativas) y "correctOption".',
      '- 1 pregunta de eje CRITICO (respuesta abierta que promueve juicio de valor, opinión fundamentada y reflexión).',
      '  NO incluyas "options" ni "correctOption", y en "expectedAnswer" describí brevemente los argumentos esperados.',
      '',
      'Respondé ÚNICAMENTE un objeto JSON válido con esta estructura exacta, sin código markdown ni comentarios:',
      '{"questions": [{"axis": "LITERAL" | "INFERENCIAL" | "CRITICO", "prompt": string, "expectedAnswer": string, "options"?: string[], "correctOption"?: string}]}',
      '',
      'Texto fuente:',
      '"""',
      sourceText,
      '"""',
    ].join('\n'),
  };
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export class AiQuestionGeneratorService {

  resolveDefaults(provider: AiProvider, customApiUrl?: string, customModel?: string) {
    if (provider === 'OPENAI') {
      return {
        apiUrl: customApiUrl || env.openai.apiUrl || 'https://api.openai.com/v1/chat/completions',
        model: customModel || env.openai.model || 'gpt-4o-mini',
      };
    }
    return {
      apiUrl: customApiUrl || env.deepseek.apiUrl || 'https://api.deepseek.com/chat/completions',
      model: customModel || env.deepseek.model || 'deepseek-chat',
    };
  }

  async generate(sourceText: string, options: GenerateWithAiOptions): Promise<CreateQuestionInput[]> {
    const { provider, apiKey } = options;
    const { apiUrl, model } = this.resolveDefaults(provider, options.apiUrl, options.model);

    if (!apiKey || apiKey.trim() === '') {
      throw new UpstreamError(`No hay clave de API configurada para el proveedor ${provider}`);
    }

    const { system, user } = buildPedagogicalPrompt(sourceText);

    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });
    } catch (err) {
      throw new UpstreamError(`No se pudo conectar con ${provider}: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new UpstreamError(`${provider} respondió con error ${res.status}: ${body.slice(0, 250)}`);
    }

    const payload = (await res.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new UpstreamError(`${provider} no devolvió contenido en su respuesta`);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new UpstreamError(`${provider} devolvió un formato JSON inválido`);
    }

    const parsed = aiResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new UpstreamError(`El contenido devuelto por ${provider} no cumple la estructura esperada: ${parsed.error.message}`);
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

  async testConnection(input: TestAiConnectionInput, institutionCustomKey?: string | null): Promise<TestAiConnectionResult> {
    const { provider, keySource } = input;
    let apiKey = '';

    if (keySource === 'CUSTOM') {
      const candidateKey = input.apiKey?.trim();
      if (candidateKey && !candidateKey.includes('••••')) {
        apiKey = candidateKey;
      } else if (institutionCustomKey) {
        apiKey = institutionCustomKey;
      }
      if (!apiKey) {
        return {
          success: false,
          modelUsed: '',
          provider,
          error: 'Debés ingresar una clave de API válida para probar la conexión en modo clave propia.',
        };
      }
    } else {
      apiKey = provider === 'OPENAI' ? env.openai.apiKey : env.deepseek.apiKey;
      if (!apiKey) {
        return {
          success: false,
          modelUsed: '',
          provider,
          error: `No hay una clave de plataforma (${provider}) configurada en el servidor.`,
        };
      }
    }

    const { apiUrl, model } = this.resolveDefaults(provider, undefined, input.model ?? undefined);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Sos un verificador de API. Respondé estrictamente un JSON con {"status": "ok"}.' },
            { role: 'user', content: 'Ping de prueba de conexión.' },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          success: false,
          modelUsed: model,
          provider,
          error: `${provider} rechazó la solicitud (Código ${res.status}): ${errText.slice(0, 200)}`,
        };
      }

      return {
        success: true,
        modelUsed: model,
        provider,
        message: `Conexión exitosa con ${provider} utilizando el modelo ${model}.`,
      };
    } catch (err) {
      return {
        success: false,
        modelUsed: model,
        provider,
        error: `Fallo de red al conectar con ${provider}: ${(err as Error).message}`,
      };
    }
  }
}

export const aiQuestionGenerator = new AiQuestionGeneratorService();
