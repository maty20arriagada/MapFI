---
title: "Dilemas 002 — Escenarios hipotéticos de uso de MapFI"
tags: [mapfi, dilemas, escenarios, riesgos, ux, speckit]
date: 2026-07-27
status: dilemas-resueltos
aliases: ["Dilemas", "Casos hipotéticos MapFI"]
---

# Dilemas y casos hipotéticos de interacción

**Feature**: 002-auditoria-robustez-corregir

> **✅ Dilemas resueltos el 2026-07-31** (sesión de clarificación). Las decisiones
> tomadas se registran al inicio de cada dilema y están integradas en la
> [spec](./spec.md). La Parte B (escenarios) se mantiene como base de pruebas.
>
> **Decisión estructural:** al no existir revisor diario, se adopta **moderación
> reactiva**: todo se publica de inmediato y el administrador retira después. Esto
> reemplaza el modelo de aprobación previa que se había construido en la fase 6.

Este documento modela **qué puede salir mal cuando personas reales usan MapFI**.
Se divide en dos partes:

- **Parte A — Dilemas de producto**: decisiones que no tienen respuesta técnica
  única y requieren criterio del equipo. Cada una lleva una recomendación.
- **Parte B — Escenarios hipotéticos**: situaciones concretas que la plataforma
  enfrentará, con su desenlace actual y el desenlace deseado.

---

# Parte A — Dilemas que requieren decisión

## D-1 · ¿Qué hacer con los eventos ya cargados con la hora desplazada?

> **✅ RESUELTO (2026-07-31): opción A.** No hay actividades reales cargadas — solo
> datos de muestra. El ajuste se aplica sin riesgo ni compensaciones.

**El dilema.** Al corregir la zona horaria, los eventos existentes quedaron
guardados con un desfase. Si solo se corrige el sistema, los eventos antiguos
pasan a mostrarse con **otra hora distinta** a la que hoy ve la gente.

| Opción | A favor | En contra |
|---|---|---|
| **A. Ajustar el histórico** (recomendada si hay pocos eventos reales) | Todo queda coherente; nadie ve horas raras | Si algún evento se cargó ya "compensando" el error, se rompe |
| **B. Dejar el histórico intacto** | Cero riesgo de tocar datos correctos | Conviven dos criterios; confunde a quien mire hacia atrás |
| **C. Ajustar solo los futuros** | Equilibrio: lo que importa es lo que viene | Los eventos pasados quedan mal para efectos de reportes |

**Recomendación:** **A**, si el servidor aún tiene pocos datos reales (es el caso
actual, recién desplegado). Verificar primero cuántas actividades no son de
muestra. Si ya hubiera carga masiva real, cambiar a **C**.

**Pregunta abierta al equipo:** ¿cuántas actividades reales hay hoy cargadas?

---

## D-2 · ¿El público debe ver las actividades "en revisión"?

> **✅ RESUELTO (2026-07-31): moderación reactiva.** Confirmado que **no hay revisor
> diario**, lo que descarta toda opción que bloquee la publicación (incluida la
> recomendación original de revisar lo importado: esas fechas habrían quedado
> invisibles para siempre). Se publica **todo de inmediato**; el administrador
> **retira** lo incorrecto cuando lo detecta, y lo retirado desaparece de todas las
> vistas. Consecuencia de diseño: la autorización del servidor pasa a ser la única
> barrera, y se añade trazabilidad de quién retira o restituye.

**El dilema.** Hoy todo se ve al instante. Si se ocultan las propuestas hasta que
el administrador apruebe, se gana control pero se introduce **una espera humana**
en el camino crítico: el centro carga su evento y **no aparece** hasta que alguien
lo revise. Si ese alguien no revisa en una semana, el calendario queda desactualizado
y los centros dejan de usar la plataforma (el riesgo de abandono del plan maestro).

| Opción | Consecuencia |
|---|---|
| **A. Ocultar lo propuesto** | Máximo control; riesgo de cuello de botella y de que el centro crea que "no funciona" |
| **B. Mostrar todo, distinguido visualmente** ("propuesto", en tono atenuado) | Nada se frena; el público entiende que aún no está confirmado |
| **C. Publicar directo, revisar solo lo importado por planilla** | Lo manual (poco volumen, con Match) va directo; lo masivo se revisa |

**Recomendación:** **C**, complementada con **B**. Es coherente con lo ya
construido: la creación individual pasa por el calculador de compatibilidad (hay
una barrera de calidad), mientras que la importación masiva es donde se cuelan
errores en volumen. Y en todos los casos, **lo rechazado nunca se muestra** — eso
no está en discusión.

**Pregunta abierta al equipo:** ¿hay alguien con disponibilidad real para revisar
a diario, o el modelo debe funcionar sin revisor activo?

---

## D-3 · ¿Se pueden publicar cifras de alcance basadas en datos de relleno?

> **✅ RESUELTO (2026-07-31): opción B.** Se implementa ahora rotulando las cifras
> como estimación referencial. **La matrícula oficial es obtenible desde Docencia**;
> al cargarla, el rótulo desaparece automáticamente. Se agrega la capacidad de
> distinguir matrícula oficial de referencial.

**El dilema.** El alcance estimado se calcula sobre una matrícula ficticia de 100
estudiantes por segmento. Una vez reconectado el cálculo, esas cifras aparecerán en
un **documento que los centros presentarán a autoridades** para rendir cuentas y
postular a fondos. Publicar un número inventado con apariencia de dato oficial es
un problema **de credibilidad institucional**, no solo técnico.

| Opción | Evaluación |
|---|---|
| **A. Publicar sin advertencia** | Inaceptable: induce a error en un documento formal |
| **B. Publicar con la cifra rotulada como estimación referencial** | Honesto y útil; permite operar mientras llega el dato real |
| **C. Ocultar el alcance hasta tener matrícula real** | Máxima prudencia; deja el reporte casi vacío y desincentiva el uso |

**Recomendación:** **B**, con una leyenda explícita en pantalla y en el documento
("estimación basada en datos referenciales de matrícula"), y gestionar la carga de
la matrícula real como tarea prioritaria de datos.

**Pregunta abierta al equipo:** ¿es posible conseguir la matrícula por carrera y
nivel con la Dirección de Docencia este semestre?

---

## D-4 · ¿Quién manda cuando dos centros chocan?

**El dilema.** MapFI **detecta** choques pero no arbitra. Si dos centros agendan
eventos masivos el mismo día para el mismo público, la plataforma los muestra
ambos con una advertencia y no pasa nada más. En la práctica: el que carga primero
"gana" visibilidad, y no hay mecanismo de negociación.

**Riesgo real:** un centro descubre que otro le "pisó" la fecha y, como no hay
canal en la plataforma, la discusión ocurre fuera y la plataforma queda como la
culpable.

**Opciones:** (a) no arbitrar y dejarlo como información; (b) exigir confirmación
explícita al crear sobre una fecha saturada ("ya hay 2 eventos para este público,
¿continuar?"); (c) permitir al administrador priorizar.

**Recomendación:** **(b)** para esta fase — una fricción mínima que obliga a ver el
choque antes de confirmar, sin meter a la plataforma a arbitrar. **(c)** queda para
el backlog.

---

## D-5 · ¿Puede un centro crear eventos dirigidos a otras carreras?

**El dilema.** Hoy cualquier centro puede marcar como público objetivo **cualquier
carrera**. Es necesario para actividades conjuntas, pero también permite que un
centro sature el mapa de calor de otra carrera, o que por error marque "todas" y
distorsione la planificación de toda la facultad.

**Recomendación:** mantener la libertad (los eventos interdisciplinarios son un
objetivo del proyecto), pero **advertir** cuando se seleccionan carreras distintas
a la propia y registrar quién creó qué. Es un problema social, no técnico; la
trazabilidad basta.

---

# Parte B — Escenarios hipotéticos

Cada escenario describe una situación concreta, qué pasa **hoy** y qué debería
pasar. Los identificadores E-## se referencian desde las tareas.

## E-01 · La feria que nadie encontró

*Marzo, inicio de semestre.* El CEE de Industrial publica su feria para el
**viernes a las 21:00**. Difunden el enlace del calendario por redes. El día del
evento, los estudiantes que confiaron en el calendario llegan a las **17:00**,
porque eso es lo que muestra la plataforma.

- **Hoy:** desfase silencioso de 4 horas (H-01, demostrado).
- **Debería:** la hora publicada es la hora ingresada, siempre.
- **Daño si no se corrige:** el primer uso masivo de la plataforma termina en una
  mala experiencia pública. Es el tipo de error que hace que un proyecto pierda la
  confianza institucional de forma irreversible.

## E-02 · El rechazo que no rechazó nada

*Docencia importa 40 certámenes.* El administrador detecta que 12 tienen fechas
equivocadas y las **rechaza** desde el panel. Al día siguiente, un estudiante
reclama que hay dos certámenes contradictorios en el calendario.

- **Hoy:** lo rechazado sigue visible (H-02). El administrador cree que actuó.
- **Debería:** rechazar retira la actividad del calendario público de inmediato.
- **Daño:** información académica errónea circulando con el respaldo institucional
  de la plataforma.

## E-03 · La rendición de cuentas vacía

*Diciembre.* El CEE de Informática descarga su reporte de impacto para adjuntarlo a
la postulación a fondos de la facultad. El documento dice **"Alcance total
estimado: 0 estudiantes"** tras un semestre de 15 actividades.

- **Hoy:** el alcance nunca se guarda (H-03).
- **Debería:** el reporte refleja el trabajo real del centro.
- **Daño:** el incentivo diseñado para sostener la carga de datos se convierte en
  un argumento para abandonar la plataforma.

## E-04 · El sello que nadie puede ganar

*El equipo promociona el Sello de Coordinación Eficiente* en la reunión de centros.
Al final del semestre, **ningún centro** lo obtiene, ni siquiera el que usó el
calculador en todos sus eventos.

- **Hoy:** el criterio depende de un dato que nunca se guarda (H-03) ⇒ inalcanzable.
- **Debería:** alcanzable y con criterios visibles para quien quiera lograrlo.
- **Daño:** una promesa pública incumplida frente a los mismos usuarios que se
  quería motivar.

## E-05 · El atajo del estudiante de informática

*Un integrante del CEE de Informática* nota que sus eventos quedan "en revisión" y,
con la consola del navegador, descubre que enviando un campo extra puede publicarlos
al instante. Lo comparte con otros centros como "truco".

- **Hoy:** funciona (H-04).
- **Debería:** el servidor ignora ese campo; el rol define lo que se puede hacer.
- **Daño:** el control del administrador se evapora y se normaliza saltarse el
  proceso.

## E-06 · La planilla del semestre completo

*Docencia prepara la carga anual*: 120 certámenes, muchos dirigidos a toda la
facultad. Al importar, la plataforma responde **"Error inesperado"**. Lo intenta
tres veces y desiste; vuelve a la planilla compartida por correo.

- **Hoy:** el envío supera el límite de tamaño alrededor de la fila 52 (H-05, medido).
- **Debería:** se procesa por lotes de forma transparente, o se explica qué hacer.
- **Daño:** se pierde al aportante más valioso de la plataforma (quien tiene el
  calendario académico completo).

## E-07 · La directiva que se fue

*Cambio de directiva en un centro.* El administrador desactiva la cuenta saliente.
Esa tarde, la persona saliente —molesta— **borra las actividades** del centro desde
su sesión aún abierta.

- **Hoy:** la desactivación no corta la sesión (H-06); las eliminaciones son
  definitivas y no hay papelera.
- **Debería:** la primera acción tras la desactivación es rechazada.
- **Daño:** pérdida de datos y un incidente de control de acceso con una persona
  identificable.

## E-08 · El doble clic nervioso

*Alguien con conexión lenta* pulsa "Guardar" dos veces porque no ve respuesta. Se
crean **dos eventos idénticos**. En el mapa de calor, ese día aparece más saturado
de lo real, y el calculador empieza a desaconsejar fechas por un evento fantasma.

- **Hoy:** ocurre (H-07); nada bloquea el segundo envío.
- **Debería:** el botón se bloquea durante el guardado.
- **Daño:** datos sucios que contaminan el algoritmo que da valor al producto.

## E-09 · La sala de computación bloqueada

*Cinco personas de distintos centros* usan la sala de computación de la facultad.
Una olvida su contraseña y falla cinco veces. Durante los siguientes quince
minutos, **nadie más en toda la red de la facultad puede iniciar sesión**.

- **Hoy:** posible si el intermediario no reenvía la dirección real (H-09).
- **Debería:** el bloqueo afecta al intento sobre esa cuenta, no a terceros.
- **Daño:** una persona distraída deja fuera a toda la facultad; muy difícil de
  diagnosticar para quien lo sufre.

## E-10 · El certamen que cayó en feriado

*Un centro agenda una actividad* en una fecha que el calculador aprueba con alta
compatibilidad. Resulta ser un feriado móvil que quedó cargado con una fecha
tentativa y nunca se confirmó.

- **Hoy:** posible (H-13); el calculador es tan bueno como sus datos.
- **Debería:** los feriados están confirmados contra la fuente oficial.
- **Daño:** el calculador —la función más diferenciadora— entrega una recomendación
  equivocada, justo en aquello que promete resolver.

## E-11 · El computador compartido de la sede

*Dos personas del mismo centro* usan el computador de la sede. La segunda nunca ve
el tutorial de bienvenida (ya fue marcado como visto) y, al crear un evento,
encuentra preseleccionadas las carreras que eligió la primera. Publica sin notarlo,
dirigido al público equivocado.

- **Hoy:** ocurre (H-12).
- **Debería:** las preferencias son por cuenta, no por navegador.
- **Daño:** actividades mal dirigidas y un tutorial que no cumple su función con
  quien más lo necesita.

## E-12 · El evento que cruza la medianoche

*Un centro agenda una actividad* de 22:00 a 02:00 del día siguiente. No está
definido cómo se cuenta en el mapa de calor (¿un día o dos?), ni cómo lo evalúa el
calculador respecto de "fin de semana" si empieza el viernes y termina el sábado.

- **Hoy:** comportamiento no definido ni probado.
- **Debería:** una regla explícita y documentada.
- **Daño:** menor, pero es el tipo de caso límite que produce números inexplicables
  en los indicadores.

## E-13 · El segundo año de la plataforma

*Marzo del año siguiente.* El calendario acumula dos semestres de historia. Cada
carga de la página cruza todas las actividades publicadas entre sí para detectar
choques, y el tiempo de respuesta empieza a notarse.

- **Hoy:** la consulta no se acota por rango (H-14); crece de forma cuadrática.
- **Debería:** se consulta solo el rango visible.
- **Daño:** degradación progresiva que aparece justo cuando la plataforma ya es
  parte del proceso institucional.

## E-14 · El estudiante que solo quiere mirar

*Una estudiante de segundo año* entra desde el teléfono a ver si hay algo esta
semana para su carrera. No tiene cuenta ni la necesita.

- **Hoy:** funciona, y es una de las cosas mejor resueltas del proyecto.
- **A cuidar:** que las correcciones de visibilidad **no** rompan la vista pública
  ni le exijan iniciar sesión. Es el usuario más numeroso y el menos representado
  en las pruebas.

---

## Cómo se usa este documento

- Los **dilemas (D-##)** deben resolverse antes o durante la implementación; cada
  uno lleva una recomendación y una pregunta abierta al equipo.
- Los **escenarios (E-##)** son la base de las pruebas de aceptación: cada uno
  debe poder representarse como una verificación reproducible.
- Escenarios sin defecto asociado (E-14) sirven como **prueba de no regresión**:
  lo que hoy funciona bien y no debe romperse.
