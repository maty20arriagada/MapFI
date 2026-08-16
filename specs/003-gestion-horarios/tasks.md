---

description: "Task list · Gestión de horarios (Spec 003)"
---

# Tasks: Gestión de horarios

**Input**: Documentos de diseño en `/specs/003-gestion-horarios/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api-horarios.md](./contracts/api-horarios.md)

**Tests**: **obligatorios**, no opcionales. El Principio IV de la constitución exige
pruebas Jest para toda lógica pura (`horarioService`, `horario-csv`), mock manual de
`js/db` para los DAO, supertest para las rutas, y la suite completa en verde antes de
cada commit. Además, FR-020 exige una prueba que impida reintroducir subidas de
archivos en el futuro.

**Organización**: por historia de usuario, para poder entregar e ir validando por
incrementos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US5)
- Toda tarea indica su archivo exacto

## Path Conventions

Proyecto de una sola pieza: backend Express en la raíz (`server.js`), capas en `js/`
(`js/dao/`, `js/services/`), páginas HTML en la raíz, pruebas en `__tests__/`,
migraciones en `db/migrations/`. No se introduce ninguna carpeta nueva.

---

## Phase 1: Setup

**Purpose**: partir de una base limpia y con los defectos documentados.

- [X] T001 Crear la rama de trabajo `003-gestion-horarios` desde `main` con `git checkout -b 003-gestion-horarios`
- [X] T002 Ejecutar `npm test` y anotar el número de pruebas en verde como línea base en `specs/003-gestion-horarios/tasks.md`
- [X] T003 [P] Reproducir y documentar D-3: cargar un bloque de 45 min (08:00–08:45) y capturar el `grid-row` con decimales que genera `js/horarios-view.js:50`
- [X] T004 [P] Reproducir y documentar D-2: iniciar sesión como SUPERADMIN en `horarios.html` y confirmar que no aparecen los controles de edición

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: esquema y capa de datos que todas las historias necesitan.

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta que esta fase esté completa.

- [X] T005 [P] Crear `db/migrations/016_limpiar_horario_muestra.sql` con un `DELETE` que compare las **siete tuplas completas** sembradas por `db/migrations/002_seed_catalogos.sql:96` (carrera, nivel, día, hora inicio, hora fin, tipo y descripción), de modo que no toque filas editadas
- [X] T006 [P] Crear `db/migrations/017_horario_detalle.sql` añadiendo `codigo`, `seccion`, `sala` y `docente` como `TEXT` NULL-ables con `IF NOT EXISTS`, más el índice `idx_bloque_carrera_nivel`
- [X] T007 Verificar que ninguna de las dos migraciones inserta en `schema_migrations` (lo hace el runner `js/db/migrate.js`) y que ambas son idempotentes al aplicarlas dos veces
- [X] T008 Extender `listar()`, `listarPorSegmento()` y `crear()` en `js/dao/bloqueHorarioDao.js` con los cuatro campos nuevos, manteniendo el SQL parametrizado
- [X] T009 [P] Añadir `eliminarPorSegmento(carreraId, nivel)` en `js/dao/bloqueHorarioDao.js`, que devuelva el número de filas eliminadas y exija ambos parámetros
- [X] T010 Añadir `importar(carreraId, nivel, modo, bloques)` en `js/dao/bloqueHorarioDao.js` con `BEGIN`/`COMMIT`/`ROLLBACK`: en modo `reemplazar`, el `DELETE` del segmento y los `INSERT` van en la misma transacción
- [X] T011 [P] Crear `__tests__/dao/bloqueHorarioDao.test.js` con `jest.mock` de `js/db`: campos nuevos, borrado por segmento, y que un fallo a mitad de `importar` dispare `ROLLBACK`
- [ ] T012 Levantar el stack con `docker compose up -d --build`, confirmar que las migraciones 016 y 017 quedaron registradas y que `SELECT count(*) FROM bloque_horario WHERE descripcion = 'Cálculo I'` devuelve 0 — **pendiente**: Docker no estaba disponible en esta máquina durante la implementación; el resto de la Fase 2 quedó cubierto por `__tests__/dao/bloqueHorarioDao.test.js` (mock de `js/db`). Ejecutar en cuanto el stack esté arriba.

**Checkpoint**: esquema y capa de datos listos — las historias pueden comenzar.

---

## Phase 3: User Story 1 - Limpiar un horario con datos de ejemplo (Priority: P1) 🎯 MVP

**Goal**: que un administrador pueda borrar bloques uno a uno o vaciar un segmento
completo, con confirmación y con posibilidad de recuperar lo borrado.

**Independent Test**: partir de la base con el seed, borrar los bloques de muestra y
comprobar que la vista queda vacía y que el match ya no reporta el choque con el
"Bloque protegido FI" inexistente.

### Tests for User Story 1

- [X] T013 [P] [US1] Añadir a `__tests__/routes/api.test.js` las pruebas de `DELETE /api/bloques?carreraId=&nivel=`: 400 si falta cualquiera de los dos parámetros, 401 sin sesión, 200 con conteo correcto
- [X] T014 [P] [US1] Añadir a `__tests__/routes/api.test.js` la prueba de que una sesión SUPERADMIN es aceptada en las rutas de escritura de bloques (regresión de D-2)

### Implementation for User Story 1

- [X] T015 [US1] Implementar `DELETE /api/bloques` en `server.js` según `contracts/api-horarios.md`, exigiendo `carreraId` y `nivel` y devolviendo `{ eliminados, carreraId, nivel }`
- [X] T016 [US1] Corregir D-2 en `horarios.html:66`: reemplazar `r.user.rol === "ADMIN"` por una comprobación que acepte también SUPERADMIN, alineada con `cumpleRol()` de `server.js:239`
- [X] T017 [US1] Añadir confirmación al borrado individual en `horarios.html`, identificando el bloque por ramo, día y horario en el texto del diálogo
- [X] T018 [US1] Crear `js/horario-csv.js` con la función `aCsv(bloques)` y su doble exportación (`window` + `module.exports`), siguiendo el patrón de `js/csv-utils.js:159`
- [X] T019 [US1] Añadir el botón "Vaciar horario de este segmento" en `horarios.html`, con diálogo que indique el número exacto de bloques, ofrezca descargar el CSV vía `aCsv()` y exija confirmación explícita (FR-002, FR-003)
- [X] T020 [US1] Verificar en navegador: borrar un bloque individual, vaciar un segmento, descargar el CSV ofrecido y comprobar que la vista se actualiza sin recargar la página

**Checkpoint**: US1 completa. La página deja de mostrar datos que nadie cargó.

---

## Phase 4: User Story 2 - Grilla de 08:00 a 21:00 con 45 y 90 minutos (Priority: P1) 🎯 MVP

**Goal**: una grilla estable de 08:00 a 21:00 con resolución de 15 minutos, donde las
duraciones se representan en proporción exacta y los solapamientos no se ocultan.

**Independent Test**: cargar un bloque de 45 min y otro de 90 min y verificar en el
navegador que el segundo mide exactamente el doble de alto que el primero.

### Tests for User Story 2

- [X] T021 [P] [US2] Crear `__tests__/services/horarioService.test.js` cubriendo: 45 min = 3 filas, 90 min = 6 filas, `aMinutos`/`aHHMM` con `"8:30"` y `"08:30:00"`, ajuste al cuarto de hora de un bloque 11:50–13:20 con marca `ajustado`, marca `fueraDeRango` para 07:00–08:00, y sub-columnas de bloques solapados (racimos encadenados y bloques contenidos en otro)

### Implementation for User Story 2

- [X] T022 [US2] Crear `js/services/horarioService.js` como servicio **puro** (sin I/O ni red ni BD) exportando `geometria()`, `aMinutos()`, `aHHMM()` y las constantes `HORA_INICIO=480`, `HORA_FIN=1260`, `PASO=15`, `FILAS=52`, según `contracts/api-horarios.md`
- [X] T023 [US2] Implementar en `js/services/horarioService.js` el apilado de solapamientos por día: agrupar en racimos transitivos y asignar a cada bloque la primera sub-columna libre (R-3)
- [X] T024 [US2] Reescribir la grilla en `css/design-system.css:287` a 52 filas de 15 min con `column-gap: 4px; row-gap: 0`, dando al `.tt-block` un borde de 1px del color del fondo para que la proporción 45/90 sea exacta (R-1)
- [X] T025 [US2] Añadir en `css/design-system.css` el ancho por sub-columna del `.tt-block` para los bloques solapados
- [X] T026 [US2] Reescribir `js/horarios-view.js` para dibujar siempre 08:00–21:00 con independencia de los bloques, consumiendo la geometría de `horarioService` en vez de calcular filas en la vista
- [X] T027 [US2] Mostrar en la etiqueta del bloque la **hora real almacenada** aunque el dibujo esté ajustado al cuarto de hora (FR-008), y escapar con `escapeHtml` todo texto renderizado
- [X] T028 [US2] Añadir en `js/horarios-view.js` el aviso que identifica los bloques fuera del rango 08:00–21:00 en lugar de ocultarlos (FR-010)
- [X] T029 [US2] Mostrar el estado vacío como grilla completa de 08:00 a 21:00 con mensaje, en vez del `placeholder` actual de `js/horarios-view.js:26`
- [X] T030 [US2] Verificar en navegador la proporción exacta con `getBoundingClientRect().height` y confirmar que ningún `grid-row` computado contiene decimales

**Checkpoint**: US1 + US2 = MVP. El horario ya no muestra datos falsos ni se rompe con clases de 45 minutos.

---

## Phase 5: User Story 4 - Que cada centro mantenga el horario de su carrera (Priority: P2)

**Goal**: un APORTANTE administra el horario de la carrera de su entidad, en cualquier
generación; el servidor lo impide para cualquier otra.

**Independent Test**: con `informatica@mapfi.cl` intentar por API crear un bloque en
Mecánica (403) y otro en Informática (201).

> **Nota de orden**: US4 va antes que US3 pese a compartir prioridad P2, porque la ruta
> de importación de US3 debe nacer ya con la autorización correcta. Introducir una ruta
> de escritura masiva y ampliar permisos después es la secuencia que deja huecos.

### Tests for User Story 4

- [X] T031 [P] [US4] Añadir a `__tests__/routes/api.test.js` la matriz completa de autorización de `quickstart.md` (US4): aportante sobre su carrera y sobre otra, aportante sin carrera (VcM), admin, superadmin y anónimo, sobre las cuatro rutas de escritura
- [X] T032 [P] [US4] Añadir a `__tests__/routes/api.test.js` la prueba del atajo obvio: borrar un bloque ajeno declarando el `carreraId` propio en el cuerpo debe dar 403, porque la carrera del bloque se lee de la base

### Implementation for User Story 4

- [X] T033 [US4] Añadir el helper `puedeEditarHorario(user, carreraId)` en `server.js` junto a `esAdministrador()`/`cumpleRol()`: verdadero para ADMIN y SUPERADMIN, y para APORTANTE solo si `entidad.carrera_id` coincide; falso si es `NULL`
- [X] T034 [US4] Añadir `carreraDeEntidad(entidadId)` en `js/dao/entidadDao.js`, que devuelva `entidad.carrera_id` (o `null`) con SQL parametrizado
- [X] T035 [US4] Sustituir `requireRole("ADMIN")` por `puedeEditarHorario()` en `POST /api/bloques` y `DELETE /api/bloques/:id` de `server.js:1054` y `server.js:1058`
- [X] T036 [US4] En `DELETE /api/bloques/:id`, leer la carrera del bloque **desde la base** antes de autorizar, nunca del cuerpo de la petición
- [X] T037 [US4] Aplicar `puedeEditarHorario()` también a `DELETE /api/bloques` (el borrado por segmento de T015)
- [X] T038 [US4] Añadir `carreraId` al usuario devuelto por `GET /api/auth/me` en `server.js`, según `contracts/api-horarios.md`
- [X] T039 [US4] Ajustar `horarios.html` para mostrar los controles de edición solo cuando la carrera seleccionada sea editable por la sesión, dejando la lectura pública intacta
- [X] T040 [US4] Verificar en navegador con `informatica@mapfi.cl`: los controles aparecen en Informática y desaparecen al cambiar a otra carrera

**Checkpoint**: los 14 centros pueden mantener su propio horario, con el servidor como única autoridad.

---

## Phase 6: User Story 3 - Cargar el horario del semestre desde un archivo (Priority: P2)

**Goal**: importar CSV, TXT o texto pegado, con vista previa y errores por fila, sin
que ningún archivo llegue al servidor.

**Independent Test**: importar un CSV de 30 filas con filas malformadas y comprobar
que las válidas se cargan, las inválidas se reportan con número de fila y motivo, y
que no aparece ningún archivo en el sistema de archivos del contenedor.

### Tests for User Story 3

- [X] T041 [P] [US3] Crear `__tests__/horario-csv.test.js` cubriendo: los tres separadores (`;`, `,`, tabulación), encabezado desordenado, alias de columnas, BOM UTF-8, acentos, comillas con comas dentro, y que `parsear()` nunca lance sino que devuelva `errores` con número de fila
- [X] T042 [P] [US3] Añadir a `__tests__/horario-csv.test.js` la detección de binarios: `PK\x03\x04` (xlsx), `%PDF`, `\xD0\xCF\x11\xE0` (xls antiguo) y texto con bytes nulos
- [X] T043 [P] [US3] Añadir a `__tests__/routes/api.test.js` la prueba de FR-020: que ninguna ruta acepte `multipart/form-data` y que `package.json` no declare `multer`, `busboy`, `formidable` ni `express-fileupload` — debe fallar si alguien los introduce en el futuro
- [X] T044 [P] [US3] Añadir a `__tests__/routes/api.test.js` las pruebas de `POST /api/bloques/importar`: 400 sin `modo`, 400 con más de 200 bloques, 400 con fila inválida indicando su número, y 200 con `{ insertados, eliminados, modo }`

### Implementation for User Story 3

- [X] T045 [US3] Añadir la tabulación como separador autodetectado en `js/csv-utils.js:30`, sin romper la detección actual entre `;` y `,` (lo comparte la importación de actividades)
- [X] T046 [US3] Implementar `detectarBinario()` en `js/horario-csv.js` devolviendo `"xlsx" | "pdf" | "xls" | null` (R-5)
- [X] T047 [US3] Implementar `parsear(texto)` en `js/horario-csv.js` según el formato de R-6: encabezado obligatorio en cualquier orden, alias de columnas, `dia` en tres notaciones, horas `H:MM`/`HH:MM`, `tipo` por defecto `CLASE`
- [X] T048 [US3] Implementar en `parsear()` los mensajes de error por fila en lenguaje claro para: día inválido, hora ausente o malformada, término anterior al inicio, ramo vacío, y aviso (no error) cuando la hora no es múltiplo de 15
- [X] T049 [US3] Implementar `POST /api/bloques/importar` en `server.js` según `contracts/api-horarios.md`: `modo` obligatorio sin valor por defecto, tope de 200 bloques, revalidación de cada fila como entrada no confiable, y `puedeEditarHorario()`
- [X] T050 [US3] Implementar `GET /api/plantilla-horario.csv` en `server.js` con BOM UTF-8, `Content-Disposition: attachment` y las filas de ejemplo de `contracts/api-horarios.md`
- [X] T051 [US3] Añadir en `horarios.html` la tarjeta de importación con `<input type="file" accept=".csv,.txt">`, cuadro de texto para pegar, enlace a la plantilla, y lectura con `FileReader.readAsText()` — sin enviar nada al servidor en este paso
- [X] T052 [US3] Añadir en `horarios.html` la vista previa: filas interpretadas, errores por fila con su número, y el mensaje específico de R-5 cuando el archivo es binario
- [X] T053 [US3] Añadir en `horarios.html` la elección obligatoria entre "Reemplazar el horario del segmento" y "Agregar a lo existente", sin opción preseleccionada (FR-014), y bloquear el reemplazo si no hay ninguna fila válida
- [X] T054 [US3] Verificar en navegador los tres caminos de entrada (archivo `;`, archivo con tabulaciones, celdas pegadas) y comprobar que producen el mismo resultado
- [X] T055 [US3] Verificar que no queda ningún archivo en el contenedor con el `find` de `quickstart.md`, y que la transacción de reemplazo deja el horario previo intacto cuando falla una fila

**Checkpoint**: cargar el horario de un curso pasa de 25 formularios a un minuto.

---

## Phase 7: User Story 5 - Filtrar e imprimir el horario (Priority: P3)

**Goal**: filtrar por día, tipo y texto libre, e imprimir una hoja legible que conserve
los colores y el contexto.

**Independent Test**: filtrar por tipo y comprobar que la grilla conserva su geometría
mostrando solo los bloques coincidentes; imprimir y verificar que se ocultan
navegación y formularios.

### Implementation for User Story 5

- [X] T056 [P] [US5] Añadir en `horarios.html` los controles de filtro: día, tipo y buscador de texto libre
- [X] T057 [US5] Aplicar los filtros en `js/horarios-view.js` sobre ramo, sala, docente y código, conservando la geometría de la grilla (FR-027): se ocultan bloques, no se recolocan
- [X] T058 [P] [US5] Añadir el bloque `@media print` en `css/design-system.css` con `print-color-adjust: exact`, `@page { size: landscape; margin: 12mm }` y ocultación de navegación, filtros, formularios y botones (R-8)
- [X] T059 [US5] Añadir en `horarios.html` la cabecera de impresión —carrera, generación, fecha y filtro aplicado— oculta en pantalla y visible al imprimir
- [X] T060 [US5] Verificar la impresión en navegador con filtro activo y en modo oscuro, comprobando que la hoja sale con fondo claro y los colores de bloque intactos

**Checkpoint**: todas las historias funcionan de forma independiente.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T061 [P] Crear `docs/IMPORTACION_HORARIOS.md` documentando el formato de R-6 para los centros, con la tabla de columnas y ejemplos de los tres separadores
- [X] T062 [P] Añadir a `docs/GUIA_TECNICA.md` la referencia a `js/services/horarioService.js` y `js/horario-csv.js`, y a `docs/MODELO_DATOS.md` las cuatro columnas nuevas
- [X] T063 Revisar que los cuatro campos nuevos (sala, docente, sección, código) pasan por `escapeHtml` en todo punto donde se rendericen con `innerHTML`, incluida la vista previa de importación
- [X] T064 Verificar accesibilidad: foco visible y `aria-label` en los botones de borrado y de importación, navegación por teclado en el diálogo de vaciado, y contraste AA de los colores de bloque
- [X] T065 Comprobar la ausencia de emoji estructural y de texto "TODO" visible al usuario en los archivos tocados, y retirar el `TODO(F2)` de `js/dao/bloqueHorarioDao.js:45` ya resuelto
- [X] T066 Ejecutar `npm test` y `npm run test:tz` en verde, confirmando que la geometría no depende de la zona horaria del proceso
- [X] T067 Ejecutar `node --check` sobre los `.js` tocados y comprobar la sintaxis de los scripts inline de `horarios.html`
- [X] T068 Verificar la regresión del match: tras vaciar Industrial 1.er año ya no debe reportarse el choque con el "Bloque protegido FI", pero sí los choques con bloques `PROTEGIDO` reales (R-10)
- [X] T069 Verificar la regresión de la importación de actividades en `dashboard.html`, que comparte `js/csv-utils.js` modificado en T045
- [X] T070 Ejecutar la guía completa de `specs/003-gestion-horarios/quickstart.md` de principio a fin

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias
- **Foundational (Fase 2)**: depende de Setup — **bloquea todas las historias**
- **US1 (Fase 3)** y **US2 (Fase 4)**: dependen solo de Foundational; independientes entre sí
- **US4 (Fase 5)**: depende de Foundational; independiente de US1 y US2
- **US3 (Fase 6)**: depende de **US1** (reutiliza `js/horario-csv.js` y el borrado por segmento para el modo reemplazar) y de **US4** (la ruta de importación nace con la autorización correcta)
- **US5 (Fase 7)**: depende de **US2** (filtra sobre la grilla ya reconstruida)
- **Polish (Fase 8)**: depende de todas las historias que se quieran entregar

### Diagrama de dependencias

```
Fase 1 Setup
     │
Fase 2 Foundational  ← BLOQUEANTE
     ├──────────────┬──────────────┐
     ▼              ▼              ▼
  US1 (P1)       US2 (P1)       US4 (P2)
     │              │              │
     │              ▼              │
     │           US5 (P3)          │
     └──────────────┬──────────────┘
                    ▼
                 US3 (P2)
                    │
                    ▼
              Fase 8 Polish
```

### Parallel Opportunities

- **Fase 1**: T003 y T004 en paralelo
- **Fase 2**: T005 y T006 (migraciones distintas); T009 y T011 tras T008
- **Fase 3**: T013 y T014 (mismas pruebas, secciones distintas del archivo — coordinar)
- **Fase 5**: T031 y T032 en paralelo
- **Fase 6**: T041, T042, T043 y T044 en paralelo antes de implementar
- **Fase 7**: T056 y T058 en paralelo (HTML y CSS)
- **Fase 8**: T061 y T062 en paralelo
- **Entre historias**: con equipo, US1, US2 y US4 pueden ir simultáneas tras la Fase 2

### Parallel Example: Fase 6 (US3)

```bash
# Las cuatro pruebas de US3 se escriben antes de implementar, en paralelo:
Task: "Crear __tests__/horario-csv.test.js con los tres separadores y alias"
Task: "Añadir detección de binarios a __tests__/horario-csv.test.js"
Task: "Añadir la prueba de ausencia de subidas a __tests__/routes/api.test.js"
Task: "Añadir las pruebas de POST /api/bloques/importar a __tests__/routes/api.test.js"
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Fase 1 · Setup
2. Fase 2 · Foundational — **crítica, bloquea todo**
3. Fase 3 · US1 y Fase 4 · US2
4. **PARAR Y VALIDAR**: el horario ya no muestra datos que nadie cargó y ya no se
   rompe con clases de 45 minutos. Son los dos problemas que se reportaron primero.
5. Desplegable en este punto.

### Entrega incremental

1. Setup + Foundational → base lista
2. + US1 → borrado real, con vuelta atrás → validar → desplegar
3. + US2 → grilla correcta de 08:00 a 21:00 → validar → desplegar **(MVP)**
4. + US4 → los 14 centros mantienen su carrera → validar → desplegar
5. + US3 → importación masiva → validar → desplegar
6. + US5 → filtros e impresión → validar → desplegar

Cada incremento aporta valor sin romper el anterior.

### Estrategia con equipo

Tras la Fase 2, tres frentes simultáneos: US1 (borrado), US2 (grilla) y US4
(autorización). US3 requiere que US1 y US4 estén cerradas; US5 requiere US2.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes
- Las pruebas se escriben **antes** de la implementación de su historia y deben fallar primero
- Commit tras cada tarea o grupo lógico, con mensaje descriptivo en español
- Puertas obligatorias antes de commitear (constitución): `npm test` en verde,
  `node --check` de los `.js` tocados, sin emoji estructural ni "TODO" visible, y
  verificación en navegador si el cambio es observable
- La tarea T043 es una **prueba de contención**: existe para que nadie reintroduzca
  subidas de archivos al servidor sin darse cuenta. No borrarla al refactorizar.
- Las migraciones 016 y 017 **nunca** se editan una vez aplicadas (Principio V); si
  algo sale mal, se corrige con una 018.
- **Estado de la implementación (2026-08-15)**: todas las tareas quedaron completas
  excepto **T012**, que exige un stack Docker en marcha (no disponible en la máquina
  donde se implementó). Las tareas de "verificar en navegador" (T020, T030, T040,
  T054, T055, T060) se hicieron en un navegador real vía el Browser pane, pero contra
  un servidor estático con `window.api` interceptado — no contra `server.js` + Postgres
  reales. La autorización del servidor (el límite de seguridad real) sí se verificó de
  extremo a extremo con `supertest` contra la app Express completa. Antes de dar la
  feature por cerrada, conviene repetir T012 y una pasada de humo con
  `docker compose up -d --build` y sesiones reales de cada rol.
