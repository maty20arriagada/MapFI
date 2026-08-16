# Phase 0 · Investigación — Gestión de horarios

**Feature**: `003-gestion-horarios` | **Fecha**: 2026-08-15

Cada apartado resuelve una incógnita del Technical Context de `plan.md`.

---

## R-1 · Cómo representar 45 y 90 minutos en la misma grilla

**Decisión**: grilla CSS de **52 filas de 15 minutos** (08:00–21:00), con
`row-gap: 0` y separación visual mediante borde del propio bloque.

**Rationale**: el máximo común divisor de 45 y 90 es 15. Con filas de 30 minutos
—las actuales— un bloque de 45 min exige `grid-row: 2 / 3.5`, que no es un valor
válido: el navegador descarta la declaración y el bloque colapsa. Con filas de 15
min, 45 min = 3 filas y 90 min = 6 filas, exactamente el doble.

El `row-gap` importa más de lo que parece. El CSS actual usa `gap: 4px` uniforme.
Con 52 filas eso introduce 51 huecos: un bloque de 3 filas mide `3h + 2g` y uno de
6 filas mide `6h + 5g`. Con `h = 13px` y `g = 4px` la razón es 47:98, no 1:2 — la
proporcionalidad que pide FR-006 se pierde por el propio andamiaje. Separando los
ejes (`column-gap: 4px; row-gap: 0`) y dando al bloque un borde de 1px del color
del fondo, la razón vuelve a ser exacta y el resultado se ve igual de aireado.

Fórmula de posición, con `M` = minutos desde medianoche:

```
fila = 2 + (M - 480) / 15        // 480 = 08:00; la fila 1 es la cabecera de días
```

**Alternativas descartadas**:
- *Posicionamiento absoluto en píxeles* (`top: X%; height: Y%`): daría resolución
  continua y toleraría el 11:50 heredado sin ajustar. Se descarta porque obliga a
  reimplementar a mano el apilado de solapamientos y las cabeceras pegajosas que
  CSS Grid ya resuelve, y porque abandona el marcado accesible por filas.
- *Filas de 5 minutos* (156 filas): tolera cualquier hora sin ajuste, pero triplica
  los nodos de la grilla sin beneficio observable para el usuario.
- *Una biblioteca de calendario semanal*: contradice el Principio I.

---

## R-2 · Bloques heredados que no caen en un cuarto de hora

**Decisión**: el renderizador **ajusta al cuarto de hora** (`floor` para el inicio,
`ceil` para el término) y la etiqueta muestra la **hora real almacenada**. No se
modifica el dato en la base.

**Rationale**: hay datos reales que no son múltiplos de 15 — el propio seed usa
11:50–13:20 (`002_seed_catalogos.sql:98`), y las mallas de la Facultad tienen bloques
que empiezan a y 20. Si el renderizador no ajusta, esos bloques producen fracciones
de fila y vuelven a romper la grilla: el defecto D-3 reaparecería sobre datos
existentes en vez de sobre datos nuevos. Ajustar solo el dibujo, y no el dato,
mantiene la información fiel: la persona lee "11:50" aunque el rectángulo empiece en
11:45. Redondear el dato almacenado sería corromper información institucional para
comodidad del dibujo.

**Alternativas descartadas**:
- *Migrar los datos al cuarto de hora más cercano*: pérdida irreversible de precisión
  sobre datos que no nos pertenecen.
- *Rechazar en el importador cualquier hora no múltiplo de 15*: cerraría la puerta a
  mallas reales legítimas. El importador **avisa** pero acepta.

---

## R-3 · Bloques solapados en el mismo día

**Decisión**: algoritmo de sub-columnas en un **servicio puro**
`js/services/horarioService.js`, que recibe los bloques y devuelve su geometría
(`filaInicio`, `filaFin`, `subColumna`, `subColumnas`).

**Rationale**: al añadir la columna `seccion`, dos secciones de la misma carrera y
año pueden ocupar la misma franja; hoy se dibujarían una encima de otra y una
quedaría invisible. El algoritmo es el clásico de calendarios: ordenar por hora de
inicio, agrupar en "racimos" de bloques que se solapan transitivamente, y asignar a
cada bloque la primera sub-columna libre dentro de su racimo. El ancho de cada bloque
es `1 / subColumnas` de la columna del día.

Ponerlo en `js/services/` y no dentro de la vista es lo que exige el Principio II, y
tiene una consecuencia práctica: el apilado es la parte con más aristas de esta
feature (racimos encadenados, bloques idénticos, bloques contenidos en otro) y así
queda cubierto por Jest sin necesidad de navegador ni de base de datos.

**Alternativas descartadas**:
- *Superponer con transparencia*: ilegible con tres bloques.
- *Rechazar solapamientos al importar*: hay solapamientos legítimos (secciones
  paralelas, un bloque protegido que cubre una franja con clases dentro).

---

## R-4 · Interpretar archivos sin que toquen el servidor

**Decisión**: `FileReader.readAsText()` en el navegador; al servidor viaja solo JSON
ya estructurado. Se reutiliza el patrón exacto de `js/csv-utils.js`, que hoy hace
esto mismo para las actividades.

**Rationale**: es el requisito FR-018/FR-019 y, felizmente, ya es el estado actual del
proyecto: no existe `multer` ni ninguna otra dependencia de subida, y
`dashboard.html:81` ya usa un `<input type="file">` que nunca llega al servidor. El
riesgo no es corregir algo roto, es **evitar que se rompa después**: basta con que
alguien agregue una ruta de subida "para adjuntar el PDF del programa del ramo" para
perder la garantía sin darse cuenta. Por eso FR-020 exige una prueba que falle si
aparece middleware `multipart` o una escritura a disco en una ruta.

Ventaja adicional: el archivo se valida por completo antes de existir la primera
petición, de modo que un archivo de 5 MB nunca cruza la red.

**Alternativas descartadas**:
- *Subir el archivo y parsearlo en el servidor*: viola FR-018 y agrega dependencia,
  superficie de ataque (zip bombs, path traversal) y limpieza de temporales.
- *Parsear en el navegador pero enviar el texto crudo al servidor para revalidar*:
  duplicaría el parser en dos lenguajes de ejecución. Se prefiere un parser único
  compartido, con **validación estructural** en el servidor sobre el JSON recibido
  (que es obligatoria de todas formas, por H-04: la autoridad es del servidor).

---

## R-5 · Detectar un archivo que no es texto

**Decisión**: inspeccionar los primeros bytes y rechazar con mensaje específico si
corresponden a un formato binario conocido: `PK\x03\x04` (`.xlsx`, `.docx`, cualquier
ZIP), `%PDF`, `\xD0\xCF\x11\xE0` (`.xls` antiguo). También se rechaza el texto que
contenga bytes nulos.

**Rationale**: el usuario dijo "Excel". Es previsible que alguien arrastre un `.xlsx`
directamente. Sin esta comprobación, `readAsText` devuelve un chorro de mojibake, el
parser encuentra cero columnas válidas y el mensaje resultante ("Encabezado
inválido") no dice nada útil sobre lo que realmente pasó. Detectar la firma permite
decir exactamente lo que hay que hacer: *"Esto es un archivo de Excel. Ábrelo y usa
Archivo → Guardar como → CSV (delimitado por comas), o copia las celdas y pégalas
abajo."*

Es una comprobación de usabilidad (Principio VI), no de seguridad: como el archivo
nunca sale del navegador, un binario malformado no representa riesgo alguno.

---

## R-6 · Formato de columnas

**Decisión**: un solo formato, tres separadores admitidos (`;`, `,`, tabulación),
autodetectados. Encabezado obligatorio, orden de columnas libre, nombres sin acentos
ni mayúsculas obligatorias.

```
dia;inicio;fin;ramo;tipo;codigo;seccion;sala;docente
LUN;08:00;09:30;Cálculo I;CLASE;525101;1;Aula 201;
LUN;09:45;10:30;Física I;CLASE;;;Lab. Física;
MIE;11:50;13:20;Bloque protegido FI;PROTEGIDO;;;;
```

| Columna | Obligatoria | Acepta |
|---------|-------------|--------|
| `dia` | sí | `LUN` `MAR` `MIE` `JUE` `VIE`, nombre completo con o sin acento, o `1`–`5` |
| `inicio` / `fin` | sí | `HH:MM` o `H:MM`, 24 horas |
| `ramo` | sí | texto libre; es el nombre que se ve en el bloque |
| `tipo` | no | `CLASE` (por defecto), `PROTEGIDO`, `LIBRE` |
| `codigo` | no | código de asignatura |
| `seccion` | no | sección |
| `sala` | no | sala o laboratorio |
| `docente` | no | nombre del profesor |

**Rationale**: la tabulación como separador es lo que convierte "leer un txt con un
formato específico" y "leer un Excel" en el **mismo** problema: al copiar celdas
desde cualquier planilla, el portapapeles entrega las columnas separadas por
tabulaciones. Aceptando ese separador, pegar la selección funciona sin que el usuario
convierta nada ni sepa qué es un CSV — que es exactamente el objetivo del Principio
VI. `js/csv-utils.js:30` ya autodetecta `;` frente a `,`; añadir la tabulación es una
línea.

El encabezado obligatorio con orden libre evita el modo de fallo más común de estos
formatos: alguien intercala una columna y todas las filas se desplazan en silencio.

Se permiten alias en los nombres de columna (`asignatura` → `ramo`, `hora_inicio` →
`inicio`, `día` → `dia`) porque el coste es un diccionario y el beneficio es que la
planilla que el centro ya tiene probablemente funcione sin editar el encabezado.

**Alternativas descartadas**:
- *Posición fija sin encabezado*: frágil e imposible de diagnosticar.
- *Un formato propio de MapFI*: nadie lo tiene ya escrito.
- *Detectar el formato de la Dirección de Docencia*: no se dispone de una muestra
  real; se deja para cuando exista una, sobre este mismo importador.

---

## R-7 · Autorización por carrera propia

**Decisión**: `usuario.entidad_id → entidad.carrera_id`, comparado contra el
`carreraId` de la operación. Se resuelve en el servidor con una consulta al DAO de
entidades; no se confía en nada que envíe el cliente.

**Rationale**: la relación **ya existe** en el esquema
(`001_schema_inicial.sql:32`, `carrera_id SMALLINT REFERENCES carrera(id)`) y **ya
está poblada** para los 14 centros (`002_seed_catalogos.sql:44`). No hace falta
migración para esto. Vinculación, Gearbox y la Dirección de Docencia tienen
`carrera_id NULL`, y ese NULL es precisamente lo que implementa FR-023: sin carrera
asociada, ninguna comparación resulta verdadera y no pueden editar horario alguno.

La jerarquía se resuelve con el `cumpleRol()` que ya existe (`server.js:239`): ADMIN
y SUPERADMIN pasan por `esAdministrador()`; el APORTANTE cae en la comprobación de
carrera. Se añade un helper `puedeEditarHorario(user, carreraId)` para que la regla
viva en un solo lugar y las cuatro rutas de escritura la compartan.

**Nota sobre D-2**: el mismo defecto que se corrigió en `server.js` durante la
Spec 002 —comparar `rol === "ADMIN"` con igualdad estricta— sigue presente en
`horarios.html:66`. Es un recordatorio de que una jerarquía de roles hay que
propagarla a **todos** los puntos de comprobación, no solo a los del backend.

---

## R-8 · Impresión

**Decisión**: bloque `@media print` en `css/design-system.css`, con
`print-color-adjust: exact`, orientación horizontal sugerida vía `@page` y una
cabecera de impresión oculta en pantalla que se revela al imprimir.

**Rationale**: por defecto los navegadores eliminan los fondos al imprimir para
ahorrar tinta. Como en este horario **el color es la información** (FR-007: el tipo
de bloque se distingue por color), sin `print-color-adjust: exact` la hoja sale con
rectángulos blancos indistinguibles. Es la única propiedad imprescindible aquí; el
resto —ocultar navegación, filtros y formularios— es aplicar `display: none` a los
elementos que no son el horario.

La cabecera de impresión (carrera · generación · fecha · filtro aplicado) es
necesaria porque una hoja pegada en un mural pierde todo el contexto que en pantalla
aportan los selectores. `@page { size: landscape; margin: 12mm }` da a las cinco
columnas el ancho que necesitan; el navegador puede ignorarlo, y en ese caso la
grilla sigue siendo legible en vertical.

No se genera PDF en el servidor: `window.print()` produce PDF en cualquier navegador
moderno mediante "Guardar como PDF", sin código ni dependencia. (El proyecto ya usa
`pdfkit` para los reportes de analítica; extenderlo al horario sería duplicar en el
servidor algo que el navegador ya hace mejor, y contradice el espíritu del
Principio I.)

---

## R-9 · Retirar los bloques de muestra sin violar el Principio V

**Decisión**: migración `016_limpiar_horario_muestra.sql` que borra **exactamente**
las siete filas sembradas por la migración 002, comparando todas sus columnas.

**Rationale**: el Principio V prohíbe editar una migración ya aplicada, de modo que no
se puede tocar el `INSERT` de 002 — y aunque se pudiera, no ayudaría a los
despliegues donde ya se aplicó. Una migración nueva es el mecanismo correcto.

La clave está en el criterio de borrado: comparar las siete tuplas **completas**
(carrera, nivel, día, hora de inicio, hora de término, tipo y descripción) en lugar de
borrar por segmento. Así, si alguien ya editó el horario de Industrial 1.er año, o
cargó ahí datos reales, la migración no los toca: solo desaparece lo que sigue siendo
literalmente el dato de muestra. Es idempotente por construcción — al segundo pase no
queda nada que coincida.

Que estas filas sean datos de ejemplo no es especulación: la propia migración las
rotula "Datos de muestra para validar la vista de Horarios. Edítalos o elimínalos"
(`002_seed_catalogos.sql:94`).

**Alternativas descartadas**:
- *`DELETE FROM bloque_horario WHERE carrera_id = 6 AND nivel = 1`*: borraría el
  horario real de ese curso si ya lo hubieran cargado.
- *No migrar y dejar que cada administrador limpie a mano*: FR-004 pide que un
  despliegue nuevo no nazca sucio; además el usuario reportó esto como un defecto,
  no como una tarea suya.
- *Marcar las filas con una bandera `es_muestra`*: columna nueva de valor permanente
  cero una vez resuelto el problema.

---

## R-10 · Impacto sobre el algoritmo de match

**Hallazgo**, no decisión: `js/services/matchService.js:125` recorre los bloques del
segmento y penaliza las actividades que chocan con un bloque `PROTEGIDO`
(`P_PROTEGIDO`). Al eliminar el "Bloque protegido FI" de muestra, el match dejará de
reportar ese choque en Industrial 1.er año.

Es el comportamiento correcto —estaba penalizando contra un dato inventado— pero
conviene anticiparlo: quien haya visto esa recomendación notará el cambio. Las
pruebas de `matchService` usan datos de prueba propios y no leen la base, así que la
suite no se ve afectada.

Consecuencia de diseño: la importación de horarios pasa a ser una **entrada directa
al motor de recomendación**. Un horario bien cargado mejora las sugerencias de fecha;
uno mal cargado las empeora. Refuerza la decisión de validar con vista previa
(FR-013) en lugar de importar a ciegas.
