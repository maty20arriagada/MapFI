# Tasks: Calendario que recuerda, se edita en su sitio y avisa

**Input**: Design documents from `specs/006-mejoras-calendario/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Tests**: **Obligatorias.** El Principio IV de la constitución exige pruebas para toda lógica
nueva y verificación en navegador para todo cambio visible. Cada historia escribe primero sus
pruebas, que deben **fallar** antes de implementar.

**Organization**: una fase por historia, en el orden del plan. Cada historia se puede desplegar
por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivo distinto, sin dependencia de tareas pendientes).
- **[Story]**: historia a la que pertenece (US1…US5).

---

## Phase 1: Setup

**Purpose**: línea base antes de tocar nada.

- [X] T001 Confirmar la línea base en la rama `006-mejoras-calendario`: `npm test` y `npm run test:tz` en verde; anotar el total de pruebas en la sección Notas de este archivo para medir después que no se perdió ninguna.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: las dos piezas que usan varias historias.

**⚠️ CRITICAL**: US3 y US4 dependen de T002-T004. US1, US2 y US5 no.

- [X] T002 [P] Pruebas del módulo de estado en `__tests__/calendario-estado.test.js`: `leerEstado(search)` devuelve `{ vista, fecha, filtros, tieneCarrera }`; `vista` válida (`mes`, `semana`, `agenda`) y su equivalencia con FullCalendar (`dayGridMonth`, `timeGridWeek`, `listWeek`); `fecha` real (`2026-11-09` sí, `2026-13-45` y `2026-02-30` no); cada valor inválido se descarta sin tumbar a los demás (data-model §3); `carreraId=` vacío marca `tieneCarrera: true` con carrera vacía, distinto de que falte; `escribirEstado(estado)` produce una query estable y leer→escribir una URL válida la deja igual; `puedeEditar(actividad, usuario)` reproduce la tabla de data-model §4 (sin sesión, ADMIN, SUPERADMIN, APORTANTE dueño, APORTANTE ajeno, APORTANTE sin entidad).
- [X] T003 Crear `js/calendario-estado.js` (IIFE con doble exportación `window.CalendarioEstado` + `module.exports`, patrón de `js/horario-csv.js`) con `leerEstado`, `escribirEstado`, `aVistaFullCalendar`, `deVistaFullCalendar` y `puedeEditar`, hasta que T002 pase.
- [X] T004 [P] Añadir `status` al error que lanza `req()` en `js/api-client.js` (`const err = new Error(...); err.status = res.status; throw err;`), sin cambiar el mensaje; así el editor distingue un 409 de un 403. Verificar que ningún llamador actual dependa del tipo exacto del error.

**Checkpoint**: módulo de estado probado; errores de la API con código.

---

## Phase 3: User Story 1 - El certamen de ejemplo desaparece (Priority: P1) 🎯 MVP

**Goal**: retirar las actividades de ejemplo de fábrica sin aviso público de cancelación y con
constancia en `borrado_definitivo` (research R-01).

**Independent Test**: tras migrar, `GET /api/actividades` no devuelve el "Certamen 1 - Cálculo I"
de Docencia, `GET /api/actividades/eliminadas` no lo menciona, y `borrado_definitivo` tiene la fila
con su motivo (quickstart US1).

### Tests for User Story 1

- [X] T005 [P] [US1] Prueba en `__tests__/db/migracion-018.test.js` que lee `db/migrations/018_limpiar_actividades_muestra.sql` como texto y verifica: que la condición exige **los cuatro** campos de la huella para cada muestra (`titulo`, `descripcion`, `ubicacion` y la sigla de la entidad) según data-model §1; que inserta en `borrado_definitivo` **antes** de borrar; que el motivo es `Dato de ejemplo de instalacion (migracion 018)`; y que **no** escribe en `schema_migrations`.

### Implementation for User Story 1

- [X] T006 [US1] Crear `db/migrations/018_limpiar_actividades_muestra.sql`: una CTE que selecciona las actividades cuya huella completa coincide con alguna de las dos muestras (unión con `entidad` por sigla `DOCFI` / `CEEIND`), `INSERT INTO borrado_definitivo (actividad_id, titulo, entidad_id, entidad_nombre, fecha_inicio, estado_previo, borrado_por, motivo)` con `borrado_por` nulo, y `DELETE FROM actividad` de esos ids (`actividad_publico` cae por `ON DELETE CASCADE`). Idempotente: una segunda pasada no encuentra nada. Comentario de cabecera que explica por qué no se archiva (aviso público falso) y por qué no se identifica por id (patrón de `016_limpiar_horario_muestra.sql`). Hacer pasar T005.
- [X] T007 [US1] Ensayar la 018 contra una base real (`npm run docker:db`, `npm run db:migrate`): la muestra desaparece, `borrado_definitivo` gana las filas, y ejecutarla a mano una segunda vez no borra nada. Crear antes una actividad real titulada "Certamen 1 - Cálculo I" desde un centro y comprobar que sobrevive (quickstart US1.4).

**Checkpoint**: US1 lista para desplegar sola.

---

## Phase 4: User Story 2 - Aviso de verificación (Priority: P1)

**Goal**: franja informativa sobre todo calendario, siempre visible, discreta y sin cierre (FR-006 a FR-009, research R-08).

**Independent Test**: el aviso se ve arriba del calendario en `/calendario.html` y `/index.html`, con y sin sesión, en tema claro y oscuro, y en la impresión.

### Tests for User Story 2

- [X] T008 [P] [US2] En `__tests__/calendar-view.test.js`, probar la función pura `htmlAviso()` exportada por `js/calendar-view.js`: contiene el texto acordado, lleva `role="note"`, usa un icono de `js/icons.js` (`data-icon="info"`) y ningún emoji, y no incluye botón de cierre.

### Implementation for User Story 2

- [X] T009 [US2] En `js/calendar-view.js`, crear `htmlAviso()` con el texto de research R-08 y hacer que `montar()` inserte el aviso **antes** del contenedor del calendario una sola vez por contenedor (marcar con `data-aviso` para no duplicarlo en los re-render de cada filtro), e hidratar el icono con `Icons.hydrate`. Exportarla también por `module.exports`. Hacer pasar T008.
- [X] T010 [P] [US2] Estilos del aviso en `css/design-system.css` (`.cal-aviso`): tokens del design system, tono informativo neutro (no rojo ni amarillo de error), contraste AA en tema claro y oscuro, y visible en `@media print`.
- [X] T011 [US2] Verificar en navegador **servido por `server.js`** (`npm run dev`) los escenarios de quickstart US2 (sin sesión, con sesión de centro y de administrador, tema oscuro, vista de impresión) y guardar una captura.

**Checkpoint**: US1 + US2 son un primer despliegue posible, que protege a los estudiantes.

---

## Phase 5: User Story 3 - El calendario recuerda dónde quedó (Priority: P1)

**Goal**: vista, fecha y filtros en la URL con `replaceState`; recargar o filtrar no mueve el calendario (FR-010 a FR-015, research R-02 y R-03).

**Independent Test**: quickstart US3, pasos 1 a 7.

**Depends on**: T003.

### Tests for User Story 3

- [X] T012 [P] [US3] En `__tests__/calendario-estado.test.js`, añadir los casos de precedencia de research R-03: con `carreraId` en la URL manda la URL (incluido vacío = "Todas"); sin el parámetro se aplica la carrera propia; exponer esa regla como función pura `carreraInicial(estado, usuario)`.

### Implementation for User Story 3

- [X] T013 [US3] Implementar `carreraInicial` en `js/calendario-estado.js` hasta que pase T012.
- [X] T014 [US3] En `js/calendar-view.js`, aceptar en `opts` una posición inicial (`opts.vista`, `opts.fecha`) y un `opts.alNavegar(vista, fecha)`; pasar `initialView`/`initialDate` a FullCalendar y registrar `datesSet` para invocar `alNavegar` con la vista en castellano y la fecha de anclaje (`cal.getDate()` como `AAAA-MM-DD` local, **no** `toISOString`). Sin `opts.vista`/`opts.fecha` el comportamiento es el de hoy, para que la portada no cambie.
- [X] T015 [US3] En `js/views/calendario-view.js`: al arrancar, leer el estado con `CalendarioEstado.leerEstado(location.search)`, aplicar sus filtros a los `<select>` y al checkbox, y resolver la carrera con `carreraInicial` en lugar de la preselección incondicional actual; en `render()` pasar la posición a `montar()`; en cada cambio de filtro y en `alNavegar`, reescribir la URL con `history.replaceState` y `escribirEstado`. Nunca `pushState` (FR-014).
- [X] T016 [US3] Cargar `js/calendario-estado.js` en `calendario.html` antes de `js/calendar-view.js` y registrar `CalendarioEstado` en la lista de `js/app-boot.js` (namespace `window.MapFI`).
- [X] T017 [US3] Verificar en navegador servido por `server.js` los pasos 1-7 de quickstart US3, incluida la URL con valores inválidos y la ventana privada con el enlace copiado.

**Checkpoint**: el calendario conserva su lugar; US4 aprovecha esto para no moverse al guardar.

---

## Phase 6: User Story 4 - Un centro edita su actividad desde el calendario (Priority: P2)

**Goal**: panel de edición para quien puede editar, arrastre con confirmación, y dos reglas nuevas en el servidor (FR-016 a FR-025, research R-04 a R-06, contrato del `PUT`).

**Independent Test**: quickstart US4, pasos 1 a 11.

**Depends on**: T003, T004 (estado y códigos de error) y US3 (para no mover el calendario al guardar).

### Tests for User Story 4 — servidor primero

- [X] T018 [P] [US4] En `__tests__/routes/api.test.js`, bloque "Spec 006 — PUT": (a) `titulo: "   "` → 400 con `"El título no puede quedar vacío"`; (b) `titulo` ausente sigue siendo válido; (c) `actualizadoEn` igual al `updated_at` de la 501 → 200; (d) `actualizadoEn` distinto → 409 con el mensaje del contrato; (e) `actualizadoEn` ilegible → 409; (f) sin `actualizadoEn` → 200, como hoy (regresión de «Mi panel»); (g) un aportante de otra entidad sigue recibiendo 403 aunque mande `actualizadoEn` correcto. Ajustar el mock de la actividad 501 para que devuelva un `updated_at` conocido.

### Implementation for User Story 4 — servidor

- [X] T019 [US4] En `server.js`, ruta `PUT /api/actividades/:id`: tras cargar `actual`, rechazar con 400 un `titulo` presente y vacío tras `trim()`; justo antes de escribir (después de validar campos y fechas), si `req.body.actualizadoEn` viene y `new Date(actualizadoEn).getTime()` no coincide con `new Date(actual.updated_at).getTime()` —o no es una fecha válida—, responder 409 con el mensaje del contrato. Comentario que explique por qué la comparación va al final (contracts/api.md). Hacer pasar T018 sin romper las pruebas `C-1`/`C-2` existentes.

### Tests for User Story 4 — interfaz

- [X] T020 [P] [US4] En `__tests__/calendario-estado.test.js`, probar dos funciones puras nuevas: `cuerpoEdicion(formulario, actividad)` arma el cuerpo del `PUT` (convierte `datetime-local` a los campos `fechaInicio`/`fechaFin`, manda `""` para vaciar ramo o ubicación, incluye `actualizadoEn = actividad.updated_at`) y `textoMovimiento(inicioAnterior, inicioNuevo)` redacta "del martes 10 al jueves 12 de noviembre" en `es-CL` (mismo día con otra hora: "del martes 10 a las 18:30 al martes 10 a las 20:00").

### Implementation for User Story 4 — interfaz

- [X] T021 [US4] Implementar `cuerpoEdicion` y `textoMovimiento` en `js/calendario-estado.js` hasta que pase T020.
- [X] T022 [US4] Crear `js/views/editor-actividad.js` (IIFE, `window.EditorActividad`): `abrir(actividad, { alGuardar })` muestra un `<dialog>` nativo con clase `confirm-dialog` y los campos inicio, término, título, ramo, tipo (mismos `value`/etiquetas que `NOMBRE_TIPO` de `js/calendar-view.js`) y lugar, con los valores actuales; valida en el cliente término > inicio y título no vacío, mostrando el error **junto al campo** (`aria-describedby`); guarda con `api.put` y `cuerpoEdicion`; ante `err.status === 409` muestra el mensaje del servidor y un botón "Recargar"; ante 403/404 muestra "Esta actividad ya no está disponible para editar. Recarga el calendario."; ante éxito llama `alGuardar` y muestra un `toast` "Cambios guardados". Acciones secundarias: "Añadir a mi calendario" (`CalendarSync.mostrarActividad`) y un enlace "Editar público y estado en Mi panel" a `dashboard.html`. Todo texto de la actividad pasa por `escapeHtml`; iconos de `js/icons.js`.
- [X] T023 [US4] En `js/calendar-view.js`, `eventClick`: si `opts.usuario` y `CalendarioEstado.puedeEditar(actividad, opts.usuario)` y existe `EditorActividad`, abrir el editor con `alGuardar: opts.alCambiar`; si no, el panel de siempre.
- [X] T024 [US4] En `js/calendar-view.js`, arrastre: marcar `editable: true` **solo** en los eventos que `puedeEditar` permite (propiedad por evento), `eventDurationEditable: false` global; en `eventDrop`, pedir `confirmDialog` con título "Mover actividad" y `textoMovimiento`; al confirmar, `api.put` con `fechaInicio`, `fechaFin` y `actualizadoEn` y luego `opts.alCambiar()`; al cancelar o ante error, `info.revert()` y `toast` con el motivo.
- [X] T025 [US4] En `js/views/calendario-view.js`, pasar a `montar()` `usuario` (el de `/api/auth/me`) y `alCambiar: render`; como la posición vive en la URL (US3), el re-render no mueve el calendario.
- [X] T026 [US4] Cargar `js/views/editor-actividad.js` en `calendario.html` (después de `ui-confirm.js`, `ui-toast.js` y `calendar-sync.js`) y registrar `EditorActividad` en `js/app-boot.js`.
- [X] T027 [P] [US4] Estilos del editor en `css/design-system.css`: rejilla de campos que pasa a una columna en pantalla chica, error en línea con token de error, foco visible, sin anchos mayores que la pantalla.
- [X] T028 [US4] Verificar en navegador servido por `server.js` los pasos 1-10 de quickstart US4 con `industrial@mapfi.cl`, `informatica@mapfi.cl` y sin sesión, incluidas las dos pestañas para el 409 y el `PUT` forzado con `curl` para el título vacío y el 403. El paso 11 (Google Calendar) se deja anotado para la verificación en producción.

**Checkpoint**: los centros corrigen sus fechas donde las ven.

---

## Phase 7: User Story 5 - Mapa de calor de toda una carrera (Priority: P2)

**Goal**: opción "Todas las generaciones" en las dos vistas, hasta 4 carreras, y semestre sin doble conteo (FR-026 a FR-029, research R-07, contratos de `/heatmap/*`).

**Independent Test**: quickstart US5, pasos 1 a 6.

**Independiente** de US1-US4.

### Tests for User Story 5

- [X] T029 [P] [US5] En `__tests__/services/heatmapService.test.js`, probar la función pura `expandirPublico(carreras, nivel)`: año concreto → una fila por carrera; `"todos"` → carreras × 1-5; entradas vacías o no numéricas se descartan; devuelve además si supera `MAX_SEGMENTOS = 20` (4 carreras × todos = 20 pasa; 5 × todos = 25 no).
- [X] T030 [P] [US5] Crear `__tests__/dao/kpiDao.test.js` (mock manual de `js/db`, patrón de `__tests__/dao/actividadVisibilidad.test.js`): `saturacionPublico(publico, desde, hasta)` consulta `vw_saturacion_actividad`, usa `COUNT(DISTINCT actividad_id)` en total y en exámenes, agrupa por `fecha`, pasa pares `(carrera, nivel)` parametrizados (sin interpolar valores) y aplica `desde`/`hasta` solo si vienen.
- [X] T031 [P] [US5] En `__tests__/routes/api.test.js`, bloque "Spec 006 — mapa de calor": `/api/heatmap/semana` con `nivel=todos` y una carrera → 200; con 5 carreras y `nivel=todos` → 400 con "hasta 4 carreras"; sin `nivel` → 400 como hoy; `/api/heatmap/semestre` acepta `carreraId` repetido y `nivel=todos` y llama a `saturacionPublico`; con una carrera y un año el resultado tiene la misma forma que hoy.

### Implementation for User Story 5

- [X] T032 [US5] Crear `db/migrations/019_vista_saturacion_actividad.sql`: `CREATE OR REPLACE VIEW vw_saturacion_actividad` con `actividad_id`, `tipo`, `carrera_id`, `nivel`, `fecha`, misma expansión multi-día en hora de Chile y mismo filtro de estados que `vw_saturacion_segmento` (`011_saturacion_multidia.sql`), con el comentario de sincronización con `ESTADOS_VIGENTES`. No modificar la vista existente.
- [X] T033 [US5] Implementar `expandirPublico` y la constante `MAX_SEGMENTOS` en `js/services/heatmapService.js` y exportarlos, hasta que pase T029.
- [X] T034 [US5] Implementar `saturacionPublico(publico, desde, hasta)` en `js/dao/kpiDao.js` sobre la vista nueva, con la misma forma de fila que `saturacionSegmento` (`fecha`, `eventos`, `examenes`) para que `heatmapService.semestrePorDia` la consuma sin cambios. Hacer pasar T030.
- [X] T035 [US5] En `server.js`: `/api/heatmap/semana` acepta `nivel=todos` y arma el público con `expandirPublico`, validando el límite **después** de expandir, con el mensaje "Con todas las generaciones puedes combinar hasta 4 carreras" cuando `nivel=todos` y el actual cuando no; reemplazar `HEATMAP_MAX_SEGMENTOS` por la constante del servicio. `/api/heatmap/semestre` acepta `carreraId` repetido y `nivel=todos` y, cuando hay carreras, usa `saturacionPublico`; sin carreras mantiene `saturacionSegmento`. Hacer pasar T031.
- [X] T036 [US5] En `mapa-calor.html` y `js/heatmap-view.js`: añadir la opción "Todas las generaciones" (`value="todos"`) al selector de año; en `actualizarEstado()`, avisar antes de pedir el mapa si hay más de 4 carreras con `todos` y deshabilitar los botones; el semestre deja de descartar las carreras cuando hay varias y las manda todas; escribir la selección en la URL con `history.replaceState` en cada cambio (hoy solo se lee) para cumplir FR-029.
- [X] T037 [US5] Ensayar la 019 contra una base real y verificar en navegador servido por `server.js` los pasos 1-6 de quickstart US5, incluido el conteo de una actividad dirigida a los 5 años (debe contar 1).

**Checkpoint**: las cinco historias funcionan cada una por su cuenta.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T038 [P] Ayuda: en `ayuda.html`, documentar la edición desde el calendario (quién puede, arrastre con confirmación, que el público se edita en «Mi panel»), el enlace compartible del calendario y la opción "Todas las generaciones".
- [X] T039 Puertas de la constitución: `npm test` y `npm run test:tz` en verde con más pruebas que la línea base de T001; `node --check` de cada `.js` tocado; compilación de los scripts inline de `calendario.html`, `index.html` y `mapa-calor.html`; sin emoji estructural ni "TODO" visible.
- [X] T040 Recorrer [quickstart.md](quickstart.md) completo contra `server.js` y marcar su lista de cierre, con capturas del aviso, el panel de edición, la confirmación de arrastre y el selector de generaciones.
- [X] T041 Actualizar `AGENTS.md` si cambió algo que un agente deba saber (módulo `CalendarioEstado`, regla `actualizadoEn` del `PUT`, vista `vw_saturacion_actividad`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: tras Setup. **Bloquea US3 y US4**, no a las demás.
- **US1 (Fase 3)** y **US2 (Fase 4)**: pueden empezar tras Setup.
- **US3 (Fase 5)**: tras T003.
- **US4 (Fase 6)**: tras T003, T004 y US3.
- **US5 (Fase 7)**: tras Setup; independiente del resto.
- **Polish (Fase 8)**: tras las historias que se vayan a entregar.

### User Story Dependencies

```text
Setup ──┬── US1 ───────────────────────────┐
        ├── US2 ───────────────────────────┤
        ├── Foundational ── US3 ── US4 ────┼── Polish
        └── US5 ───────────────────────────┘
```

### Within Each User Story

- Pruebas primero, y deben fallar antes de implementar.
- En US4, el servidor antes que la interfaz: el panel depende de las reglas nuevas del `PUT`.
- En US5, la vista antes que el DAO, el DAO antes que la ruta, la ruta antes que la interfaz.
- Verificación en navegador contra `server.js` al cerrar cada historia visible.

### Parallel Opportunities

- T002 y T004 (Foundational) en paralelo.
- Las fases US1, US2 y US5 en paralelo entre sí.
- Dentro de cada historia, las tareas de prueba marcadas [P] en paralelo.
- Los estilos (T010, T027) en paralelo con la lógica de su historia.

---

## Parallel Example: User Story 5

```text
# Pruebas de US5 a la vez (archivos distintos):
T029  expandirPublico     → __tests__/services/heatmapService.test.js
T030  saturacionPublico   → __tests__/dao/kpiDao.test.js
T031  rutas del mapa      → __tests__/routes/api.test.js
```

---

## Implementation Strategy

### MVP: US1 + US2

1. Setup (T001).
2. US1 (T005-T007) y US2 (T008-T011).
3. **Desplegar**: el certamen falso desaparece y el aviso protege a los estudiantes desde el primer día.

### Entrega incremental

1. MVP (US1 + US2) → desplegar.
2. Foundational + US3 → desplegar: el calendario deja de perder su lugar.
3. US4 → desplegar: los centros editan en el calendario.
4. US5 → desplegar: mapa de calor de carrera completa.

Cada paso se cierra **en el servidor de la Facultad**, no con el merge (lección de la Spec 004).

---

## Notes

- Línea base de pruebas (T001): **559/559** en `npm test` y en `npm run test:tz` (25 suites), 2026-09-27.
- La migración 018 es irreversible por diseño (borra datos de fábrica); la constancia queda en
  `borrado_definitivo`.
- `actualizadoEn` es opcional a propósito: «Mi panel» no lo manda y debe seguir funcionando igual.
