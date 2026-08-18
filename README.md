# Habitar — Backend

API REST del proyecto Habitar, construida en capas con Node.js, Express, TypeScript y SQL plano
(`pg`) sobre PostgreSQL.

## Arquitectura en capas

```
src/
  domain/         Entidades y tipos de negocio puros (sin dependencias de pg ni Express)
  dto/            Esquemas Zod para validar el body de las requests
  repositories/   Acceso a datos — SQL plano vía `pg` detrás de interfaces (Data Access Layer)
  services/       Lógica de negocio — orquesta repositorios, aplica reglas de dominio
  controllers/    Capa HTTP — parsea el request, llama al service, arma la respuesta
  routes/         Registro de rutas de Express, aplica middlewares por endpoint
  middlewares/    Auth (JWT), validación de body, manejo centralizado de errores
  config/         Variables de entorno, pool de conexión (`config/db.ts`)
  utils/          JWT, errores HTTP tipados
db/
  migrations/     Migraciones SQL versionadas, numeradas y aplicadas en orden
scripts/
  migrate.ts      Corre las migraciones pendientes (tracking en la tabla "_migrations")
  seed.ts         Carga los datos de ejemplo que usa el frontend
```

Flujo de una request: `routes → middlewares → controller → service → repository → pg → PostgreSQL`.

Cada capa solo conoce la inmediatamente inferior. Los `domain/*.ts` no importan nada de `pg` —
los repositorios son responsables de mapear las filas devueltas por Postgres al tipo de dominio.

## Stack

- **Express 5** — enrutamiento y HTTP
- **pg (node-postgres) + PostgreSQL** — acceso a datos por SQL plano, sin ORM
- **Zod** — validación de DTOs de entrada
- **jsonwebtoken** — sesión vía JWT (login OAuth simulado, igual que el frontend)

## Cómo correrlo (con una base PostgreSQL ya disponible)

```bash
npm install
# completá DATABASE_URL en .env (ver .env.example) apuntando a tu Postgres
npm run db:migrate   # aplica las migraciones de db/migrations/ (idempotente)
npm run db:seed      # carga los mismos datos de ejemplo que usa el frontend
npm run dev            # levanta la API en http://localhost:4000
```

Otros scripts:
- `npm run build` / `npm start` — build de producción y ejecución de `dist/` (`start` corre
  `db:migrate` antes de levantar el server, así que las migraciones nuevas se aplican solas en cada deploy).

## Autenticación

`POST /api/auth/login` con `{ "provider": "GOOGLE" | "MICROSOFT" }` simula el login OAuth (igual
que hoy hace el frontend) y devuelve un JWT propio. `GOOGLE` resuelve al usuario docente semilla,
`MICROSOFT` al coordinador. Las rutas protegidas requieren `Authorization: Bearer <token>`.

## Endpoints principales

| Método | Ruta | Rol requerido |
|---|---|---|
| POST | `/api/auth/login` | público |
| GET | `/api/auth/me` | autenticado |
| GET/POST | `/api/institutions` | ADMIN |
| GET | `/api/institutions/:slug` | autenticado |
| GET | `/api/institutions/:id/alerts` | COORDINADOR/ADMIN |
| GET | `/api/institutions/:id/results` | COORDINADOR/ADMIN |
| POST | `/api/activities/generate-questions` | DOCENTE |
| POST | `/api/activities` | DOCENTE |
| GET | `/api/activities/:code` | público |
| POST | `/api/activities/:code/responses` | público (alumno sin login) |
| GET | `/api/results/courses/:courseId` | DOCENTE/COORDINADOR/ADMIN |
| GET | `/api/results/students/:studentId` | DOCENTE/COORDINADOR/ADMIN |
| GET/POST/DELETE | `/api/compliance/*` | COORDINADOR/ADMIN |
| GET/PATCH/POST | `/api/subscriptions/*` | ADMIN |
| GET/POST | `/api/oauth/:institutionId/*` | ADMIN |
| GET | `/api/monitoring` | ADMIN |

## Generación de preguntas con IA

`question-generator.service.ts` expone la interfaz `QuestionGenerator`. Si hay `DEEPSEEK_API_KEY`
configurada, se usa la API real de DeepSeek (`deepseek-question-generator.service.ts`); si no, cae
al `TemplateQuestionGenerator` (opción múltiple con distractores reales, sin proveedor externo).

## Base de datos

PostgreSQL, sin ORM — las queries están escritas a mano en cada repository usando `pg`. No requiere
nada instalado localmente: alcanza con apuntar `DATABASE_URL` a cualquier Postgres accesible
(Neon, Coolify, Railway, RDS, un contenedor propio, etc).

Los ids de todas las tablas se generan del lado de la base (`gen_random_uuid()`, vía la extensión
`pgcrypto`) — los repositories no arman los ids en JS, solo hacen `INSERT ... RETURNING`.

### Migraciones

`db/migrations/*.sql`, aplicadas en orden por nombre de archivo. `npm run db:migrate` (o
`tsx scripts/migrate.ts`) crea una tabla `_migrations` que trackea cuáles ya corrieron, así que es
seguro correrlo en cada deploy — las que ya se aplicaron se saltean.

Para agregar un cambio de schema: crear un nuevo archivo `db/migrations/00N_descripcion.sql` con el
`ALTER TABLE`/`CREATE TABLE` que corresponda y correr `npm run db:migrate`.

### Deploy en Coolify (con Neon como base de datos)

La base de datos recomendada es **Neon** (neon.tech, Postgres administrado en la nube) — no
requiere Postgres propio en Coolify.

1. Creá un proyecto en Neon y copiá la connection string **"direct"** (no la "pooled"/PgBouncer).
   Tiene que incluir `sslmode=require`:
   `postgresql://usuario:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`
2. En el servicio del backend en Coolify (pestaña **Environment Variables**), seteá `DATABASE_URL`
   con esa string, junto con `JWT_SECRET` (cualquier string random) y el resto de `.env.example`.
3. El comando `start` (`npm run db:migrate && node dist/server.js`) aplica las migraciones
   automáticamente contra Neon en cada arranque — no hace falta correrlas a mano.
4. (Opcional) `npm run db:seed` para cargar los datos de ejemplo que usa el frontend.

# Tesis-Habitar-Backend
