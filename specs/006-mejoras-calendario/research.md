# Research: Spec 006 — Calendario que recuerda, se edita en su sitio y avisa

Todo lo que sigue se verificó contra el código de la rama `006-mejoras-calendario` y contra
producción (`https://mapafi.giia.udec.cl`) el 2026-09-27. Donde un hallazgo contradice lo que la
especificación daba por hecho, está marcado.

---

## R-01 · Cómo retirar el certamen de ejemplo

**Hechos verificados**

- Producción: actividad **id 1**, "Certamen 1 - Cálculo I", DOCFI, `2026-10-12T02:17:10.238Z`,
  `CONFIRMADA`, público ICI 1.er año. La hora con segundos y milisegundos delata un `now()`.
- Origen: `db/migrations/002_seed_catalogos.sql:108` la inserta con descripción
  `'Primera evaluación del semestre'` y ubicación `'Aula 301'`; `007_fix_seeds.sql:15` le suma
  60 días si la fecha ya pasó. La otra muestra, "Semana del Novato"
  (`'Actividad de bienvenida a primer año'`, `'Patio central FI'`, CEEIND), no está vigente.
- `actividadDao.listarEliminadasRecientes` solo lista `estado = 'ARCHIVADA'` y el aviso público
  está vacío hoy: un `DELETE` físico **no** aparece como cancelación.
- El `.ics` emite `CANCELLED` solo para archivadas recientes; una fila borrada desaparece del
  feed y los calendarios suscritos la quitan en su siguiente sincronización.
- `actividad_publico` tiene `ON DELETE CASCADE`. `borrado_definitivo` (migración 015) admite
  `borrado_por` nulo.

**Decision**: nueva migración `018_limpiar_actividades_muestra.sql` que, en una sola sentencia
con CTE, copia a `borrado_definitivo` las filas que calzan con la **huella completa** de fábrica
(título + descripción + ubicación + sigla de la entidad) y luego las borra. Motivo registrado:
`'Dato de ejemplo de instalacion (migracion 018)'`, `borrado_por` nulo.

**Rationale**: repite el patrón ya aceptado de `016_limpiar_horario_muestra.sql`, que limpió los
bloques de horario de ejemplo. La huella de cuatro campos hace imposible tocar una actividad
real que se llame igual: ningún centro escribe "Primera evaluación del semestre" en "Aula 301"
para Docencia. Es idempotente —una segunda pasada no encuentra nada— y en una instalación
limpia 002 inserta, 007 mueve y 018 borra, así que el arranque termina sin ejemplos (FR-005).

**Alternatives considered**

- *Retirar desde el panel de administración*: archiva y publica "Docencia canceló el
  Certamen 1". Es exactamente lo que FR-002 prohíbe.
- *Borrado definitivo vía API de superadministrador*: funciona, pero es una acción manual sobre
  un servidor que yo no opero, no deja arreglada la instalación limpia, y no existe en la
  interfaz.
- *Editar la migración 002 para no sembrar*: prohibido por el Principio V (002 ya está aplicada).
- *Identificar por `id = 1`*: frágil. En una base restaurada o sembrada en otro orden, el id 1
  puede ser una actividad real.

---

## R-02 · Dónde vive la posición del calendario

**Hechos verificados**

- `js/calendar-view.js:125` destruye la instancia de FullCalendar en cada `montar()`, y
  `js/views/calendario-view.js:159-165` llama a `montar()` en cada `change` de un `.filtro`. No hay
  `initialDate` ni `datesSet`. Por eso el calendario vuelve al mes actual **tanto al recargar
  como al filtrar**: son el mismo defecto.
- `mapa-calor.html:81-87` ya lee la selección desde los parámetros de la URL.
- FullCalendar 6.1.15 vendorizado expone `initialDate`, `initialView` y el callback `datesSet`.

**Decision**: la posición (vista + fecha de anclaje + filtros) vive en los **parámetros de la
URL** y se escribe con `history.replaceState`. Un módulo puro nuevo, `js/calendario-estado.js`,
convierte entre la URL y un objeto `{ vista, fecha, filtros }`, validando cada valor por
separado. Doble exportación (`window` + `module.exports`) como `js/horario-csv.js`: solo lo usa
el navegador, así que **no** va en `js/shared/`, que la Spec 004 reservó para lo que también
corre en el servidor. `montar()` recibe ese estado y lo pasa como
`initialView`/`initialDate`; `datesSet` lo reescribe al navegar. Como cada re-render lee la URL,
filtrar deja el calendario en la misma fecha sin cambiar la estrategia de destruir y recrear.

Parámetros: `vista` ∈ {`mes`, `semana`, `agenda`}, `fecha` = `AAAA-MM-DD`, y los filtros ya
existentes (`carreraId`, `nivel`, `entidadId`, `tipo`, `soloParticipacion`).

**Rationale**:
- Arregla los dos síntomas con un solo mecanismo.
- `replaceState` y no `pushState`: recorrer diez meses no debe llenar el botón Atrás de diez
  pasos (FR-014).
- En la URL y no en `localStorage`: el enlace se puede compartir (FR-012), no depende del
  navegador, y repite el patrón que el mapa de calor ya usa.
- Un módulo puro se prueba en Node sin DOM, que es lo que la constitución exige.
- Nombres en castellano (`mes`, `semana`) y no los internos de FullCalendar (`dayGridMonth`):
  la URL la ve el usuario y la comparte.

**Alternatives considered**

- *Reutilizar la instancia y solo cambiar la fuente de eventos*: mejor transición visual, pero
  obliga a reestructurar `montar()` (el mapa de choques y el `eventContent` dependen de sus
  argumentos). No aporta a los criterios de éxito; se deja anotado como mejora futura.
- *`localStorage`*: no se comparte y queda pegado a un navegador.
- *`sessionStorage`*: se pierde al abrir otra pestaña.

**Alcance acotado**: la persistencia se activa solo en `calendario.html`. La portada muestra un
anticipo del mes en curso y no debe cargar su dirección con parámetros de navegación; se activa
con una opción de `montar()`.

**Pantallas chicas**: no existe hoy lógica que cambie de vista según el ancho, y la vista Semana
funciona en teléfono. Se respeta la vista guardada. El caso borde de la especificación queda
cubierto por la validación: una vista desconocida cae a Mes.

---

## R-03 · Filtros guardados frente a la preselección de la carrera propia

**Hecho**: `calendario-view.js` preselecciona la carrera del centro con sesión cuando carga.

**Decision**: si la URL trae `carreraId` (incluido `carreraId=` vacío, que significa "Todas"),
manda la URL. Solo cuando la URL no trae el parámetro se aplica la preselección, que además se
escribe en la URL.

**Rationale**: FR-015. Un centro que eligió "Todas las carreras" y recargó no debe volver a su
carrera; uno que entra limpio sí.

---

## R-04 · Edición desde el calendario: qué reutilizar

**Hechos verificados**

- `PUT /api/actividades/:id` ya valida propiedad (`puedeEditarActividad`: administrador, o
  `entidad_id` igual al de la sesión), filtra campos con `camposActividadPermitidos`, valida el
  rango con `errorRangoFechas` y recalcula la compatibilidad solo si cambia fecha o público.
- `GET /api/actividades` devuelve `entidad_id` y `updated_at`; `GET /api/auth/me` devuelve
  `rol` y `entidadId`.
- `actividadDao.actualizar` pone `updated_at = now()` y el `.ics` deriva `SEQUENCE` de ese campo:
  **un cambio llega a Google/Outlook como actualización del mismo evento**. FR-022 ya se cumple.
- Existen `<dialog>` nativos en `js/ui-confirm.js` y `js/calendar-sync.js`: foco atrapado y
  cierre con Escape vienen del navegador.
- `event-table.js` convierte fechas con `toLocalInput()` para `datetime-local`.

**Decision**: módulo nuevo `js/views/editor-actividad.js` que abre un `<dialog>` de edición con
los mismos estilos (`confirm-dialog`). `eventClick` decide con una función pura,
`CalendarioEstado.puedeEditar(actividad, usuario)`, qué panel abrir; el de edición incluye como
acción secundaria "Añadir a mi calendario" (que abre el panel de siempre) y un enlace a
«Mi panel» para el público objetivo y el estado. Tras guardar, se vuelve a renderizar el
calendario: la fecha no se mueve porque está en la URL (R-02), y el servidor vuelve a ser la
fuente de verdad (color por tipo, compatibilidad recalculada).

**Rationale**: la decisión en la interfaz es solo de conveniencia; la autorización la sigue
decidiendo el servidor (FR-021, Principio III). No se duplica el formulario de «Mi panel»: el
panel del calendario cubre solo los campos de uso diario.

---

## R-05 · Defectos del `PUT` que la edición en el calendario destaparía

**Hallazgo 1 — título vacío.** `actividadDao.actualizar` usa `titulo = COALESCE($2, titulo)`.
`null` conserva el título, pero `""` **no es nulo** y lo pisa. El formulario de «Mi panel» nunca
manda el título, por eso no se vio; el panel nuevo sí lo manda.

**Decision**: el `PUT` rechaza con 400 un `titulo` presente y vacío tras recortar espacios, con
el mensaje `"El título no puede quedar vacío"`. Validación en el servidor, no solo en el
formulario (FR-020).

**Hallazgo 2 — sin control de concurrencia.** Dos personas del mismo centro pueden editar la
misma actividad y la segunda pisa a la primera sin enterarse (FR-023).

**Decision**: el `PUT` acepta un campo opcional `actualizadoEn` con el `updated_at` que el
cliente vio. Si viene y no coincide con el actual, responde **409** con
`"Esta actividad cambió mientras la editabas. Recarga para ver la versión actual."`. Si no viene,
el comportamiento es el de hoy: «Mi panel» sigue funcionando sin cambios.

**Rationale**: control optimista mínimo, retrocompatible, sin columna nueva (`updated_at` ya
existe y ya lo mantiene el DAO). Una actividad borrada mientras se editaba ya responde 404.

**Alternatives considered**: bloqueo pesimista (sobra para el volumen de un centro), o
cabecera `If-Match` con ETag (correcto, pero ningún cliente del proyecto usa cabeceras
condicionales; un campo del cuerpo es más simple de probar y de leer).

---

## R-06 · Arrastrar con confirmación

**Hechos**: el bundle estándar incluye el plugin de interacción (`eventDrop`, `info.revert()`,
`eventAllow`, `eventStartEditable`). Hoy el calendario no es editable.

**Decision**: `editable` se activa **por evento**, solo en los que `puedeEditar()` devuelve
verdadero; el resto no se puede arrastrar (FR-024). En `eventDrop` se abre `confirmDialog`
con origen y destino en palabras ("del martes 10 al jueves 12 de noviembre"). Confirmar manda el
mismo `PUT` con `fechaInicio`, `fechaFin` y `actualizadoEn`; cancelar, o un error del servidor,
llama a `info.revert()`. Se desactiva el redimensionado (`durationEditable: false`): cambiar la
duración se hace en el panel, donde se ve la hora exacta.

**Rationale**: decisión del usuario (Clarifications). Por evento y no global: un visitante que
arrastra "sin querer" no ve moverse nada.

---

## R-07 · Mapa de calor con "Todas las generaciones"

**Hallazgo — la vista de semestre cuenta de más.** `vw_saturacion_segmento`
(`011_saturacion_multidia.sql`) agrupa por `(carrera, nivel, fecha)`. `GET /api/heatmap/semestre`
ya acepta la petición **sin** nivel (responde 200 en producción) y `heatmapService.semestrePorDia`
**suma** las filas. Una charla dirigida a los 5 años de Industrial cuenta **5** actividades ese
día. Hoy no se nota porque la interfaz obliga a elegir un año; "Todas las generaciones" lo
destaparía.

**Decision**:
- **Semestre**: vista nueva y aditiva `vw_saturacion_actividad` (migración
  `019_vista_saturacion_actividad.sql`) con una fila por `(actividad, carrera, nivel, día)`:
  la misma expansión multi-día y el mismo filtro de estados vigentes que `vw_saturacion_segmento`,
  pero **exponiendo `actividad_id` y `tipo`**. `kpiDao.saturacionPublico(publico, desde, hasta)`
  la consulta con `COUNT(DISTINCT actividad_id)` por día para el conjunto de segmentos pedido.
  La ruta acepta además varias carreras, como la vista por hora.
- **Por qué una vista y no una consulta a las tablas**: la constitución exige que los KPIs vivan
  detrás de vistas `vw_*` ("Backend desacoplado para BI"). Una vista nueva no toca el esquema
  base ni la vista existente, que otros indicadores siguen usando. La lista de estados se repite
  en SQL con el comentario de sincronización que ya llevan las vistas 009 y 011.
- **Por hora**: `GET /api/heatmap/semana` acepta `nivel=todos` y arma el público como
  carreras × niveles 1-5. `heatmapService.semanaPorHora` ya pondera N segmentos por matrícula; no
  se toca.
- **Límite**: se mantiene `HEATMAP_MAX_SEGMENTOS = 20`, y se valida **después** de expandir los
  niveles: 4 carreras × 5 años = 20 pasa, 5 carreras × 5 = 25 no (decisión del usuario). El
  mensaje explica el límite en términos de carreras, no de "segmentos".
- **Interfaz**: el selector de año de `mapa-calor.html` gana la opción "Todas las generaciones"
  (`todos`), el aviso previo advierte antes de pedir el mapa si hay más de 4 carreras marcadas, y
  la opción viaja en la URL como hoy la carrera y el año.

**Rationale**: la palabra `todos` en vez de omitir el nivel hace explícita la intención: omitirlo
hoy es un error de la petición y debe seguir siéndolo en la vista por hora. Contar actividades
distintas es lo único correcto para "la carrera completa": una actividad transversal es una
actividad, no cinco.

**Alternatives considered**: arreglar la suma en `semestrePorDia` (imposible: la vista no expone
el id de la actividad, no hay con qué deduplicar); modificar `vw_saturacion_segmento` (la usan
otros KPIs y cambiaría su granularidad); consultar las tablas desde el DAO (incumple la
restricción de vistas para KPIs).

---

## R-08 · El aviso de verificación

**Decision**: una franja informativa (`role="note"`) con icono `info` de `js/icons.js`, que
`CalendarView.montar()` inserta **encima** del calendario en cualquier página que lo monte
(calendario y portada, FR-008), una sola vez por contenedor. Tokens del design system, tono
neutro y no de error (FR-009), visible también al imprimir.

Texto:

> Las actividades de este calendario las publican los centros de estudiantes y pueden contener
> errores. Si una fecha es importante para ti, confírmala con tu profesor o con el programa de la
> asignatura.

**Rationale**: montarla desde `CalendarView` garantiza que ningún calendario futuro salga sin
ella. `role="note"` es la semántica correcta para información complementaria: `role="alert"`
interrumpiría al lector de pantalla en cada carga.

**Alternatives considered**: escribirla a mano en cada HTML (dos sitios que desincronizar); un
`alert` (se lee como error y los usuarios aprenden a ignorarlo).

---

## Resumen: nada queda sin resolver

| Punto | Estado |
|---|---|
| Identificación segura del dato de ejemplo | Resuelto — huella de 4 campos (R-01) |
| Mecanismo de persistencia | Resuelto — URL + `replaceState` (R-02) |
| Conflicto con la preselección de carrera | Resuelto — manda la URL (R-03) |
| Sincronización con calendarios externos | Ya funciona — `updated_at` → `SEQUENCE` (R-04) |
| Título vacío y concurrencia | Resuelto — validación + `actualizadoEn` → 409 (R-05) |
| Doble conteo en el semestre | Resuelto — vista nueva + `COUNT(DISTINCT)` (R-07) |
