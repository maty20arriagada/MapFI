---
title: "Plan 002 — Auditoría de robustez de MapFI"
tags: [mapfi, plan, auditoria, robustez, speckit]
date: 2026-07-27
status: listo-para-tareas
aliases: ["Plan 002", "Plan de robustez"]
---

# Implementation Plan: Auditoría de robustez — corregir inconsistencias críticas

**Branch**: `002-auditoria-robustez-corregir` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-auditoria-robustez-corregir/spec.md`

## Summary

Corregir **14 defectos verificados** hallados en una auditoría transversal del
proyecto. Cuatro son críticos y comparten un patrón: **fallan en silencio y rompen
promesas centrales del producto** (la hora de un evento, la moderación del
administrador, el reporte de impacto y el modelo de permisos). El enfoque técnico
es de bajo riesgo y respeta la constitución v1.0.0: fijar la zona horaria del
despliegue, introducir un **criterio único de visibilidad por estado** compartido
por las tres vistas, **persistir el resultado del Match** al guardar una actividad,
y **mover al servidor** las decisiones que hoy acepta del cliente. No se cambia el
stack ni se agregan dependencias pesadas.

Detalle de evidencias en [research.md](./research.md) y de escenarios hipotéticos
en [dilemas.md](./dilemas.md).

## Technical Context

**Language/Version**: Node.js 20 (contenedor `node:20-alpine`), JavaScript vanilla en el cliente.

**Primary Dependencies**: Express, `pg`, `express-session` + `connect-pg-simple`, `bcryptjs`, `pdfkit`, FullCalendar (vendoreado). Sin dependencias nuevas previstas.

**Storage**: PostgreSQL 16. Se prevén migraciones aditivas (`008`, `009`) para índices y normalización de datos históricos.

**Testing**: Jest (servicios y utilidades), mock manual de `js/db` (DAO), supertest (rutas). Se añade ejecución de la suite en **dos zonas horarias** para que la configuración de pruebas deje de enmascarar defectos de fecha.

**Target Platform**: Servidor de la Facultad de Ingeniería, Docker Compose, tras un intermediario HTTP.

**Project Type**: Aplicación web institucional (calendario compartido multiusuario).

**Performance Goals**: La carga del calendario debe seguir siendo instantánea con el volumen de un año académico (≈ 1.000–3.000 actividades). La detección de choques debe acotarse al rango visible.

**Constraints**: Sin paso de compilación (Principio I). Migraciones aditivas e idempotentes (Principio V). Hay datos ya cargados en el servidor: toda corrección debe preservar el histórico. Sin ventana de mantención prolongada.

**Scale/Scope**: 16 entidades aportantes, 14 carreras × 5 niveles = 70 segmentos, decenas de usuarios concurrentes en picos (inicio de semestre), lectores anónimos sin límite.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución vigente **v1.0.0**. Esta feature es **correctiva**: su propósito es
restaurar principios que hoy están incumplidos en el código.

| Principio | Situación actual | Efecto del plan | Estado |
|-----------|------------------|-----------------|--------|
| I. Simplicidad sin build | Respetado | No agrega dependencias ni pipeline | ✅ PASS |
| II. Arquitectura por capas | Respetado | Refuerza: las decisiones de estado se mueven a la capa de rutas | ✅ PASS |
| III. Seguridad por defecto | **Incumplido**: el cliente impone estado y entidad; desactivar no corta sesiones | Corrige ambos | ⚠️→✅ |
| IV. Calidad verificada | **Parcialmente incumplido**: la suite fija una zona horaria que oculta defectos reales | Añade pruebas entre capas y en dos zonas horarias | ⚠️→✅ |
| V. Migraciones aditivas | Respetado | Nuevas migraciones aditivas e idempotentes | ✅ PASS |
| VI. UX cero-fricción | **Parcialmente incumplido**: mensajes técnicos, duplicados por doble clic | Corrige mensajes y bloqueo de envío | ⚠️→✅ |

**Sin violaciones que justificar**: el plan no introduce complejidad nueva, elimina
incoherencias. La sección Complexity Tracking queda vacía.

**Re-evaluación post-diseño**: sin cambios; se mantiene en PASS.

## Project Structure

### Documentation (this feature)

```text
specs/002-auditoria-robustez-corregir/
├── spec.md              # Qué debe cumplirse (historias, requisitos, criterios)
├── plan.md              # Este archivo
├── research.md          # Fase 0: 14 hallazgos con evidencia y decisión técnica
├── dilemas.md           # Escenarios hipotéticos y decisiones de producto pendientes
├── data-model.md        # Fase 1: estados, visibilidad y datos derivados
├── quickstart.md        # Fase 1: guion de validación reproducible
└── tasks.md             # Fase 2 (/speckit-tasks — no lo crea /speckit-plan)
```

### Source Code (repository root)

Áreas afectadas por la corrección:

```text
server.js                    # Rutas: forzar estado/entidad, validar fechas,
                             #   revalidar sesión, mensajes de error, límites
js/
├── dao/actividadDao.js      # Filtro de visibilidad por estado (fuente única)
├── services/
│   ├── matchService.js      # Sin cambios de lógica; se consume al guardar
│   └── reputationService.js # Criterio del sello, ahora alcanzable
├── views/
│   ├── dashboard-view.js    # Persistir resultado del Match; bloquear doble envío
│   └── calendario-view.js   # Idem para fechas académicas
└── api-client.js            # Mensajes para códigos aún no cubiertos

db/migrations/
├── 008_*.sql                # Índices de apoyo y normalización del histórico
└── 009_*.sql                # (según decisión de zona horaria)

docker-compose.yaml          # Zona horaria explícita del contenedor
jest.setup.js                # Deja de fijar una única zona horaria
__tests__/                   # Nuevas pruebas: visibilidad, permisos, fechas
```

**Structure Decision**: No se introducen carpetas nuevas. La corrección se
concentra en la capa de rutas (`server.js`) y en el DAO de actividades, que son los
puntos donde hoy se pierden las garantías. Se evita deliberadamente crear una capa
de validación nueva: las reglas viven donde ya está la autorización.

## Enfoque por defecto (bloque crítico)

Estrategia técnica resumida; alternativas descartadas en [research.md](./research.md).

1. **Zona horaria** — Fijar la zona horaria del contenedor y de la base de datos en
   la de Chile continental, de modo que la interpretación de las fechas sin zona
   coincida con la intención del usuario. Es la corrección de menor superficie y no
   obliga a reescribir el cliente. Se acompaña de una revisión del histórico.
2. **Visibilidad por estado (moderación reactiva)** — Decidido en clarificación: no
   hay revisor diario, por lo que **todo se publica de inmediato** y el
   administrador **retira** lo incorrecto después. Un único criterio aplicado en el
   DAO: el calendario público muestra lo vigente y **excluye lo retirado o
   archivado**; el autor sigue viendo lo suyo. El mapa de calor y el detector de
   choques adoptan el mismo criterio. El borrado pasa a ser **archivado
   reversible**, con registro de quién y cuándo.
3. **Persistir el Match** — Al guardar una actividad, el servidor recalcula la
   compatibilidad y el alcance y los almacena. Se recalcula en el servidor (no se
   confía en lo que envíe el cliente), lo que además cierra un hueco de permisos.
4. **Autoridad del servidor** — El estado y la entidad de una actividad se derivan
   del rol de la sesión; los valores enviados por el cliente se descartan. Con
   moderación reactiva, esta es la **única barrera** que queda: solo el
   administrador puede retirar y restituir.
5. **Sesión viva** — La autorización revalida contra la base de datos el estado de
   la cuenta, con un costo despreciable frente al beneficio de poder revocar accesos.

## Complexity Tracking

> No aplica: la Constitution Check pasó sin violaciones. El plan reduce
> complejidad e incoherencia en vez de agregarlas.
