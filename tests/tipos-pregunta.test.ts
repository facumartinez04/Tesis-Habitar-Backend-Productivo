import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeClosed, normalizeAnswer, normalizeQuestionInput } from '../src/bll/question-grading';
import { computeScores } from '../src/bll/activity.service';
import { TemplateQuestionGenerator } from '../src/services/question-generator.service';
import type { Question } from '../src/domain/question';

const base = { options: null, correctOption: null, correctOptions: null, acceptedAnswers: null };

test('opción única y verdadero/falso: acierta sólo la correcta', () => {
  const q = { ...base, type: 'VERDADERO_FALSO' as const, options: ['Verdadero', 'Falso'], correctOption: 'Falso' };
  assert.equal(gradeClosed(q, { selectedOption: 'Falso' }), 1);
  assert.equal(gradeClosed(q, { selectedOption: 'Verdadero' }), 0);
  assert.equal(gradeClosed(q, undefined), 0);
});

test('opción múltiple: puntaje parcial y las incorrectas restan', () => {
  const q = { ...base, type: 'OPCION_MULTIPLE' as const, options: ['a', 'b', 'c', 'd'], correctOptions: ['a', 'b'] };
  assert.equal(gradeClosed(q, { selectedOptions: ['a', 'b'] }), 1);
  assert.equal(gradeClosed(q, { selectedOptions: ['a'] }), 0.5);
  assert.equal(gradeClosed(q, { selectedOptions: ['a', 'c'] }), 0);
  assert.equal(gradeClosed(q, { selectedOptions: ['c', 'd'] }), 0);
});

test('completar: ignora mayúsculas, tildes y signos, y acepta sinónimos', () => {
  const q = { ...base, type: 'COMPLETAR' as const, acceptedAnswers: ['ecosistema', 'ambiente'] };
  assert.equal(normalizeAnswer('  Ecosistéma! '), 'ecosistema');
  assert.equal(gradeClosed(q, { textAnswer: 'ECOSISTÉMA' }), 1);
  assert.equal(gradeClosed(q, { textAnswer: 'ambiente.' }), 1);
  assert.equal(gradeClosed(q, { textAnswer: 'planeta' }), 0);
});

test('normalizar: completar agrega el espacio en blanco y múltiple exige alguna correcta', () => {
  const completar = normalizeQuestionInput({ axis: 'LITERAL', type: 'COMPLETAR', prompt: 'El agua es', expectedAnswer: 'vital', approved: true });
  assert.ok(completar.prompt.includes('___'));
  assert.deepEqual(completar.acceptedAnswers, ['vital']);
  assert.throws(() =>
    normalizeQuestionInput({ axis: 'LITERAL', type: 'OPCION_MULTIPLE', prompt: '¿Cuáles?', expectedAnswer: '', options: ['a', 'b'], correctOptions: ['z'], approved: true }),
  );
});

test('el puntaje del eje suma fracciones de distintos tipos', () => {
  const q = (id: string, extra: Partial<Question>): Question => ({
    id, activityId: 'a', axis: 'LITERAL', prompt: '', expectedAnswer: '', edited: false, approved: true, order: 0,
    type: 'OPCION_UNICA', options: ['x', 'y'], correctOption: 'x', correctOptions: null, acceptedAnswers: null, ...extra,
  });
  const questions = [
    q('1', {}),
    q('2', { type: 'OPCION_MULTIPLE', options: ['a', 'b', 'c'], correctOption: null, correctOptions: ['a', 'b'] }),
    q('3', { type: 'COMPLETAR', options: null, correctOption: null, acceptedAnswers: ['sol'] }),
  ];
  const { scores } = computeScores(questions, [
    { questionId: '1', selectedOption: 'x', textAnswer: null },
    { questionId: '2', selectedOption: null, selectedOptions: ['a'], textAnswer: null },
    { questionId: '3', selectedOption: null, textAnswer: 'Sol' },
  ]);
  assert.equal(scores.literal, 83);
});

test('las plantillas sin IA alternan los tipos pedidos', async () => {
  const text = 'El sol es una estrella enorme. Las plantas necesitan luz para crecer. Sin agua no hay vida posible. Los animales dependen de las plantas.';
  const questions = await new TemplateQuestionGenerator().generate(text, undefined, 'es', ['VERDADERO_FALSO', 'COMPLETAR', 'OPCION_MULTIPLE']);
  const types = new Set(questions.map((q) => q.type));
  assert.ok(types.has('VERDADERO_FALSO'));
  assert.ok(types.has('ABIERTA'));
  for (const q of questions) assert.doesNotThrow(() => normalizeQuestionInput(q));
});
