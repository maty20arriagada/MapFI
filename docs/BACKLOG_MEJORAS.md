---
title: Backlog de mejoras (post-v2)
tags:
  - backlog
  - mejoras
  - roadmap
  - pendiente
date: 2026-07-20
status: activo
aliases:
  - Backlog
  - Mejoras pendientes
cssclasses:
  - wide-page
---

# 🧭 Backlog de mejoras (post-v2)

Ideas de mejora anotadas para el futuro. No son bugs; el MVP está sólido
(Fases F0–F8 completas). Cada punto fue verificado contra el código actual
(julio 2026). Estimaciones aproximadas.

> **Actualización 2026-08-03:** siete puntos (1.5, 2.1, 2.2, 2.3, 4.1 parcial,
> 4.2 parcial, 4.3) se implementaron como parte de la Fase 10 de
> `002-auditoria-robustez-corregir`, **porque ya se estaba tocando ese mismo
> código** al corregir los hallazgos de la auditoría (ver
> [[AUDITORIA_ROBUSTEZ|Auditoría de robustez]]). Quedan marcados `✅` abajo,
> con la tarea que los resolvió. El resto sigue pendiente y sin implementar.

Prioridad sugerida: **P1** alto impacto / bajo-medio esfuerzo · **P2** valioso ·
**P3** requiere infraestructura o datos externos.

---

## 1. Calendario interactivo

> Hoy el calendario **ya** permite clic en un día → abre el formulario con la
> fecha puesta (`dateClick` en `js/calendar-view.js`). Falta activar el resto de
> la interacción de FullCalendar (`selectable`/`editable` no están puestos).

| # | Mejora | Detalle | Prioridad | Esfuerzo |
|---|--------|---------|-----------|----------|
| 1.1 | **Arrastrar para crear rango** | En vista semana, arrastrar sobre las horas crea un evento con inicio/fin exactos (`select`). | P1 | ~2 h |
| 1.2 | **Arrastrar para mover / redimensionar** | Reprogramar un evento arrastrándolo o estirándolo → `PUT /api/actividades/:id`. Solo dueño/admin (`editable` + `eventDrop`/`eventResize`). | P1 | ~4 h |
| 1.3 | **Popover de creación rápida** | Al clicar una celda, mini-formulario flotante (Título + Tipo) ahí mismo, con "Guardar" / "Más opciones", en vez de bajar al formulario grande. | P2 | ~4 h |
| 1.4 | **Tarjeta de detalle del evento** | Clic en un evento → popover con datos + botones editar/eliminar, en lugar del `toast` actual. | P2 | ~3 h |
| 1.5 | ✅ **Aplicar sugerencia del Match** | Las 3 sugerencias hoy solo se muestran; hacerlas accionables (clic → rellena esa fecha/hora en el formulario). | P1 | **Hecho — T070 (2026-08-03)** |

---

## 2. Accesibilidad (WCAG 2.1 AA)

> Refuerza el Principio VI de la constitución ("UX cero-fricción" incluye
> accesibilidad). Brechas verificadas en el código.

| # | Mejora | Hallazgo | Prioridad | Esfuerzo |
|---|--------|----------|-----------|----------|
| 2.1 | ✅ **`aria-live` en toasts** | `js/ui-toast.js` no anuncia los mensajes → un lector de pantalla no dice "Evento creado" ni los errores. Añadir `role="status"` + `aria-live="polite"` (y `assertive` para errores). | P1 | **Hecho — T009 (2026-08-03)** |
| 2.2 | ✅ **Skip-link funcional** | La clase `.skip-link` existe en el CSS pero **no se usa** en ninguna página. Agregar "Saltar al contenido" con destino en `<main>`. | P1 | **Hecho — T072 (2026-08-03)**, centralizado en `js/layout.js` |
| 2.3 | ✅ **Heatmap no solo color** | Las celdas del mapa de calor se distinguen solo por color (verde/amarillo/rojo) + `title`. Añadir `aria-label` descriptivo y/o patrón/texto por celda. | P2 | **Hecho — T071 (2026-08-03)** |
| 2.4 | **Teclado en grillas propias** | La grilla de horarios y el mapa de calor no son navegables por teclado ni tienen roles ARIA (FullCalendar sí trae algo). | P2 | ~3 h |
| 2.5 | **Contraste modo oscuro + meta** | Pase de contraste AA en tema oscuro; agregar `<meta name="description">`. | P3 | ~1 h |

---

## 3. Eventos recurrentes y carga repetitiva

| # | Mejora | Detalle | Prioridad | Esfuerzo |
|---|--------|---------|-----------|----------|
| 3.1 | **Eventos recurrentes** | Repetir un evento semanalmente por N semanas en una sola operación (útil para talleres/ayudantías). | P2 | ~4 h |
| 3.2 | **Duplicar evento** | Clonar una actividad existente con nueva fecha. | P3 | ~1.5 h |

---

## 4. Datos y rendimiento

| # | Mejora | Hallazgo | Prioridad | Esfuerzo |
|---|--------|----------|-----------|----------|
| 4.1 | ⚠️ **Matrícula real** | El alcance del Match usa un *placeholder de 100 por segmento* (`004_matricula.sql`). Los números son ficticios hasta cargar la matrícula real. | P1 (dato) | **Mecanismo listo — T040–T043 (2026-08-03)**: columna `origen`, rótulo automático, `npm run seed:matricula`. **Falta el dato real de Docencia** (pendiente, depende de un tercero). |
| 4.2 | ⚠️ **Feriados móviles 2026** | Seguían marcados `-- VERIFICAR` en `002_seed_catalogos.sql` (San Pedro y San Pablo, Pueblos Indígenas, Encuentro de Dos Mundos). | P2 (dato) | **Parcial — T069 (2026-08-03)**: Pueblos Indígenas corregido (20→21 jun); los otros dos, confirmados correctos. No verificado contra el Diario Oficial directo — pendiente recontrastar. |
| 4.3 | ✅ **Perf de `/api/actividades/conflictos`** | Hacía un self-join sobre **todas** las actividades confirmadas en **cada** montaje del calendario, sin filtrar por rango/segmento. | P2 | **Hecho — T022 (2026-08-03)**: exige rango de fechas y usa el conjunto vigente completo. |

---

## 5. Requiere infraestructura (P3)

- **Recordatorios por email** (registro de cuenta, aviso de choque, cierre de
  semestre con el PDF): alto valor, pero necesita un servicio SMTP y variables
  de entorno adicionales.
- **App móvil / PWA** sobre la misma API.
- **Integración con el sistema académico** (mallas y matrícula automáticas).

---

*Registrado el 2026-07-20. Fuente: revisión del código + evaluación con el equipo.
Actualizado el 2026-08-03: 7 puntos implementados como parte de la Fase 10 de
`002-auditoria-robustez-corregir` (ver nota arriba); el resto sigue como backlog
para priorizar en una futura fase.*
