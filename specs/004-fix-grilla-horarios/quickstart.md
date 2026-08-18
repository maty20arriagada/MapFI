# Quickstart · Verificar que la grilla vuelve a dibujarse

**Feature**: `004-fix-grilla-horarios` | **Fecha**: 2026-08-18

Dos partes independientes, y conviene no confundirlas:

- **Parte A — la corrección.** Que la grilla se *dibuje*. Es lo que arregla esta rama.
- **Parte B — los datos.** Que la grilla tenga *algo dentro*. Eso lo ejecutas tú en el servidor
  de la Facultad; el horario aún no está cargado.

Con la Parte A hecha y la B pendiente, la página funciona pero dice "Este segmento aún no tiene
horario cargado". Eso es el resultado correcto y ya es un avance frente a la página muerta de hoy.

**La spec no se cierra al mergear.** El paso que la cierra es A-3 corriendo en el servidor de la
Facultad, no en local — porque el defecto solo existe ahí.

---

## Requisitos previos

- Estar en la rama `004-fix-grilla-horarios`.
- `npm install` hecho.
- Para la Parte B: acceso al servidor y el contenedor arriba.

---

# Parte A · La corrección

## A-1 · Pruebas automatizadas

```bash
npm test
```

Esperado: **472 en verde**, igual que antes. La suite de `horarioService` (40 pruebas) es la que
demuestra que el `require` nuevo resuelve; si la ruta quedara mal, ese archivo falla entero al
importar y se nota de inmediato.

```bash
npm run test:tz
```

## A-2 · El 404 ya no ocurre — servido por `server.js`

**Este es el paso que no se puede saltar, y el que se saltó la vez anterior.** La verificación de
la Spec 003 se hizo con `python -m http.server`, que sirve cualquier archivo del árbol y no aplica
la lista de bloqueo: daba 200 y ocultaba el defecto. Aquí hace falta el servidor real.

**No hace falta Docker ni base de datos para este paso.** `server.js` arranca sin Postgres:
`HAS_DB` (`server.js:50`) desactiva las migraciones y el store de sesión, y `js/db/index.js:11`
solo aborta si `NODE_ENV` no es `test`. Así que basta:

```bash
NODE_ENV=test node server.js
```

(o `docker compose up -d` si ya lo tienes arriba). Luego pide las cuatro rutas:

```bash
curl -s -o /dev/null -w "shared    %{http_code}\n" http://localhost:3000/js/shared/horarioService.js
```

```bash
curl -s -o /dev/null -w "services  %{http_code}\n" http://localhost:3000/js/services/matchService.js
```

```bash
curl -s -o /dev/null -w "dao       %{http_code}\n" http://localhost:3000/js/dao/actividadDao.js
```

```bash
curl -s -o /dev/null -w "db        %{http_code}\n" http://localhost:3000/js/db/migrate.js
```

| Ruta | Esperado | Qué demuestra |
|---|---|---|
| `js/shared/horarioService.js` | **200** | SC-001 · el módulo llega al navegador |
| `js/services/matchService.js` | **404** | SC-002 · el algoritmo de Match sigue cerrado |
| `js/dao/actividadDao.js` | **404** | SC-002 · el SQL sigue cerrado |
| `js/db/migrate.js` | **404** | SC-002 · las migraciones siguen cerradas |

Un `200` en cualquiera de las tres últimas significa que la corrección debilitó SEG-2 y hay que
revertirla.

## A-3 · En el navegador

1. Abre `/horarios.html` **con la caché desactivada** o recarga forzada (`Ctrl+Shift+R`). Un
   navegador que ya cacheó el 404 puede seguir fallando y hacerte perseguir un fantasma.
2. Abre la consola **antes** de interactuar.
3. Elige una carrera en la lista y un año.
4. Pulsa **«Ver horario»**.

Esperado:

- La consola **sin** el 404 de `/js/services/horarioService.js` y **sin** el
  `TypeError: Cannot read properties of undefined (reading 'geometria')`.
- La grilla dibujada de **08:00 a 21:00**, con las etiquetas de hora en punto en la columna
  izquierda y las cinco columnas Lun–Vie.
- Sin datos cargados: la grilla vacía + "Este segmento aún no tiene horario cargado".
- Con datos cargados: los bloques en su sitio, un bloque de 90 min midiendo el doble que uno de 45.

## A-3b · El guard: comprobar que el fallo ahora se explica

FR-006 solo se demuestra **rompiéndolo a propósito**. Esperar a que falle solo no prueba nada.

En la consola de `/horarios.html`, antes de pulsar el botón:

```javascript
delete window.HorarioService; window.MapFI && delete window.MapFI.HorarioService;
```

Ahora pulsa «Ver horario». Esperado:

- Un mensaje visible que dice que no se pudo cargar el módulo de horarios y qué hacer.
- Un `console.error` con la ruta que no cargó.
- **Ninguna** zona en blanco, y ningún `TypeError` sin capturar.

Recarga para dejar la página como estaba.

## A-4 · Que no se rompió nada de la Spec 003

Rápido, sobre la misma página:

- Los filtros de día, tipo, sección y texto ocultan bloques **sin recolocar la grilla**.
- Marcar dos carreras con Ctrl pinta cada bloque del color de su carrera y muestra la leyenda.
- Imprimir con un filtro activo respeta el filtro.
- El botón de disponibilidad y el enlace al mapa de calor siguen funcionando.
- `/mapa-calor.html` sigue igual: no lo toca esta corrección.

---

# Parte B · Cargar el horario en el servidor de la Facultad

Esto lo corres tú. Yo no tengo acceso a esa máquina ni Docker en este entorno, así que aquí van
los pasos exactos y qué debería devolver cada uno. **Pégame la salida y te digo cómo seguir.**

## B-0 · Antes de empezar: qué hace y qué borra

El importador carga en modo **reemplazar** por segmento `(carrera, año)`. Los segmentos que
aparecen en el archivo se **borran y se vuelven a escribir**; los que no aparecen quedan intactos.
Es idempotente: correrlo dos veces deja lo mismo, no el doble.

El horario sale del volcado de la Facultad y **el año de algunos ramos es una estimación**. Por eso
la página lleva el aviso de calidad del dato: puede tener errores y no hay que fiarse por completo
de él. El `REVISION.md` del paso B-1 lista exactamente qué ramos quedaron con confianza baja.

## B-1 · Ensayo sin tocar la base

Primero comprueba que el archivo está dentro del contenedor:

```bash
docker compose exec server ls -la Extras/Horarios_FI_UDEC.txt
```

Si no está, no lo copies a mano dentro del contenedor: asegúrate de que llegó por `git pull` y
reconstruye. Luego el ensayo, escribiendo la salida en `/tmp` — `/app/Extras` es de root y el
contenedor corre como usuario `node`, así que escribir ahí da `EACCES`:

```bash
docker compose exec server node js/db/importar-horarios.js Extras/Horarios_FI_UDEC.txt --dry-run --salida /tmp/horarios
```

Esperado, aproximadamente: **~2.594 bloques** repartidos en **~66 segmentos**, **0 errores de
parseo**, y **7 ramos** marcados con año de confianza baja. Si ves errores de parseo, para y
mándame la salida antes de cargar nada.

Revisa el informe:

```bash
docker compose exec server cat /tmp/horarios/REVISION.md
```

## B-2 · La carga real

```bash
docker compose exec server node js/db/importar-horarios.js Extras/Horarios_FI_UDEC.txt --salida /tmp/horarios
```

## B-3 · Comprobar en la base

```bash
docker compose exec db psql -U mapfi -d mapfi -c "SELECT c.codigo, b.nivel, count(*) FROM bloque_horario b JOIN carrera c ON c.id=b.carrera_id GROUP BY 1,2 ORDER BY 1,2;"
```

Esperado: filas para las 14 carreras, con los años 1 a 5. Un total cercano a los 2.594 del ensayo.

## B-4 · Comprobar en el navegador

Vuelve a `/horarios.html`, elige una carrera y un año, y pulsa «Ver horario». Contrasta **tres
ramos** contra el `.txt` original: día, hora, sala, docente y sección. Es la única verificación que
detecta un error de mapeo — la base puede estar llena y aun así tener un ramo en el año equivocado.

Después mira `/mapa-calor.html` en la vista **«Ver por hora»**: con el horario cargado, las franjas
de clase deberían aparecer saturadas y los huecos libres, que es justo lo que se necesita para
elegir la hora de una actividad.

---

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| La grilla no se dibuja, 404 de `horarioService` | Caché del navegador, o el despliegue no trae la rama | `Ctrl+Shift+R`; comprobar con `git log --oneline -1` dentro del contenedor |
| La grilla no se dibuja, sin 404 | Otro error de JS | Pásame la consola completa; no es el mismo defecto |
| La grilla se dibuja vacía | Parte B pendiente | B-1 → B-2 |
| `Cannot find module` al correr el importador | La imagen no tiene el archivo | `git pull` y `docker compose up -d --build`; si todo sale `CACHED`, el `git pull` no trajo nada |
| `EACCES: permission denied, mkdir '/app/Extras/salida'` | `/app` es de root y el contenedor corre como `node` | Añadir `--salida /tmp/horarios` |
| Un ramo en el año equivocado | Estimación de año con confianza baja | Corregirlo a mano desde la interfaz; está listado en `REVISION.md` |
