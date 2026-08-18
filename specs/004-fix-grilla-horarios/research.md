# Phase 0 · Investigación — Grilla de horarios bloqueada en producción

**Feature**: `004-fix-grilla-horarios` | **Fecha**: 2026-08-18

---

## R-1 · Confirmación de la causa raíz

**Hecho, no hipótesis.** Se evaluó la regex real de `server.js:1333` contra las rutas que carga
`horarios.html`:

```js
const RE = /^\/js\/(dao|services|db)\//i;
RE.test("/js/services/horarioService.js")  // true  → 404
RE.test("/js/horario-csv.js")              // false → servido
RE.test("/js/heatmap-view.js")             // false → servido
```

Y se localizó al único infractor en todo el frontend:

```
$ grep -n 'src="js/\(dao\|services\|db\)/' *.html
horarios.html:162:  <script src="js/services/horarioService.js"></script>
```

La cadena de fallo, con líneas exactas:

| # | Dónde | Qué pasa |
|---|---|---|
| 1 | `horarios.html:162` | El navegador pide `/js/services/horarioService.js` |
| 2 | `server.js:1340-1345` | El middleware lo bloquea y responde 404 |
| 3 | — | `window.HorarioService` queda `undefined` |
| 4 | `js/horarios-view.js:201` | `HS().geometria(bloquesCrudos)` lanza TypeError |
| 5 | `horarios.html` | `render()` queda rechazada; la grilla no se pinta |

El paso 4 es el que mata la vista: `HS()` es `() => global.HorarioService`, y llamar `.geometria`
sobre `undefined` es un TypeError, no un fallo silencioso. En la consola del servidor real debe
verse tanto el 404 del script como el TypeError.

---

## R-2 · Por qué el mapa de calor no se ve afectado

Es la observación que más ayudó a acotar el problema, y merece quedar escrita porque explica una
diferencia de arquitectura entre las dos páginas:

| | Horarios | Mapa de calor |
|---|---|---|
| Script de vista | `js/horarios-view.js` (servido) | `js/heatmap-view.js` (servido) |
| ¿Necesita un módulo de `js/services/` en el navegador? | **Sí** (`horarioService`) | **No** |
| Dónde se calcula la rejilla | En el **navegador** | En el **servidor** (`/api/heatmap/semana`) |

El mapa de calor pide una rejilla ya calculada; Horarios pide bloques crudos y los coloca él mismo.
Por eso uno sobrevive al bloqueo y el otro no.

---

## R-3 · Dónde poner un módulo que corre en los dos lados

**Decisión: carpeta `js/shared/`, servida al navegador.**

`js/services/` queda estrictamente de servidor y sigue bloqueada. `js/shared/` es para lo isomorfo
y se sirve. La regla pasa a ser posicional: **un archivo es público si vive en un sitio público**,
en vez de depender de que alguien recuerde una lista de excepciones.

**Rationale.** El comentario del propio `server.js` dice *"Se comprobó que ninguna página carga
js/dao, js/services ni js/db antes de cerrarlas"* — una invariante verificada una vez, en 2026-08-04,
y que nada impedía romper después. Se rompió. Una lista de excepciones (`salvo horarioService.js`)
volvería a apoyarse en la memoria de quien edite; una convención de carpetas se hace evidente al
mirar el árbol del proyecto.

**Alcance real: un archivo.** Se auditaron los diez módulos de `js/services/` buscando exportación
al navegador:

| Módulo | Exporta a `window` | Destino |
|---|---|---|
| `horarioService.js` | **Sí** (UMD) | → `js/shared/` |
| `heatmapService`, `holidayService`, `horarioCarrera`, `horarioFiParser`, `horarioMalla`, `icsService`, `matchService`, `reportService`, `reputationService` | No | se quedan en `js/services/` |

Mover solo uno mantiene el bloqueo cerrado sobre los otros nueve. Mover la carpeta entera reabriría
SEG-2: publicaría `matchService` (el algoritmo de compatibilidad) y `reportService`, entre otros.

**Alternativas descartadas**:

- *Excepción en la lista de bloqueo* (`!/horarioService\.js$/`): tres líneas y funciona hoy, pero el
  siguiente módulo compartido vuelve a fallar igual, y el fallo solo aparece en producción.
- *Duplicar el archivo* (una copia en `js/` para el navegador, otra en `js/services/` para Node):
  dos copias de la misma aritmética de horas divergen en cuanto alguien corrija una sola.
- *Mover todo el frontend a `public/`*: es el arreglo de fondo que el propio código dejó anotado
  como pendiente, y elimina la lista de bloqueo entera. Se descarta **para esta corrección** porque
  toca las 12 páginas, el `Dockerfile`, el `.dockerignore` y todas las rutas relativas — demasiada
  superficie para arreglar una página caída. Queda propuesto como trabajo aparte.
- *Calcular la geometría en el servidor*, como hace el mapa de calor: eliminaría la dependencia del
  navegador, pero convierte cada cambio de filtro en una petición y descarta un servicio puro que ya
  está probado con 40 pruebas.

---

## R-4 · Riesgo de la operación de movimiento

Mover un archivo con tres referencias es de bajo riesgo, y las tres son verificables antes de
desplegar:

| Referencia | Archivo | Cómo se comprueba |
|---|---|---|
| `require("./js/services/horarioService")` | `server.js:43` | `npm test` (rutas de importación) |
| `require("../../js/services/horarioService")` | `__tests__/services/horarioService.test.js:6` | la propia suite, 40 pruebas |
| `<script src="js/services/horarioService.js">` | `horarios.html:162` | pidiendo la URL a `server.js` |

El módulo no cambia por dentro: mismo contenido, misma doble exportación, mismas constantes. Solo
cambia su ruta.

---

## R-5 · Verificación con el servidor real, no con uno estático

**Este es el aprendizaje que evita repetir el fallo.** La comprobación en navegador de la Spec 003
se hizo con `python -m http.server`, que sirve cualquier archivo del árbol. Ese servidor **no tiene**
la lista de bloqueo, así que el 404 era invisible en local.

La verificación de esta corrección debe hacerse **contra `server.js`**, aunque sea sin base de
datos. Basta con pedir la URL del script y mirar el código de estado:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/js/shared/horarioService.js   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/js/services/matchService.js   # 404
```

Un servidor estático habría dado 200 en las dos y no habría demostrado nada.

**Nota sobre la prueba de contención.** Se propuso una prueba automatizada que recorriera todos los
`<script src>` de cada HTML y comprobara que el servidor los sirve. El usuario decidió dejarla fuera
de alcance. Sin ella, el mismo error puede reintroducirse y volvería a detectarse solo en
producción; queda anotado aquí para que la decisión esté registrada, no para insistir en ella.

---

## R-6 · El horario vacío es OTRO problema

Conviene separarlo para no confundir dos síntomas:

| Síntoma | Causa | Se arregla con |
|---|---|---|
| La grilla **no se dibuja** | 404 del script (este documento) | Esta corrección |
| La grilla se dibuja **vacía** | `bloque_horario` sin datos | Ejecutar `js/db/importar-horarios.js` |

Tras esta corrección, un segmento sin datos mostrará la grilla de 08:00 a 21:00 con el mensaje
"Este segmento aún no tiene horario cargado". Eso es correcto, y distinto de la página muerta que
se ve ahora.

La carga de datos la ejecuta el usuario en su servidor: este entorno no tiene acceso a esa máquina
ni Docker disponible. Los comandos están en `quickstart.md`.
