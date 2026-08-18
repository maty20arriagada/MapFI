# Feature Specification: La grilla de horarios no se dibuja en producción

**Feature Branch**: `004-fix-grilla-horarios`

**Created**: 2026-08-18

**Status**: Draft

**Input**: Reporte del usuario en producción: *"por alguna razón veo el mapa de calor pero no los
horarios, no me carga el diseño de grilla del horario por más que le dé al botón. ¿Crees que será
un problema netamente porque lo carga el servidor?"*

## El defecto

En el servidor de la Facultad, la página de Horarios no dibuja la grilla. El usuario elige carrera
y año, pulsa **«Ver horario»** y no ocurre nada visible. El mapa de calor, en la misma sesión y
con la misma base de datos, sí funciona.

La intuición del usuario era correcta: **es el servidor**.

## Causa raíz (verificada, no inferida)

`server.js` bloquea con 404 toda ruta que sea código de backend, para que el navegador no pueda
descargarse los DAO, las migraciones ni la lógica de servidor. Es el arreglo del hallazgo SEG-2 de
la revisión de seguridad de 2026-08-04:

```js
// server.js:1332
const RUTAS_SOLO_BACKEND = [
  /^\/js\/(dao|services|db)\//i,   // capa de datos y logica de servidor
  ...
];
app.use((req, res, next) => {
  if (RUTAS_SOLO_BACKEND.some((re) => re.test(req.path))) {
    return res.status(404).json({ error: "No encontrado" });
  }
  next();
});
```

El comentario que acompaña esa lista dice: *"Se comprobó que ninguna página carga js/dao, js/services
ni js/db antes de cerrarlas."* Era cierto cuando se escribió. **La Spec 003 rompió esa invariante**:

```html
<!-- horarios.html:162 -->
<script src="js/services/horarioService.js"></script>
```

Encadenando:

1. El navegador pide `/js/services/horarioService.js`.
2. El middleware lo empareja con `/^\/js\/(dao|services|db)\//i` y devuelve **404**.
3. `window.HorarioService` queda **indefinido**.
4. `js/horarios-view.js:201` ejecuta `HS().geometria(bloquesCrudos)` → **TypeError**.
5. La excepción escapa de `montar()`, `render()` queda rechazada y la grilla nunca se pinta.

Verificado sobre la regex real:

| Ruta | Resultado |
|---|---|
| `/js/services/horarioService.js` | **404 (bloqueado)** |
| `/js/horario-csv.js` | servido |
| `/js/heatmap-view.js` | servido |
| `/js/sanitize.js` | servido |

### Por qué el mapa de calor sí funciona

Dos motivos independientes, y por eso el contraste es tan limpio:

- Su script vive en `js/heatmap-view.js`, fuera del prefijo bloqueado.
- Su rejilla la calcula el **servidor** (`GET /api/heatmap/semana` llama a `heatmapService`), así
  que el navegador no necesita ningún módulo de `js/services/`.

### Por qué no se detectó antes

La verificación en navegador de la Spec 003 se hizo sirviendo el proyecto con
`python -m http.server`, que entrega cualquier archivo del árbol y **no aplica la lista de bloqueo
de Express**. El fallo solo existe cuando quien sirve es `server.js`, es decir, solo en un despliegue
real. Es un defecto de entorno de prueba, no de lógica.

## Clarifications

### Session 2026-08-18

- Q: Cuando falta un módulo de navegador, ¿la página debe decir qué pasó o morir en silencio? → A: Guard + mensaje en pantalla (`console.error` con la ruta que falló, además del mensaje visible)
- Q: ¿Cuándo se considera cerrada la Spec 004? → A: Solo tras confirmarlo en el servidor de la Facultad; el merge no la cierra

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el horario en el servidor de la Facultad (Priority: P1)

Un estudiante entra a Horarios en el despliegue real, elige su carrera y su año, pulsa
«Ver horario» y ve la grilla semanal.

**Why this priority**: es la única historia. La página está inutilizable en producción.

**Independent Test**: se prueba sirviendo con `server.js` (no con un servidor estático), pidiendo
la URL del script y comprobando que devuelve 200 con `Content-Type` de JavaScript, y luego que la
grilla se dibuja en el navegador.

**Acceptance Scenarios**:

1. **Given** el proyecto servido por `server.js`, **When** se pide la ruta del módulo de geometría
   de horarios, **Then** responde **200** y no 404.
2. **Given** la página de Horarios en el servidor real, **When** se elige carrera y año y se pulsa
   «Ver horario», **Then** se dibuja la grilla de 08:00 a 21:00 sin errores en consola.
3. **Given** un segmento sin bloques cargados, **Then** la grilla igual se dibuja, con el mensaje
   "Este segmento aún no tiene horario cargado" — no una página en blanco.
4. **Given** el mismo servidor, **When** se piden rutas de backend
   (`/js/dao/...`, `/js/db/...`, `/js/services/...`), **Then** siguen devolviendo **404**: la
   corrección no puede debilitar SEG-2.
5. **Given** que el módulo de geometría no se carga por cualquier motivo (404, red caída, error de
   sintaxis), **When** se pulsa «Ver horario», **Then** la página muestra un mensaje que dice que
   no se pudo cargar el módulo y qué hacer, y registra en consola la ruta que falló — **no** una
   zona en blanco sin explicación.

### Edge Cases

- **Un módulo compartido futuro**: si mañana otra página necesita lógica que también corre en el
  servidor, debe existir un sitio evidente donde ponerla sin volver a romper nada.
- **El resto de servicios**: los otros 9 módulos de `js/services/` son solo de Node y **deben
  seguir bloqueados**. Mover indiscriminadamente todo sería reabrir SEG-2.
- **Caché del navegador**: tras el arreglo, un navegador que ya cacheó el 404 podría seguir
  fallando; hay que comprobarlo con recarga forzada.
- **El módulo no está disponible**: cubierto por FR-006. El fallo debe ser legible por quien lo
  sufre, no solo por quien abre DevTools. Es la diferencia entre este incidente (una página muerta
  que costó una sesión de depuración) y un aviso que se entiende al leerlo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El módulo de geometría de horarios DEBE ser descargable por el navegador cuando quien
  sirve es `server.js`.
- **FR-002**: `js/dao/`, `js/db/` y `js/services/` DEBEN seguir devolviendo 404 al navegador.
- **FR-003**: El mismo módulo DEBE seguir siendo importable desde Node (`server.js` lo usa para
  validar las horas en `POST /api/bloques/importar`).
- **FR-004**: DEBE existir una ubicación explícita para módulos que corren en navegador **y**
  servidor, de modo que "es público o no" dependa de dónde vive el archivo y no de recordar una
  lista de excepciones.
- **FR-005**: La corrección NO DEBE cambiar el comportamiento de la grilla: mismas horas, misma
  geometría, mismos filtros.
- **FR-006**: Si el módulo de geometría no está disponible en el navegador, la vista DEBE mostrar
  un mensaje visible y accionable en lugar de fallar en silencio, y DEBE registrar en consola la
  ruta que no cargó. Nunca una zona en blanco. (Principio VI: *mensajes de error claros y
  accionables*.)
- **FR-007**: El módulo DEBE quedar accesible por el namespace `MapFI` (`js/app-boot.js`), como
  el resto de los globales del cliente, según la restricción "Namespace de cliente" de la
  constitución. Hoy `HorariosView` está en esa lista y `HorarioService` no.

### Key Entities

- **Módulo isomorfo**: el que se ejecuta en los dos lados. Hoy hay exactamente uno,
  `horarioService` (escrito en formato UMD: `window.HorarioService` + `module.exports`).
  Los otros nueve servicios exportan solo por CommonJS y son de servidor.

## Success Criteria *(mandatory)*

- **SC-001**: Pedir el módulo de geometría al servidor devuelve 200.
- **SC-002**: Pedir cualquier ruta de `js/dao/`, `js/db/` o `js/services/` sigue devolviendo 404.
- **SC-003**: En el despliegue real de la Facultad, pulsar «Ver horario» dibuja la grilla sin
  errores de consola. **Es la puerta de cierre de esta spec**: mientras SC-003 no esté confirmado
  en ese servidor, la corrección no está terminada, aunque el PR esté mergeado y todo lo demás en
  verde. Lo confirma el usuario, porque este entorno no tiene acceso a esa máquina.
- **SC-004**: La suite completa sigue en verde, más las pruebas nuevas del guard de FR-006 (línea
  base actual: 472).
- **SC-005**: Con el módulo ausente a propósito, la página muestra el mensaje de FR-006 en vez de
  quedarse en blanco. Es la única forma de comprobar que el guard funciona: se prueba quitando el
  módulo, no esperando a que falle solo.

## Assumptions

- **Un solo módulo afectado.** Verificado: `grep 'src="js/(dao|services|db)/'` sobre las páginas
  HTML devuelve únicamente `horarios.html:162`.
- **No se añade la prueba de contención.** Se propuso una prueba que recorriera todos los
  `<script src>` de cada HTML comprobando que el servidor los sirve; el usuario decidió dejarla
  fuera de alcance. Sin ella no hay detección *automática* de una recurrencia. Lo que sí queda es
  el guard de FR-006: si vuelve a pasar, la página lo dirá en vez de quedarse muda — detección
  humana en segundos en lugar de una sesión de depuración. No es lo mismo que una puerta de CI, y
  conviene tenerlo claro.
- **Se puede verificar sin Docker.** `server.js` arranca sin Postgres: `HAS_DB` (`server.js:50`)
  desactiva migraciones y el store de sesión, y `js/db/index.js:11` solo aborta si `NODE_ENV` no es
  `test`. Así que SC-001 y SC-002 se comprueban con `NODE_ENV=test node server.js` y cuatro
  `curl` — sin base de datos y sin contenedor. Lo que **no** se puede comprobar así es SC-003.
- **Los horarios aún no están cargados** en la base del servidor. Es un problema **distinto** de
  este: aunque la grilla se dibuje, saldrá vacía hasta que se ejecute el importador. Los pasos van
  en `quickstart.md`, pero los ejecuta el usuario — este entorno no tiene acceso a su servidor.
