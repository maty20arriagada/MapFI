# Feature Specification: Calendario que recuerda, se edita en su sitio y avisa; mapa de calor por carrera completa

**Feature Branch**: `006-mejoras-calendario`

**Created**: 2026-09-27

**Status**: Draft

**Input**: Pedido del usuario: *"quiero que veas la opción de poder eliminar el certamen 1 de
cálculo I el 12 de octubre, además quiero que mejores la experiencia de la plataforma, por
ejemplo algo que me pasa cuando la veo es que cuando actualizo la página se mueve al primer mes
del calendario y la idea es que me guarde por así decirlo donde quede […] Dentro de la mirada de
los centros de estudiantes quiero que el calendario permita poder editar la fecha o el evento de
certamen directamente en lugar de que me lleve a guardarlo en un calendario externo. […] Deja un
mensaje en la parte superior del calendario que diga (vista desde cualquier cuenta) que el
calendario pueda tener errores y que es importante para el usuario verificar las fechas de ser
necesario. Respecto al mapa de calor añade la opción de ver todas las generaciones posibles de
tal forma que permita que el mapa de calor cruce más datos."*

## Situación de partida (observada en producción el 2026-09-27)

- En el calendario público aparece un **"Certamen 1 - Cálculo I"** de la Dirección de Docencia,
  en el "Aula 301", para Ingeniería Civil Industrial de 1.er año. **No es un certamen real**: es
  un dato de ejemplo que la plataforma trae de fábrica para mostrarse al instalarse, y cuya fecha
  se recalculó sola al desplegar. Hoy lo ven estudiantes reales como si fuera una evaluación.
  Nadie puede quitarlo desde la interfaz: no existe cuenta de Docencia, y la acción de retirar
  del administrador lo **archiva**, lo que publicaría un aviso de *"Docencia canceló el Certamen 1"*
  sobre algo que nunca existió.
- Al **recargar** el calendario, vuelve siempre al mes en curso. Y lo mismo pasa al **cambiar
  cualquier filtro**: quien estaba mirando noviembre y filtra por su carrera, aparece en
  septiembre.
- Al hacer clic en una actividad **propia**, un centro de estudiantes recibe el mismo panel que
  cualquier visitante: *"Añadir a Google / Outlook"*. Para corregir una fecha tiene que ir a
  «Mi panel», buscarla en una tabla y editarla ahí.
- El calendario no advierte en ninguna parte que sus datos los cargan los centros y pueden tener
  errores.
- El mapa de calor obliga a elegir **una** generación. En la vista del semestre acepta una
  carrera completa; en la vista por hora, no. No hay forma de ver la disponibilidad de toda una
  carrera hora por hora.

## Clarifications

### Session 2026-09-27

- Q: ¿Se permite mover una actividad propia arrastrándola a otro día? → A: Sí, con confirmación
  antes de guardar; si se cancela, vuelve a su lugar (FR-024).
- Q: ¿El aviso de "el calendario puede tener errores" se puede cerrar? → A: No. Siempre visible,
  pero discreto (FR-009).
- Q: Con "Todas las generaciones", ¿cuántas carreras se pueden combinar en el mapa de calor?
  → A: Hasta 4 carreras, 20 grupos: el tope vigente (FR-028).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El certamen de ejemplo desaparece del calendario (Priority: P1)

Un estudiante de primer año de Industrial abre el calendario y ya no ve un "Certamen 1 - Cálculo I"
que nadie programó. Tampoco ve, en el aviso de cancelaciones, que Docencia haya cancelado nada.

**Why this priority**: es información falsa sobre una evaluación, publicada ante estudiantes
reales. Es el único punto de esta especificación que hoy puede hacer que alguien se prepare
para un certamen que no existe.

**Independent Test**: tras desplegar, el calendario público no muestra la actividad de ejemplo, el
aviso público de cancelaciones no la menciona, y el registro interno de borrados deja constancia
de qué se eliminó, cuándo y por qué.

**Acceptance Scenarios**:

1. **Given** el calendario público con el certamen de ejemplo visible, **When** se despliega esta
   versión, **Then** el certamen deja de aparecer en el calendario, en «Eventos cercanos», en el
   mapa de calor y en los calendarios suscritos por los estudiantes.
2. **Given** el mismo despliegue, **When** se consulta el aviso público de cancelaciones,
   **Then** no aparece ninguna cancelación atribuida a Docencia.
3. **Given** el mismo despliegue, **When** un superadministrador revisa el registro de borrados,
   **Then** encuentra la actividad eliminada con el motivo "dato de ejemplo de instalación".
4. **Given** que un centro creó por su cuenta una actividad que se llama igual (por ejemplo, un
   "Certamen 1 - Cálculo I" real), **When** se despliega, **Then** esa actividad real **no** se toca.
5. **Given** una instalación nueva desde cero, **When** arranca por primera vez, **Then** el
   calendario tampoco muestra actividades de ejemplo.

---

### User Story 2 - Aviso de que el calendario puede tener errores (Priority: P1)

Cualquier persona que abra el calendario —con o sin cuenta— lee, antes de mirar las fechas, que
las actividades las publican los centros, que pueden tener errores y que debe verificar con la
fuente oficial las que sean importantes para ella.

**Why this priority**: el calendario se está convirtiendo en la referencia de los estudiantes y
sus datos se cargan a mano, muchas veces convertidos con IA desde un PDF. Sin el aviso, un error
de carga se lee como una fecha oficial.

**Independent Test**: se abre el calendario sin sesión, con sesión de centro y con sesión de
administrador, y en los tres casos el aviso está visible arriba del calendario.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** abre el calendario, **Then** ve el aviso antes que
   el calendario, sin tener que desplazarse.
2. **Given** un centro o un administrador con sesión iniciada, **When** abre el calendario,
   **Then** ve el mismo aviso.
3. **Given** el aviso visible, **When** se lee con un lector de pantalla, **Then** se anuncia como
   información importante, no como decoración.

---

### User Story 3 - El calendario recuerda dónde lo dejé (Priority: P1)

Un estudiante está revisando la semana del 9 de noviembre. Recarga la página, o cambia el filtro
de carrera, y sigue en la semana del 9 de noviembre, con la misma vista (Mes, Semana o Agenda) y
los mismos filtros.

**Why this priority**: es la molestia que el usuario reporta en cada visita. Quien planifica mira
las semanas que vienen, no la actual, y cada recarga le hace perder el lugar.

**Independent Test**: se navega a noviembre en vista Semana con un filtro puesto, se recarga, y la
vista, la semana y el filtro siguen iguales. Se cambia el filtro y la semana no se mueve.

**Acceptance Scenarios**:

1. **Given** el calendario en noviembre, **When** se recarga la página, **Then** sigue en
   noviembre.
2. **Given** el calendario en vista Semana, **When** se recarga, **Then** sigue en vista Semana en
   la misma semana.
3. **Given** el calendario en noviembre con una carrera filtrada, **When** se cambia la generación,
   **Then** el calendario se actualiza sin moverse de noviembre.
4. **Given** el calendario en una fecha y vista concretas, **When** se copia el enlace de la página
   y otra persona lo abre, **Then** ve la misma fecha, vista y filtros.
5. **Given** un enlace con una fecha mal escrita o una vista que no existe, **When** se abre,
   **Then** el calendario abre en el mes en curso sin error visible.
6. **Given** que el usuario nunca había navegado (entrada limpia), **When** abre el calendario,
   **Then** ve el mes en curso, como hoy.

---

### User Story 4 - Un centro edita su actividad desde el calendario (Priority: P2)

La directiva de un centro ve en el calendario que su "Certamen 2 de Termodinámica" quedó el día
equivocado. Hace clic en él y, en vez del panel de "Añadir a Google/Outlook", se le abre un panel
de edición con la fecha, la hora, el título, el ramo, el tipo y el lugar. Corrige la fecha, guarda,
y el certamen aparece en el día correcto sin salir del calendario.

**Why this priority**: acorta de varios pasos a uno la corrección más frecuente —una fecha mal
cargada— y la hace justo donde se detecta el error. Depende de que los centros ya hayan cargado
datos, por eso va después de los arreglos que ven todos.

**Independent Test**: con la cuenta de un centro, se hace clic en una actividad propia, se cambia
su fecha, se guarda y aparece en la nueva fecha. Con la misma cuenta, se hace clic en una actividad
de otro centro y se abre el panel de siempre, sin opción de editar.

**Acceptance Scenarios**:

1. **Given** un centro con sesión iniciada, **When** hace clic en una actividad de su propio centro,
   **Then** se abre un panel de edición con los datos actuales ya cargados.
2. **Given** ese panel, **When** cambia la fecha y guarda, **Then** la actividad aparece en la
   nueva fecha, el calendario no se mueve de la semana que estaba mirando, y recibe una
   confirmación visible.
3. **Given** ese panel, **When** pone una hora de término anterior a la de inicio y guarda,
   **Then** no se guarda y ve un mensaje que explica qué corregir.
4. **Given** un centro con sesión iniciada, **When** hace clic en una actividad de **otro** centro,
   **Then** se abre el panel de siempre, sin ningún control de edición.
5. **Given** un visitante sin sesión, **When** hace clic en cualquier actividad, **Then** se abre
   el panel de siempre.
6. **Given** un administrador, **When** hace clic en cualquier actividad, **Then** puede editarla.
7. **Given** el panel de edición abierto, **When** el centro quiere igualmente llevarse la
   actividad a su calendario personal, **Then** tiene esa opción disponible como acción
   secundaria.
8. **Given** un centro que edita una actividad, **When** otro centro la modificó o eliminó un
   instante antes, **Then** recibe un mensaje claro en vez de sobrescribir en silencio.
9. **Given** una actividad editada, **When** un estudiante que la tenía en su Google/Outlook
   sincroniza, **Then** ve la fecha nueva, no una copia duplicada.
10. **Given** un centro con sesión iniciada, **When** arrastra una actividad propia a otro día,
    **Then** se comporta según FR-024.

---

### User Story 5 - Mapa de calor de toda una carrera (Priority: P2)

Un centro que va a organizar una charla para toda su carrera elige su carrera y **"Todas las
generaciones"**, y el mapa de calor le muestra, hora por hora y a lo largo del semestre, qué
proporción de **toda** la carrera está libre.

**Why this priority**: amplía una herramienta que ya funciona. Es el cruce que más sirve para
actividades transversales (charlas, ferias, asambleas), pero no corrige ningún error.

**Independent Test**: se elige una carrera y "Todas las generaciones", y tanto la vista por hora
como la del semestre muestran resultados, ponderados por cuántos estudiantes tiene cada año.

**Acceptance Scenarios**:

1. **Given** el mapa de calor, **When** se elige una carrera y "Todas las generaciones", **Then**
   las dos vistas (por hora y semestre) muestran la disponibilidad de la carrera completa.
2. **Given** esa selección, **When** un año tiene muchos más estudiantes que otro, **Then** ese año
   pesa más en el resultado.
3. **Given** "Todas las generaciones", **When** además se marcan varias carreras, **Then**
   se aplica el límite de FR-028.
4. **Given** una selección que supera el límite acordado, **When** se pide el mapa, **Then** se
   explica el límite y cómo ajustarlo, en vez de fallar sin mensaje.
5. **Given** un enlace con la selección "Todas las generaciones", **When** se comparte y se abre,
   **Then** conserva esa selección, igual que hoy conserva la carrera y el año.

---

### Edge Cases

- **La actividad de ejemplo ya fue borrada o archivada a mano** antes del despliegue: la limpieza
  no falla y no toca nada más.
- **Un centro crea una actividad real con el mismo título** que la de ejemplo: no se borra. La
  identificación del dato de ejemplo no puede depender solo del título.
- **Se recarga el calendario en una vista que no existe en pantalla chica** (Semana en un
  teléfono): se respeta la vista guardada; si no cabe, se muestra la más cercana que sí funcione.
- **El enlace guardado apunta a una fecha muy lejana** (años atrás o adelante): se abre esa fecha;
  no se fuerza a volver al mes en curso.
- **Un centro con sesión caducada** intenta guardar una edición: se le pide volver a ingresar y
  no pierde lo que había escrito.
- **Un centro edita una actividad recién creada por otro integrante** del mismo centro: la puede
  editar, porque la propiedad es del centro y no de la persona.
- **La actividad pertenece a Vinculación con el Medio, Gearbox o Docencia** y la ve un centro de
  estudiantes: no es suya, se abre el panel de siempre.
- **Mapa de calor con una carrera que no tiene estudiantes cargados en algún año**: ese año no
  distorsiona el resultado.
- **El aviso de verificación en la impresión** del calendario: aparece también en lo impreso,
  porque un calendario impreso circula sin contexto.

## Requirements *(mandatory)*

### Functional Requirements

**Limpieza del dato de ejemplo**

- **FR-001**: La plataforma DEBE retirar del calendario la actividad de ejemplo de instalación
  ("Certamen 1 - Cálculo I" de Docencia) y cualquier otra actividad de ejemplo que traiga de
  fábrica, en cualquier estado en que se encuentre.
- **FR-002**: La retirada NO DEBE aparecer en el aviso público de cancelaciones.
- **FR-003**: La retirada DEBE quedar registrada en el registro interno de borrados, con el
  motivo "dato de ejemplo de instalación".
- **FR-004**: La retirada DEBE identificar el dato de ejemplo por su huella completa (título,
  descripción, lugar y entidad de fábrica), de modo que una actividad real con el mismo título
  nunca se vea afectada.
- **FR-005**: Una instalación nueva NO DEBE mostrar actividades de ejemplo en el calendario una
  vez terminado su arranque.

**Aviso de verificación**

- **FR-006**: El calendario DEBE mostrar en su parte superior, a cualquier persona con o sin
  sesión, un aviso que diga que las actividades las publican los centros, que pueden contener
  errores, y que conviene verificar las fechas importantes con la fuente oficial (el profesor o el
  programa de la asignatura).
- **FR-007**: El aviso DEBE ser visible sin desplazarse, legible en tema claro y oscuro, y
  anunciarse como información importante a los lectores de pantalla.
- **FR-008**: El aviso DEBE aparecer en todos los lugares donde la plataforma muestra el
  calendario de actividades, incluida la portada y la versión impresa.
- **FR-009**: El aviso DEBE estar siempre visible y NO DEBE poder cerrarse. Para no molestar al
  usuario habitual DEBE ser discreto: una franja informativa sobria, no una alerta de error.

**El calendario recuerda su posición**

- **FR-010**: El calendario DEBE conservar la vista (Mes, Semana, Agenda), la fecha visible y los
  filtros aplicados al recargar la página.
- **FR-011**: Cambiar un filtro NO DEBE mover el calendario de la fecha que se estaba mirando.
- **FR-012**: La posición DEBE quedar reflejada en la dirección de la página, de modo que copiar
  el enlace y compartirlo lleve a otra persona al mismo lugar.
- **FR-013**: Una dirección con valores inválidos DEBE abrir el calendario en el mes en curso, sin
  mensaje de error, y conservando los valores que sí sean válidos.
- **FR-014**: Los botones de atrás y adelante del navegador NO DEBEN quedar llenos de un paso
  por cada mes recorrido.
- **FR-015**: Cuando un centro abre el calendario sin posición guardada, la preselección de su
  propia carrera DEBE seguir funcionando como hoy; cuando hay una posición guardada, manda la
  posición guardada.

**Edición desde el calendario**

- **FR-016**: Al hacer clic en una actividad, la plataforma DEBE ofrecer editarla solo si quien
  mira puede editarla: el centro dueño de la actividad o un administrador. En cualquier otro caso
  se abre el panel actual.
- **FR-017**: El panel de edición DEBE permitir cambiar fecha y hora de inicio, fecha y hora de
  término, título, ramo, tipo y lugar, y DEBE mostrar los valores actuales ya cargados.
- **FR-018**: El panel de edición DEBE conservar como acción secundaria la opción de llevarse la
  actividad al calendario personal.
- **FR-019**: Al guardar, la actividad DEBE aparecer con sus datos nuevos sin recargar la página y
  sin mover el calendario de la fecha que se estaba mirando, con una confirmación visible.
- **FR-020**: Si los datos no son válidos (término antes que el inicio, fecha ilegible, título
  vacío), la edición NO DEBE guardarse y DEBE explicarse qué corregir, junto al campo afectado.
- **FR-021**: La autorización DEBE decidirla el servidor: ocultar el panel de edición en la
  interfaz no reemplaza la verificación de que quien guarda es dueño de la actividad.
- **FR-022**: Los calendarios personales de los estudiantes suscritos DEBEN recibir el cambio como
  una actualización del mismo evento, no como un evento nuevo.
- **FR-023**: Si la actividad fue modificada o eliminada por otra persona mientras se editaba,
  la plataforma DEBE avisarlo en vez de sobrescribir en silencio.
- **FR-024**: Quien puede editar una actividad DEBE poder moverla arrastrándola a otro día u
  hora. Al soltarla, la plataforma DEBE pedir confirmación indicando el día de origen y el de
  destino; solo al confirmar se guarda. Si se cancela, o si el guardado falla, la actividad DEBE
  volver a su posición original. Las actividades que no se pueden editar NO DEBEN poder
  arrastrarse.
- **FR-025**: El público objetivo (carreras y años) y el estado de la actividad se siguen
  editando desde «Mi panel»; el panel del calendario DEBE ofrecer un acceso directo a esa edición
  completa.

**Mapa de calor por carrera completa**

- **FR-026**: El mapa de calor DEBE ofrecer la opción "Todas las generaciones" en ambas vistas
  (por hora y semestre).
- **FR-027**: Con "Todas las generaciones", el resultado DEBE ponderar cada año según su cantidad
  de estudiantes, igual que hoy se ponderan varias carreras.
- **FR-028**: Con "Todas las generaciones" se pueden combinar **hasta 4 carreras** (4 × 5 = 20
  grupos de estudiantes, el mismo tope que ya rige). Una selección que lo supere DEBE rechazarse
  con un mensaje que explique el límite y cómo reducir la selección, y la interfaz DEBE avisarlo
  antes de pedir el mapa.
- **FR-029**: La opción elegida DEBE conservarse en el enlace, como hoy se conservan la carrera y
  el año.

### Key Entities

- **Actividad de ejemplo de instalación**: actividad que la plataforma trae de fábrica para no
  mostrarse vacía al instalarse. Se reconoce por su huella completa (título, descripción, lugar y
  entidad), no por su título. No es un dato real y no debe verse en producción.
- **Posición del calendario**: vista (Mes/Semana/Agenda), fecha visible y filtros. Pertenece a la
  dirección de la página, no a la cuenta: es la misma para quien recibe el enlace.
- **Grupo de estudiantes (segmento)**: una carrera en un año concreto. "Todas las generaciones"
  de una carrera son cinco grupos; el mapa de calor pondera cada grupo por su cantidad de
  estudiantes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras el despliegue, **cero** actividades de ejemplo visibles en el calendario
  público y **cero** cancelaciones falsas en el aviso público.
- **SC-002**: El aviso de verificación es visible sin desplazarse en el **100 %** de las visitas
  al calendario, en escritorio y teléfono, con o sin sesión.
- **SC-003**: En **5 de 5** recargas desde fechas y vistas distintas, el calendario reaparece en
  la misma fecha, vista y filtros.
- **SC-004**: Cambiar cualquier filtro deja el calendario en la misma fecha en el **100 %** de los
  casos.
- **SC-005**: Un centro corrige la fecha de su propia actividad en **menos de 30 segundos** desde
  que la ve en el calendario, sin salir de la página.
- **SC-006**: **Ninguna** cuenta de centro puede guardar cambios en una actividad de otro centro,
  aunque fuerce la petición fuera de la interfaz.
- **SC-007**: Un estudiante suscrito ve el cambio de fecha en su calendario personal **sin
  duplicados**.
- **SC-008**: El mapa de calor con "Todas las generaciones" de una carrera responde en un tiempo
  comparable al de una sola generación (no más del doble).

## Assumptions

- **Solo hay una actividad de ejemplo vigente en producción**: "Certamen 1 - Cálculo I". La
  otra que trae la plataforma de fábrica, "Semana del Novato", ya no está vigente; igual se
  incluye en la limpieza para que no aparezca en instalaciones nuevas.
- **La posición del calendario vive en la dirección de la página** y no en la cuenta. Es lo que
  permite compartir un enlace a "la semana del 9 de noviembre", y repite el patrón que el mapa de
  calor ya usa para conservar la carrera y el año.
- **Los campos editables en el calendario son los de uso diario** (fecha, hora, título, ramo,
  tipo, lugar). El público objetivo y el estado, que requieren más contexto, quedan en «Mi panel».
- **Eliminar una actividad sigue haciéndose desde «Mi panel»**, con su diálogo que pide motivo y
  publica la cancelación. El panel del calendario no incluye eliminar.
- **La propiedad es del centro, no de la persona**: cualquier integrante con la cuenta del centro
  puede editar lo que publicó el centro, como hoy.
- **El texto del aviso** se redacta en lenguaje directo, sin tecnicismos. Propuesta: *"Las
  actividades de este calendario las publican los centros de estudiantes y pueden contener errores.
  Si una fecha es importante para ti, confírmala con tu profesor o con el programa de la
  asignatura."*
- **La matrícula por año es la que ya usa el mapa de calor**; si no está cargada, cada grupo pesa
  igual y la interfaz ya lo advierte.
- **El arreglo de la portada** (tipo de actividad en palabras y ramo visible), hoy en una rama sin
  mergear, viaja con esta entrega.
