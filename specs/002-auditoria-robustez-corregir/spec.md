---
title: "Spec 002 — Auditoría de robustez de MapFI"
tags: [mapfi, spec, auditoria, robustez, speckit]
date: 2026-07-27
status: draft
aliases: ["Spec 002", "Auditoría de robustez"]
---

# Feature Specification: Auditoría de robustez — corregir inconsistencias críticas

**Feature Branch**: `002-auditoria-robustez-corregir`

**Created**: 2026-07-27

**Status**: Draft

**Input**: Revisión detallada de todo el proyecto en busca de errores e inconsistencias, modelando dilemas y casos hipotéticos de interacción real de usuarios que puedan convertirse en un problema para la plataforma.

## Clarifications

### Session 2026-07-31

- Q: ¿Cuántas actividades reales hay cargadas hoy en el servidor? → A: Ninguna; el uso real comienza más adelante.
- Q: ¿Existe alguien revisando las actividades a diario? → A: No.
- Q: ¿Es posible obtener la matrícula real desde Docencia? → A: Sí.
- Q: Sin revisor diario, ¿cómo deben publicarse las actividades? → A: Publicar de inmediato con moderación reactiva (el administrador retira o corrige después; no hay aprobación previa).
- Q: Al eliminar una actividad, ¿debe poder recuperarse? → A: Sí; se archiva (oculta de todas las vistas) y un administrador puede restaurarla.
- Q: ¿Cómo proceder mientras llega la matrícula real? → A: Implementar ahora rotulando las cifras como estimación referencial; el rótulo desaparece al cargar los datos oficiales.

## Contexto

MapFI está funcionalmente completo (Fases F0–F8) y con 60 pruebas en verde, pero la suite **no cubre las interacciones entre capas** (navegador → API → base de datos → navegador). Esta auditoría encontró **4 defectos críticos verificados empíricamente** que rompen promesas centrales del producto, más varios de severidad alta y media. Ninguno se manifiesta como una excepción visible: todos fallan **en silencio**, que es el modo más peligroso para una plataforma que aspira a ser la "fuente de verdad" del calendario de la facultad.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un evento aparece a una hora distinta de la que se cargó (Priority: P1)

Una persona del CEE de Industrial agenda su feria para el **viernes a las 21:00**. Guarda, y el calendario público muestra la actividad a las **17:00**. Los estudiantes llegan cuatro horas antes; la feria "no existe" a la hora publicada.

**Why this priority**: Destruye la confianza en el dato. Un calendario que muestra horas incorrectas es peor que no tener calendario, porque la gente sí actúa sobre él. Afecta al 100 % de las actividades cargadas.

**Independent Test**: Crear una actividad a una hora conocida y comparar la hora mostrada en el calendario con la ingresada, con el servidor corriendo en la configuración horaria real del contenedor.

**Acceptance Scenarios**:

1. **Given** el servidor desplegado en Docker (zona horaria del contenedor distinta a la de Chile), **When** una persona en Chile crea un evento a las 21:00, **Then** el calendario público, la tabla "Mis eventos" y el reporte muestran **21:00**.
2. **Given** actividades creadas antes de la corrección, **When** se aplica la corrección, **Then** siguen mostrando la hora que sus autores pretendían, o se documenta explícitamente el ajuste aplicado.
3. **Given** el cambio de horario de verano en Chile, **When** se crean eventos a ambos lados del cambio, **Then** cada uno muestra su hora local correcta.

---

### User Story 2 - El administrador retira una actividad y sigue publicada (Priority: P1)

Docencia importa por planilla 40 fechas de certámenes y todas se publican de inmediato. El administrador detecta que 12 están mal cargadas y las **retira**. Las 12 retiradas **siguen apareciendo en el calendario público**.

**Why this priority**: Como no hay revisor diario, el modelo es de **moderación reactiva**: se publica al instante y el administrador corrige después. Ese modelo solo funciona si **retirar realmente retira**; hoy no lo hace, de modo que no existe ningún mecanismo efectivo para sacar información errónea del calendario.

**Independent Test**: Publicar una actividad, retirarla como administrador y verificar que desaparece del calendario público y de los indicadores.

**Acceptance Scenarios**:

1. **Given** una actividad recién creada por un centro, **When** un visitante sin sesión consulta el calendario público, **Then** la actividad **sí** aparece de inmediato (no hay aprobación previa).
2. **Given** una actividad retirada por el administrador, **When** cualquier usuario consulta el calendario público, **Then** la actividad **no** aparece.
3. **Given** una actividad propia retirada o archivada, **When** su centro entra a "Mis eventos", **Then** sí la ve, con su estado visible, para poder corregirla o solicitar su restitución.
4. **Given** el mapa de calor y el detector de choques, **When** se calculan, **Then** usan el **mismo criterio de estados** que el calendario y excluyen lo retirado.

---

### User Story 3 - El reporte de impacto declara "0 estudiantes" (Priority: P1)

Al cierre de semestre, el centro descarga su **Reporte de Impacto** para adjuntarlo a una rendición de cuentas y a una postulación a fondos. El documento dice **"Alcance total estimado: 0 estudiantes"** pese a haber realizado 15 actividades. Además, ningún centro obtiene jamás el **Sello de Coordinación Eficiente**, por más que use el calculador.

**Why this priority**: El reporte y la gamificación son los incentivos que sostienen la carga de datos (riesgo "abandono de aportantes" del plan maestro). Un reporte con ceros es inservible para el propósito declarado y desprestigia la plataforma ante autoridades.

**Independent Test**: Crear actividades usando el calculador, marcarlas como realizadas, generar el reporte y verificar que el alcance sea mayor que cero y que el sello sea alcanzable.

**Acceptance Scenarios**:

1. **Given** una actividad creada tras evaluar la compatibilidad, **When** se guarda, **Then** se conservan su porcentaje de compatibilidad y su alcance estimado.
2. **Given** una entidad con actividades realizadas, **When** genera su reporte, **Then** el alcance total es coherente con el público objetivo declarado.
3. **Given** una entidad con al menos 3 actividades, que evaluó la compatibilidad en al menos el 70 % de ellas y cuya tasa de reprogramación/suspensión es de máximo el 20 %, **When** se recalcula la reputación, **Then** **obtiene** el Sello de Coordinación Eficiente.
4. **Given** que la matrícula cargada es un valor de relleno, **When** se muestra o exporta un alcance, **Then** la cifra se presenta explícitamente como estimación con datos referenciales.

---

### User Story 4 - Un centro manipula datos que no le corresponden (Priority: P2)

Una persona con cuenta de aportante usa la interfaz de programación directamente y crea actividades **a nombre de otra entidad**, o **restituye** una actividad que el administrador había retirado, o se marca actividades como realizadas para inflar su reputación.

**Why this priority**: Con moderación reactiva, la única barrera que queda es la autorización del servidor. Si el cliente puede imponer la entidad o el estado, el administrador pierde su capacidad de retirar contenido (lo retirado se puede volver a publicar) y las métricas de gamificación se vuelven manipulables.

**Independent Test**: Con una sesión de aportante, intentar imponer entidad y estado en creación y edición, y verificar que el servidor los ignora.

**Acceptance Scenarios**:

1. **Given** una sesión de aportante, **When** intenta crear una actividad a nombre de otra entidad, **Then** el servidor la asigna a su propia entidad.
2. **Given** una actividad retirada por el administrador, **When** su autor intenta devolverla al estado publicado, **Then** el servidor lo rechaza; solo un administrador puede restituir.
3. **Given** una sesión de aportante, **When** intenta marcar como realizada una actividad futura para mejorar su reputación, **Then** el servidor lo rechaza.
4. **Given** cualquier sesión, **When** envía valores de compatibilidad o alcance en la creación, **Then** el servidor los descarta y usa los que él mismo calcula.

---

### User Story 5 - La carga del semestre completo falla sin explicación (Priority: P2)

Docencia prepara la planilla con todos los certámenes del semestre e indica que aplican a toda la facultad. Al importar, la plataforma responde **"Error inesperado"** y no se carga nada. No hay pista de qué hacer.

**Why this priority**: Es exactamente el caso de uso que motivó construir la importación masiva, y falla justo en el escenario más grande. El mensaje no orienta a ninguna acción.

**Independent Test**: Importar una planilla equivalente a un semestre completo dirigido a todas las carreras y años, y verificar que se procesa.

**Acceptance Scenarios**:

1. **Given** una planilla que expande a un volumen grande de público objetivo, **When** se importa, **Then** la operación se completa correctamente o se procesa por lotes de forma transparente.
2. **Given** una carga que excede el límite admitido, **When** se rechaza, **Then** el mensaje explica la causa y sugiere una acción concreta.
3. **Given** una planilla con filas inválidas, **When** se importa, **Then** los errores se describen en lenguaje comprensible, sin texto técnico interno.

---

### User Story 6 - Una cuenta desactivada sigue operando (Priority: P2)

Cambia la directiva del centro. El administrador **desactiva** la cuenta saliente. La persona, con la sesión ya abierta, **continúa creando y borrando actividades durante horas**, porque la desactivación solo impide nuevos inicios de sesión.

**Why this priority**: El administrador cree haber revocado un acceso y no lo hizo; es un riesgo de control de acceso con impacto directo sobre datos compartidos.

**Independent Test**: Con una sesión abierta, desactivar la cuenta desde el panel y verificar que la siguiente acción es rechazada.

**Acceptance Scenarios**:

1. **Given** una sesión activa, **When** el administrador desactiva esa cuenta, **Then** la siguiente acción del usuario es rechazada y se le pide iniciar sesión.
2. **Given** que el administrador cambia el rol o la entidad de una cuenta, **When** el usuario continúa navegando, **Then** sus permisos reflejan el cambio sin esperar la expiración de la sesión.

---

### Edge Cases

- **Doble clic al guardar**: el botón no se bloquea durante el envío, por lo que se crean actividades duplicadas que ensucian el calendario común e inflan el mapa de calor.
- **Fecha de término anterior al inicio**: no se valida antes de guardar; el usuario recibe un error interno en lugar de una explicación.
- **Red universitaria tras un intermediario**: si no se reenvía la dirección real, cinco intentos fallidos de una sola persona **bloquean el ingreso a toda la facultad** durante quince minutos, porque el límite se aplica a la dirección compartida.
- **Reinicio del servidor**: el control de intentos vive en la memoria del proceso; un reinicio lo borra por completo y no funciona si algún día hay más de una instancia.
- **Computador compartido en la sede del centro**: la bienvenida y las preferencias del formulario se guardan por navegador y no por usuario, de modo que la segunda persona no ve el tutorial y hereda las carreras preseleccionadas de la anterior.
- **Feriados móviles sin confirmar**: fechas marcadas para verificación siguen cargadas; el calculador puede aprobar una fecha que en realidad es feriado.
- **Crecimiento del historial**: la detección de choques recorre todas las actividades publicadas en cada carga del calendario, sin acotar por semana.
- **Actividad que cruza la medianoche o dura varios días**: se cuenta para saturación y choques en **cada día de calendario** que abarca su rango (una actividad de 22:00 a 02:00 cuenta para ambos días). El criterio de "fin de semana" del calculador se evalúa sobre la fecha y hora de **inicio** únicamente.
- **Borrado en conflicto**: con archivado reversible, dos personas del mismo centro podrían archivar y restaurar la misma actividad; debe prevalecer la última acción y quedar registrada.
- **Información errónea visible antes de ser detectada**: al publicar sin revisión previa, un dato equivocado permanece visible hasta que alguien lo advierta; el sistema debe facilitar que el administrador lo encuentre y lo retire rápido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Las fechas y horas MUST almacenarse y mostrarse de forma que la hora visible para el usuario sea siempre la que ingresó, con independencia de la configuración horaria del servidor.
- **FR-002**: El sistema MUST aplicar un criterio único y explícito de estados para decidir qué actividades son visibles públicamente; las retiradas o archivadas MUST NOT aparecer en el calendario público.
- **FR-002b**: Las actividades creadas por un aportante MUST publicarse de inmediato, sin aprobación previa (modelo de moderación reactiva, dado que no existe revisor diario).
- **FR-003**: El calendario público, el mapa de calor y la detección de choques MUST coincidir en qué actividades consideran vigentes.
- **FR-004**: Cada aportante MUST poder ver sus propias actividades retiradas o archivadas, con su estado claramente indicado.
- **FR-004b**: El administrador MUST poder retirar del calendario público cualquier actividad, y esa acción MUST surtir efecto inmediato en todas las vistas.
- **FR-005**: Al crear una actividad tras evaluar su compatibilidad, el sistema MUST conservar el porcentaje de compatibilidad y el alcance estimado asociados.
- **FR-006**: El Sello de Coordinación Eficiente MUST ser alcanzable por una entidad con al menos 3 actividades, que evaluó la compatibilidad en al menos el 70 % de ellas y cuya tasa de reprogramación/suspensión sea de máximo el 20 %.
- **FR-007**: Los reportes e indicadores que expongan alcance MUST señalar cuándo la cifra proviene de datos de matrícula referenciales; el rótulo MUST desaparecer automáticamente cuando la matrícula cargada sea la oficial.
- **FR-007b**: El sistema MUST permitir cargar la matrícula oficial por carrera y nivel, y distinguirla de los valores referenciales.
- **FR-008**: El estado de una actividad y su entidad organizadora MUST ser determinados por el servidor según el rol de quien la crea; el cliente MUST NOT poder imponerlos.
- **FR-009**: Solo un administrador MUST poder **restituir** una actividad previamente retirada o archivada.
- **FR-009b**: La eliminación de una actividad MUST ser reversible: el registro se archiva y deja de mostrarse, y un administrador MUST poder restaurarlo.
- **FR-009c**: El sistema MUST registrar quién y cuándo retiró, archivó o restituyó una actividad, para dar trazabilidad a la moderación reactiva.
- **FR-010**: La importación masiva MUST completarse para el volumen de un semestre académico completo dirigido a toda la facultad, o informar con claridad el límite y cómo dividir la carga.
- **FR-011**: Los errores mostrados al usuario MUST estar redactados en lenguaje comprensible, sin exponer mensajes técnicos internos.
- **FR-012**: La desactivación o el cambio de permisos de una cuenta MUST tener efecto sobre las sesiones ya abiertas.
- **FR-013**: Las acciones de guardado MUST impedir envíos duplicados por interacción repetida del usuario.
- **FR-014**: El sistema MUST validar que la fecha de término sea posterior a la de inicio antes de intentar guardar, con un mensaje específico.
- **FR-015**: El control de intentos de ingreso MUST distinguir usuarios detrás de una dirección compartida, de modo que una persona no pueda bloquear el acceso de terceros.

### Key Entities

- **Actividad**: su **estado** pasa a ser el eje de la visibilidad pública y debe interpretarse igual en todas las vistas.
- **Sesión**: deja de ser una copia inmutable del usuario al momento del ingreso; debe reflejar los cambios administrativos.
- **Matrícula**: dato de referencia que alimenta cifras publicadas; su naturaleza (real o referencial) debe ser explícita.
- **Resultado de compatibilidad**: hoy efímero; pasa a ser un dato asociado a la actividad que alimenta reportes e incentivos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las actividades muestra la misma hora que ingresó su autor, verificado con el servidor en una zona horaria distinta a la de Chile.
- **SC-002**: Cero actividades retiradas o archivadas visibles en el calendario público, y toda actividad recién creada aparece en él sin intervención de un administrador.
- **SC-002b**: Una actividad eliminada por error puede restaurarse íntegramente por un administrador.
- **SC-003**: El calendario, el mapa de calor y el detector de choques devuelven el mismo conjunto de actividades vigentes para un mismo filtro.
- **SC-004**: Un reporte de impacto de una entidad con actividades realizadas informa un alcance mayor que cero y coherente con su público.
- **SC-005**: Al menos una entidad de prueba con 3 o más actividades, ≥ 70 % de uso del calculador y ≤ 20 % de reprogramación obtiene el Sello de Coordinación Eficiente.
- **SC-006**: Un aportante no logra, por ningún medio disponible, actuar a nombre de otra entidad ni restituir una actividad retirada por el administrador.
- **SC-007**: Una carga masiva equivalente a un semestre completo para toda la facultad se procesa con éxito.
- **SC-008**: Tras desactivar una cuenta, su siguiente acción es rechazada.
- **SC-009**: Ningún mensaje visible al usuario contiene texto técnico interno.
- **SC-010**: La suite de pruebas se ejecuta también en la configuración horaria del servidor real y sigue en verde.

## Assumptions

- La zona horaria operativa de la facultad es la de Chile continental, con horario de verano.
- **No hay actividades reales cargadas** al momento de la corrección (solo datos de muestra), por lo que el ajuste de fechas históricas no presenta riesgo y puede aplicarse sin compensaciones.
- **No existe un revisor diario**, de lo que se deriva el modelo de moderación reactiva: publicar de inmediato y permitir retirar después. Si en el futuro se designa un revisor permanente, el modelo puede endurecerse sin rehacer el diseño.
- **La matrícula oficial es obtenible desde Docencia**; hasta que se cargue, las cifras de alcance se rotulan como referenciales.
- No se cambia el stack ni se agregan dependencias pesadas (Principio I de la constitución).
- Un subconjunto de tareas de implementación (mejoras de accesibilidad, del backlog y de los dilemas D-4/D-5) se aborda de forma oportunista por compartir archivos con las correcciones críticas; no derivan de un Functional Requirement de esta spec y no bloquean sus criterios de éxito.
