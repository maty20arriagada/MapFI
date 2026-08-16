# Feature Specification: Gestión de horarios

**Feature Branch**: `003-gestion-horarios`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "Actualizar la gestión de horarios: poder borrar cosas dentro del apartado de horarios (quedó cargada información de Cálculo I y similares); leer un Excel o un archivo con un formato específico de txt; que ningún archivo (pdf, Excel, txt o cualquiera) se guarde en el servidor; que el horario tenga bloques desde las 8:00 hasta las 21:00 y admita clases tanto de 45 como de 90 minutos, coloreando el bloque; y que el horario se pueda filtrar e imprimir."

## Contexto y estado actual

La página de Horarios (`horarios.html`) muestra la malla semanal recurrente de cada
carrera y generación. Es independiente del calendario académico. Hoy tiene cinco
defectos observables y una carencia funcional:

| # | Defecto | Evidencia |
|---|---------|-----------|
| D-1 | Datos de muestra visibles como si fueran reales | `db/migrations/002_seed_catalogos.sql:96` siembra 7 bloques ("Cálculo I", "Álgebra y Geometría"…) en Ing. Civil Industrial 1.er año, en **todo despliegue nuevo** |
| D-2 | El SUPERADMIN no puede editar horarios | `horarios.html:66` compara `r.user.rol === "ADMIN"`; el backend sí lo autoriza vía `cumpleRol()` — la interfaz y la API discrepan |
| D-3 | Los bloques de 45 minutos rompen la grilla | `js/horarios-view.js:36` construye filas de 30 min; un bloque 08:00–08:45 genera `grid-row: 2 / 3.5`, valor CSS inválido |
| D-4 | El rango horario no es estable | El rango se calcula desde los bloques existentes, de modo que la grilla cambia de forma cada vez que se agrega o borra un bloque |
| D-5 | Borrado incompleto | Existe `DELETE /api/bloques/:id` pero sin confirmación, sin borrado masivo y sin verificación de propiedad |
| C-1 | No hay carga masiva ni impresión | `js/dao/bloqueHorarioDao.js:45` deja un `TODO(F2): importacion masiva por CSV`; no existe filtro ni hoja de estilos de impresión |

Además, el horario alimenta al algoritmo de match (`js/services/matchService.js:125`
usa los bloques `PROTEGIDO` para penalizar choques), por lo que la calidad de estos
datos no es cosmética: condiciona las recomendaciones de fecha que la plataforma da
a los centros.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Limpiar un horario que quedó con datos de ejemplo (Priority: P1)

Un administrador entra a Horarios, elige Ing. Civil Industrial / 1.er año y ve
bloques que nunca cargó nadie ("Cálculo I", "Ventana libre"). Necesita eliminarlos:
uno por uno si son pocos, o vaciar el segmento completo si el horario entero está
mal. Antes de vaciar quiere poder llevarse una copia por si acaso.

**Why this priority**: es el problema que el usuario reportó primero y el único que
hoy hace que la página muestre información falsa a estudiantes reales. Sin esto, todo
lo demás se construye sobre datos sucios.

**Independent Test**: se prueba cargando la plataforma con el seed por defecto,
borrando los 7 bloques de muestra y comprobando que la vista queda vacía y que el
match ya no reporta choques con el "Bloque protegido FI" inexistente.

**Acceptance Scenarios**:

1. **Given** un segmento con bloques cargados y sesión de administrador, **When** se
   pulsa la × de un bloque, **Then** se pide confirmación indicando el ramo y el
   horario, y al confirmar el bloque desaparece de la grilla sin recargar la página.
2. **Given** un segmento con 7 bloques, **When** se usa "Vaciar horario de este
   segmento", **Then** el diálogo indica el número exacto de bloques a eliminar,
   ofrece descargar el horario actual como CSV y exige una confirmación explícita.
3. **Given** un despliegue nuevo desde cero, **When** se aplican todas las
   migraciones, **Then** no queda ningún bloque de muestra en la base.
4. **Given** una sesión con rol SUPERADMIN, **When** se abre Horarios, **Then** se
   ven los controles de edición y borrado (hoy no se ven).

---

### User Story 2 - Ver un horario legible con bloques de 45 y 90 minutos (Priority: P1)

Un estudiante abre Horarios, elige su carrera y su año, y ve una grilla estable de
08:00 a 21:00 donde cada clase ocupa el alto que le corresponde: una de 45 minutos
ocupa la mitad que una de 90. Cada bloque va coloreado según su tipo, sin depender de
leer la hora escrita dentro.

**Why this priority**: es la razón de ser de la página y hoy está rota: un bloque de
45 minutos produce CSS inválido. Junto con US1 forma el MVP.

**Independent Test**: se prueba cargando un segmento con un bloque de 45 min y otro
de 90 min y verificando en el navegador que el segundo mide exactamente el doble de
alto que el primero, y que ambos caen en la fila horaria correcta.

**Acceptance Scenarios**:

1. **Given** un segmento sin bloques, **When** se selecciona carrera y generación,
   **Then** la grilla se dibuja igual: de 08:00 a 21:00, con las cinco columnas de
   lunes a viernes, y un mensaje de que aún no hay horario cargado.
2. **Given** un bloque de 08:00 a 08:45 y otro de 09:00 a 10:30, **Then** el segundo
   ocupa el doble de altura vertical que el primero.
3. **Given** un bloque heredado cuyo horario no cae en un cuarto de hora exacto
   (p. ej. 11:50–13:20), **Then** el bloque se dibuja ajustado al cuarto de hora,
   pero la etiqueta muestra la hora real almacenada.
4. **Given** un bloque fuera del rango 08:00–21:00, **Then** la grilla no se deforma
   y se muestra un aviso que identifica ese bloque en lugar de ocultarlo en silencio.
5. **Given** dos bloques que se solapan el mismo día, **Then** se dibujan lado a lado
   dentro de la columna de ese día, sin taparse.

---

### User Story 3 - Cargar el horario del semestre desde un archivo (Priority: P2)

El encargado de un centro de estudiantes tiene el horario de su carrera en una
planilla. Lo exporta como CSV (o copia las celdas y las pega), lo suelta en la
página, ve una vista previa con los errores marcados fila por fila, elige si
reemplaza el horario existente o lo agrega, y confirma. Ningún archivo queda
almacenado en el servidor.

**Why this priority**: convierte una tarea de 30 bloques cargados a mano en una de
un minuto. Depende de US1 y US2 estando en pie, pero es lo que hace sostenible que
14 centros mantengan sus horarios al día.

**Independent Test**: se prueba con un CSV de 30 filas —incluyendo filas
deliberadamente malformadas— y se verifica que las válidas se cargan, las inválidas
se reportan con número de fila y motivo, y que no aparece ningún archivo en el
sistema de archivos del contenedor.

**Acceptance Scenarios**:

1. **Given** un archivo `.csv` separado por `;`, `,` o tabulaciones, **When** se
   selecciona, **Then** se muestra una vista previa con las filas interpretadas y los
   errores por fila, sin haber enviado nada al servidor todavía.
2. **Given** una tabla copiada desde una planilla, **When** se pega en el cuadro de
   texto, **Then** se interpreta igual que un archivo (las celdas llegan separadas
   por tabulaciones).
3. **Given** un segmento que ya tiene bloques, **When** se confirma la importación,
   **Then** el usuario debe haber elegido explícitamente entre "Reemplazar" y
   "Agregar", y el resultado corresponde a lo elegido.
4. **Given** una importación con filas inválidas, **When** se confirma, **Then** las
   filas válidas se cargan y las inválidas se listan con su número de fila y motivo,
   sin abortar el conjunto.
5. **Given** cualquier importación, **When** se inspecciona el contenedor del
   servidor, **Then** no existe ningún archivo subido: solo viajó JSON ya validado.

---

### User Story 4 - Que cada centro mantenga el horario de su carrera (Priority: P2)

El centro de estudiantes de Informática entra con su cuenta y puede cargar, editar y
borrar los bloques de Ingeniería Civil Informática, en cualquier generación. Al
seleccionar otra carrera ve el horario pero sin controles de edición, y si intenta
saltarse la interfaz el servidor lo rechaza.

**Why this priority**: descentraliza el mantenimiento, que es lo que hace que el dato
se mantenga vivo. Es una ampliación de permisos y por tanto exige que la autoridad
resida en el servidor, no en ocultar botones.

**Independent Test**: se prueba con la cuenta `informatica@mapfi.cl` intentando por
API crear un bloque en la carrera de Mecánica y verificando el 403, y creando uno en
Informática y verificando el 201.

**Acceptance Scenarios**:

1. **Given** sesión APORTANTE de un centro con `entidad.carrera_id = 7`, **When**
   crea, importa o borra un bloque con `carreraId = 7`, **Then** la operación procede.
2. **Given** la misma sesión, **When** intenta cualquiera de esas operaciones con
   `carreraId ≠ 7`, **Then** el servidor responde 403 y no modifica nada.
3. **Given** una sesión APORTANTE de una entidad sin carrera asociada (Vinculación,
   Gearbox, Dirección de Docencia), **When** intenta editar cualquier horario,
   **Then** el servidor responde 403.
4. **Given** una sesión ADMIN o SUPERADMIN, **Then** puede operar sobre cualquier
   carrera.
5. **Given** un visitante sin sesión, **Then** puede ver e imprimir el horario pero
   ninguna ruta de escritura le responde algo distinto de 401.

---

### User Story 5 - Filtrar e imprimir el horario (Priority: P3)

Un estudiante quiere quedarse solo con sus clases de laboratorio, o buscar en qué
bloque está "Física I". Un delegado quiere imprimir el horario del curso para pegarlo
en el mural, con los colores intactos y sin la barra de navegación.

**Why this priority**: mejora real de uso, pero la página sigue siendo útil sin ella.
Se implementa al final porque el filtro opera sobre la grilla ya construida en US2.

**Independent Test**: se prueba filtrando por tipo y comprobando que la grilla
conserva su geometría (08:00–21:00) mostrando solo los bloques que coinciden, y
lanzando la vista previa de impresión para verificar que se ocultan navegación y
formularios.

**Acceptance Scenarios**:

1. **Given** un horario cargado, **When** se escribe texto en el buscador, **Then**
   solo permanecen visibles los bloques cuyo ramo, sala, docente o código coinciden.
2. **Given** un filtro activo por tipo o día, **Then** la grilla mantiene el rango
   08:00–21:00 y las cinco columnas, sin recolocar los bloques restantes.
3. **Given** cualquier estado de filtro, **When** se imprime, **Then** la salida
   incluye carrera, generación y fecha de impresión; conserva los colores de los
   bloques; y omite navegación, filtros, formularios y botones.
4. **Given** un filtro activo, **When** se imprime, **Then** se imprime lo filtrado y
   la hoja indica qué filtro estaba aplicado.

---

### Edge Cases

- **Bloque que empieza y termina a la misma hora**: rechazado por el `CHECK` existente
  en la tabla; el importador debe reportarlo como error de fila, no como error 500.
- **Bloque que cruza la medianoche o termina después de las 21:00**: no se dibuja
  fuera de la grilla; se avisa.
- **Horario con 200 filas** (5 años cargados de una vez por error): el importador
  limita el número de bloques por operación y lo comunica antes de enviar.
- **Archivo con BOM UTF-8, acentos o comillas** (lo que produce Excel en español): se
  interpreta correctamente, como ya hace `js/csv-utils.js` para actividades.
- **Archivo que no es texto** (un `.xlsx` renombrado, un PDF): se detecta y se
  rechaza con un mensaje que explica cómo exportar a CSV, en vez de mostrar basura.
- **Reemplazar un segmento con un archivo cuyas filas son todas inválidas**: no se
  borra nada; reemplazar solo procede si hay al menos una fila válida.
- **Dos sesiones editando el mismo segmento a la vez**: la última importación con
  "Reemplazar" gana; se asume aceptable dado que un segmento tiene un solo
  responsable.
- **Nombre de docente en una página pública**: es dato personal y la página de
  horarios no exige sesión (ver Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

**Borrado y limpieza**

- **FR-001**: El sistema DEBE permitir eliminar un bloque individual, pidiendo
  confirmación que identifique el bloque (ramo, día y horario).
- **FR-002**: El sistema DEBE permitir vaciar todos los bloques de un segmento
  (carrera + generación) en una operación, informando previamente cuántos bloques se
  eliminarán.
- **FR-003**: Antes de vaciar un segmento, el sistema DEBE ofrecer descargar el
  horario actual en el mismo formato que acepta al importar, de modo que la operación
  sea reversible por el propio usuario.
- **FR-004**: El sistema DEBE eliminar de la base los bloques de muestra sembrados por
  la migración 002, sin tocar ningún bloque que haya sido editado o creado después.

**Visualización**

- **FR-005**: La grilla DEBE abarcar siempre de 08:00 a 21:00, con independencia de
  los bloques cargados.
- **FR-006**: La grilla DEBE usar una resolución de 15 minutos, de modo que las
  duraciones de 45 y 90 minutos se representen en proporción exacta.
- **FR-007**: Cada bloque DEBE identificarse por color según su tipo, sin necesidad de
  leer el texto interior.
- **FR-008**: Un bloque cuyo horario no coincida con un cuarto de hora DEBE dibujarse
  ajustado al cuarto de hora más cercano, conservando la hora real en su etiqueta.
- **FR-009**: Los bloques que se solapan en el mismo día DEBEN mostrarse lado a lado,
  sin ocultarse entre sí.
- **FR-010**: Los bloques fuera del rango 08:00–21:00 DEBEN señalarse en un aviso
  visible en lugar de desaparecer.

**Importación**

- **FR-011**: El sistema DEBE aceptar archivos `.csv` y `.txt`, y texto pegado
  directamente, con un único formato de columnas.
- **FR-012**: El sistema DEBE autodetectar el separador entre punto y coma, coma y
  tabulación, de modo que tanto un CSV exportado como una selección copiada desde una
  planilla funcionen sin conversión manual.
- **FR-013**: El sistema DEBE mostrar una vista previa con las filas interpretadas y
  los errores por fila **antes** de enviar nada al servidor.
- **FR-014**: El sistema DEBE exigir que el usuario elija entre "Reemplazar el
  horario del segmento" y "Agregar a lo existente" antes de confirmar.
- **FR-015**: Las filas inválidas NO DEBEN impedir la carga de las válidas; cada error
  se reporta con número de fila y motivo en lenguaje claro.
- **FR-016**: El sistema DEBE ofrecer una plantilla descargable del formato.
- **FR-017**: El formato DEBE requerir día, hora de inicio, hora de término y ramo, y
  aceptar como opcionales el tipo, la sala, el docente, la sección y el código de
  asignatura.

**No persistencia de archivos**

- **FR-018**: Ningún archivo cargado por el usuario —de cualquier tipo— DEBE
  escribirse en el sistema de archivos del servidor, ni de forma temporal.
- **FR-019**: El servidor NO DEBE aceptar peticiones `multipart/form-data` en ninguna
  ruta; la interpretación de archivos ocurre íntegramente en el navegador y al
  servidor solo llegan datos ya estructurados y validados.
- **FR-020**: Esta garantía DEBE estar cubierta por una prueba automatizada que falle
  si alguien introduce en el futuro una ruta de subida de archivos.

**Autorización**

- **FR-021**: ADMIN y SUPERADMIN DEBEN poder crear, importar y borrar bloques de
  cualquier carrera y generación.
- **FR-022**: Un APORTANTE DEBE poder crear, importar y borrar bloques únicamente de
  la carrera asociada a su entidad, en cualquier generación.
- **FR-023**: Un APORTANTE cuya entidad no tenga carrera asociada NO DEBE poder
  modificar ningún horario.
- **FR-024**: La autorización DEBE verificarse en el servidor en cada operación de
  escritura; ocultar controles en la interfaz es cortesía, no control de acceso.
- **FR-025**: La consulta y la impresión de horarios DEBEN seguir siendo públicas, sin
  sesión.

**Filtros e impresión**

- **FR-026**: El sistema DEBE permitir filtrar los bloques visibles por día, por tipo y
  por texto libre sobre ramo, sala, docente y código.
- **FR-027**: Al filtrar, la geometría de la grilla DEBE permanecer estable.
- **FR-028**: El sistema DEBE ofrecer una salida de impresión que omita navegación,
  filtros y formularios, conserve los colores de los bloques e incluya carrera,
  generación, fecha de impresión y el filtro aplicado.

### Key Entities

- **Bloque horario**: una clase recurrente semanal de un segmento. Atributos
  actuales: carrera, generación, día de la semana (lunes a viernes), hora de inicio,
  hora de término, tipo (clase / protegido / libre) y descripción. Esta feature añade
  como opcionales: sala, docente, sección y código de asignatura, y reinterpreta la
  descripción como **nombre del ramo**.
- **Segmento**: el par carrera + generación. Es la unidad sobre la que se importa, se
  vacía, se filtra y se imprime. No es una tabla: es una clave compuesta.
- **Entidad aportante**: ya existe y ya tiene `carrera_id` poblado para los 14 centros
  de estudiantes; es la base de la autorización por carrera propia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un despliegue nuevo desde cero no muestra ningún bloque de horario que
  nadie haya cargado.
- **SC-002**: Un bloque de 90 minutos ocupa exactamente el doble de altura que uno de
  45 minutos, verificable midiendo ambos en el navegador.
- **SC-003**: Cargar el horario semanal completo de un curso (aprox. 25 bloques) toma
  menos de 2 minutos desde una planilla existente, frente a los aprox. 25 formularios
  que exige hoy.
- **SC-004**: Una persona de un centro que nunca ha usado la función logra importar su
  horario sin asistencia, apoyándose solo en la plantilla y los mensajes de error.
- **SC-005**: Tras cualquier número de importaciones, el sistema de archivos del
  contenedor no contiene ningún archivo aportado por usuarios.
- **SC-006**: Ninguna cuenta puede modificar el horario de una carrera que no le
  corresponde, comprobado por prueba automatizada contra la API.
- **SC-007**: El horario impreso en una hoja A4 es legible sin lupa y conserva la
  codificación por color.
- **SC-008**: La suite de pruebas queda en verde, con cobertura de la nueva lógica de
  interpretación de archivos y de geometría de la grilla.

## Assumptions

- **Formato de archivo**: se acepta CSV y TXT, no `.xlsx` nativo. Interpretar el
  formato binario de Excel exigiría incorporar una biblioteca de terceros al
  navegador, lo que choca con el Principio I de la constitución; el usuario exporta
  con "Guardar como → CSV" o copia y pega las celdas. Decisión tomada por el usuario
  el 2026-08-15.
- **Semántica de importación**: la elección entre reemplazar y agregar la hace el
  usuario en cada importación, en lugar de fijarla el sistema. Decisión tomada por el
  usuario el 2026-08-15.
- **Alcance de la edición por centro**: un centro administra su carrera en **todas**
  las generaciones. No se contempla delegar por año.
- **Docente como dato personal**: la columna docente es opcional y la página de
  horarios es pública. Se asume que un nombre de profesor asociado a un ramo y un
  horario es información institucional de la misma naturaleza que la que ya publica la
  Facultad. Si el equipo prefiere lo contrario, la columna puede mostrarse solo con
  sesión iniciada sin cambiar el resto del diseño.
- **Días**: la semana académica sigue siendo de lunes a viernes, como impone el
  `CHECK (dia_semana BETWEEN 1 AND 5)` vigente. El sábado queda fuera de alcance.
- **Sin versionado por semestre**: un segmento tiene un único horario vigente. Guardar
  el histórico por período académico queda fuera de alcance.
- **Reutilización**: se reutilizan `js/csv-utils.js` (interpretación de texto
  delimitado), `js/sanitize.js` (escapado), el sistema de roles ya existente en
  `server.js` y la tabla `bloque_horario` ya existente, ampliada de forma aditiva.
