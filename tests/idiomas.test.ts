import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { localeFromHeaders, toLocale } from '../src/i18n/locale';
import { translateMessage, translatePayload } from '../src/i18n/translate';
import { TemplateQuestionGenerator } from '../src/services/question-generator.service';

test('idioma del pedido: el encabezado propio gana, después Accept-Language y por defecto español', () => {
  assert.equal(localeFromHeaders('en', 'es-AR,es;q=0.9'), 'en');
  assert.equal(localeFromHeaders(undefined, 'en-US,en;q=0.9,es;q=0.8'), 'en');
  assert.equal(localeFromHeaders(undefined, 'fr-FR,es;q=0.5'), 'es');
  assert.equal(localeFromHeaders('pt', undefined), 'es');
  assert.equal(toLocale('EN-gb'), 'en');
});

test('mensajes: traducción exacta, con datos variables y compuestos', () => {
  assert.equal(translateMessage('Actividad no encontrada', 'en'), 'Activity not found');
  assert.equal(translateMessage('Actividad no encontrada', 'es'), 'Actividad no encontrada');
  assert.equal(translateMessage('El rol "jefe" no existe', 'en'), 'The role "jefe" does not exist');
  assert.equal(
    translateMessage('Falta o es inválido el campo «name». El campo «questions» es demasiado corto o tiene pocos elementos', 'en'),
    'The field «name» is missing or invalid The field «questions» is too short or has too few items',
  );
  assert.equal(translateMessage('datos: Debe enviarse al menos un campo de configuración para actualizar', 'en'),
    'datos: At least one configuration field must be sent to update');
  assert.equal(translateMessage('Texto que nadie tradujo', 'en'), 'Texto que nadie tradujo');
});

test('respuestas: se traducen error, message y scoreLabel, y no el contenido del usuario', () => {
  const payload = translatePayload(
    { error: 'Curso no encontrado', items: [{ message: 'Dispositivo verificado.', name: 'Curso no encontrado' }], scoreLabel: 'Fundamenta con el texto' },
    'en',
  );
  assert.deepEqual(payload, {
    error: 'Course not found',
    items: [{ message: 'Device verified.', name: 'Curso no encontrado' }],
    scoreLabel: 'Supports it with the text',
  });
});

test('bitácoras: las descripciones de eventos se leen en inglés', () => {
  assert.equal(translateMessage('Publicó la actividad «Cuento» (HAB-ABCD).', 'en'), 'Published the activity «Cuento» (HAB-ABCD).');
  assert.equal(translateMessage('Creó la actividad.', 'en'), 'Created the activity.');
  assert.equal(translateMessage('Invitó a ana@colegio.edu como Docente.', 'en'), 'Invited ana@colegio.edu as Teacher.');
  assert.equal(translateMessage('Cerró sesión.', 'en'), 'Signed out.');
});

test('preguntas por plantilla en inglés', async () => {
  const questions = await new TemplateQuestionGenerator().generate('The sun is a star. It gives light. Plants need it.', undefined, 'en');
  assert.equal(questions[0].prompt, 'Which of the following sentences appears word for word in the material?');
  assert.ok(questions.every((q) => !/[¿áéíóúñ]/.test(q.prompt)));
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

test('todo mensaje de error fijo del código tiene traducción al inglés', () => {
  const internal = /^(Missing required|GOOGLE_|MICROSOFT_)/;
  const missing: string[] = [];
  for (const file of sourceFiles(join(__dirname, '..', 'src'))) {
    const code = readFileSync(file, 'utf-8');
    for (const match of code.matchAll(/(?:Error|HttpError)\(\s*(?:\d{3},\s*)?'((?:[^'\\]|\\.)+)'\s*\)/g)) {
      const message = match[1].replace(/\\'/g, "'");
      if (internal.test(message)) continue;
      if (translateMessage(message, 'en') === message) missing.push(message);
    }
  }
  assert.deepEqual(missing, []);
});

test('mensajes nuevos: límite de lectura y dispositivos en inglés', () => {
  assert.equal(
    translateMessage('El texto tiene 6200 caracteres y la institución permite hasta 5000', 'en'),
    'The text has 6200 characters and the institution allows up to 5000',
  );
  assert.equal(
    translateMessage('Mateo González ya tiene su cuenta abierta en 2 dispositivos. Pedile a tu docente que cierre la sesión en uno de ellos.', 'en'),
    'Mateo González already has their account open on 2 devices. Ask your teacher to close the session on one of them.',
  );
});
