---
title: Guía Técnica — MapFI
tags:
  - documentacion
  - desarrollo
  - backend
  - testing
  - guia
date: 2026-07-20
status: verificado
aliases:
  - Guia Tecnica
  - docs-tecnicos
cssclasses:
  - wide-page
---

# 🧰 Guía Técnica — MapFI

Para desarrolladores que van a extender el código. Asume lectura previa de [[ARQUITECTURA|Arquitectura]].

---

## 1. Puesta en marcha para desarrollo

```bash
npm install
npm run docker:db        # Postgres local en :5433
cp .env.example .env
npm run db:migrate
npm run dev              # nodemon, recarga en caliente
npm test                 # Jest
```

---

## 2. Cómo agregar una nueva entidad de datos (patrón)

1. **Migración:** crear `db/migrations/0NN_descripcion.sql` con la tabla (aditiva).
2. **DAO:** crear `js/dao/miEntidadDao.js` con funciones `listar/obtener/crear/actualizar/eliminar` usando consultas parametrizadas y el pool de `js/db`.
3. **Rutas:** en `server.js`, agregar endpoints `/api/mi-entidad` que validen entrada y deleguen al DAO.
4. **Frontend:** consumir vía `js/api-client.js`.
5. **Tests:** `__tests__/dao/miEntidadDao.test.js` con mock manual de `js/db` vía `jest.mock("../../js/db")`.

```js
// __tests__/dao/miEntidadDao.test.js
jest.mock("../../js/db", () => ({
  pool: { query: jest.fn() }
}));
const { pool } = require("../../js/db");
const miEntidadDao = require("../../js/dao/miEntidadDao");

test("listar devuelve las entidades", async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 1, nombre: "test" }] });
  const result = await miEntidadDao.listar();
  expect(result).toEqual([{ id: 1, nombre: "test" }]);
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SELECT"), []);
});
```

> Mantener el DAO libre de lógica de negocio; esa va en `js/services/`.

---

## 3. Cómo agregar un endpoint de lógica (patrón servicio)

```js
// js/services/miServicio.js  — PURO, sin I/O
"use strict";
function calcular(input, params) { /* ... */ return resultado; }
module.exports = { calcular };
```

```js
// server.js
const miServicio = require("./js/services/miServicio");
app.post("/api/mi-endpoint", requireAuth, async (req, res) => {
  const contexto = await algunDao.cargarContexto(req.body); // I/O aquí
  const out = miServicio.calcular(req.body, contexto);       // cálculo puro
  res.json(out);
});
```

Beneficio: el servicio se testea sin servidor ni BD.

---

## 4. Convenciones de código

- **`"use strict";`** al inicio de cada módulo.
- **CommonJS** (`require`/`module.exports`), por simplicidad y compatibilidad con el ecosistema Node.js sin necesidad de herramientas de build.
- **SQL parametrizado siempre** (`$1, $2`), nunca interpolación de strings.
- **Nombres en español** para dominio (carrera, entidad, actividad); inglés para utilidades genéricas.
- **Frontend sin build:** módulos UMD/IIFE que cuelgan de `window` o exportan funciones; iconos vía `js/icons.js` (`data-icon="..."`).
- **Comentarios** explican el *porqué*, no el *qué*.

---

## 5. Migraciones

- Se aplican en orden numérico; una tabla `schema_migrations` evita re-aplicar.
- Corren automáticamente al arrancar (`js/db/migrate.js`) y vía `npm run db:migrate`.
- **Nunca** editar una migración ya desplegada en producción: crear una nueva.
- Seeds idempotentes (`INSERT ... ON CONFLICT DO NOTHING`).

---

## 6. Testing

| Tipo | Herramienta | Carpeta |
|------|-------------|---------|
| Servicios (puros) | Jest | `__tests__/services/` |
| DAO | Jest + `jest.mock("../../js/db")` | `__tests__/dao/` |
| API (rutas mockeadas) | Jest + `supertest` + `jest.mock("../../js/db")` | `__tests__/routes/` |
| API (salud/gating) | Jest + `supertest` (app real, sin BD) | `__tests__/server/` |

> **Nota:** `pg-mem` figura en `devDependencies` de `package.json` pero ningún test lo usa actualmente. El patrón vigente es mock manual de `js/db` vía `jest.mock`.

```bash
npm test            # todo
npm run test:watch  # modo watch
```

`require('./server')` **no** arranca el server (se exporta `app` para supertest).

---

## 7. Estructura de `js/`

```
js/
├── db/                    ← Infraestructura de datos
│   ├── index.js              Pool de pg (lee DATABASE_URL)
│   ├── migrate.js            Runner de migraciones
│   └── reset-admin.js        Reset del admin seed
├── dao/                   ← Data Access Objects (un archivo por entidad)
│   ├── userDao.js
│   ├── actividadDao.js
│   ├── entidadDao.js
│   ├── bloqueHorarioDao.js
│   └── ...
├── services/              ← Lógica de negocio pura (sin I/O)
│   ├── matchService.js
│   ├── heatmapService.js
│   ├── holidayService.js
│   ├── reputationService.js
│   └── reportService.js
├── views/                 ← Vistas de página (frontend)
│   ├── dashboard-view.js
│   ├── calendario-view.js
│   ├── event-table.js
│   ├── onboarding.js
│   ├── tour.js
│   └── tooltips.js
├── vendor/                ← Dependencias vendoreadas (offline-safe)
│   └── fullcalendar/
├── api-client.js          ← (frontend) wrapper fetch único
├── app-boot.js            ← (frontend) inicialización de la app
├── calendar-view.js       ← (frontend) FullCalendar
├── csv-utils.js           ← (frontend) import/export CSV
├── filters.js             ← (frontend) filtros de búsqueda
├── heatmap-view.js        ← (frontend) render heatmap
├── horarios-view.js       ← (frontend) vista de horarios
├── icons.js               ← (frontend) iconos Lucide vendoreados
├── kpis-view.js           ← (frontend) vista de KPIs
├── layout.js              ← (frontend) layout y navegación
├── load-env.js            ← carga .env en dev (no-op en prod)
├── match-calculator.js    ← (frontend) UI del match
├── sanitize.js            ← (frontend) escapeHtml para XSS
├── theme-toggle.js        ← (frontend) modo claro/oscuro
└── ui-toast.js            ← (frontend) notificaciones
```

**Carpetas de primer nivel:** `js/dao/`, `js/services/`, `js/views/`, `js/db/`, `js/vendor/`

---

## 8. Errores y logging

- Respuestas de error JSON consistentes: `{ error: 'mensaje' }` + status adecuado.
- `4xx` para validación/autorización, `5xx` para fallos internos (loguear stack en server).
- No filtrar detalles internos al cliente en producción.

---

*Dudas de modelo de datos → [`MODELO_DATOS.md`](MODELO_DATOS.md). Dudas del algoritmo → [`ALGORITMO_MATCH.md`](ALGORITMO_MATCH.md).*
