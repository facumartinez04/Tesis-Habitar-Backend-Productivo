import type { CreateQuestionInput } from '../domain/activity';
import type { ComprehensionAxis } from '../domain/enums';
import { questionMix } from './ai-question-generator.service';
import type { Locale } from '../i18n/locale';
import type { QuestionType } from '../domain/question';

export interface QuestionGenerator {
  generate(sourceText: string, focusAxis?: ComprehensionAxis, language?: Locale, types?: QuestionType[]): Promise<CreateQuestionInput[]>;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface TemplateText {
  notInText: string;
  decoys: string[];
  trueFalse: [string, string];
  truePrompt: (sentence: string) => string;
  inferTruePrompt: (idea: string) => string;
  completePrompt: string;
  multiplePrompt: string;
  literalPrompt: string;
  inferencial: Array<{ prompt: string; correct: string; decoys: string[] }>;
  critico: string[];
  criticoExpected: string;
}

const TEMPLATE_TEXT: Record<Locale, TemplateText> = {
  es: {
    notInText: 'Esta afirmación no aparece en el texto',
    decoys: ['El texto no menciona este tema en ningún momento', 'El autor afirma lo contrario de lo que plantea'],
    trueFalse: ['Verdadero', 'Falso'],
    truePrompt: (sentence) => `Verdadero o falso: el texto dice que «${sentence}»`,
    inferTruePrompt: (idea) => `Verdadero o falso: del texto se puede inferir lo siguiente: ${idea.charAt(0).toLowerCase()}${idea.slice(1)}.`,
    completePrompt: 'Completá con la palabra que falta, tal como aparece en el texto:',
    multiplePrompt: '¿Cuáles de estas frases aparecen en el texto? Puede haber más de una correcta.',
    literalPrompt: '¿Cuál de las siguientes frases aparece textualmente en el material?',
    inferencial: [
      {
        prompt: '¿Qué relación se puede inferir entre las ideas centrales del texto?',
        correct: 'Existe una relación de causa y efecto entre los conceptos presentados',
        decoys: ['No existe ninguna relación entre las ideas', 'Las ideas del texto son completamente independientes'],
      },
      {
        prompt: '¿Qué consecuencia se desprende de la información brindada?',
        correct: 'Se generan efectos que impactan más allá de lo mencionado explícitamente',
        decoys: ['No se puede inferir ninguna consecuencia', 'La consecuencia es opuesta a lo planteado en el texto'],
      },
      {
        prompt: '¿Qué propósito parece tener el texto?',
        correct: 'Informar y generar reflexión sobre el tema tratado',
        decoys: ['Entretener sin ningún objetivo informativo', 'Vender un producto relacionado al tema'],
      },
    ],
    critico: [
      '¿Estás de acuerdo con la perspectiva planteada en el texto? Justificá tu respuesta.',
      '¿Qué opinás de la idea principal del texto? Fundamentá con lo que dice el autor.',
      '¿Cambiarías algo de lo que plantea el texto? Explicá por qué, con argumentos del texto.',
    ],
    criticoExpected: '(respuesta abierta — justificación con argumentos del texto)',
  },
  en: {
    notInText: 'This statement does not appear in the text',
    decoys: ['The text never mentions this topic', 'The author states the opposite of what is proposed'],
    trueFalse: ['True', 'False'],
    truePrompt: (sentence) => `True or false: the text says that «${sentence}»`,
    inferTruePrompt: (idea) => `True or false: the following can be inferred from the text: ${idea.charAt(0).toLowerCase()}${idea.slice(1)}.`,
    completePrompt: 'Fill in the missing word, exactly as it appears in the text:',
    multiplePrompt: 'Which of these sentences appear in the text? There may be more than one correct answer.',
    literalPrompt: 'Which of the following sentences appears word for word in the material?',
    inferencial: [
      {
        prompt: 'What relationship can be inferred between the main ideas of the text?',
        correct: 'There is a cause-and-effect relationship between the concepts presented',
        decoys: ['There is no relationship between the ideas', 'The ideas in the text are completely independent'],
      },
      {
        prompt: 'What consequence follows from the information given?',
        correct: 'There are effects that go beyond what is explicitly mentioned',
        decoys: ['No consequence can be inferred', 'The consequence is the opposite of what the text states'],
      },
      {
        prompt: 'What purpose does the text seem to have?',
        correct: 'To inform and encourage reflection on the topic',
        decoys: ['To entertain without any informative goal', 'To sell a product related to the topic'],
      },
    ],
    critico: [
      'Do you agree with the perspective presented in the text? Justify your answer.',
      'What do you think of the main idea of the text? Support it with what the author says.',
      'Would you change anything the text proposes? Explain why, with arguments from the text.',
    ],
    criticoExpected: '(open answer — justification with arguments from the text)',
  },
};

export class TemplateQuestionGenerator implements QuestionGenerator {
  async generate(
    sourceText: string,
    focusAxis?: ComprehensionAxis,
    language: Locale = 'es',
    types: QuestionType[] = ['OPCION_UNICA'],
  ): Promise<CreateQuestionInput[]> {
    const base = await this.generateSingle(sourceText, focusAxis, language);
    const text = TEMPLATE_TEXT[language];
    const sentences = splitSentences(sourceText);
    const allowed = types.filter((t) => t !== 'ABIERTA');
    let literalIndex = 0;
    let inferIndex = 0;
    return base.map((question) => {
      if (question.type === 'ABIERTA' || allowed.length === 0) return question;
      const index = question.axis === 'LITERAL' ? literalIndex++ : inferIndex++;
      const type = allowed[(index + (question.axis === 'LITERAL' ? 0 : 1)) % allowed.length];
      return this.retype(question, type, text, sentences, index) ?? question;
    });
  }

  private retype(
    question: CreateQuestionInput,
    type: QuestionType,
    text: TemplateText,
    sentences: string[],
    index: number,
  ): CreateQuestionInput | null {
    const correct = question.correctOption ?? '';
    if (type === 'OPCION_UNICA') return question;
    if (type === 'VERDADERO_FALSO') {
      const prompt = question.axis === 'LITERAL' ? text.truePrompt(correct) : text.inferTruePrompt(correct);
      return { ...question, type, prompt, options: [...text.trueFalse], correctOption: text.trueFalse[0], expectedAnswer: text.trueFalse[0] };
    }
    if (type === 'COMPLETAR' && question.axis === 'LITERAL') {
      const sentence = sentences[index] ?? correct;
      const words = sentence.match(/[\p{L}]{5,}/gu) ?? [];
      const word = [...words].sort((a, b) => b.length - a.length)[0];
      if (!word) return null;
      const blanked = sentence.replace(word, '___');
      return { ...question, type, prompt: `${text.completePrompt} ${blanked}`, options: undefined, correctOption: undefined, acceptedAnswers: [word], expectedAnswer: word };
    }
    if (type === 'OPCION_MULTIPLE' && question.axis === 'LITERAL' && sentences.length >= 2) {
      const real = [sentences[index % sentences.length], sentences[(index + 1) % sentences.length]].filter((s, i, all) => all.indexOf(s) === i);
      if (real.length < 2) return null;
      const options = shuffle([...real, ...text.decoys]);
      return { ...question, type, prompt: text.multiplePrompt, options, correctOption: undefined, correctOptions: real, expectedAnswer: real.join(' · ') };
    }
    return null;
  }

  private async generateSingle(sourceText: string, focusAxis?: ComprehensionAxis, language: Locale = 'es'): Promise<CreateQuestionInput[]> {
    const text = TEMPLATE_TEXT[language];
    const sentences = splitSentences(sourceText);
    const literalCorrect = sentences[0] ?? sourceText.slice(0, 120);
    const literalDecoys = sentences.slice(1, 3);
    while (literalDecoys.length < 2) {
      literalDecoys.push(text.notInText);
    }

    const literal: CreateQuestionInput = {
      axis: 'LITERAL',
      type: 'OPCION_UNICA',
      prompt: text.literalPrompt,
      expectedAnswer: literalCorrect,
      options: shuffle([literalCorrect, ...literalDecoys.slice(0, 2)]),
      correctOption: literalCorrect,
      approved: true,
    };

    const inferencial: CreateQuestionInput[] = text.inferencial.map((template) => ({
      axis: 'INFERENCIAL',
      type: 'OPCION_UNICA',
      prompt: template.prompt,
      expectedAnswer: template.correct,
      options: shuffle([template.correct, ...template.decoys]),
      correctOption: template.correct,
      approved: true,
    }));

    const critico: CreateQuestionInput[] = text.critico.map((prompt) => ({
      axis: 'CRITICO',
      type: 'ABIERTA',
      prompt,
      expectedAnswer: text.criticoExpected,
      approved: false,
    }));

    const literales: CreateQuestionInput[] = [literal];
    for (const sentence of sentences.slice(3, 5)) {
      const decoys = sentences.filter((s) => s !== sentence).slice(0, 2);
      while (decoys.length < 2) decoys.push(text.notInText);
      literales.push({ ...literal, expectedAnswer: sentence, options: shuffle([sentence, ...decoys]), correctOption: sentence });
    }

    const mix = questionMix(focusAxis);
    return [
      ...literales.slice(0, mix.LITERAL),
      ...inferencial.slice(0, mix.INFERENCIAL),
      ...critico.slice(0, mix.CRITICO),
    ];
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const MIN_READING_WORDS = 40;

export function isReadingLengthValid(text: string, maxChars: number): boolean {
  return countWords(text) >= MIN_READING_WORDS && text.trim().length <= maxChars;
}
