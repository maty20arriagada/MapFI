# Implementation Plan: Calendario que recuerda, se edita en su sitio y avisa

**Branch**: `006-mejoras-calendario` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-mejoras-calendario/spec.md`

## Summary

Cinco cambios, todos sobre piezas que ya existen:

1. **Retirar el certamen de ejemplo** con una migración que lo borra por su huella completa y deja
   constancia en `borrado_definitivo`, sin pasar por el archivado que publicaría una cancelación
   falsa.
2. **Aviso de verificación** que `CalendarView.montar()` inserta encima de todo calendario.
3. **Posición del calendario en la URL** (`vista`, `fecha`, filtros) con `replaceState`. Arregla a
   la vez la recarga y el reinicio al filtrar, que resultan ser el mismo defecto.
4. **Edición en el calendario** para el dueño de la actividad o un administrador: panel propio al
   hacer clic y arrastre con confirmación. El backend ya autoriza y valida; se le añaden dos
   reglas que la edición en el calendario destaparía (título vacío y concurrencia).
5. **"Todas las generaciones" en el mapa de calor**, hasta 4 carreras. Corrige de paso un doble
   conteo latente en la vista de semestre.

La investigación ([research.md](research.md)) encontró tres defectos que la especificación no
nombraba y que esta entrega corrige, porque las funciones nuevas los harían visibles:

| Defecto | Dónde | Por qué importa ahora |
|---|---|---|
| El `PUT` acepta un título vacío | `actividadDao.actualizar` usa `COALESCE`, y `""` no es nulo | El panel nuevo manda el título; «Mi panel» nunca lo hacía |
| Sin control de concurrencia | `PUT /api/actividades/:id` | Dos integrantes del mismo centro editando desde el calendario |
| El semestre cuenta de más sin año | `vw_saturacion_segmento` agrupa por segmento y el servicio suma | Una charla para 5 años contaría 5 con "Todas las generaciones" |

## Technical Context

**Language/Version**: JavaScript — Node.js 20 en el servidor; ES5/ES2017 en el navegador, sin
transpilar.

**Primary Dependencies**: Express 4, `pg`, FullCalendar 6.1.15 vendorizado (bundle estándar, con
el plugin de interacción). Sin dependencias nuevas.

**Storage**: PostgreSQL 16. Dos migraciones nuevas: `018` (limpieza de datos de ejemplo) y `019`
(vista `vw_saturacion_actividad`). Sin tablas ni columnas nuevas.

**Testing**: Jest + supertest con mocks manuales de la capa de datos (no pg-mem: no soporta la
columna `tstzrange GENERATED`). Batería también con `TZ=UTC`. Verificación en navegador
**servido por `server.js`**.

**Target Platform**: servidor Linux con Docker Compose (servidor de la Facultad); navegadores de
escritorio y móvil actuales.

**Project Type**: aplicación web monolítica — Express sirve la API y el frontend estático.

**Performance Goals**: el mapa de calor con "Todas las generaciones" de una carrera responde en no
más del doble que con un solo año (SC-008). La persistencia de la URL no añade peticiones.

**Constraints**: sin paso de build; iconos solo de `js/icons.js`; accesibilidad AA; migraciones
aditivas, idempotentes y que no escriben `schema_migrations`; autorización decidida en el
servidor.

**Scale/Scope**: 181 actividades vigentes, 16 cuentas de centros, 14 carreras × 5 años = 70 grupos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el diseño | Estado |
|---|---|---|
| **I · Simplicidad sin build** | Dos módulos IIFE con doble exportación, como `horario-csv.js`. Sin dependencias nuevas: todo lo de FullCalendar ya está en el bundle vendorizado. | ✅ |
| **II · Capas: DAO + servicios puros** | La lógica nueva es pura y probable en Node: `calendario-estado.js` (URL ↔ estado, `puedeEditar`) y la expansión del público del mapa de calor. El SQL vive en el DAO y en una vista. | ✅ |
| **III · Seguridad por defecto** | La interfaz solo decide qué panel mostrar; el servidor sigue autorizando con `puedeEditarActividad`. Todo texto de usuario del panel se escapa. Validación de título en el servidor, no solo en el formulario. Mensaje 403 que no revela qué ids existen. | ✅ |
| **IV · Calidad verificada** | Pruebas para cada pieza pura, cada regla nueva del `PUT` y cada ruta del mapa de calor; `test:tz`; verificación en navegador contra `server.js` ([quickstart.md](quickstart.md)). | ✅ |
| **V · Migraciones aditivas** | `018` borra por huella con idempotencia (una segunda pasada no toca nada) y no edita la `002`; `019` crea una vista sin tocar la existente. Ninguna escribe `schema_migrations`. | ✅ |
| **VI · UX cero-fricción** | Edición donde se detecta el error; confirmación antes de mover; aviso con `role="note"` e icono SVG; errores junto al campo; foco y Escape del `<dialog>` nativo; tema claro y oscuro. | ✅ |
| **Restricción: KPIs tras vistas `vw_*`** | El conteo nuevo del semestre lee `vw_saturacion_actividad`, no las tablas. | ✅ |
| **Restricción: namespace `window.MapFI`** | `CalendarioEstado` y `EditorActividad` se registran en `js/app-boot.js`. | ✅ |
| **Propuesta 1 (no ratificada): reversibilidad** | Aplica a operaciones *iniciadas por usuarios*. La `018` es limpieza de datos de fábrica y deja constancia en `borrado_definitivo`, igual que la `016`. | ✅ fuera de alcance, con trazabilidad |

**Resultado**: pasa sin violaciones. Re-verificado tras la fase 1 de diseño: sin cambios. La
tabla de complejidad queda vacía.

## Project Structure

### Documentation (this feature)

```text
specs/006-mejoras-calendario/
├── spec.md              # Especificación + Clarifications
├── plan.md              # Este archivo
├── research.md          # R-01..R-08: decisiones con su evidencia
├── data-model.md        # Huella del ejemplo, reglas del PUT, estado de URL, vista nueva
├── quickstart.md        # Validación de punta a punta, contra server.js
├── contracts/
│   └── api.md           # PUT, /heatmap/semana, /heatmap/semestre, URLs
├── checklists/
│   └── requirements.md  # Calidad de la especificación: completa
└── tasks.md             # Lo genera /speckit-tasks
```

### Source Code (repository root)

```text
db/migrations/
├── 018_limpiar_actividades_muestra.sql   # NUEVO · US1
└── 019_vista_saturacion_actividad.sql    # NUEVO · US5

server.js                                 # PUT: título vacío + actualizadoEn → 409   (US4)
                                          # /heatmap/semana y /semestre: nivel=todos  (US5)
js/dao/kpiDao.js                          # saturacionPublico() sobre la vista nueva  (US5)
js/services/heatmapService.js             # expandirPublico(carreras, nivel) — puro  (US5)

js/calendario-estado.js                   # NUEVO · URL ↔ estado, puedeEditar — puro (US3, US4)
js/calendar-view.js                       # aviso, initialView/initialDate, datesSet,
                                          # eventClick por permiso, arrastre           (US2-US4)
js/views/editor-actividad.js              # NUEVO · panel de edición en <dialog>      (US4)
js/views/calendario-view.js               # filtros desde/hacia la URL, R-03          (US3)
js/app-boot.js                            # registrar los dos módulos en window.MapFI
calendario.html · index.html              # cargar los scripts nuevos
mapa-calor.html · js/heatmap-view.js      # opción "Todas las generaciones", aviso   (US5)
css/design-system.css                     # aviso y panel de edición, con tokens      (US2, US4)

__tests__/
├── calendario-estado.test.js             # NUEVO
├── services/heatmapService.test.js       # expandirPublico + límite
├── dao/kpiDao.test.js                    # NUEVO · saturacionPublico: SQL y parámetros
├── db/migracion-018.test.js              # NUEVO · lee el SQL: la huella exige los 4 campos
└── routes/api.test.js                    # PUT 400/409, heatmap nivel=todos y límite
```

**Structure Decision**: se mantiene la estructura monolítica existente. Los dos módulos nuevos
del navegador van en `js/` (lo que solo corre en el cliente); `js/shared/` queda reservada, como
decidió la Spec 004, para lo que corre también en el servidor.

## Orden de implementación

Cada historia es independiente y desplegable por separado, en este orden:

| # | Historia | Por qué en este lugar | Tamaño |
|---|---|---|---|
| 1 | **US1** Dato de ejemplo | Es información falsa ante estudiantes reales. Una migración. | S |
| 2 | **US2** Aviso | Protege a los estudiantes desde el primer día. Un bloque en `montar()`. | S |
| 3 | **US3** Posición | La molestia diaria. Deja la URL lista, que US4 aprovecha para no mover el calendario al guardar. | M |
| 4 | **US4** Edición | Depende de US3. Primero las reglas del servidor, luego el panel, al final el arrastre. | L |
| 5 | **US5** Mapa de calor | Independiente de las anteriores. Primero la vista y el DAO, luego la ruta, al final la interfaz. | M |

**US1 y US2 pueden salir en un primer despliegue** mientras se trabaja el resto: son las dos que
protegen a los estudiantes y no dependen de nada.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La `018` borra algo real | Huella de 4 campos + prueba que verifica que el SQL exige los cuatro + ensayo manual en el quickstart (US1.4). |
| Un arrastre accidental de un certamen | Confirmación obligatoria antes de guardar; solo arrastran quienes pueden editar; sin redimensionado. |
| Regresión en «Mi panel» al tocar el `PUT` | `actualizadoEn` es opcional; sin él, el comportamiento es el actual. Las pruebas existentes del `PUT` siguen en verde. |
| Cambia el número del semestre en el mapa de calor | Con un solo año el resultado es idéntico (prueba de equivalencia). Solo cambia sin año, que hoy la interfaz no permite pedir. |
| URL con parámetros basura compartida por WhatsApp | Validación campo a campo; lo inválido se ignora sin romper la página. |
| Verificar con un servidor estático y no ver un 404 | El quickstart exige `server.js`; los scripts nuevos van en `js/`, que se sirve. |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
