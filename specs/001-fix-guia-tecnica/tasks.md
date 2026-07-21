# Tasks: Documentación técnica alineada con el código real

**Input**: Design documents from `/specs/001-fix-guia-tecnica/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks organized by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in all descriptions

---

## Phase 1: Setup (Auditoría inicial)

**Purpose**: Verificar la estructura real del repositorio antes de editar documentación

- [x] T001 Listar carpetas reales de `__tests__/` y confirmar que existen `services/`, `dao/`, `routes/`, `server/` en `__tests__/`
- [x] T002 Listar carpetas reales de `js/` y confirmar que existen `dao/`, `services/`, `views/`, `db/`, `vendor/` y los 16 módulos raíz
- [x] T003 Verificar que `package.json` contiene `pg-mem` en `devDependencies`
- [x] T004 Verificar que ningún test en `__tests__/dao/` usa `pg-mem` (grep para confirmar patrón real: `jest.mock`)
- [x] T005 [P] Extraer todas las rutas tipo `js/...`, `__tests__/...`, `db/...` mencionadas en `docs/GUIA_TECNICA.md` y comprobar que existen
- [x] T006 [P] Extraer todas las rutas tipo `js/...`, `__tests__/...`, `db/...` mencionadas en `docs/ARQUITECTURA.md` y comprobar que existen

---

## Phase 2: Foundational (Identificar diferencias)

**Purpose**: Documentar las brechas exactas entre lo que dicen los documentos y la realidad

- [x] T007 Identificar en `docs/GUIA_TECNICA.md` línea 43 la ruta incorrecta `__tests__/db/miEntidadDao.test.js` y la mención a `pg-mem`
- [x] T008 Identificar en `docs/GUIA_TECNICA.md` línea 75 la referencia "igual que el simulador"
- [x] T009 Identificar en `docs/GUIA_TECNICA.md` líneas 97-98 la tabla de Testing con DAO en `__tests__/db/` y sin `__tests__/routes/`
- [x] T010 Identificar en `docs/GUIA_TECNICA.md` líneas 112-124 el diagrama de `js/` incompleto (faltan `views/`, `vendor/`, módulos raíz)
- [x] T011 Identificar en `docs/ARQUITECTURA.md` línea 121 la referencia "igual que el simulador"
- [x] T012 Identificar en `docs/ARQUITECTURA.md` línea 131 la referencia "y con el simulador"

**Checkpoint**: Diferencias documentadas, listo para implementar correcciones

---

## Phase 3: User Story 1 — Testing correcto (Priority: P1) 🎯 MVP

**Goal**: Que una persona nueva sepa exactamente dónde y cómo testear un DAO nuevo, sin preguntar a nadie

**Independent Test**: Leer §2 y §6 de la guía, crear un DAO de prueba en `__tests__/dao/` con `jest.mock("../../js/db")`, verificar que Jest lo ejecuta

### Implementation for User Story 1

- [x] T013 [US1] Corregir `docs/GUIA_TECNICA.md` línea 43: cambiar `__tests__/db/miEntidadDao.test.js` con `pg-mem` por `__tests__/dao/miEntidadDao.test.js` con mock manual de `js/db` vía `jest.mock("../../js/db")` (FR-001, FR-002)
- [x] T014 [US1] Corregir `docs/GUIA_TECNICA.md` tabla §6 Testing: cambiar fila DAO de `Jest + pg-mem | __tests__/db/` a `Jest + jest.mock("../../js/db") | __tests__/dao/` (FR-001, FR-002)
- [x] T015 [US1] Agregar a `docs/GUIA_TECNICA.md` tabla §6 Testing fila para `__tests__/routes/`: `API (rutas mockeadas) | Jest + supertest + jest.mock("../../js/db") | __tests__/routes/` (FR-004)
- [x] T016 [US1] Agregar nota en `docs/GUIA_TECNICA.md` §6 Testing indicando que `pg-mem` figura en `devDependencies` pero ningún test lo usa actualmente (FR-003)
- [x] T017 [US1] Actualizar ejemplo de test en `docs/GUIA_TECNICA.md` §2 para mostrar el patrón real con `jest.mock("../../js/db", () => ({ pool: { query: jest.fn() } }))` en vez de `pg-mem`

**Checkpoint**: §2 y §6 de la guía describen correctamente dónde y cómo testear DAOs

---

## Phase 4: User Story 2 — Diagrama completo de js/ (Priority: P2)

**Goal**: Que el diagrama de estructura de `js/` refleje fielmente todas las carpetas y módulos reales

**Independent Test**: Comparar el diagrama actualizado contra el listado real de `ls js/` y verificar que todas las carpetas de primer nivel están representadas

### Implementation for User Story 2

- [x] T018 [US2] Reemplazar diagrama de `docs/GUIA_TECNICA.md` §7 Estructura de `js/` por uno completo que incluya todas las carpetas reales de primer nivel: `dao/`, `services/`, `views/`, `db/`, `vendor/` (FR-005)
- [x] T019 [US2] Agregar al diagrama de `docs/GUIA_TECNICA.md` §7 los módulos raíz que faltan: `admin-panel.js`, `app-boot.js`, `csv-utils.js`, `filters.js`, `horarios-view.js`, `kpis-view.js`, `layout.js`, `sanitize.js` (FR-005)
- [x] T020 [US2] Agregar al diagrama de `docs/GUIA_TECNICA.md` §7 la carpeta `js/views/` con ejemplos representativos (`calendario-view.js`, `dashboard-view.js`, `onboarding.js`, `tour.js`) (FR-005)
- [x] T021 [US2] Agregar al diagrama de `docs/GUIA_TECNICA.md` §7 la carpeta `js/vendor/` con nota de que contiene FullCalendar vendoreado (FR-005)
- [x] T022 [US2] Agregar al diagrama de `docs/GUIA_TECNICA.md` §7 la carpeta `js/db/` con archivos `index.js`, `migrate.js`, `reset-admin.js` (FR-005)

**Checkpoint**: El diagrama de `js/` cubre todas las carpetas reales con al menos un ejemplo por carpeta

---

## Phase 5: User Story 3 — Sin referencias al simulador (Priority: P3)

**Goal**: Eliminar toda mención al proyecto externo "el simulador" y re-justificar con razones propias de MapFI

**Independent Test**: `grep -rniE "simulador|marketing" docs/GUIA_TECNICA.md docs/ARQUITECTURA.md` devuelve 0 coincidencias

### Implementation for User Story 3

- [x] T023 [US3] Eliminar de `docs/GUIA_TECNICA.md` línea 75 la referencia "igual que el simulador" y reemplazar por justificación propia: "CommonJS por simplicidad y compatibilidad con el ecosistema Node.js sin necesidad de herramientas de build" (FR-006)
- [x] T024 [US3] Eliminar de `docs/ARQUITECTURA.md` línea 121 la referencia "igual que el simulador" y reemplazar por justificación propia: "Docker Compose construye `DATABASE_URL` con el host interno `db:5432` para que el backend se conecte al contenedor de PostgreSQL dentro de la red interna de Docker" (FR-006)
- [x] T025 [US3] Eliminar de `docs/ARQUITECTURA.md` línea 131 la referencia "y con el simulador" y reemplazar por justificación propia: "Sin framework frontend: menos superficie de mantenimiento, alineado con el Principio I (Simplicidad sin build) y el Principio VI (cero capacitación) de la constitución" (FR-006)
- [x] T026 [US3] Verificar que el encabezado de `docs/ARQUITECTURA.md` ya no contiene "Simulador Marketing B2B" (ya corregido previamente, solo verificar)

**Checkpoint**: 0 coincidencias de "simulador" o "marketing" en ambos documentos

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validación final, preservación de alcance, y verificación de integridad

- [x] T027 Verificar que `docs/GUIA_TECNICA.md` conserva intactas las secciones §3 (endpoint), §4 (convenciones), §5 (migraciones), §8 (errores/logging) — FR-007, FR-009
- [x] T028 Verificar que `docs/ARQUITECTURA.md` conserva intactas las secciones §1 (vista alto nivel), §2 (capas), §3 (flujo petición), §4 (migraciones), §5 (seguridad), §8 (escalabilidad) — FR-007
- [x] T029 Ejecutar Escenario 1 del quickstart: `grep -rniE "simulador|marketing" docs/GUIA_TECNICA.md docs/ARQUITECTURA.md` → debe fallar (sin coincidencias) — SC-003
- [x] T030 Ejecutar Escenario 2 del quickstart: extraer rutas y verificar que todas existen — SC-001, FR-008
- [x] T031 Ejecutar Escenario 3 del quickstart: verificar que §2 y §6 apuntan a `__tests__/dao/` con `jest.mock` y mencionan `pg-mem` como no usado — SC-002, FR-001…FR-004
- [x] T032 Ejecutar Escenario 4 del quickstart: verificar que el diagrama incluye `js/dao`, `js/services`, `js/views`, `js/db`, `js/vendor` — SC-004, FR-005
- [x] T033 Ejecutar Escenario 5 del quickstart: revisión visual de que ambos documentos mantienen su estructura original — FR-007, FR-009
- [x] T034 Ejecutar `npm test` para verificar que no se rompió nada (no se tocó código) — validación de no-regresión

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion (need real structure confirmed)
- **US1 (Phase 3)**: Depends on Phase 2 completion (need diffs documented) — **MVP**
- **US2 (Phase 4)**: Depends on Phase 2 completion — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 completion — can run in parallel with US1 and US2
- **Polish (Phase 6)**: Depends on Phases 3, 4, 5 completion — final validation

### User Story Dependencies

- **US1 (P1)**: Independent — can start after Phase 2
- **US2 (P2)**: Independent — can start after Phase 2, parallel with US1
- **US3 (P3)**: Independent — can start after Phase 2, parallel with US1 and US2
- **All stories**: Must complete before Phase 6 (Polish)

### Within Each User Story

- US1: Fix §2 route → Fix §6 table → Add routes/ row → Add pg-mem note → Update example
- US2: Replace diagram → Add missing modules → Add views/ → Add vendor/ → Add db/
- US3: Fix GUIA line 75 → Fix ARQ line 121 → Fix ARQ line 131 → Verify header

### Parallel Opportunities

- Phase 1 tasks T005 and T006 can run in parallel (different files)
- Phase 2 tasks T007-T012 can run in parallel (different lines/sections)
- US1 (Phase 3), US2 (Phase 4), US3 (Phase 5) can all run in parallel after Phase 2
- Phase 6 validation tasks T029-T033 can run in parallel (different grep commands)

---

## Parallel Example: After Phase 2

```bash
# Three user stories can proceed simultaneously:
Task US1: "Corregir §2 y §6 de GUIA_TECNICA.md" (docs/GUIA_TECNICA.md)
Task US2: "Actualizar diagrama §7 de GUIA_TECNICA.md" (docs/GUIA_TECNICA.md)
Task US3: "Eliminar referencias al simulador" (docs/GUIA_TECNICA.md + docs/ARQUITECTURA.md)

# Note: US1 and US2 both edit GUIA_TECNICA.md but different sections
# Run sequentially if same person, or coordinate section ownership
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify real structure)
2. Complete Phase 2: Foundational (identify exact diffs)
3. Complete Phase 3: User Story 1 (fix testing section)
4. **STOP and VALIDATE**: Run quickstart Scenarios 1-3
5. Deploy/doc if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 (testing fix) → Validate → Deploy (MVP!)
3. Add US2 (diagram fix) → Validate → Deploy
4. Add US3 (simulator refs) → Validate → Deploy
5. Phase 6: Final polish → Full validation → Done

---

## Notes

- This is a **documentation-only feature** — no code changes, no tests to write
- All tasks edit Markdown files, not source code
- The "source of truth" is the actual repository structure (read-only)
- Each user story is independently testable via grep/comparison commands
- `npm test` must remain green throughout (no code touched)
- Commit after each phase or logical group of tasks

---

## Traceability: Tasks → Requirements → Success Criteria

| Task | Requirement | Success Criterion |
|------|-------------|-------------------|
| T013, T014 | FR-001, FR-002 | SC-002 |
| T015 | FR-004 | SC-002 |
| T016 | FR-003 | SC-002 |
| T017 | FR-002 | SC-002 |
| T018-T022 | FR-005 | SC-004 |
| T023-T026 | FR-006 | SC-003 |
| T027-T028 | FR-007, FR-009 | — |
| T030 | FR-008 | SC-001 |
| T029 | FR-006 | SC-003 |
| T031 | FR-001…FR-004 | SC-002 |
| T032 | FR-005 | SC-004 |
| T033 | FR-007, FR-009 | — |
