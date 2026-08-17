# Habitar — Backend

API REST del proyecto Habitar, construida en capas con Node.js, Express, TypeScript y Prisma (PostgreSQL).

## Arquitectura en capas

```
src/
  domain/         Entidades y tipos de negocio puros (sin dependencias de Prisma ni Express)
  dto/            Esquemas Zod para validar el body de las requests
  repositories/   Acceso a datos (Prisma) detrás de interfaces — Data Access Layer
  services/       Lógica de negocio — orquesta repositorios, aplica reglas de dominio
  controllers/    Capa HTTP — parsea el request, llama al service, arma la respuesta
  routes/         Registro de rutas de Express, aplica middlewares por endpoint
  middlewares/    Auth (JWT), validación de body, manejo centralizado de errores
  config/         Variables de entorno, cliente Prisma singleton
  utils/          JWT, errores HTTP tipados
```

Flujo de una request: `routes → middlewares → controller → service → repository → Prisma → PostgreSQL`.

Cada capa solo conoce la inmediatamente inferior. Los `domain/*.ts` no importan nada de Prisma —
los repositorios son responsables de mapear el modelo de Prisma al tipo de dominio (`toDomain`).

## Stack

- **Express 5** — enrutamiento y HTTP
- **Prisma + PostgreSQL** — ORM y base de datos
- **Zod** — validación de DTOs de entrada
- **jsonwebtoken** — sesión vía JWT (login OAuth simulado, igual que el frontend)

## Cómo correrlo (con una base PostgreSQL ya disponible)

```bash
npm install
# completá DATABASE_URL en .env (ver .env.example) apuntando a tu Postgres
npm run prisma:migrate   # aplica las migraciones (o npx prisma migrate deploy en prod)
npm run prisma:seed      # carga los mismos datos de ejemplo que usa el frontend
npm run dev               # levanta la API en http://localhost:4000
```

Otros scripts:
- `npm run build` / `npm start` — build de producción y ejecución de `dist/`
- `npm run prisma:studio` — explorador visual de la base de datos

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

## Generación de preguntas (IA simulada)

`question-generator.service.ts` expone la interfaz `QuestionGenerator`. La implementación actual
(`TemplateQuestionGenerator`) genera preguntas de opción múltiple con distractores reales a partir
del texto ingresado, sin depender de un proveedor externo. El puerto queda listo para reemplazarse
por una llamada real a un LLM sin tocar el resto de las capas.

## Base de datos

PostgreSQL vía Prisma (`prisma/schema.prisma`). No requiere nada instalado localmente: alcanza con
apuntar `DATABASE_URL` a cualquier Postgres accesible (Coolify, Railway, RDS, un contenedor propio, etc).

### Deploy en Coolify (o cualquier hosting con Postgres administrado)

1. Creá un recurso PostgreSQL en Coolify (o el hosting elegido) y copiá su cadena de conexión.
2. En el servicio del backend, seteá `DATABASE_URL="postgresql://usuario:pass@host:5432/db?schema=public"`
   junto con el resto de las variables de `.env.example` (`JWT_SECRET`, `DEEPSEEK_API_KEY`, etc).
3. Aplicá el schema con **una** de estas dos opciones (son equivalentes):
   - `npx prisma migrate deploy` — recomendado: usa las migraciones versionadas en
     `prisma/migrations/` y deja la tabla `_prisma_migrations` lista para futuras migraciones.
   - `psql "$DATABASE_URL" -f prisma/schema.postgresql.sql` — corre el `.sql` plano si preferís
     ejecutarlo a mano (mismo contenido que la migración, sin el tracking de Prisma).
4. (Opcional) `npx prisma db seed` para cargar los datos de ejemplo que usa el frontend.

El SQL completo (23 tablas, enums nativos de Postgres, todas las foreign keys e índices) vive en
[`prisma/schema.postgresql.sql`](prisma/schema.postgresql.sql) y en
[`prisma/migrations/20260817180000_init_postgresql/migration.sql`](prisma/migrations/20260817180000_init_postgresql/migration.sql) —
se generó con `prisma migrate diff --from-empty` (no necesita una base viva para generarse).

Las migraciones viejas en SQLite quedaron archivadas en `prisma/migrations_sqlite_archive/`
(no se aplican más — se conservan solo como historial de cambios de schema).

# Tesis-Habitar-Backend
