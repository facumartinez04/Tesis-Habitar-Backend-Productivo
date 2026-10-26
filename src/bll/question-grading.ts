import { BadRequestError } from '../utils/http-error';
import type { CreateQuestionInput } from '../domain/activity';
import type { Question, QuestionType } from '../domain/question';

export const QUESTION_TYPES: QuestionType[] = ['OPCION_UNICA', 'OPCION_MULTIPLE', 'VERDADERO_FALSO', 'COMPLETAR', 'ABIERTA'];

export const BLANK = '___';

type Gradable = Pick<Question, 'type' | 'options' | 'correctOption' | 'correctOptions' | 'acceptedAnswers'>;

export interface GivenAnswer {
  selectedOption?: string | null;
  selectedOptions?: string[] | null;
  textAnswer?: string | null;
}

export function isAutoGraded(question: Pick<Question, 'type'>): boolean {
  return question.type !== 'ABIERTA';
}

export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function gradeClosed(question: Gradable, answer: GivenAnswer | undefined): number {
  if (!answer) return 0;
  switch (question.type) {
    case 'OPCION_UNICA':
    case 'VERDADERO_FALSO':
      return answer.selectedOption && answer.selectedOption === question.correctOption ? 1 : 0;
    case 'OPCION_MULTIPLE': {
      const correct = new Set(question.correctOptions ?? []);
      if (correct.size === 0) return 0;
      const chosen = new Set(answer.selectedOptions ?? []);
      let hits = 0;
      let misses = 0;
      for (const option of chosen) {
        if (correct.has(option)) hits++;
        else misses++;
      }
      return Math.max(0, (hits - misses) / correct.size);
    }
    case 'COMPLETAR': {
      const given = normalizeAnswer(answer.textAnswer ?? '');
      if (!given) return 0;
      return (question.acceptedAnswers ?? []).some((accepted) => normalizeAnswer(accepted) === given) ? 1 : 0;
    }
    default:
      return 0;
  }
}

function cleanList(values: string[] | undefined | null): string[] {
  return [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))];
}

export function inferQuestionType(input: Pick<CreateQuestionInput, 'type' | 'options' | 'correctOption' | 'correctOptions' | 'acceptedAnswers'>): QuestionType {
  if (input.type && QUESTION_TYPES.includes(input.type)) return input.type;
  if (input.acceptedAnswers?.length) return 'COMPLETAR';
  if (input.correctOptions && input.correctOptions.length > 0) return 'OPCION_MULTIPLE';
  if (input.correctOption) return 'OPCION_UNICA';
  return 'ABIERTA';
}

export function normalizeQuestionInput(input: CreateQuestionInput): CreateQuestionInput {
  const type = inferQuestionType(input);
  const base = { ...input, type, prompt: input.prompt.trim() };
  if (type === 'ABIERTA') {
    return { ...base, options: undefined, correctOption: undefined, correctOptions: undefined, acceptedAnswers: undefined };
  }
  if (type === 'COMPLETAR') {
    const accepted = cleanList(input.acceptedAnswers?.length ? input.acceptedAnswers : [input.expectedAnswer]);
    if (accepted.length === 0) throw new BadRequestError('La pregunta para completar necesita al menos una respuesta aceptada');
    const prompt = base.prompt.includes(BLANK) ? base.prompt : `${base.prompt} ${BLANK}`;
    return { ...base, prompt, options: undefined, correctOption: undefined, correctOptions: undefined, acceptedAnswers: accepted, expectedAnswer: accepted[0] };
  }
  const options = cleanList(input.options);
  if (options.length < 2) throw new BadRequestError('La pregunta necesita al menos dos opciones');
  if (type === 'OPCION_MULTIPLE') {
    const correct = cleanList(input.correctOptions).filter((o) => options.includes(o));
    if (correct.length === 0) throw new BadRequestError('Marcá al menos una opción correcta');
    return { ...base, options, correctOption: undefined, correctOptions: correct, acceptedAnswers: undefined, expectedAnswer: input.expectedAnswer || correct.join(' · ') };
  }
  const correctOption = input.correctOption?.trim();
  if (!correctOption || !options.includes(correctOption)) {
    throw new BadRequestError('La opción correcta tiene que estar entre las opciones');
  }
  return { ...base, options, correctOption, correctOptions: undefined, acceptedAnswers: undefined, expectedAnswer: input.expectedAnswer || correctOption };
}
