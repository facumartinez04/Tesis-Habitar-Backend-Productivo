// Pruebas de las reglas de producto que la tesis promete. No necesitan base de datos.
// Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScores, pseudonymize } from '../src/services/activity.service';
import { criticoFromAnswers } from '../src/repositories/response.repository';
import { resolveStudentIdentity } from '../src/services/student-identity';
import { activityWindow, hasClosed, hasOpened, SUBMIT_GRACE_MS } from '../src/services/activity-window';
import { questionMix } from '../src/services/ai-question-generator.service';
import { classify } from '../src/services/result.service';
import type { Question } from '../src/domain/question';

function q(id: string, axis: Question['axis'], correctOption: string | null): Question {
  return {
    id,
    activityId: 'a1',
    axis,
    prompt: `pregunta ${id}`,
    expectedAnswer: '',
    options: correctOption ? [correctOption, 'otra', 'tercera'] : null,
    correctOption,
    edited: false,
    approved: true,
    order: 0,
  };
}

const preguntas = [q('l1', 'LITERAL', 'A'), q('i1', 'INFERENCIAL', 'B'), q('i2', 'INFERENCIAL', 'C'), q('i3', 'INFERENCIAL', 'D'), q('c1', 'CRITICO', null)];

test('eje crítico: con una respuesta abierta sin revisar queda pendiente, nunca en 50', () => {
  const { scores, criticoReviewed } = computeScores(preguntas, [
    { questionId: 'l1', selectedOption: 'A', textAnswer: null },
    { questionId: 'i1', selectedOption: 'B', textAnswer: null },
    { questionId: 'i2', selectedOption: 'otra', textAnswer: null },
    { questionId: 'i3', selectedOption: 'D', textAnswer: null },
    { questionId: 'c1', selectedOption: null, textAnswer: 'Estoy de acuerdo porque el texto dice que...' },
  ]);
  assert.equal(scores.literal, 100);
  assert.equal(scores.inferencial, 67);
  assert.equal(scores.critico, null);
  assert.equal(criticoReviewed, false);
});

test('eje crítico: la respuesta abierta en blanco vale 0 y no espera revisión', () => {
  const { scores, criticoReviewed } = computeScores(preguntas, [
    { questionId: 'c1', selectedOption: null, textAnswer: null, autoScore: 0 },
  ]);
  assert.equal(scores.critico, 0);
  assert.equal(criticoReviewed, true);
});

test('preguntas cerradas sin responder cuentan como incorrectas (envío automático parcial)', () => {
  const { scores } = computeScores(preguntas, [{ questionId: 'i1', selectedOption: 'B', textAnswer: null }]);
  assert.equal(scores.literal, 0);
  assert.equal(scores.inferencial, 33);
});

test('un eje sin preguntas queda sin dato', () => {
  const { scores } = computeScores([q('l1', 'LITERAL', 'A')], [{ questionId: 'l1', selectedOption: 'A', textAnswer: null }]);
  assert.equal(scores.inferencial, null);
  assert.equal(scores.critico, null);
});

test('crítico revisado por el docente: puntaje de 0 a 3 llevado a 0–100, combinado con cerradas', () => {
  assert.deepEqual(criticoFromAnswers([{ correctOption: null, selectedOption: null, teacherScore: 3 }]), {
    criticoScore: 100,
    criticoReviewed: true,
  });
  assert.deepEqual(
    criticoFromAnswers([
      { correctOption: null, selectedOption: null, teacherScore: 2 },
      { correctOption: 'X', selectedOption: 'Y', teacherScore: null },
    ]),
    { criticoScore: 33, criticoReviewed: true },
  );
});

test('identificación por número de lista: acepta 12, N.º 12 y #12; rechaza nombres', () => {
  for (const raw of ['12', 'N.º 12', 'n 12', '#12', ' 12 ']) {
    assert.equal(resolveStudentIdentity('LISTA', raw).displayName, 'N.º 12', raw);
  }
  assert.throws(() => resolveStudentIdentity('LISTA', 'Mateo González'));
  assert.throws(() => resolveStudentIdentity('LISTA', '0'));
  assert.equal(resolveStudentIdentity('NOMBRE', '  Mateo   González ').displayName, 'Mateo González');
  assert.equal(resolveStudentIdentity('NOMBRE', 'Mateo González').normalized, 'mateo gonzalez');
});

test('ventana horaria en hora argentina, con tolerancia para el envío automático', () => {
  const act = { availableFrom: '2026-10-18', startTime: '08:00', endTime: '12:00' };
  const { opensAt, closesAt } = activityWindow(act);
  assert.equal(opensAt?.toISOString(), '2026-10-18T11:00:00.000Z');
  assert.equal(closesAt?.toISOString(), '2026-10-18T15:00:00.000Z');
  assert.equal(hasOpened(act, Date.parse('2026-10-18T10:59:00Z')), false);
  assert.equal(hasOpened(act, Date.parse('2026-10-18T11:00:00Z')), true);
  assert.equal(hasClosed(act, Date.parse('2026-10-18T15:00:00Z') + SUBMIT_GRACE_MS - 1), false);
  assert.equal(hasClosed(act, Date.parse('2026-10-18T15:00:00Z') + SUBMIT_GRACE_MS + 1), true);
  // Un horario inválido no cierra la actividad.
  assert.equal(hasClosed({ availableFrom: '2026-10-18', startTime: '12:00', endTime: '08:00' }, Date.now() + 1e12), false);
});

test('a la IA no le llega el nombre del alumno ni el de la institución', () => {
  const texto = 'Yo, Mateo González, del Colegio San José, opino que mateo tiene razón.';
  const salida = pseudonymize(texto, ['Mateo González', 'Colegio San José']);
  assert.ok(!/mateo|gonz|san jos/i.test(salida), salida);
  // Los tokens cortos no se reemplazan, para no romper el texto.
  assert.equal(pseudonymize('Ana fue al río', ['Al']), 'Ana fue al río');
});

test('mezcla de preguntas: 1/3/1 sin foco, 3 del eje foco con foco', () => {
  assert.deepEqual(questionMix(), { LITERAL: 1, INFERENCIAL: 3, CRITICO: 1 });
  assert.deepEqual(questionMix('CRITICO'), { LITERAL: 1, INFERENCIAL: 1, CRITICO: 3 });
});

test('clasificación del alumno: un eje sin dato no lo hace bajar', () => {
  assert.equal(classify({ literal: 80, inferencial: 70, critico: null }), 'BIEN');
  assert.equal(classify({ literal: 30, inferencial: null, critico: null }), 'BAJO');
  assert.equal(classify({ literal: null, inferencial: null, critico: null }), 'SIN_DATOS');
});
