import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupHelpByActivity } from '../src/bll/result.service';

const row = (activityId: string, question: string, minute: number) => ({
  activityId,
  activityName: `Actividad ${activityId}`,
  question,
  answer: `Respuesta a ${question}`,
  declined: false,
  createdAt: new Date(Date.UTC(2026, 9, 20, 10, minute)),
});

test('historial de ayuda: agrupa por actividad, la más reciente primero y las preguntas en orden', () => {
  // El repositorio las devuelve de la más nueva a la más vieja.
  const grouped = groupHelpByActivity([row('b', 'tercera', 30), row('a', 'segunda', 20), row('b', 'primera de b', 10), row('a', 'primera', 5)]);
  assert.deepEqual(
    grouped.map((g) => g.activityId),
    ['b', 'a'],
  );
  assert.deepEqual(
    grouped[0].questions.map((q) => q.question),
    ['primera de b', 'tercera'],
  );
  assert.deepEqual(
    grouped[1].questions.map((q) => q.question),
    ['primera', 'segunda'],
  );
  assert.equal(grouped[1].activityName, 'Actividad a');
  assert.equal(grouped[1].questions[0].askedAt, '2026-10-20T10:05:00.000Z');
});

test('historial de ayuda: sin preguntas queda vacío', () => {
  assert.deepEqual(groupHelpByActivity([]), []);
});
