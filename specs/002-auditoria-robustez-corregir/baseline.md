---
title: "Baseline 002 — Evidencia de la línea base antes de corregir"
tags: [mapfi, baseline, auditoria, robustez, speckit]
date: 2026-08-03
status: completo
aliases: ["Baseline 002"]
---

# Baseline: evidencia previa a la implementación

**Feature**: 002-auditoria-robustez-corregir · Tarea T003

Registro del estado del código **antes** de aplicar ninguna corrección de esta
feature. Sirve para demostrar H-01 (la suite oculta el defecto de zona horaria)
y como punto de comparación tras la implementación (T076).

## `npm test` (línea base)

```
Test Suites: 10 passed, 10 total
Tests:       60 passed, 60 total
Time:        4.758 s
```

## `npm run test:tz` (línea base, con `jest.setup.js` SIN modificar)

```
Test Suites: 10 passed, 10 total
Tests:       60 passed, 60 total
Time:        3.126 s
```

## Hallazgo confirmado empíricamente

**Ambos comandos dan el resultado idéntico (60/60)**, pese a que `test:tz`
fuerza `TZ=UTC` en el proceso antes de invocar Jest. La razón: `jest.setup.js`
contiene `process.env.TZ = "America/Santiago";` **sin condición**, que se
ejecuta dentro de cada worker de Jest y sobrescribe cualquier zona horaria
heredada del proceso padre — **antes de que corra cualquier prueba**.

Se verificó por separado (fuera de Jest) que Node.js **sí** respeta la
reasignación de `process.env.TZ` en caliente si ocurre antes del primer uso de
una fecha dada:

```
process.env.TZ = 'UTC';            new Date('2026-04-17T21:00').toISOString()
  → 2026-04-17T21:00:00.000Z   (interpretada como UTC)
process.env.TZ = 'America/Santiago'; new Date('2026-04-17T21:00').toISOString()
  → 2026-04-18T01:00:00.000Z   (interpretada como Chile, +4h en UTC)
```

Esto descarta que el resultado idéntico se deba a una limitación del motor:
**la suite actual es estructuralmente incapaz de detectar defectos de zona
horaria**, porque siempre corre en la zona "correcta" sin importar la del
entorno real de despliegue (el contenedor Docker, que no define `TZ` y por
tanto corre en UTC — ver H-01 en [research.md](./research.md)).

## Acción derivada (T015) — aplicada

`jest.setup.js` ahora respeta la variable de entorno si ya viene definida
(`process.env.TZ = process.env.TZ || "America/Santiago"`), en vez de
sobrescribirla siempre. Con esto:

```
npm test        → Test Suites: 11 passed, 11 total · Tests: 65 passed, 65 total
npm run test:tz → Test Suites: 11 passed, 11 total · Tests: 65 passed, 65 total
```

Ambos siguen en verde — pero ya no por enmascaramiento: se verificó por
separado (ver `_tzprobe`, no persistido) que un worker de Jest **no** respeta
la reasignación de `process.env.TZ` a mitad de ejecución (V8/ICU cachean la
zona local del proceso al primer uso de `Date`), a diferencia de un script
`node -e` plano de un solo bloque. Por eso T010/T011 (`fechas.test.js`,
`matchService.test.js`) no reasignan `TZ` dentro del test: lanzan
subprocesos reales de Node con `TZ` fijada ANTES de arrancar (vía
`execFileSync`), igual que hace `test:tz` con la suite completa, y así sí
exhiben el defecto real de H-01 de forma determinista en ambos comandos.

## Confirmación final (T076)

Al cierre de la implementación de las 11 fases:

```
npm test        → Test Suites: 12 passed, 12 total · Tests: 85 passed, 85 total
npm run test:tz → Test Suites: 12 passed, 12 total · Tests: 85 passed, 85 total
```

85/85 frente a la línea base de 60/60 (T003): **+25 pruebas nuevas**, y ambos
comandos genuinamente verdes (no por enmascaramiento — ver T015 más arriba).

## Entorno de esta ejecución

- No fue posible levantar el stack completo (`docker compose up`): Docker
  Desktop no está disponible en esta sesión. Las tareas que requieren el stack
  vivo o verificación en navegador (T004, T007, T017, T033, T044, T050, T056,
  T061, T082, entre otras) quedan **implementadas en código** pero **sin
  verificación en vivo**; se marcan explícitamente así en `tasks.md`.
