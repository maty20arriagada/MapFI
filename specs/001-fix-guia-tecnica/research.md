# Research: alineación de la documentación técnica con el código real

**Feature**: 001-fix-guia-tecnica · **Fase**: 0 (Outline & Research)

No había ítems `NEEDS CLARIFICATION` en el Technical Context (la fuente de verdad
es el repositorio, que se puede inspeccionar directamente). Esta "investigación"
es la **auditoría** de lo que cada documento afirma hoy frente a lo que el código
realmente hace. Cada hallazgo se resuelve como una Decisión.

---

## D1 — Patrón real de test de DAOs

- **Decisión**: documentar que los DAOs se prueban con **mock manual de `js/db`**
  vía `jest.mock("../../js/db", () => …)`, que simula `pool`/`client` y responde a
  los SQL por patrón (`__tests__/dao/actividadDao.test.js`, `userDao.test.js`).
- **Rationale**: es lo que el código hace hoy. La guía dice "pg-mem", que induce a
  instalar/aprender una herramienta que el proyecto no usa (US1, FR-002).
- **Alternativas consideradas**: migrar los tests a `pg-mem` para que la guía sea
  cierta — **rechazado**: el spec (Assumptions) fija que se documenta la realidad,
  no se cambia el código de los tests.

## D2 — Carpeta real de los tests de DAO

- **Decisión**: la ruta correcta es **`__tests__/dao/`** (no `__tests__/db/`).
- **Rationale**: `__tests__/dao/` es la carpeta que existe y contiene los tests de
  DAO. La guía (Sección 2 "agregar entidad" y Sección 6 tabla) apunta a otra
  carpeta → genera archivos en el lugar equivocado (FR-001, edge case).
- **Alternativas**: renombrar carpetas — **rechazado** (Assumptions: no se mueven
  ni renombran carpetas de test).

## D3 — Tests de API: dos carpetas con propósitos distintos

- **Decisión**: documentar que existen **`__tests__/server/`** y
  **`__tests__/routes/`**. `server/` prueba salud y gating de autorización contra
  la app real con supertest (sin tocar BD); `routes/` prueba rutas con supertest
  **mockeando `js/db`** para simular respuestas de datos.
- **Rationale**: la tabla de Testing hoy no refleja ambas ni las distingue (FR-004).
- **Alternativas**: unificar en una carpeta — **rechazado** (no se cambia el código).

## D4 — `pg-mem` declarado pero no usado

- **Decisión**: señalar explícitamente que `pg-mem` figura en `devDependencies` de
  `package.json` pero **ningún test lo usa** actualmente.
- **Rationale**: evita que alguien lo asuma como el mecanismo vigente (FR-003, edge
  case). Es información necesaria para no perder tiempo.
- **Alternativas**: quitar `pg-mem` del `package.json` — **fuera de alcance** (esto
  es una corrección documental; la limpieza de dependencias es otra tarea).

## D5 — Referencias al proyecto externo "el simulador"

- **Decisión**: eliminar las **4** referencias y sustituir cada justificación por
  una razón propia de MapFI (o quitarla si no aporta).
- **Ubicaciones detectadas** (fuente de verdad):
  - `docs/GUIA_TECNICA.md:58` — "CommonJS …, igual que el simulador".
  - `docs/ARQUITECTURA.md:3` — "Espeja el patrón del Simulador Marketing B2B …".
  - `docs/ARQUITECTURA.md:104` — "… igual que el simulador" (armado de `DATABASE_URL`).
  - `docs/ARQUITECTURA.md:114` — "… alineado con 'cero capacitación' y con el simulador".
- **Rationale**: quien lee no conoce ese proyecto; la comparación no informa y da
  impresión de copia sin revisar (US3, FR-006). Las decisiones se sostienen solas:
  CommonJS por simplicidad sin build; `DATABASE_URL` interno por la red de Docker;
  sin framework por mantenibilidad y "cero capacitación" (Principios I y VI de la
  constitución).
- **Alternativas**: dejar las referencias como contexto histórico — **rechazado**
  (SC-003 exige 0 coincidencias).

## D6 — Diagrama de `js/` incompleto

- **Decisión**: actualizar el diagrama (Sección 7) para incluir **al menos un
  ejemplo por carpeta real de primer nivel** de `js/`: `dao/`, `services/`,
  `views/`, `db/`, `vendor/`, más los módulos raíz que hoy faltan (`admin-panel.js`,
  `app-boot.js`, `csv-utils.js`, `filters.js`, `horarios-view.js`, `kpis-view.js`,
  `layout.js`, `sanitize.js`).
- **Rationale**: el diagrama es la referencia rápida para ubicar código nuevo; si
  omite carpetas, se duplica o se ubica inconsistente (US2, FR-005).
- **Alternativas**: listar exhaustivamente cada archivo — **rechazado**: invita a
  re-desactualización (edge case). Se usa un ejemplo representativo por carpeta.

## D7 — Preservar el alcance de ambos documentos

- **Decisión**: conservar intactas las secciones ya correctas (convenciones,
  migraciones, errores/logging en la guía; capas, flujo de match, seguridad,
  configuración por entorno, escalabilidad en arquitectura). Los cambios se limitan
  a lo señalado en D1–D6.
- **Rationale**: FR-007 y FR-009 exigen no reducir la guía a solo testing/estructura
  ni tocar contenido ya verificado como correcto.

---

**Salida**: todas las decisiones resueltas; sin `NEEDS CLARIFICATION` pendientes.
Listo para Phase 1.
