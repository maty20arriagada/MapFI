# 🛣️ Roadmap por Fases — MapFI

Plan de ejecución incremental. Cada fase es un entregable demostrable con criterios de aceptación. El **MVP** se alcanza al cerrar la **Fase 3**.

---

## Fase 0 · Scaffold & DevOps ✅ (este entregable)

**Objetivo:** repositorio ejecutable, listo para GitHub y para empezar a programar.

- [x] Estructura de carpetas espejando el Simulador Marketing.
- [x] `Dockerfile`, `docker-compose.yaml`, `.env.example`.
- [x] `package.json` con scripts (`start`, `dev`, `test`, `docker:*`, `db:migrate`).
- [x] `server.js` arranca, sirve estáticos y expone `/api/health`.
- [x] Esquema SQL inicial + seeds (14 carreras, niveles, entidades, feriados).
- [x] Stubs de DAO y servicios con firmas + `TODO`.
- [x] Documentación (`docs/`) y plan maestro.

**Criterio de aceptación:** `docker-compose up --build` levanta Postgres + server, aplica migraciones y responde `200` en `/api/health`.

---

## Fase 1 · Autenticación & Catálogos

**Objetivo:** que las entidades puedan iniciar sesión y exista la administración de catálogos.

- [x] Login/logout con `bcryptjs` + `express-session` (persistido).
- [x] Middleware `requireAuth` y `requireRole('ADMIN')`.
- [x] CRUD admin (API) de `carrera`, `generacion`, `entidad`, `usuario`.
- [x] CRUD de `periodo_academico` + marcar el activo (API).
- [x] `login.html` + `dashboard.html` con estado de sesión.
- [x] **Panel de administración (UI)**: usuarios, entidades, carreras, periodos y bloques.

**Criterio de aceptación:** un usuario `APORTANTE` inicia sesión y ve su dashboard; un `ADMIN` gestiona los catálogos; las contraseñas se guardan hasheadas.

---

## Fase 2 · Calendario & Cronología

**Objetivo:** el calendario centralizado con filtros y la lógica de fechas.

- [x] CRUD de `actividad` (con `actividad_publico`) — API + formulario de alta.
- [x] Filtros avanzados: carrera, generación, entidad.
- [x] `holidayService`: feriados + exclusión de findes (con tests).
- [x] Vista pública (sin login) de solo lectura.
- [x] Carga de `bloque_horario` (API + UI admin).
- [x] Calendario con **FullCalendar** (mes/semana/lista; vendoreado localmente).
- [x] Edición inline de actividades (tabla de eventos + modal).

**Criterio de aceptación:** un aportante crea una actividad con público objetivo; el público general la ve filtrada por carrera/año; los feriados aparecen marcados y los findes se ignoran en cálculos.

---

## Fase 3 · Match & Mapa de Calor 🎯 (cierre de MVP)

**Objetivo:** las dos funciones diferenciadoras.

- [x] `matchService` completo (pasos 0–6, ver [`ALGORITMO_MATCH.md`](ALGORITMO_MATCH.md)) + tests.
- [x] `match.html`: propuesta → compatibilidad + alcance + 3 sugerencias.
- [x] `cargarContextoMatch` + tabla `matricula` (alcance real).
- [x] `heatmapService` + `vw_saturacion_segmento` + endpoint.
- [x] `mapa-calor.html` con escala de color, filtrable por segmento.
- [x] Persistencia de compatibilidad y alcance estimado al guardar actividad.

**Criterio de aceptación:** al proponer una fecha sobre un examen del segmento, el sistema marca compatibilidad BAJA y sugiere 3 bloques mejores Lun–Vie; el mapa de calor refleja la saturación de un segmento específico.

---

## Fase 4 · Gamificación, PDF & BI

**Objetivo:** sostenibilidad del dato y analítica.

- [x] Indicador de confiabilidad y `eventos_exitosos` por entidad (`reputationService`).
- [x] Sello de coordinación eficiente + **ranking público** en la portada.
- [x] Reporte de impacto en **PDF** por entidad (pdfkit) + resumen JSON.
- [x] Panel de KPIs (`kpis.html`): ocupación, aporte, reprogramaciones, ranking.
- [x] Endpoints `/api/analytics/*` sobre las vistas (Looker/PowerBI/Python).
- [x] Panel de revisión de importaciones CSV (admin aprueba/rechaza propuestas de CEE).

**Criterio de aceptación:** al cierre de semestre cada entidad descarga su PDF de impacto; el admin ve los KPIs iniciales; un analista consulta las vistas desde una herramienta externa.

---

## Fases 5–8 · Cierre de MVP, Tutoriales, UX y Robustez ✅

Ejecutadas en julio 2026. Detalle completo en [`PLAN_DE_IMPLEMENTACION.md`](../PLAN_DE_IMPLEMENTACION.md).

- [x] Seguridad: rate limiting, sanitización XSS, cookies SameSite strict, CSRF.
- [x] Tags CHARLA / TALLER / ENTREGA + campo `ramo` en actividad.
- [x] Dashboard con selección multi-carrera / multi-año (producto cartesiano).
- [x] Tabla "Mis Eventos" con edición inline (cambio de fecha, estado, eliminación).
- [x] Conflictos visuales en calendario (badge ⚠️, borde naranja en overlaps).
- [x] Importación CSV híbrida (CEE → PROPUESTA → admin revisa).
- [x] Plantilla CSV descargable.
- [x] Logo GIIA vectorizado (SVG) con filtro dark mode.
- [x] Sistema de tutoriales: banner de bienvenida, tour guiado 5 pasos, tooltips contextuales.
- [x] Centro de ayuda (`ayuda.html`) con FAQ y guías paso a paso.
- [x] Correcciones UX: errores amigables, loaders, mensajes claros, links clickeables.
- [x] JS inline extraído a módulos (`dashboard-view.js`, `calendario-view.js`).
- [x] Tests: +18 tests nuevos (DAO + API) — total 60 tests.
- [x] Migración 007: fechas semilla relativas al año actual.
- [x] Documentación actualizada (README, GUIA_APORTANTE, ROADMAP, PLAN_DE_IMPLEMENTACION).

---

## Backlog / Ideas futuras

- SSO institucional (Google/Microsoft) si lo pide la facultad.
- Notificaciones por email (recordatorios de carga / topes detectados).
- Función de **clonación de calendario anual** (un clic para el año siguiente).
- App móvil (PWA) sobre la misma API.
- Exportación .ics para Google Calendar / Apple Calendar.
- Importación masiva de mallas horarias desde el sistema académico.
- Namespace `window.MapFI` para todos los módulos globales.

---

## Convenciones de trabajo

- Una rama por fase/feature; PRs pequeños y revisados.
- Tests verdes antes de mergear (`npm test`).
- Migraciones aditivas (nunca editar una ya aplicada en prod).
- Actualizar `docs/` cuando cambie el comportamiento.
