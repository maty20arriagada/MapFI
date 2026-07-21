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

Ideas de mejora **anotadas para el futuro** — ninguna está implementada aún.
No son bugs; el MVP está sólido (Fases F0–F8 completas). Cada punto fue
verificado contra el código actual (julio 2026). Estimaciones aproximadas.

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
| 1.5 | **Aplicar sugerencia del Match** | Las 3 sugerencias hoy solo se muestran; hacerlas accionables (clic → rellena esa fecha/hora en el formulario). | P1 | ~1.5 h |

---

## 2. Accesibilidad (WCAG 2.1 AA)

> Refuerza el Principio VI de la constitución ("UX cero-fricción" incluye
> accesibilidad). Brechas verificadas en el código.

| # | Mejora | Hallazgo | Prioridad | Esfuerzo |
|---|--------|----------|-----------|----------|
| 2.1 | **`aria-live` en toasts** | `js/ui-toast.js` no anuncia los mensajes → un lector de pantalla no dice "Evento creado" ni los errores. Añadir `role="status"` + `aria-live="polite"` (y `assertive` para errores). | P1 | ~0.5 h |
| 2.2 | **Skip-link funcional** | La clase `.skip-link` existe en el CSS pero **no se usa** en ninguna página. Agregar "Saltar al contenido" con destino en `<main>`. | P1 | ~0.5 h |
| 2.3 | **Heatmap no solo color** | Las celdas del mapa de calor se distinguen solo por color (verde/amarillo/rojo) + `title`. Añadir `aria-label` descriptivo y/o patrón/texto por celda. | P2 | ~1 h |
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
| 4.1 | **Matrícula real** | El alcance del Match usa un *placeholder de 100 por segmento* (`004_matricula.sql`). Los números son ficticios hasta cargar la matrícula real (idealmente import CSV de matrícula). | P1 (dato) | ~2 h + datos |
| 4.2 | **Feriados móviles 2026** | Siguen marcados `-- VERIFICAR` en `002_seed_catalogos.sql` (Semana Santa, San Pedro y San Pablo, Pueblos Indígenas, Encuentro de Dos Mundos). | P2 (dato) | ~0.5 h |
| 4.3 | **Perf de `/api/actividades/conflictos`** | Hace un self-join sobre **todas** las actividades confirmadas en **cada** montaje del calendario, sin filtrar por rango/segmento. OK con pocos datos; filtrar por semana/segmento antes de que crezca. | P2 | ~2 h |

---

## 5. Requiere infraestructura (P3)

- **Recordatorios por email** (registro de cuenta, aviso de choque, cierre de
  semestre con el PDF): alto valor, pero necesita un servicio SMTP y variables
  de entorno adicionales.
- **App móvil / PWA** sobre la misma API.
- **Integración con el sistema académico** (mallas y matrícula automáticas).

---

*Registrado el 2026-07-20. Fuente: revisión del código + evaluación con el equipo.
Nada de esto está implementado; es un backlog para priorizar en una futura fase.*
