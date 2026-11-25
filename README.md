# Habitar — Backend

API REST de Habitar, la plataforma de comprensión lectora con IA. Está hecha con Node.js, Express 5
y TypeScript, usa PostgreSQL con SQL escrito a mano (`pg`, sin ORM) y Socket.IO para el tiempo real.

El frontend está en [Tesis-Habitar-Frontend-Productivo](https://github.com/facumartinez04/Tesis-Habitar-Frontend-Productivo).

## Arquitectura en capas

```
src/
  routes/        Rutas de Express y middlewares de cada endpoint
  middlewares/   Autenticación (JWT), permisos por rol, validación, idioma y errores
  controllers/   Capa HTTP: lee la solicitud, llama a la lógica de negocio y arma la respuesta
  bll/           Lógica de negocio (reglas de actividades, corrección, sesiones, costos de IA…)
  dal/           Acceso a datos: repositorios con SQL sobre PostgreSQL
  services/      Integraciones externas: IA (DeepSeek/OpenAI), Mercado Pago, correo, identidad
  domain/        Entidades y tipos del negocio
  dto/           Esquemas Zod de los datos de entrada
  realtime/      Socket.IO y reloj de las actividades
  i18n/          Mensajes en español e inglés
  config/        Variables de entorno, conexión a la base y migraciones
db/migrations/   Migraciones SQL numeradas
scripts/         migrate.ts y seed.ts
tests/           Pruebas con node:test
```

Flujo de una solicitud: `routes → middlewares → controllers → bll → dal → PostgreSQL`.

## Cómo correrlo

Requiere Node.js 22 y una base PostgreSQL.

```bash
npm install
cp .env.example .env   # completar DATABASE_URL y JWT_SECRET como mínimo
npm run dev            # API en http://localhost:4000
```

Al iniciar, el servidor aplica las migraciones pendientes de `db/migrations/`.

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` / `npm start` | Compila a `dist/` y lo ejecuta |
| `npm run db:migrate` | Aplica las migraciones a mano |
| `npm run db:seed` | Carga datos de ejemplo (solo contra una base local) |
| `npm test` | Corre las pruebas de `tests/` |

## Autenticación

El ingreso es con Google o Microsoft 365 (OAuth 2.0 / OpenID Connect con PKCE). La institución se
resuelve por el dominio del correo o por la cuenta dada de alta; con Microsoft además se controla
la organización (tenant) de la institución. La sesión usa un token de acceso JWT y un token de
renovación en una cookie httpOnly que rota en cada uso.

Los alumnos no tienen cuenta: entran a la actividad con el QR del aula o el código, y se
identifican con nombre y apellido.

## Rutas

Todas cuelgan de `/api`:

| Prefijo | Contenido |
| :--- | :--- |
| `/auth` | Ingreso con Google y Microsoft, sesión, renovación y cierre |
| `/institutions` | Instituciones, configuración, usuarios y alertas |
| `/courses` | Aulas, QR fijo, docentes y alumnos |
| `/activities` | Actividades, preguntas, documento, respuestas y ayuda de lectura |
| `/results`, `/dashboard`, `/feedback` | Resultados, tablero y devolución |
| `/roles` | Roles y permisos |
| `/compliance` | Consentimientos y derechos ARCO |
| `/subscriptions`, `/finances` | Planes, pagos y Mercado Pago |
| `/logs`, `/monitoring`, `/status` | Bitácoras, monitoreo y estado del servicio |
| `/admin` | Datos de cada institución para el administrador de la plataforma |
| `/oauth`, `/jira` | Activación de proveedores e integración con Jira |

## IA

Las preguntas, la corrección de respuestas abiertas, la ayuda de lectura y la lectura de PDF usan
DeepSeek u OpenAI. Cada institución puede usar la clave de la plataforma (con un tope de gasto
mensual) o la propia. Sin IA disponible, las preguntas salen de plantillas y la corrección queda a
cargo del docente.
