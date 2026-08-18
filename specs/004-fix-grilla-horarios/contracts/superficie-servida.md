# Contrato · Qué se sirve al navegador y qué no

**Feature**: `004-fix-grilla-horarios` | **Fecha**: 2026-08-18

Este es el contrato que la Spec 003 rompió sin darse cuenta. Se escribe explícitamente para que
la próxima vez sea una regla consultable y no una afirmación en un comentario.

## La regla

**La ubicación del archivo decide si es público.** No hay excepciones por nombre.

| Ruta | ¿Se sirve? | Para qué es |
|---|---|---|
| `js/*.js` (raíz) | **Sí** | Código de navegador: vistas, cliente de API, iconos, saneado. |
| `js/views/*.js` | **Sí** | Vistas de página. |
| `js/vendor/*` | **Sí** | Dependencias vendoreadas (FullCalendar). |
| `js/shared/*.js` | **Sí** | **Módulos isomorfos**: corren en navegador *y* servidor. |
| `js/services/*.js` | **No — 404** | Lógica de negocio de servidor. |
| `js/dao/*.js` | **No — 404** | SQL. |
| `js/db/*.js` | **No — 404** | Migraciones, seeds, importadores CLI. |
| `db/**` | **No — 404** | Archivos `.sql`. |
| `server.js`, `jest.setup.js` | **No — 404** | |
| `package.json`, `package-lock.json` | **No — 404** | |
| `Dockerfile`, `docker-compose*.yml`, `run.sh` | **No — 404** | |
| `specs/**`, `__tests__/**`, `docs/**`, `coverage/**` | **No — 404** | |
| Cualquier dotfile | **No** | `express.static` con `dotfiles: "deny"`. |

Implementado en `server.js` con `RUTAS_SOLO_BACKEND` **antes** de `express.static(__dirname)`.
`js/shared/` no aparece en la lista porque **no está bloqueada**: se sirve por ser parte de
`js/` y no coincidir con ningún patrón.

## Qué cuenta como módulo isomorfo

Los tres requisitos, todos obligatorios:

1. **Es puro.** Sin I/O, sin red, sin base de datos, sin `fs`, sin `pg`. Recibe datos y devuelve
   datos. (Principio II de la constitución.)
2. **Exporta a los dos lados**, con el envoltorio UMD que el proyecto ya usa:
   ```js
   (function (global) {
     "use strict";
     // …
     global.NombreDelServicio = api;
     if (typeof module !== "undefined" && module.exports) module.exports = api;
   })(typeof window !== "undefined" ? window : globalThis);
   ```
3. **No contiene nada que no deba ser público.** Si publicarlo revela una regla de negocio que
   protege algo — puntuaciones, umbrales de moderación, criterios de autorización — **no va en
   `js/shared/`**: se calcula en el servidor y se expone por `/api/*`, como hace el mapa de calor.

Un módulo que cumple 1 y 2 pero no 3 se queda en `js/services/`.

## Inventario actual

**Isomorfo (1):**

| Módulo | Qué expone | Quién lo usa |
|---|---|---|
| `js/shared/horarioService.js` | `HorarioService` / `module.exports` — `geometria`, `aMinutos`, `aHHMM`, `disponibilidad`, `mejoresFranjas`, `HORA_INICIO`, `HORA_FIN`, `PASO`, `FILAS` | `horarios.html` (navegador) · `server.js:43` (valida horas en `POST /api/bloques/importar`) · `__tests__/services/horarioService.test.js` |

**Solo servidor (9)** — siguen en `js/services/` y siguen devolviendo 404:
`heatmapService`, `holidayService`, `horarioCarrera`, `horarioFiParser`, `horarioMalla`,
`icsService`, `matchService`, `reportService`, `reputationService`.

Dos merecen mención porque son la razón de que la carpeta no se abra en bloque:

- **`matchService`** — el algoritmo de compatibilidad, con sus penalizaciones y pesos. Publicarlo
  permitiría fabricar una actividad optimizada contra el puntaje.
- **`reportService`** — agregaciones y criterios de reporte.

## La API pública de `horarioService` no cambia

La firma del módulo es idéntica antes y después del movimiento: mismas funciones, mismas
constantes, mismo comportamiento. Solo cambia la ruta desde la que se carga. El contrato de la
Spec 003 (`specs/003-gestion-horarios/contracts/api-horarios.md`, sección *"Contrato interno ·
js/services/horarioService.js"*) sigue vigente palabra por palabra; solo queda desactualizada su
ruta.

## Cómo se comprueba

Contra `server.js` corriendo — **no** contra un servidor estático, que serviría las dos y no
demostraría nada:

```bash
curl -s -o /dev/null -w "shared   %{http_code}\n" http://localhost:3000/js/shared/horarioService.js
```

```bash
curl -s -o /dev/null -w "services %{http_code}\n" http://localhost:3000/js/services/matchService.js
```

```bash
curl -s -o /dev/null -w "dao      %{http_code}\n" http://localhost:3000/js/dao/actividadDao.js
```

Esperado: `200`, `404`, `404`.

## Al añadir un módulo nuevo

Una pregunta, dos respuestas:

- **¿Lo carga un `<script src>` de alguna página?** → `js/` o `js/shared/` según si también corre
  en el servidor. Y compruébalo pidiendo la URL a `server.js`, no a un servidor estático.
- **¿Solo lo hace `require()` el backend?** → `js/services/`, `js/dao/` o `js/db/`. Queda
  bloqueado automáticamente.
