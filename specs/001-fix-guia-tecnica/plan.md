# Implementation Plan: Documentación técnica alineada con el código real

**Branch**: `001-fix-guia-tecnica` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-fix-guia-tecnica/spec.md`

## Summary

Corregir `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md` para que describan
**fielmente** las convenciones y la estructura reales de MapFI. Son tres focos:
(1) la sección de Testing debe apuntar a la carpeta y al patrón de mock reales
(`__tests__/dao/` con `jest.mock("../../js/db")`, no `pg-mem`); (2) el diagrama de
`js/` debe incluir las carpetas y módulos que hoy faltan (`views/`, `vendor/`,
`admin-panel.js`, `csv-utils.js`, etc.); (3) eliminar toda referencia al proyecto
externo "el simulador", reemplazando esas justificaciones por razones propias de
MapFI. Es un cambio **puramente documental**: no se modifica ni un test ni una
línea de código de producción; la fuente de verdad es el repositorio tal como
existe hoy.

## Technical Context

**Language/Version**: N/A (artefactos Markdown). El código descrito es Node.js 20 + JS vanilla.

**Primary Dependencies**: Ninguna nueva. Los documentos describen Express, `pg`, Jest, supertest, `bcryptjs`.

**Storage**: N/A — la feature no toca la base de datos ni su esquema.

**Testing**: Verificación por script/manual (existencia de rutas citadas + `grep "simulador"` = 0). El patrón real que la guía DEBE documentar es: tests de servicios en `__tests__/services/` (Jest puro), tests de DAO en `__tests__/dao/` (mock manual de `js/db` vía `jest.mock`), tests de API en `__tests__/server/` y `__tests__/routes/` (supertest; `routes/` mockea `js/db`, `server/` prueba salud/gating sin BD).

**Target Platform**: Documentación del repositorio (se lee en GitHub / editor).

**Project Type**: Aplicación web (MapFI). Esta feature es mantenimiento de documentación de ese proyecto.

**Performance Goals**: N/A.

**Constraints**: Sin cambios de código (los tests existentes no se migran a `pg-mem`; se documenta la realidad). Toda ruta citada DEBE existir en el repo. Se conserva el alcance y estructura originales de ambos documentos (no se reduce la guía solo a testing/estructura).

**Scale/Scope**: 2 archivos (`docs/GUIA_TECNICA.md`, `docs/ARQUITECTURA.md`); 9 requisitos funcionales; 4 referencias al "simulador" a eliminar (1 en GUIA_TECNICA, 3 en ARQUITECTURA).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución vigente: **v1.0.0**. Esta feature es documental y **no introduce
violaciones**; de hecho refuerza la gobernanza:

| Principio | Impacto de esta feature | Estado |
|-----------|-------------------------|--------|
| I. Simplicidad sin build | Sin dependencias ni build nuevos; solo Markdown | ✅ PASS |
| II. Arquitectura por capas | La guía describirá con precisión la separación rutas → DAO → servicios | ✅ PASS |
| III. Seguridad por defecto | No toca código ni configuración de seguridad | ✅ PASS (N/A) |
| IV. Calidad verificada | Alinea la doc de testing con el patrón real; añade criterios verificables (SC-001…SC-004) | ✅ PASS (refuerza) |
| V. Migraciones aditivas | No hay migraciones | ✅ PASS (N/A) |
| VI. UX cero-fricción | No toca la interfaz | ✅ PASS (N/A) |

Además, la cláusula de Governance ("el `README.md` y `docs/` complementan esta
constitución con el detalle operativo") hace que mantener estos documentos
exactos sea un deber explícito. **Sin desviaciones que justificar** → la sección
Complexity Tracking queda vacía.

Re-evaluación post-diseño (Phase 1): sin cambios; sigue en PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-guia-tecnica/
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Phase 0: auditoría doc-vs-código
├── data-model.md        # Phase 1: entidades documentales y su fuente de verdad
├── quickstart.md        # Phase 1: escenarios de validación
├── contracts/           # N/A — feature documental, sin interfaces externas
├── checklists/
│   └── requirements.md  # (ya existe)
└── tasks.md             # Phase 2 (/speckit-tasks — no lo crea /speckit-plan)
```

### Source Code (repository root)

Los artefactos a editar y la fuente de verdad contra la que se validan:

```text
docs/
├── GUIA_TECNICA.md      # ← EDITAR (secciones Testing, Estructura js/, convenciones)
└── ARQUITECTURA.md      # ← EDITAR (solo referencias al "simulador")

# Fuente de verdad (solo lectura, NO se modifica):
js/
├── dao/                 # userDao, actividadDao, entidadDao, bloqueHorarioDao, …
├── services/            # matchService, heatmapService, holidayService, reputationService, reportService
├── views/               # dashboard-view, calendario-view, event-table, onboarding, tour, tooltips
├── db/                  # index.js (pool), migrate.js, reset-admin.js
├── vendor/              # fullcalendar/ (vendoreado, offline-safe)
└── *.js                 # 16 módulos raíz (api-client, layout, filters, csv-utils, sanitize, …)

__tests__/
├── services/            # Jest puro
├── dao/                 # jest.mock("../../js/db") — mock manual
├── routes/              # supertest + jest.mock("../../js/db")
└── server/              # supertest contra la app real (salud/gating, sin BD)
```

**Structure Decision**: No hay "estructura nueva" que decidir — la feature es
documental y su tarea es que el diagrama de `js/` de la guía **coincida** con las
carpetas reales listadas arriba (`dao/`, `services/`, `views/`, `db/`, `vendor/` +
módulos raíz) y que la tabla de Testing coincida con las carpetas reales de
`__tests__/` (`services/`, `dao/`, `routes/`, `server/`) y sus patrones.

## Complexity Tracking

> No aplica. La Constitution Check pasó sin violaciones; no hay complejidad que justificar.
