# Implementation Plan: La grilla de horarios no se dibuja en producción

**Branch**: `004-fix-grilla-horarios` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-fix-grilla-horarios/spec.md`

## Summary

La página de Horarios está caída en el servidor de la Facultad. La causa está confirmada: la
lista `RUTAS_SOLO_BACKEND` de `server.js` responde **404** a todo lo que cuelga de
`js/dao/`, `js/db/` y `js/services/` — es el arreglo del hallazgo de seguridad SEG-2 — y la
Spec 003 añadió a `horarios.html` un `<script src="js/services/horarioService.js">` que cae
justo dentro de ese bloqueo. Sin ese script, `window.HorarioService` no existe y
`HorariosView.montar()` revienta con TypeError antes de pintar nada.

**El arreglo es mover un archivo, no debilitar el bloqueo.** Se crea `js/shared/` para los
módulos que corren en navegador *y* servidor, y `horarioService.js` se muda allí.
`js/services/` queda estrictamente de servidor y sigue devolviendo 404. La regla pasa a ser
posicional — un archivo es público si vive en una carpeta pública — en vez de depender de que
alguien recuerde una lista de excepciones.

Es un cambio de cuatro líneas repartidas en cuatro archivos, más el movimiento del módulo. El
módulo no se toca por dentro.

## Technical Context

**Language/Version**: Node.js 20 + JavaScript vanilla (CommonJS en servidor, UMD en el módulo compartido)

**Primary Dependencies**: Express 4 (`express.static` y el middleware de bloqueo). Ninguna nueva.

**Storage**: PostgreSQL 16 — **no se toca**. Sin migraciones.

**Testing**: Jest. Línea base **472 pruebas en verde**; `__tests__/services/horarioService.test.js` aporta 40.

**Target Platform**: Contenedor Docker servido por `server.js`. **Es la plataforma donde el defecto existe**: un servidor estático no lo reproduce.

**Project Type**: Aplicación web sin build, servida desde la raíz del repositorio.

**Performance Goals**: N/A — no cambia ninguna ruta caliente.

**Constraints**: FR-002 es la restricción dura — `js/dao/`, `js/db/` y `js/services/` DEBEN seguir devolviendo 404. Cualquier diseño que los abra queda descartado.

**Scale/Scope**: 1 archivo movido · 4 referencias actualizadas · 1 guard con su prueba · 1 entrada de namespace · 3 comentarios y 1 línea de documentación al día · 0 cambios de esquema · 0 dependencias nuevas.

## Constitution Check

*GATE: pasa antes de la Fase 0 y se vuelve a comprobar tras la Fase 1.*

| Principio | Veredicto | Justificación |
|---|---|---|
| **I · Simplicidad sin build** | Refuerza | Sin bundler, sin dependencias, sin paso de compilación. El módulo sigue siendo un `<script>` plano. La convención de carpeta es más simple que una excepción en una regex. |
| **II · Arquitectura por capas** | Aclara | Hoy `js/services/` mezcla nueve módulos de servidor con uno que también corre en el navegador. Separarlos hace la capa **más** honesta, no menos. El navegador sigue sin tocar la base de datos: `horarioService` es aritmética de horas pura, sin I/O. |
| **III · Seguridad por defecto** | Refuerza | Se publica un módulo que ya se pretendía público (por eso está escrito en UMD) y que no contiene lógica sensible: constantes de rejilla y colocación de bloques. Los otros nueve servicios — incluidos `matchService` y `reportService` — siguen bloqueados. Es exactamente la garantía de la **Propuesta 2** de la constitución: *"solo se sirven al navegador los archivos que el navegador necesita"*. Esta corrección la hace verificable por la estructura de carpetas. |
| **IV · Calidad verificada** | Parcial, decidido por el usuario | Las 472 pruebas siguen corriendo, se añade la del guard de FR-006, y la verificación en navegador se hará **contra `server.js`**, no contra un servidor estático (fue precisamente el atajo que ocultó el fallo). La prueba automatizada de contención que cerraría el hueco quedó **fuera de alcance por decisión del usuario** — anotado en Complexity Tracking. |
| **V · Migraciones aditivas** | No aplica | Ninguna migración. |
| **VI · UX sin capacitación** | Restaura y mejora | Devuelve una página que hoy no funciona, sin cambios visuales en el caso normal. El guard de FR-006 cumple la exigencia de *mensajes de error claros y accionables*: hoy el fallo es una zona en blanco. |
| **Namespace de cliente** (Restricciones técnicas) | Corrige | `js/app-boot.js:19-24` lista `HorariosView` pero no `HorarioService`. FR-007 lo añade, aprovechando que el módulo se toca de todos modos. |

**Resultado**: pasa. La única desviación es la prueba de contención, decidida por el usuario y registrada abajo.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-grilla-horarios/
├── plan.md              # Este archivo
├── spec.md              # El defecto y sus criterios de aceptación
├── research.md          # Fase 0 · causa raíz verificada y alternativas
├── contracts/
│   └── superficie-servida.md   # Fase 1 · qué se sirve y qué no
├── quickstart.md        # Fase 1 · cómo verificarlo (y cómo cargar el horario)
└── tasks.md             # Fase 2 — lo genera /speckit-tasks, no este comando
```

No hay `data-model.md`: **la corrección no toca el modelo de datos.** Ni tablas, ni columnas,
ni migraciones. La única entidad en juego es la clasificación de un archivo como público o de
servidor, y eso vive en `contracts/superficie-servida.md`.

### Source Code (repository root)

```text
js/
├── shared/                     # NUEVA · se sirve al navegador
│   └── horarioService.js       # MOVIDO desde js/services/ · sin cambios internos
├── services/                   # solo servidor · sigue devolviendo 404
│   ├── heatmapService.js
│   ├── holidayService.js
│   ├── horarioCarrera.js
│   ├── horarioFiParser.js
│   ├── horarioMalla.js
│   ├── icsService.js
│   ├── matchService.js
│   ├── reportService.js
│   └── reputationService.js
├── dao/                        # solo servidor · 404
├── db/                         # solo servidor · 404
└── *.js                        # navegador · se sirven

server.js                       # linea 43: la ruta del require
horarios.html                   # linea 162: la ruta del script
__tests__/services/horarioService.test.js   # linea 6: la ruta del require
docs/GUIA_TECNICA.md            # linea 149: el arbol documentado
```

**Structure Decision**: se introduce **una** carpeta, `js/shared/`, y se mueve **un** archivo.
No se toca `Dockerfile` (su `COPY . .` la incluye sola) ni `.dockerignore` (no excluye `js/`).
El archivo de pruebas **no se mueve**: `__tests__/services/` ya no es un espejo estricto de
`js/services/` — ahí conviven las pruebas de `js/sanitize.js`, `js/csv-utils.js` y `fechas`,
que son de la raíz de `js/`. Moverlo sería inventar una convención que el proyecto no sigue.

### Cambios, uno por uno

| # | Archivo | Cambio |
|---|---|---|
| 1 | `js/services/horarioService.js` -> `js/shared/horarioService.js` | `git mv`. Contenido idéntico. |
| 2 | `server.js:43` | `require("./js/services/horarioService")` -> `require("./js/shared/horarioService")` |
| 3 | `__tests__/services/horarioService.test.js:6` | `require("../../js/services/horarioService")` -> `require("../../js/shared/horarioService")` |
| 4 | `horarios.html:162` | `src="js/services/horarioService.js"` -> `src="js/shared/horarioService.js"` |
| 5 | `server.js` (comentario de `RUTAS_SOLO_BACKEND`) | Reemplazar la afirmación caducada *"se comprobó que ninguna página carga…"* por la regla vigente: `js/shared/` es para lo isomorfo; `js/dao`, `js/db` y `js/services` no se sirven **nunca**. Dejar escrito que esta lista ya se rompió una vez y cómo. |
| 6 | `js/horarios-view.js` (**FR-006**) | Guard al principio de `montar()`: si `HS()` no existe, pintar un mensaje visible con qué pasó y qué hacer, y `console.error` con la ruta que no cargó. Sustituye al TypeError silencioso de la línea 201. |
| 7 | `js/app-boot.js:19-24` (**FR-007**) | Añadir `"HorarioService"` a `MODULOS`, junto a `HorariosView`, que ya está. |
| 8 | `__tests__/services/horarioService.test.js` o el de la vista | Prueba del guard: con el módulo ausente, `montar()` no lanza y deja el mensaje en el DOM. |
| 9 | `js/horarios-view.js:5`, `js/services/heatmapService.js:38`, `js/services/horarioFiParser.js:28` | Tres comentarios que citan la ruta vieja. |
| 10 | `docs/GUIA_TECNICA.md:149` | Mover la línea del árbol a la carpeta nueva y explicar la convención. |

El orden importa poco salvo en un punto: **el paso 5 no es cosmético.** El comentario actual
afirma una invariante que ya es falsa, y fue esa afirmación la que hizo que añadir el script
de la Spec 003 pareciera inofensivo.

El paso 6 es el que cambia el carácter del arreglo: sin él corregimos *este* fallo; con él,
cualquier fallo futuro de carga de módulo se explica solo en vez de manifestarse como una página
muerta. Es la diferencia entre arreglar el síntoma y hacerlo diagnosticable.

## Complexity Tracking

| Desviación | Por qué se acepta | Alternativa descartada, y por qué |
|---|---|---|
| **No se añade la prueba de contención** (recorrer los `<script src>` de cada HTML y comprobar que `server.js` los sirve) | El usuario decidió limitar el alcance a la corrección. Es su llamada y queda registrada. | Esa prueba habría convertido este fallo en un error de CI en vez de un fallo de producción. Sin ella, la convención de carpetas es la única defensa: real, pero no automática. Si el mismo problema reaparece, este es el primer sitio donde mirar. |

## Cuándo está cerrada

**Al confirmarse en el servidor de la Facultad, no al mergear.** SC-003 es la puerta. El PR puede
estar mergeado, las 472 pruebas en verde y los `curl` locales correctos, y la spec sigue abierta
hasta que el usuario confirme que la grilla se dibuja en ese servidor.

No es burocracia: este defecto **solo existe en producción**. Cerrarlo antes sería repetir
exactamente el error que lo causó — dar por bueno lo que un servidor que no aplica la lista de
bloqueo dijo que funcionaba. La verificación la hace el usuario porque este entorno no tiene acceso
a esa máquina.

## Fuera de alcance

- **Mover el frontend a `public/`**, que eliminaría la lista de bloqueo entera. Es el arreglo
  de fondo que el propio `server.js` deja anotado como pendiente; toca 12 páginas, el
  `Dockerfile` y todas las rutas relativas. Demasiada superficie para levantar una página caída.
- **Cargar el horario en la base de datos.** Es un problema distinto con el mismo síntoma
  aparente: con esta corrección la grilla se dibuja, pero saldrá vacía hasta que se ejecute
  `js/db/importar-horarios.js`. Los pasos están en [quickstart.md](./quickstart.md) y los
  ejecuta el usuario en su servidor.
