import { env } from '../config/env';
import { TemplateQuestionGenerator, type QuestionGenerator } from './question-generator.service';
import { DeepSeekQuestionGenerator } from './deepseek-question-generator.service';

function buildQuestionGenerator(): QuestionGenerator {
  if (env.deepseek.apiKey) {
    return new DeepSeekQuestionGenerator();
  }

  console.warn(
    '[question-generator] DEEPSEEK_API_KEY no configurada: usando TemplateQuestionGenerator (mock, sin IA).',
  );
  return new TemplateQuestionGenerator();
}

export const questionGenerator: QuestionGenerator = buildQuestionGenerator();
