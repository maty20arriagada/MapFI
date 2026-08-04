# AGENTS.md

## Quick commands

```bash
npm install            # install deps
npm run dev            # server with nodemon on localhost:3000
npm test               # run all tests (Jest, 93 tests, ~30s timeout)
npm run test:tz        # same suite forcing TZ=UTC (catches timezone-dependent bugs)
npm run db:migrate     # apply SQL migrations manually
npm run docker:db      # start only Postgres in Docker (for local dev)
npm run docker:up      # full stack in Docker (Postgres + server)
```

**No linter, formatter, or typecheck exists.** The only verification command is `npm test`. The codebase is plain JS (no TypeScript, no ESLint, no Prettier).

## Architecture

- **Entry point:** `server.js` — Express app, single file, ~600 lines, ~40 API endpoints.
- **No build step.** Frontend is vanilla HTML/CSS/JS served as static files.
- **Layering:** `server.js` routes → `js/dao/*` (data access) → PostgreSQL. Services in `js/services/*` are pure logic (no DB).
- **FullCalendar** is vendored in `js/vendor/fullcalendar/` — no npm dependency, no CDN. If updating, replace both `.min.js` files.
- **Frontend modules** use IIFEs that bind to `window`. See `js/views/onboarding.js` as a reference pattern. No module bundler.

## Database

- **PostgreSQL 16** with `tstzrange` columns and GiST indexes (migration 001).
- **pg-mem does not support `tstzrange GENERATED ALWAYS`.** Tests use manual mocks, not pg-mem. Do not attempt to migrate DAO tests to pg-mem without removing the generated column.
- **Migrations are additive and idempotent.** They run automatically on server start. Never edit a migration already applied in production — create a new numbered file (`008_*.sql`).
- **`schema_migrations`** table tracks applied versions. Each migration runs in a transaction.
- **Seeds** create a default admin (`admin@mapfi.cl` / `admin1234`) on first run. In production, override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
- **`matricula` table has placeholder values (100 per segment).** Match reach estimates are symbolic until real data is loaded.

## Tests

- **Framework:** Jest with supertest. Test files in `__tests__/` (10 suites).
- **`jest.setup.js`** sets `NODE_ENV=test`, `SESSION_SECRET` dummy, and `TZ=America/Santiago` for deterministic date tests.
- **`--forceExit`** is used because pg-mem/manual mocks may leave open handles.
- **DAO tests use manual mocks** (jest.fn / in-memory objects), not a real or emulated database.
- **To run a single test file:** `npx jest __tests__/server/health.test.js`
- **To run a single suite:** `npx jest -t "API basica"`

## Gotchas

- **Sessions are stored in PostgreSQL** via `connect-pg-simple`. In tests, `NODE_ENV=test` skips the PgSession store, so no DB session persistence.
- **Rate limiting on `/api/auth/login`** is in-memory (a `Map`). Works for single-instance only.
- **CSP uses `script-src 'unsafe-inline'`** because several HTML pages have inline `<script>` tags. Removing it requires extracting all inline JS first.
- **Docker Compose binds server to `127.0.0.1`** — not accessible externally without a reverse proxy.
- **Docker Compose ignores `DATABASE_URL` from `.env`** — it constructs its own using the internal `db:5432` hostname.
- **`server.js` exports `app`** (not starting the listener) when required (for supertest). It only calls `start()` when run directly.

## Conventions

- Language: code comments and docs are in Spanish.
- Backend responses use `{ error: "..." }` for errors, `{ ok: true }` for success.
- Roles: `ADMIN`, `APORTANTE`. Authorization helpers: `requireAuth`, `requireRole("ADMIN")`.
- Activity states: `CONFIRMADA`, `PROPUESTA`, `SUSPENDIDA`.
- All HTML pages reference IDs that JS modules depend on. If you change an HTML element ID, search `js/views/` for references.

## Key files

| File | Role |
|------|------|
| `server.js` | Express app, all routes, auth, middleware |
| `js/db/migrate.js` | Migration runner + admin seed |
| `js/dao/*.js` | Data access per entity (9 DAOs) |
| `js/services/matchService.js` | Match algorithm (pure logic) |
| `js/services/heatmapService.js` | Heatmap builder (pure logic) |
| `js/sanitize.js` | `escapeHtml()` — used across all views |
| `js/views/*.js` | Frontend modules (IIFE pattern) |
| `HANDOFF.md` | Full project context and known issues |
| `PLAN_DE_IMPLEMENTACION.md` | Feature roadmap and phase status |
