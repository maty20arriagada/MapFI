---
title: "Tasks 002 — Auditoría de robustez de MapFI"
tags: [mapfi, tasks, auditoria, robustez, speckit]
date: 2026-07-31
status: listo-para-implementar
aliases: ["Tasks 002", "Tareas de robustez"]
---

# Tasks: Auditoría de robustez — corregir inconsistencias críticas

**Input**: Design documents from `specs/002-auditoria-robustez-corregir/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [dilemas.md](./dilemas.md)

**Tests**: SÍ se incluyen. La constitución (Principio IV) los exige, y esta feature nace precisamente porque las pruebas actuales no cubrían las junturas entre capas.

**Organization**: Agrupadas por historia de usuario, para poder implementar, probar y entregar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1…US6)
- Cada tarea indica **ruta exacta**, **qué hacer** y **cómo se verifica**

## Convenciones de esta lista

- **H-##** = hallazgo de [research.md](./research.md) · **E-##** = escenario de [dilemas.md](./dilemas.md) · **FR-###** = requisito de [spec.md](./spec.md)
- Antes de cada commit: `npm test` en verde y, si el cambio se ve en pantalla, verificación en navegador real (Principio IV).
- Migraciones **aditivas e idempotentes**; nunca insertan en `schema_migrations` (Principio V, y fue causa de un incidente previo).

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: Preparar el entorno para que los defectos sean **reproducibles** antes de corregirlos. Sin esto se corrige a ciegas.

- [ ] T001 Crear rama de trabajo `002-auditoria-robustez` desde `update/v2-seguridad-tutoriales` y confirmar con `npm test` que la línea base está en verde (60 pruebas) antes de tocar nada.
- [ ] T002 [P] Añadir al `package.json` el script `test:tz` que ejecute la suite forzando una zona horaria distinta a la de Chile (por ejemplo UTC), de modo que `npm run test:tz` reproduzca el entorno real del contenedor. No modificar aún `jest.setup.js`.
- [ ] T003 [P] Documentar en `specs/002-auditoria-robustez-corregir/baseline.md` el resultado de ejecutar `npm test` y `npm run test:tz` sobre el código actual, dejando constancia de qué pruebas pasan en cada zona horaria (evidencia de que la suite enmascara H-01).
- [ ] T004 Levantar el entorno completo con `docker compose up -d --build`, aplicar migraciones y crear datos de prueba mínimos (una entidad aportante con cuenta, una actividad de ejemplo) para poder validar manualmente cada historia.

**Checkpoint**: entorno reproducible y línea base documentada.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: Cambios transversales de los que dependen varias historias. **Deben completarse antes de las fases 3+**.

⚠️ **Bloquean a US1, US2 y US3.**

- [ ] T005 Definir en `js/dao/actividadDao.js` una constante exportada con los estados **vigentes** (`PROPUESTA`, `CONFIRMADA`, `REALIZADA`) y otra con los **ocultos** (`SUSPENDIDA`, `REPROGRAMADA`, `ARCHIVADA`), como **fuente única de verdad** de visibilidad según [data-model.md](./data-model.md). No cambiar todavía las consultas; solo introducir la definición y documentarla con un comentario que explique el modelo de moderación reactiva.
- [ ] T006 Crear la migración `db/migrations/008_estados_y_trazabilidad.sql` que: (a) amplíe el `CHECK` del campo **`estado`** (no el de `tipo`, que no debe tocarse) para admitir `ARCHIVADA`; (b) agregue las columnas `retirada_por INTEGER REFERENCES usuario(id)`, `retirada_en TIMESTAMPTZ` y `motivo_retiro TEXT`; (c) cree un índice sobre `estado` para acelerar el filtro de visibilidad. Debe ser aditiva, idempotente (`IF NOT EXISTS`) y **no** insertar en `schema_migrations`.
- [ ] T007 Verificar la migración 008 aplicándola sobre la base ya levantada (`npm run db:migrate`) y comprobando que el servidor arranca sin error y que `docker compose logs server` no muestra fallos — la migración 007 ya causó una caída de arranque por este motivo, así que este control es obligatorio.
- [ ] T008 [P] Añadir en `js/api-client.js` el mapeo del código de respuesta 413 a un mensaje comprensible ("El archivo es demasiado grande; divídelo en partes") y revisar que todo código no mapeado caiga en un texto genérico útil (FR-011).
- [ ] T009 [P] Añadir `role="status"` y `aria-live="polite"` al contenedor de avisos en `js/ui-toast.js` (y `aria-live="assertive"` cuando el tipo sea `error`), para que los mensajes de éxito y error sean anunciados por lectores de pantalla. *(Mejora de accesibilidad 2.1 del backlog, incorporada aquí porque toda esta feature depende de que los mensajes se perciban.)*
- [ ] T009a Introducir en `server.js` una función que construya el objeto de actividad **seleccionando explícitamente** los campos permitidos del cuerpo de la petición (título, descripción, tipo, ramo, ubicación, fechas, público), en lugar de propagar el cuerpo completo con `{ ...b }`. Esta función se usa desde el inicio en **todas** las rutas de escritura de actividades (creación individual, carga masiva, edición) para que ningún campo no autorizado llegue nunca al DAO (causa raíz de H-04, FR-008). Se adelanta a esta fase porque US3 y US4 escriben sobre las mismas rutas y deben partir ya protegidas.

**Checkpoint**: base de datos preparada, criterio de visibilidad definido, mensajes de error legibles y las rutas de escritura de actividades ya blindadas contra campos no autorizados.

---

## Phase 3: US1 — La hora publicada es la hora ingresada (Priority: P1) 🎯 MVP

**Goal**: Que una actividad cargada a las 21:00 se muestre a las 21:00 en el calendario, en "Mis eventos" y en el reporte, con el servidor en cualquier zona horaria.

**Independent Test**: crear un evento a una hora conocida con el contenedor en su configuración real y comparar la hora mostrada en las tres vistas (V-1 del [quickstart](./quickstart.md)).

**Corrige**: H-01 · **Escenario**: E-01 · **Requisitos**: FR-001, SC-001, SC-010

### Pruebas primero

- [ ] T010 [P] [US1] Crear `__tests__/services/fechas.test.js` con pruebas que fallen hoy: verificar que una fecha ingresada como texto sin zona (`"2026-04-17T21:00"`) produce la hora 21:00 al formatearse para el usuario, ejecutando la prueba en zona UTC. Debe fallar antes de la corrección y pasar después.
- [ ] T011 [P] [US1] Añadir a `__tests__/services/matchService.test.js` un caso que evalúe una propuesta el **viernes a las 21:00** y verifique que **no** se clasifica como fin de semana, y otro el **lunes a las 09:00** contra un bloque de clase 08:30–10:00 que verifique que **sí** detecta el choque. Ambos deben pasar en las dos zonas horarias.

### Implementación

- [ ] T012 [US1] Fijar la zona horaria del contenedor de aplicación en `docker-compose.yaml`: agregar `TZ: America/Santiago` al servicio `server`, y `TZ`/`PGTZ` al servicio `db`, para que Node y PostgreSQL interpreten igual las fechas sin zona. Documentar en un comentario por qué es necesario (el valor por defecto es UTC y desplaza las horas 4 h).
- [ ] T013 [US1] Añadir `ENV TZ=America/Santiago` en el `Dockerfile` e instalar los datos de zonas horarias (`tzdata`) si la imagen `node:20-alpine` no los trae, verificando dentro del contenedor que `date` reporta la hora chilena.
- [ ] T014 [US1] Documentar la variable `TZ` en `.env.example` con una explicación breve, para que un despliegue futuro en otro servidor no reintroduzca el defecto.
- [ ] T015 [US1] Modificar `jest.setup.js` para que **deje de fijar** `TZ=America/Santiago` de forma incondicional: debe respetar la zona del entorno si viene definida, de modo que `npm run test:tz` ejerza realmente otra zona. Es el cambio que impide que la suite vuelva a ocultar defectos de fecha (SC-010).
- [ ] T016 [US1] Ejecutar `npm test` y `npm run test:tz`; ambas deben quedar en verde. Si alguna prueba solo pasa en una zona, corregir la dependencia oculta que revela.
- [ ] T017 [US1] Verificar en navegador real (V-1): crear un evento a las 21:00, confirmar que el calendario público, "Mis eventos" y el PDF descargado muestran 21:00. Dejar constancia con una captura en `specs/002-auditoria-robustez-corregir/evidencia/`.
- [ ] T018 [US1] Revisar los datos de muestra sembrados: como **no hay actividades reales** (decisión D-1), basta con recrear la base (`docker compose down -v && docker compose up -d --build`) y confirmar que las actividades de ejemplo quedan a la hora esperada.

**Checkpoint**: US1 completa y entregable por sí sola. Es el **MVP de esta feature**.

---

## Phase 4: US2 — Retirar retira de verdad (Priority: P1)

**Goal**: Implementar la **moderación reactiva** decidida: todo se publica al instante, el administrador puede retirar, y lo retirado desaparece de todas las vistas. La eliminación pasa a ser archivado reversible.

**Independent Test**: publicar una actividad, retirarla y comprobar que desaparece del calendario, del mapa de calor y del detector de choques; eliminar otra y restaurarla (V-2).

**Corrige**: H-02 · **Escenarios**: E-02, E-07 · **Requisitos**: FR-002, FR-002b, FR-003, FR-004, FR-004b, FR-009b, FR-009c, SC-002, SC-002b, SC-003

### Pruebas primero

- [ ] T019 [P] [US2] Crear `__tests__/dao/actividadVisibilidad.test.js` que verifique, con el mock de `js/db`, que la consulta pública **excluye** los estados ocultos y que la consulta del autor **incluye** los suyos en cualquier estado.
- [ ] T020 [P] [US2] Añadir a `__tests__/routes/api.test.js` un caso que compruebe que una actividad retirada no aparece en la respuesta del calendario público y que sí aparece para su entidad autora.

### Implementación — visibilidad unificada

- [ ] T021 [US2] Modificar `actividadDao.listar()` en `js/dao/actividadDao.js` para que acepte un parámetro de alcance (`publico` por defecto, o `propias` con el identificador de la entidad) y aplique el filtro de estados definido en T005. El calendario público debe recibir solo los estados vigentes; la vista del autor, además, los suyos ocultos con su estado. **Regla**: ninguna consulta debe volver a escribir la lista de estados a mano.
- [ ] T022 [US2] Actualizar `actividadDao.conflictos()` para que use el mismo conjunto vigente en lugar de considerar únicamente el estado confirmado, y para que **acepte un rango de fechas** (inicio y fin) y filtre por él, resolviendo de paso el crecimiento cuadrático (H-14, E-13).
- [ ] T023 [US2] Crear la migración `db/migrations/009_vistas_visibilidad.sql` que redefina `vw_saturacion_segmento` para excluir los estados ocultos (hoy incluye propuesta, confirmada y realizada, pero no contempla el archivado nuevo), manteniendo el resto de vistas coherentes con el mismo criterio.
- [ ] T024 [US2] Ajustar `server.js` en la ruta del calendario (`GET /api/actividades`) para pasar el alcance correcto según haya o no sesión, y en `GET /api/actividades/conflictos` para exigir el rango de fechas que ahora recibe el DAO.
- [ ] T025 [US2] Actualizar `js/calendar-view.js` para enviar el rango visible del calendario al consultar los choques, de modo que la consulta quede acotada a la ventana que el usuario está mirando.

### Implementación — archivado reversible y trazabilidad

- [ ] T026 [US2] Reemplazar el borrado físico de `actividadDao.eliminar()` por un **archivado**: cambiar el estado a archivado y registrar `retirada_por` y `retirada_en`. Renombrar la función a `archivar()` y dejar clara en un comentario la razón (E-07: una cuenta saliente podría borrar el trabajo de un semestre sin retorno).
- [ ] T027 [US2] Agregar en `js/dao/actividadDao.js` las funciones `retirar(id, usuarioId, motivo)` y `restituir(id, usuarioId)`, ambas registrando quién y cuándo (FR-009c).
- [ ] T028 [US2] Exponer en `server.js` los endpoints de retiro y restitución bajo rol administrador, y ajustar el endpoint de eliminación existente para que invoque el archivado. Responder con mensajes claros sobre lo ocurrido.
- [ ] T029 [US2] Añadir en el panel de administración (`admin.html` y `js/admin-panel.js`) una sección **"Actividades retiradas"** que liste lo archivado o retirado con su motivo y permita **restituir** con un clic. Sin esta vista, lo archivado sería invisible y la reversibilidad quedaría en el papel. **Recordatorio constitucional**: el título y el motivo son texto libre de usuario — pasarlos por `escapeHtml` (`js/sanitize.js`) antes de insertarlos en el DOM (Principio III); usar iconos de `js/icons.js` para las acciones, sin emoji (Principio VI).
- [ ] T030 [US2] Reemplazar en `js/views/event-table.js` el `confirm()` nativo del borrado por un diálogo del sistema de diseño que explique que la actividad **se archiva y puede restaurarse**, alineando el mensaje con el comportamiento real (FR-011). Interpolar el título de la actividad en el mensaje con `escapeHtml`; sin emoji, usar iconos de `js/icons.js` (Principios III y VI).
- [ ] T031 [US2] Actualizar la comunicación en `dashboard.html` y `js/views/dashboard-view.js`: el texto de la tarjeta de importación aún dice que las fechas "quedarán como propuestas hasta que el administrador las apruebe", lo que **ya no es cierto** con moderación reactiva. Debe indicar que se publican de inmediato y que el administrador puede retirarlas.
- [ ] T032 [US2] Revisar el panel "Pendientes de revisión" del administrador: con moderación reactiva deja de ser una cola bloqueante y pasa a ser una **bandeja de actividades sin ratificar**. Renombrar y reformular sus textos, conservando las acciones de ratificar y retirar.
- [ ] T033 [US2] Verificar en navegador (V-2) el ciclo completo: publicar → visible; retirar → desaparece del calendario, del mapa de calor y de los choques; eliminar → se archiva; restituir → vuelve íntegra.

**Checkpoint**: la moderación reactiva funciona de extremo a extremo y ningún borrado es irreversible.

---

## Phase 5: US3 — El reporte refleja el trabajo real (Priority: P1)

**Goal**: Persistir el resultado del Match al guardar una actividad, para que el reporte de impacto informe alcance real y el Sello de Coordinación sea alcanzable. Rotular las cifras mientras la matrícula sea referencial.

**Independent Test**: crear actividades evaluando compatibilidad, marcarlas realizadas, recalcular reputación y comprobar alcance > 0 y sello obtenible (V-3).

**Corrige**: H-03, H-10 · **Escenarios**: E-03, E-04 · **Requisitos**: FR-005, FR-006, FR-007, FR-007b, SC-004, SC-005

### Pruebas primero

- [ ] T034 [P] [US3] Añadir a `__tests__/services/reputationService.test.js` un caso que represente a una entidad que evaluó la compatibilidad en la mayoría de sus eventos y tiene baja reprogramación, verificando que **obtiene** el sello. Hoy ese caso es imposible porque el dato nunca se guarda.
- [ ] T035 [P] [US3] Añadir a `__tests__/routes/api.test.js` una prueba que cree una actividad y verifique que la respuesta incluye compatibilidad y alcance calculados **por el servidor**, y que los valores enviados por el cliente son ignorados.

### Implementación

- [ ] T036 [US3] Extraer en `server.js` una función interna que, dada una actividad (fechas y público), arme el contexto con `actividadDao.cargarContextoMatch()` y evalúe `matchService`, devolviendo compatibilidad y alcance. Debe reutilizarse tanto en la creación individual como en la masiva.
- [ ] T037 [US3] Invocar esa función en `POST /api/actividades` (construido a partir del objeto ya saneado por la función de selección explícita de T009a) antes de persistir, y guardar los valores obtenidos. **No** aceptar compatibilidad ni alcance que vengan en el cuerpo de la petición (FR-005 y prevención de manipulación).
- [ ] T038 [US3] Invocar la misma función en `POST /api/actividades/bulk`, cuidando el rendimiento: reutilizar el contexto entre filas que compartan semana y público, para no multiplicar consultas en una carga de cien filas.
- [ ] T039 [US3] Recalcular compatibilidad y alcance en `PUT /api/actividades/:id` **solo** cuando cambien la fecha o el público (los datos que los determinan), evitando trabajo innecesario en ediciones de título o lugar.
- [ ] T040 [US3] Crear la migración `db/migrations/010_matricula_origen.sql` que agregue a la tabla de matrícula una columna que distinga el origen del dato (oficial o referencial), con valor por defecto referencial para lo ya sembrado (decisión D-3).
- [ ] T041 [US3] Añadir en `js/dao/kpiDao.js` (o el DAO correspondiente) una consulta que informe si **algún** segmento involucrado usa matrícula referencial, para decidir si corresponde rotular la cifra.
- [ ] T042 [US3] Mostrar el rótulo "estimación basada en datos referenciales de matrícula" en el reporte PDF (`js/services/reportService.js`) y en las tarjetas de alcance del panel, **solo** cuando corresponda; al cargar la matrícula oficial el rótulo debe desaparecer sin intervención (FR-007).
- [ ] T043 [US3] Crear el script `js/db/importar-matricula.js` con su atajo `npm run seed:matricula`, que cargue la matrícula oficial desde un archivo separado por comas (carrera, nivel, cantidad), marcándola como oficial. Documentar el formato esperado en `docs/IMPORTACION_CSV.md`.
- [ ] T044 [US3] Verificar en navegador (V-3) que el reporte informa alcance mayor que cero, que el sello se otorga a una entidad que cumple los criterios, y que el rótulo aparece y desaparece según el origen de la matrícula.

**Checkpoint**: los incentivos que sostienen la carga de datos vuelven a funcionar.

---

## Phase 6: US4 — El servidor manda sobre entidad y estado (Priority: P2)

**Goal**: Que la autorización del servidor sea la barrera efectiva de la moderación reactiva: nadie puede actuar por otra entidad ni restituir lo retirado.

**Independent Test**: con sesión de aportante, intentar imponer entidad y estado, restituir lo retirado y marcar como realizada una actividad futura; todo debe ser rechazado (V-4).

**Corrige**: H-04 · **Escenario**: E-05 · **Requisitos**: FR-008, FR-009, SC-006

### Pruebas primero

- [ ] T045 [P] [US4] Añadir a `__tests__/routes/api.test.js` pruebas que verifiquen que un aportante: (a) no puede crear a nombre de otra entidad; (b) no puede restituir una actividad retirada; (c) no puede marcar como realizada una actividad futura; (d) no puede imponer compatibilidad ni alcance.

### Implementación

- [ ] T046 [US4] Verificar que **todas** las rutas de escritura de actividades (`POST /api/actividades`, `POST /api/actividades/bulk`, `PUT /api/actividades/:id`, cambio de estado) usan la función de selección explícita de campos introducida en T009a y en ningún punto la sustituyen por `{ ...b }` o equivalente. Si se detecta una ruta que la omite, corregirla ahí mismo — es la barrera de la que depende toda la moderación reactiva (H-04).
- [ ] T047 [US4] Derivar el estado inicial y la entidad del rol de la sesión en `POST /api/actividades`, ignorando lo que envíe el cliente, e igualar el criterio ya presente en la ruta de carga masiva (que sí lo hacía bien).
- [ ] T048 [US4] Restringir en `PUT /api/actividades/:id` y en el cambio de estado qué transiciones puede hacer cada rol, según la tabla de [data-model.md](./data-model.md): el aportante puede cancelar, archivar y reprogramar lo suyo; solo el administrador ratifica, retira y restituye.
- [ ] T049 [US4] Impedir que se marque como realizada una actividad cuya fecha de inicio aún no ha ocurrido, para que la reputación no sea manipulable.
- [ ] T050 [US4] Verificar manualmente los cuatro intentos de V-4 usando la consola del navegador con una sesión de aportante, dejando constancia de que todos son rechazados.

**Checkpoint**: la moderación reactiva tiene una barrera real.

---

## Phase 7: US5 — La carga del semestre completo funciona (Priority: P2)

**Goal**: Que una planilla de un semestre dirigida a toda la facultad se importe sin errores crípticos.

**Independent Test**: importar 120 filas con público amplio y verificar que se procesan (V-5).

**Corrige**: H-05 · **Escenario**: E-06 · **Requisitos**: FR-010, FR-011, SC-007

### Pruebas primero

- [ ] T051 [P] [US5] Añadir a `__tests__/services/csv-utils.test.js` una prueba que construya una planilla de 120 filas con público completo y verifique que la utilidad la divide en lotes que no superan el límite de tamaño admitido.

### Implementación

- [ ] T052 [US5] Implementar en `js/csv-utils.js` una función que **divida** el conjunto de actividades en lotes, estimando el tamaño de la petición (medición base: una actividad con público completo ocupa cerca de 2 kB y el límite del servidor es de 100 kB) y dejando un margen de seguridad.
- [ ] T053 [US5] Modificar la importación en `js/views/dashboard-view.js` y `js/views/calendario-view.js` para enviar los lotes **secuencialmente**, acumulando el total creado y los errores de todas las tandas en un único informe final.
- [ ] T054 [US5] Mostrar progreso durante la importación por lotes ("procesando 40 de 120…"), porque una carga larga sin señal de avance parece que se colgó (Principio VI). El indicador de progreso no lleva emoji; si se muestran títulos de filas ya importadas, pasarlos por `escapeHtml` (Principio III).
- [ ] T055 [US5] Traducir en `server.js` los errores de la base de datos antes de devolverlos en el detalle por fila de la importación, para que nadie vea el texto interno de una restricción (FR-011, SC-009).
- [ ] T056 [US5] Verificar en navegador (V-5) la importación de una planilla de 120 filas con público amplio, confirmando que se completa e informa el resultado.

**Checkpoint**: el aportante más valioso (quien tiene el calendario académico completo) puede usar la plataforma.

---

## Phase 8: US6 — Desactivar corta el acceso (Priority: P2)

**Goal**: Que desactivar una cuenta o cambiar sus permisos tenga efecto inmediato sobre sesiones abiertas.

**Independent Test**: con sesión abierta, desactivar la cuenta y comprobar que la siguiente acción es rechazada (V-6).

**Corrige**: H-06 · **Escenario**: E-07 · **Requisitos**: FR-012, SC-008

### Pruebas primero

- [ ] T057 [P] [US6] Añadir a `__tests__/routes/api.test.js` una prueba que simule una cuenta desactivada tras el inicio de sesión y verifique que la siguiente petición autenticada responde con el código de no autenticado.

### Implementación

- [ ] T058 [US6] Modificar el middleware de autenticación en `server.js` para que revalide la cuenta contra la base de datos en cada petición autenticada (consulta por clave primaria, coste despreciable), rechazando si está inactiva y refrescando rol y entidad desde el dato vigente.
- [ ] T059 [US6] Destruir la sesión cuando la revalidación falle, para que el usuario reciba la pantalla de inicio de sesión en lugar de un error repetido.
- [ ] T060 [US6] Añadir en el panel de administración un aviso al desactivar una cuenta que explique que el efecto es inmediato, cerrando el ciclo de expectativa del administrador.
- [ ] T061 [US6] Verificar en navegador (V-6) con dos ventanas: desactivar desde una y comprobar que la otra queda fuera en su siguiente acción.

**Checkpoint**: los accesos se pueden revocar de verdad.

---

## Phase 9: Robustez adicional y casos límite

**Purpose**: Hallazgos altos y medios que no forman una historia propia pero que degradan la plataforma.

- [ ] T062 [P] Deshabilitar el botón de guardado mientras la petición está en curso en `js/views/dashboard-view.js` y `js/views/calendario-view.js`, siguiendo el patrón ya aplicado en el calculador de Match, y restaurarlo al terminar. Corrige H-07 y E-08 (duplicados que ensucian el calendario e inflan el mapa de calor), FR-013.
- [ ] T063 [P] Validar en `server.js`, antes de persistir, que la fecha de término sea posterior a la de inicio, devolviendo un mensaje específico en lugar de dejar que falle la restricción de la base de datos (H-08, FR-014).
- [ ] T064 [P] Validar también en el cliente esa condición al perder el foco el campo de término, mostrando el mensaje junto al campo (Principio VI: el error se muestra donde ocurre).
- [ ] T065 Limitar los intentos de ingreso por combinación de dirección **y** cuenta en `server.js`, de modo que una persona que olvida su contraseña no deje sin acceso a toda la facultad tras un intermediario compartido (H-09, E-09, FR-015).
- [ ] T066 Documentar en `docs/DESPLIEGUE_SERVIDOR.md` la configuración que debe tener el intermediario para reenviar la dirección real del visitante, y las consecuencias de no hacerlo.
- [ ] T067 [P] Asociar al identificador de la cuenta las claves que hoy se guardan por navegador (bienvenida y contexto del formulario) en `js/views/onboarding.js` y `js/views/dashboard-view.js`, y limpiarlas al cerrar sesión en `js/layout.js`, para el computador compartido de la sede (H-12, E-11).
- [ ] T068 Implementar en `js/dao/actividadDao.js` y `js/services/heatmapService.js` la regla ya fijada en spec.md (edge cases): una actividad que cruza la medianoche cuenta para saturación y choques en **cada día de calendario** que abarca, y el criterio de fin de semana del calculador se evalúa solo sobre la fecha/hora de **inicio**. Agregar una prueba que confirme ambos comportamientos (E-12).
- [ ] T069 Actualizar los feriados móviles pendientes de confirmación en una migración nueva, tras verificarlos con la fuente oficial, y quitar las marcas de verificación del archivo de datos (H-13, E-10). **Depende de un dato externo**; puede avanzar en paralelo al código.

---

## Phase 10: Mejoras de plataforma con sinergia directa

**Purpose**: Mejoras del [backlog](../../docs/BACKLOG_MEJORAS.md) que se vuelven baratas **porque ya se está tocando ese código**. Aprovechan el trabajo de las fases anteriores en lugar de abrir una intervención nueva.

- [ ] T070 [P] Hacer accionables las tres sugerencias del calculador en `js/match-calculator.js`: al pulsar una, rellenar la fecha y hora propuestas en el formulario. La compatibilidad ya se calcula y ahora **se persiste** (US3), así que el trabajo restante es de interfaz. *(Backlog 1.5)*
- [ ] T071 [P] Añadir a las celdas del mapa de calor en `js/heatmap-view.js` una descripción accesible que indique el nivel de saturación en texto, para no depender solo del color. Se apoya en el criterio de estados unificado de US2. *(Backlog 2.3, WCAG)*
- [ ] T072 [P] Incorporar el enlace "Saltar al contenido" en las páginas, aprovechando que la clase ya existe en el sistema de diseño pero no se usa en ninguna página. *(Backlog 2.2, WCAG)*
- [ ] T073 Mostrar en el calendario un aviso de confirmación cuando alguien agende sobre una fecha ya saturada para ese público, usando la detección de choques que en US2 pasó a estar acotada por rango. Implementa la decisión del dilema D-4 sin convertir a la plataforma en árbitro.
- [ ] T074 Advertir en el formulario cuando un centro selecciona carreras distintas a la propia, sin impedirlo, dejando registro del autor. Implementa la decisión del dilema D-5.

---

## Phase 11: Cierre — documentación y validación integral

- [ ] T075 Ejecutar el guion completo de [quickstart.md](./quickstart.md) (V-1 a V-9) sobre el entorno real y registrar el resultado de cada verificación.
- [ ] T076 Confirmar que `npm test` **y** `npm run test:tz` quedan en verde, y que la cantidad de pruebas creció respecto de la línea base documentada en T003.
- [ ] T077 [P] Actualizar `docs/AUDITORIA_ROBUSTEZ.md` marcando cada hallazgo como corregido, con la fecha y el número de tarea que lo resolvió, para que el documento sirva de historial.
- [ ] T078 [P] Actualizar `docs/BACKLOG_MEJORAS.md` retirando las mejoras implementadas en la fase 10 y anotando las que siguen pendientes.
- [ ] T079 [P] Actualizar `docs/MODELO_DATOS.md` con el estado archivado, las columnas de trazabilidad, el origen de la matrícula y las migraciones 008–010.
- [ ] T080 [P] Actualizar `docs/GUIA_APORTANTE.md` para explicar el modelo real: las actividades se publican de inmediato, el administrador puede retirarlas, y lo eliminado se archiva y puede restaurarse.
- [ ] T081 Revisar si la constitución necesita enmienda: el modelo de moderación reactiva y el archivado reversible son decisiones estructurales que convendría reflejar en los principios (procedimiento de la sección Governance).
- [ ] T082 Verificar que el despliegue completo funciona desde cero (`docker compose down -v && docker compose up -d --build`), incluidas todas las migraciones nuevas en secuencia, antes de dar la feature por terminada.

---

## Dependencies & Execution Order

### Orden de fases

```text
Fase 1 (Setup)
   ↓
Fase 2 (Foundational) ← BLOQUEA a US1, US2 y US3
   ↓
Fase 3 (US1 · zona horaria) ← MVP; independiente del resto
   ↓
Fase 4 (US2 · visibilidad y archivado) ← usa el criterio de estados de T005
   ↓
Fase 5 (US3 · Match persistido) ← conviene después de US2 (comparte rutas de escritura)
   ↓
Fases 6, 7, 8 (US4, US5, US6) ← independientes entre sí; pueden ir en paralelo
   ↓
Fase 9 (robustez) → Fase 10 (mejoras) → Fase 11 (cierre)
```

### Dependencias entre historias

- **US1** es completamente independiente: puede implementarse, probarse y desplegarse sola.
- **US2** depende de T005 y T006 (fase 2).
- **US3** depende de que US2 haya unificado el criterio de estados, para no calcular alcance sobre actividades retiradas.
- **US4** conviene después de US2, porque protege precisamente las acciones de retiro y restitución que US2 introduce.
- **US5** y **US6** son independientes de las demás.

### Oportunidades de paralelismo

- Fase 2: T008 y T009 en paralelo (archivos distintos).
- Fase 3: T010 y T011 en paralelo.
- Fases 6, 7 y 8 completas en paralelo si hay más de una persona.
- Fase 9: T062, T063, T064 y T067 en paralelo.
- Fase 10: T070, T071 y T072 en paralelo.
- Fase 11: T077 a T080 en paralelo.

---

## Implementation Strategy

### MVP recomendado

**Fase 1 + Fase 2 + Fase 3 (US1)**. Corrige el defecto de mayor daño reputacional
—que un evento se publique con la hora equivocada— y es desplegable por sí solo.
Si hubiera que detener el trabajo ahí, la plataforma ya estaría en mejor estado.

### Entrega incremental sugerida

1. **Entrega 1 — Confianza en el dato**: US1. La hora publicada es la correcta.
2. **Entrega 2 — Control del contenido**: US2 + US4. Retirar funciona y nadie puede
   saltarse la moderación. Se entregan juntas porque US4 protege lo que US2 crea.
3. **Entrega 3 — Incentivos**: US3. Reportes y sello vuelven a tener sentido.
4. **Entrega 4 — Operación**: US5 + US6. Carga masiva y revocación de accesos.
5. **Entrega 5 — Pulido**: fases 9, 10 y 11.

### Advertencias de implementación

- **La selección explícita de campos (T009a) va primero, en Foundational**,
  precisamente porque US3 (T037, T038) y US4 (T046, T047) escriben sobre las
  mismas rutas de actividades; todas parten ya protegidas en lugar de competir
  por modificar la ruta en distinto orden.
- **Las migraciones 008, 009 y 010 deben probarse en secuencia sobre una base
  limpia** (T082). El proyecto ya sufrió una caída de arranque por una migración
  mal formada.
- **No reintroducir la zona horaria fija en `jest.setup.js`**: es exactamente lo
  que ocultó H-01 durante toda la fase 8 anterior.
- Cada fase termina con verificación en navegador cuando el cambio es visible; el
  syntax-check no basta (Principio IV).

---

## Resumen

| Fase | Historia | Tareas | Prioridad |
|---|---|---|---|
| 1 | Setup | T001–T004 | — |
| 2 | Foundational | T005–T009a | Bloqueante |
| 3 | US1 · Zona horaria | T010–T018 | **P1 · MVP** |
| 4 | US2 · Visibilidad y archivado | T019–T033 | **P1** |
| 5 | US3 · Match persistido | T034–T044 | **P1** |
| 6 | US4 · Autoridad del servidor | T045–T050 | P2 |
| 7 | US5 · Carga masiva | T051–T056 | P2 |
| 8 | US6 · Revocación de acceso | T057–T061 | P2 |
| 9 | Robustez y casos límite | T062–T069 | Media |
| 10 | Mejoras con sinergia | T070–T074 | Oportunista |
| 11 | Cierre y documentación | T075–T082 | Final |

**Total: 83 tareas** (incluye T009a, insertada en Foundational tras el análisis de consistencia del 2026-08-03).
