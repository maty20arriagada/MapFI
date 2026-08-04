---
title: "Revisión QA de robustez — post Spec 002"
tags: [mapfi, qa, revision, hallazgos, robustez]
date: 2026-08-04
status: correcciones-aplicadas
aliases: ["Revisión QA", "QA 002"]
---

# 🔬 Revisión QA de robustez (post Spec 002)

Revisión completa ejecutada **contra el stack real** (Docker + PostgreSQL 16 + navegador),
tras implementar las 82 tareas de `002-auditoria-robustez-corregir`.

> **Por qué era necesaria.** Las 85 pruebas automatizadas usan mocks hechos a mano de
> `js/db`: validan la lógica JS, pero **no ejecutan una sola línea del SQL nuevo** y **no
> cubren nada del frontend**. Todo lo de abajo vive precisamente en ese hueco.

**Método**: rebuild completo → migraciones 006–012 aplicadas por primera vez → pruebas por
API con `curl`, consultas directas a Postgres, simulación de carga masiva con el código real
del navegador, e inspección en navegador real.

---

## Resumen

| | Cantidad |
|---|---|
| Hallazgos confirmados en vivo | **13** |
| De ellos, críticos | **2** |
| Comportamientos verificados como correctos | **16** |
| **Corregidos y verificados en vivo** | **12 de 13** |
| Pendiente deliberadamente | **1** (S-2, ver abajo) |

**Lo más importante era que H-01, el defecto insignia que toda la Spec 002 debía corregir,
NO estaba corregido**: un evento cargado a las 21:00 se guardaba y se mostraba como 17:00.
Ya está arreglado y comprobado de punta a punta.

### Estado de las correcciones (2026-08-04)

| # | Hallazgo | Estado | Verificación en vivo |
|---|---|---|---|
| C-1 | Zona horaria (H-01) | ✅ Corregido | `21:00` → se guarda `21:00-04` y la tabla muestra `09:00 p. m.` |
| C-2 | Aportante no podía editar | ✅ Corregido | Editar solo la fecha → *"Evento actualizado"* |
| A-1 | `0` guardado como `NULL` | ✅ Corregido | Actividad en sábado → `compat=0.00`, no `NULL` |
| A-2 | Despliegue obsoleto invisible | ✅ Corregido | `/api/health` informa versión, migración y ambas zonas |
| M-1 | Diálogo colgado al cancelar | ✅ Corregido | La promesa resuelve `false` al pulsar "Cancelar" |
| M-2 | Fuga de texto de Postgres | ✅ Corregido | Ahora: *"Un valor no cumple una regla del sistema"* |
| M-3 | Estados imposibles en el menú | ✅ Corregido | Ofrece solo `[actual, SUSPENDIDA, REPROGRAMADA]` |
| M-4 | Ventana de doble envío | ✅ Corregido | Botón deshabilitado antes de la primera llamada |
| M-5 | Grilla KPI descuadrada | ✅ Corregido | `.grid.cols-4` + `dashboard.html` actualizado |
| M-6 | `/auth/me` no revalidaba | ✅ Corregido | Cuenta desactivada → `{"user":null}` |
| M-7 | Fecha cruda en mapa de calor | ✅ Corregido | Se formatea con `toLocaleDateString("es-CL")` |
| S-1 | `SESSION_SECRET` por defecto | ✅ Corregido | Fail-fast si falta con `NODE_ENV=production` |
| S-3 | Rango de `/conflictos` sin tope | ✅ Corregido | Rango de 9000 años → 400 con mensaje claro |
| S-2 | CSP con `unsafe-inline` | ⏸️ **No aplicado** | Ver "Pendiente" más abajo |

Pruebas: **93/93 en verde** en `npm test` y `npm run test:tz` (antes de la revisión: 85).
Las 8 nuevas son regresiones que **fallaban antes** de su corrección.

### Pendiente deliberadamente: S-2 (CSP `unsafe-inline`)

Quitar `'unsafe-inline'` de `script-src` obliga a sacar a archivos los **10 bloques de
script embebidos repartidos en 9 páginas**. Es viable —no hay atributos `onclick=` ni
similares, que serían el bloqueo real— pero es una refactorización que toca todas las
páginas, y **en este entorno no puedo verificarla visualmente** (el panel del navegador
reporta ancho 0 y no permite capturas). Romper una página en silencio sale más caro que la
mejora, así que lo dejo señalado en vez de aplicarlo a ciegas.

**Cómo hacerlo cuando toque:** mover cada bloque `<script>…</script>` a `js/views/<pagina>.js`,
enlazarlo con `<script src>`, y recién entonces quitar `'unsafe-inline'` de `script-src`
(dejándolo en `style-src`, que sí lo necesita). Verificar página por página en un navegador
real antes de dar por bueno el cambio.

---

## 🔴 Críticos

### C-1 · H-01 sigue vivo: el fix de zona horaria no funciona en despliegues existentes

**Evidencia (cadena completa, reproducible):**

```bash
# 1. Postgres ignora el TZ del contenedor
docker compose exec -T db sh -c 'echo "TZ=$TZ"; psql -U mapfi -d mapfi -tAc "SHOW timezone;"'
#   TZ=America/Santiago      <- la variable SÍ está puesta
#   Etc/UTC                  <- pero el timezone de Postgres NO cambió

# 2. Consecuencia directa
psql -tAc "SELECT '2026-04-17T21:00'::timestamptz;"   # -> 2026-04-17 21:00:00+00

# 3. Por la API real
curl -b sesion -d '{"titulo":"QA","fechaInicio":"2026-04-17T21:00", ...}' /api/actividades
psql -tAc "SELECT fecha_inicio AT TIME ZONE 'America/Santiago' FROM actividad WHERE ..."
#   -> 2026-04-17 17:00:00
```

**En el navegador**: la tabla "Mis eventos" muestra `17/4, 05:00 p. m.` y el formulario de
edición precarga `2026-04-17T17:00`. El usuario escribió 21:00.

**Causa.** `TZ` en el contenedor `db` **no** cambia el parámetro `timezone` de PostgreSQL:
ese valor se fija en `postgresql.conf` durante el `initdb`. En un volumen ya existente —
que es el caso de cualquier despliegue real con datos— queda en `Etc/UTC` para siempre.

Lo verifiqué con un contenedor desechable:

| Escenario | `SHOW timezone` | `'21:00'::timestamptz` |
|---|---|---|
| Postgres **nuevo** con `TZ` | `America/Santiago` | `21:00-04` ✅ |
| Volumen **existente** (el tuyo, y el del servidor de la facultad) | `Etc/UTC` | `21:00+00` ❌ |

> Este es el peor patrón posible: **funciona en una máquina limpia y queda roto justo al
> actualizar el servidor que ya tiene datos.** Por eso pasó desapercibido.

**Agravante:** el servidor Node sí quedó en `America/Santiago`, así que el **Match se calcula
en hora de Chile mientras el dato se guarda en UTC** — dos criterios distintos conviviendo.

**Fix propuesto** (no aplicado aún):
1. Migración `013`: `ALTER DATABASE mapfi SET timezone = 'America/Santiago';` — corrige
   despliegues existentes, queda versionado e idempotente.
2. Refuerzo en `docker-compose.yaml`: `command: postgres -c timezone=America/Santiago`.
3. **Fix de fondo** (recomendado además): normalizar en el servidor la fecha naive a un
   instante explícito antes de persistir, para no depender de la zona de sesión de Postgres.
4. Añadir una prueba que falle si `SHOW timezone` no es la esperada.

### C-2 · Un aportante no puede editar sus propias actividades

El flujo principal del usuario objetivo de la plataforma está roto.

**Reproducción (interfaz real):** entrar como aportante → "Mis eventos" → lápiz de editar →
cambiar **solo la fecha** → Guardar → toast rojo:

> ❌ *"No puedes cambiar la actividad a ese estado"*

**Por API:**
```bash
curl -b sesion_aportante -X PUT -d '{"fechaInicio":"...","fechaFin":"...","estado":"PROPUESTA"}' \
  /api/actividades/6      # -> HTTP 403
```

**Causa.** `event-table.js:56` **siempre** envía `estado` (el actual, sin cambiarlo), y
`server.js:513` rechaza de un aportante cualquier estado fuera de `SUSPENDIDA/REPROGRAMADA`.
Editar la fecha de una actividad `PROPUESTA` o `CONFIRMADA` es, por tanto, imposible.
Regresión introducida en T048.

**Fix propuesto:** comparar contra el estado **actual** en el servidor y aplicar la
restricción solo si el estado **cambia de verdad**. El servidor debe decidirlo (no basta con
que el cliente omita el campo).

---

## 🟠 Altos

### A-1 · Una compatibilidad de 0 se guarda como "nunca evaluada"

**Evidencia:** tras cargar 120 evaluaciones, solo 59 tienen `compatibilidad_pct`:

```
con compat = 0    : 0
con compat = NULL : 61      <- todas caen en sábado o domingo
```

Las 61 son exactamente los casos en que el Match devuelve `0` (descarte duro por fin de
semana). **Causa:** `actividadDao.crear()` usa `a.compatibilidadPct || null` — y `||`
convierte el `0` en `null`.

**Impacto:** vuelve a abrir el agujero que H-03 debía cerrar. `reputationService` cuenta
"usó el Match" como `compatibilidad_pct != null`; una actividad evaluada con resultado 0
figura como **no evaluada**, así que `usoMatch` se subestima y el **Sello de Coordinación se
vuelve más difícil de alcanzar**. El mismo defecto afecta a `alcance_estimado`.

**Fix propuesto:** usar `??` en vez de `||` en `crear()` (y revisar el mismo patrón en
`actualizar()`, donde un recálculo a 0 tampoco se persiste).

### A-2 · El despliegue que estaba corriendo no tenía ninguna corrección

Al empezar la revisión, `http://localhost:3000` respondía pero servía la **imagen del
2026-06-09** con solo las migraciones **001–005** aplicadas y `TZ` vacío en ambos
contenedores.

No es un bug del código, pero sí un riesgo operativo real: **es indistinguible "la app está
corriendo" de "la app está actualizada"**. Si el servidor de la facultad se levanta con
`docker start` en vez de `up --build`, se queda en la versión vieja en silencio.

**Fix propuesto:** exponer versión y última migración en `/api/health`, para poder
verificarlo de un vistazo.

---

## 🟡 Medios

| # | Hallazgo | Evidencia | Fix propuesto |
|---|---|---|---|
| M-1 | **El diálogo de confirmación nunca resuelve al cancelar.** `onCancel()` ejecuta `cleanup()` —que quita el listener de `close`— *antes* de `d.close()`, así que `resolve` no corre nunca. Afecta archivar, desactivar cuenta y el aviso de saturación. | Medido en navegador: al pulsar "Cancelar" la promesa queda pendiente. *(Nota: este navegador además no dispara `close` en `<dialog>` ni siquiera en un elemento limpio, así que la vía Escape también cuelga aquí.)* | Resolver **explícitamente** en `onCancel` en vez de depender del evento; dejar el listener de `close` solo como respaldo. |
| M-2 | **Se filtra el texto crudo de Postgres.** `PATCH /estado` con un valor inválido devuelve al cliente `violates check constraint "actividad_estado_check"`, exponiendo nombres internos. `traducirErrorBD()` existe pero solo se usa en `/bulk`. | `curl -X PATCH -d '{"estado":"INVENTADO"}'` → 400 con el texto interno | Aplicar `traducirErrorBD()` en los 11 `catch` que hoy devuelven `e.message`. |
| M-3 | **El frontend no conoce `ARCHIVADA`.** El desplegable de estado ofrece 5 opciones, de las cuales **3 el servidor siempre rechazará** a un aportante, y no incluye `ARCHIVADA` — que el autor sí ve ahora en su tabla. | Desplegable leído en vivo: `[PROPUESTA, CONFIRMADA, REALIZADA, SUSPENDIDA, REPROGRAMADA]` | Mostrar solo las transiciones permitidas según rol; añadir `ARCHIVADA` a `BADGE` como estado de solo lectura. |
| M-4 | **Sigue siendo posible el doble envío.** El chequeo de saturación (T073) hace una llamada de red **antes** de deshabilitar el botón; en esa ventana un doble clic crea dos actividades. Anula parcialmente T062. | Revisión de código: `dashboard-view.js:203` y `calendario-view.js` | Deshabilitar el botón **antes** del chequeo, en un `try/finally`. |
| M-5 | **4 tarjetas KPI en una grilla de 3 columnas.** "Alcance estimado" queda sola en una segunda fila. | Medido: `grid-template-columns` = 3 columnas, 2 filas, última fila con 1 tarjeta | Pasar la grilla a 4 columnas o mover la tarjeta. |
| M-6 | **`/api/auth/me` no revalida.** Con la cuenta ya desactivada en la BD, sigue devolviendo el usuario completo → el frontend mantiene la interfaz de sesión iniciada hasta que se toque una ruta protegida. | `activo=false` en BD y `/me` devuelve el usuario | Revalidar también en `/me`. |
| M-7 | **Fechas sin formatear en el mapa de calor.** Se muestra `2026-04-17T04:00:00.000Z` en vez de una fecha legible. | Leído del DOM en `mapa-calor.html` | Formatear con `toLocaleDateString("es-CL")`. |

---

## 🔵 Seguridad

| # | Hallazgo | Detalle |
|---|---|---|
| S-1 | **`SESSION_SECRET` tiene valor por defecto** | `server.js:81` usa `"dev-inseguro-cambiar"` si la variable falta. En producción sin esa variable, las cookies se firman con un secreto **público** → falsificación de sesión. `DATABASE_URL` sí hace fail-fast; esto debería hacerlo también. *(Preexistente.)* |
| S-2 | **CSP con `script-src 'unsafe-inline'`** | Necesario por los `<script>` embebidos en el HTML; debilita la defensa XSS. T070 añadió más código inline a `match.html`. Mover los scripts a archivos permitiría quitarlo. |
| S-3 | **`/api/actividades/conflictos` es público y sin tope de rango** | Un self-join invocable sin sesión con un rango arbitrario (`desde=1000-01-01&hasta=9999-12-31`). Acotar el rango máximo. |

---

## ✅ Verificado como correcto

Vale la pena dejarlo escrito: **la mayor parte de la Spec 002 sí funciona**, y se comprobó
ejecutándolo, no leyéndolo.

**Migraciones y SQL nuevo** (nunca antes ejecutado):
- Las 7 migraciones pendientes (006→012) aplican **limpio y en secuencia** sobre una base con
  datos, sin tumbar el arranque.
- `conflictos(desde, hasta)` con `tstzrange` — sin ambigüedad de tipos.
- `archivar` / `retirar` / `restituir` con su trazabilidad (`retirada_por`, `retirada_en`,
  `restituida_por`); `listarRetiradas`; `segmentosDe`; `usaMatriculaReferencial`.
- Migración 010: las 70 filas de matrícula quedaron marcadas `REFERENCIAL`.

**Moderación reactiva (H-02)** — ciclo completo verificado:
- "Eliminar" ya **no borra**: pasa a `ARCHIVADA` conservando la fila.
- Lo archivado **desaparece del calendario público** pero el admin sí lo ve.
- Aparece en "Actividades retiradas" y **restituir lo devuelve** a `PROPUESTA` limpiando la
  trazabilidad de retiro.

**Autoridad del servidor (H-04):**
- Un aportante que envía `entidadId: 7` termina con `entidad_id = 6` (la suya).
- Restituir → 403 para aportante. Marcar `REALIZADA` → rechazado.

**Revocación de acceso (H-06):** cuenta desactivada → **401 inmediato** en la sesión abierta.

**Rate limit (H-09):** agotar los 5 intentos de una cuenta devuelve 429, y **otra cuenta
desde la misma IP entra sin problema**.

**Carga masiva (H-05):**
- Payload de 120 evaluaciones = **239,5 kB** → sin lotear, **HTTP 413** (el bug original).
- Con `dividirEnLotes`: 4 lotes (77,8 / 77,8 / 77,9 / 6,0 kB) → **120 creadas, 0 errores, 3,3 s**.
- Errores por fila traducidos a lenguaje comprensible: *"La fecha de término debe ser
  posterior a la de inicio"*, *"Hace referencia a un dato que no existe"*.

**Otros:**
- **XSS correctamente escapado**: un título `<script>alert(1)</script>` se renderiza como
  texto literal (`&lt;script&gt;`), 0 etiquetas reales inyectadas.
- Validación de rango de fechas (T063) con mensaje claro.
- Accesibilidad del mapa de calor (T071): `role="img"` + `aria-label="Saturación baja: 1
  evento(s)"` + texto visible, no solo color.
- Skip-link (T072) presente y apuntando a `#main-content`.
- Match persistido (H-03): `alcanceTotal = 182.500`, ya no 0 — con la salvedad de A-1.
- Rótulo de matrícula referencial (T042): `matriculaReferencial: true`.
- Reporte PDF: se genera correctamente (`%PDF-1.3`, 4.444 bytes).
- Sin errores en la consola del navegador.

---

## Cambios aplicados

| Archivo | Qué se hizo |
|---|---|
| `db/migrations/013_timezone_base_datos.sql` | **Nuevo.** `ALTER DATABASE … SET timezone` — corrige C-1 en despliegues ya existentes. |
| `docker-compose.yaml` | `command: postgres -c timezone=America/Santiago` como refuerzo. |
| `server.js` | Normaliza fechas naive a instante (`aInstante`), estado solo restringido si **cambia**, `traducirErrorBD` en todos los `catch`, `/auth/me` revalida, fail-fast de `SESSION_SECRET`, tope de rango en `/conflictos`, `/health` con versión y migración. |
| `js/dao/actividadDao.js` | `??` en vez de `||` para compatibilidad y alcance (A-1). |
| `js/ui-confirm.js` | La promesa resuelve siempre y una sola vez; escucha `close` **y** `cancel`. |
| `js/views/event-table.js` | Estados según rol, insignia para `ARCHIVADA`, botón bloqueado al guardar. |
| `js/views/dashboard-view.js`, `js/views/calendario-view.js` | Botón deshabilitado **antes** del chequeo de saturación. |
| `js/heatmap-view.js` | Fecha formateada en zona de Chile. |
| `css/design-system.css`, `dashboard.html` | `.grid.cols-4` para las 4 tarjetas KPI. |
| `__tests__/routes/api.test.js`, `__tests__/dao/actividadDao.test.js` | 8 regresiones nuevas (C-1, C-2, A-1, A-2, S-3). |

## Estado del entorno de desarrollo

- Los ~128 registros de prueba de la revisión **ya fueron eliminados** (queda 1 actividad,
  la original de la semilla).
- La contraseña del admin **fue restablecida** durante la revisión (era necesaria para
  probar la matriz de roles) y están sembradas las 16 cuentas de aportante
  (`npm run seed:cuentas`). **Cámbiala antes de cualquier despliegue** con:

  ```bash
  docker compose exec server node js/db/reset-admin.js admin@mapfi.cl <nueva-clave>
  ```

> **Nota sobre datos anteriores:** cualquier actividad creada **antes** de la corrección
> C-1 tiene su hora desplazada (se guardó como UTC). En esta base solo había datos de
> muestra, así que no se hizo migración de datos. Si en algún momento se hubiera cargado
> información real antes de este arreglo, habría que corregirla con un
> `UPDATE … SET fecha_inicio = fecha_inicio - interval '4 hours'` acotado por fecha de
> creación — **no es el caso hoy**.
