# Tasks: La grilla de horarios no se dibuja en producción

**Feature**: `004-fix-grilla-horarios` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Un solo user story (US1, P1), así que no hay fases por historia: es una corrección con
verificación. Los `[P]` pueden ir en paralelo porque tocan archivos distintos.

**Restricción dura**: FR-002. Ninguna tarea puede hacer que `js/dao/`, `js/db/` o `js/services/`
dejen de devolver 404.

---

> **Estado 2026-08-18**: T001-T020 completadas y verificadas. Queda **T021**, la puerta de cierre,
> que la ejecuta el usuario en el servidor de la Facultad.

## Fase 1 · Preparación

- [X] **T001** Rama `004-fix-grilla-horarios` creada desde el estado que ya contiene lo mergeado de
      la Spec 003.
- [X] **T002** Línea base conocida: **472** pruebas. Tras el cambio: **479** (472 + 7 nuevas).

## Fase 2 · El movimiento (FR-001, FR-003, FR-004)

Secuencial: T004 y T005 dependen de que el archivo ya esté en su sitio nuevo.

- [X] **T003** Módulo movido a `js/shared/horarioService.js`; el de `js/services/` eliminado.
      Código idéntico: misma API, mismas constantes, mismo envoltorio UMD. Solo se amplió el
      encabezado para explicar por qué vive en `shared/`.
- [X] **T004** [P] `server.js:43` → `require("./js/shared/horarioService")`.
- [X] **T005** [P] `__tests__/services/horarioService.test.js:6` →
      `require("../../js/shared/horarioService")`. El archivo de pruebas **no se movió**
      (ver Structure Decision del plan).
- [X] **T006** [P] `horarios.html:162` → `src="js/shared/horarioService.js"`.
- [X] **T007** `npm test` en verde. La suite de `horarioService` (40 pruebas) importa desde la ruta
      nueva sin problema.

## Fase 3 · Cerrar la puerta que se dejó abierta

- [X] **T008** `server.js` — reescrito el comentario de `RUTAS_SOLO_BACKEND` (líneas 1327-1331).
      Quitar la afirmación caducada *"Se comprobó que ninguna página carga js/dao, js/services ni
      js/db"* — es falsa desde la Spec 003 — y poner la regla vigente: `js/shared/` es para lo
      isomorfo y se sirve; `js/dao`, `js/db` y `js/services` no se sirven nunca. Dejar dicho que
      esta lista ya se rompió una vez y cómo, para que el próximo no repita el error.
      **La lista de regexes no se toca.**

## Fase 4 · El fallo deja de ser mudo (FR-006)

TDD: la prueba primero, porque el guard solo se puede comprobar provocando la ausencia.

- [X] **T009** `__tests__/horarios-view.test.js` (nuevo, 7 pruebas): sin `HorarioService`, `montar()`
      no lanza, deja mensaje visible, registra la ruta en consola y devuelve la forma vacía; con el
      módulo presente el guard **no** se dispara y los mensajes normales siguen saliendo.
      Sin jsdom: al guard le basta un objeto con `innerHTML` (Principio I, cero dependencias nuevas).
- [X] **T010** `js/horarios-view.js` — `avisoSinModulo()` + guard al principio de `montar()`,
      **antes** de la comprobación de selección: si la página está rota conviene decirlo en el
      primer render, no después de rellenar los filtros. Texto fijo sin interpolar datos de usuario,
      así que no hay superficie de XSS. Se añadió `module.exports` (patrón de `js/horario-csv.js`)
      para poder probarlo desde Node.
- [X] **T011** Las 7 pruebas nuevas pasan y las 472 anteriores siguen en verde: **479/479**.

## Fase 5 · Namespace y comentarios (FR-007)

- [X] **T012** [P] `js/app-boot.js` — `"HorarioService"` añadido al array `MODULOS`, junto a
      `HorariosView`. Cumple la restricción "Namespace de cliente" de la constitución.
- [X] **T013** [P] Rutas viejas corregidas en `js/horarios-view.js:5`,
      `js/services/heatmapService.js:38` y `css/design-system.css:334` (esta última no estaba en el
      plan; apareció al barrer el árbol completo). `js/services/horarioFiParser.js:28` no hacía
      falta: nombra el módulo sin ruta.
- [X] **T014** [P] `docs/GUIA_TECNICA.md` — árbol actualizado con `js/shared/` y sección nueva
      *"La carpeta decide si un archivo es público"* con la tabla de qué se sirve y la advertencia
      de comprobar contra `server.js`, no contra un servidor estático.

## Fase 6 · Verificación (SC-001, SC-002, SC-005)

- [X] **T015** `npm test` **479/479** y `npm run test:tz` **479/479** (TZ=UTC), 22 suites.
- [X] **T016** `node --check` limpio en `server.js`, `js/horarios-view.js`, `js/app-boot.js`,
      `js/shared/horarioService.js` y `__tests__/horarios-view.test.js`.
- [X] **T017** **Servido por `server.js`**, no por un servidor estático — el paso que se saltó la
      vez anterior. Arrancado con `DATABASE_URL="" NODE_ENV=test PORT=3199 node server.js`
      (la cadena vacía hace `HAS_DB` falso y `load-env` no la pisa, porque solo rellena claves
      ausentes). Códigos observados:

      | Ruta | Código |
      |---|---|
      | `js/shared/horarioService.js` | **200** (`application/javascript`, archivo completo) |
      | `js/horarios-view.js`, `js/app-boot.js`, `js/heatmap-view.js` | 200 |
      | `js/services/matchService.js`, `heatmapService.js`, `horarioService.js` | **404** |
      | `js/dao/actividadDao.js`, `js/db/migrate.js` | **404** |
      | `server.js`, `package.json` | **404** |

      El 404 de `js/services/horarioService.js` confirma además que el archivo viejo ya no existe
      y que, de existir, seguiría bloqueado.
- [X] **T018** Navegador real sobre ese servidor: `window.HorarioService` es un objeto con
      `geometria`, `HORA_INICIO=480` y `FILAS=52`; `MapFI.HorarioService` resuelve (FR-007);
      `document.scripts` carga `js/shared/horarioService.js`. **Sin 404 en consola** — solo un 500
      de la API, esperable porque se arrancó sin Postgres.
- [X] **T019** Guard comprobado rompiéndolo a propósito en el navegador: con
      `delete window.HorarioService`, `montar()` **no lanza**, devuelve
      `{secciones:[],ramos:[],carreras:[]}` y deja el texto *"No se pudo cargar el módulo de
      horarios. Recarga la página. Si sigue igual, avisa a tu centro de estudiantes o al equipo de
      MapFI e indícales que falta js/shared/horarioService.js."*
- [X] **T020** Sin regresión: los cambios no tocan filtros, multi-carrera, impresión ni mapa de
      calor. La suite completa cubre esas rutas y sigue en verde. **La comprobación visual con datos
      reales queda en T021**, porque este entorno no tiene base de datos.

## Fase 7 · Cierre — lo confirma el usuario

- [ ] **T021** **SC-003, la puerta de cierre.** Desplegar en el servidor de la Facultad y confirmar
      que la grilla se dibuja. Lo ejecuta el usuario: este entorno no tiene acceso a esa máquina.
      Mientras no esté confirmado, la spec sigue abierta aunque el PR esté mergeado.
- [ ] **T022** Aparte de esta spec, pero con el mismo síntoma aparente: cargar el horario con
      `js/db/importar-horarios.js` para que la grilla tenga datos. Pasos en
      [quickstart.md](./quickstart.md), Parte B. También lo ejecuta el usuario.

---

## Dependencias

```
T001 → T002 → T003 → {T004, T005, T006} → T007 → T008
                                            ↓
                                    T009 → T010 → T011
                                            ↓
                              {T012, T013, T014}
                                            ↓
                    T015 → T016 → T017 → {T018, T019, T020}
                                            ↓
                                    T021 (usuario) → T022 (usuario)
```

## Fuera de alcance

- La **prueba de contención** que recorrería los `<script src>` de cada HTML comprobando que el
  servidor los sirve. Decisión explícita del usuario. Sin ella no hay detección automática de una
  recurrencia; el guard de T010 da detección humana, que no es lo mismo.
- Mover el frontend a `public/`.
