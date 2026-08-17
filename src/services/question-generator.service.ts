import type { CreateQuestionInput } from '../domain/activity';

export interface QuestionGenerator {
  generate(sourceText: string): Promise<CreateQuestionInput[]>;
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

export class TemplateQuestionGenerator implements QuestionGenerator {
  async generate(sourceText: string): Promise<CreateQuestionInput[]> {
    const sentences = splitSentences(sourceText);
    const literalCorrect = sentences[0] ?? sourceText.slice(0, 120);
    const literalDecoys = sentences.slice(1, 3);
    while (literalDecoys.length < 2) {
      literalDecoys.push('Esta afirmación no aparece en el texto');
    }

    const literal: CreateQuestionInput = {
      axis: 'LITERAL',
      prompt: '¿Cuál de las siguientes frases aparece textualmente en el material?',
      expectedAnswer: literalCorrect,
      options: shuffle([literalCorrect, ...literalDecoys.slice(0, 2)]),
      correctOption: literalCorrect,
      approved: true,
    };

    const inferencialTemplates: Array<{ prompt: string; correct: string; decoys: string[] }> = [
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
    ];

    const inferencial: CreateQuestionInput[] = inferencialTemplates.map((template) => ({
      axis: 'INFERENCIAL',
      prompt: template.prompt,
      expectedAnswer: template.correct,
      options: shuffle([template.correct, ...template.decoys]),
      correctOption: template.correct,
      approved: true,
    }));

    const critico: CreateQuestionInput = {
      axis: 'CRITICO',
      prompt: '¿Estás de acuerdo con la perspectiva planteada en el texto? Justificá tu respuesta.',
      expectedAnswer: '(respuesta abierta — justificación con argumentos del texto)',
      approved: false,
    };

    return [literal, ...inferencial, critico];
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isWordCountValid(wordCount: number, min = 40, max = 600): boolean {
  return wordCount >= min && wordCount <= max;
}
