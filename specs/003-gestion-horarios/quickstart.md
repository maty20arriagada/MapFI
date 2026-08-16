# Quickstart · Validación de la gestión de horarios

**Feature**: `003-gestion-horarios`

Guía para comprobar que la feature funciona de extremo a extremo. Detalles de
interfaz en `contracts/api-horarios.md`; estructura en `data-model.md`.

## Prerrequisitos

```bash
docker compose up -d --build
```

Las migraciones corren solas al arrancar. Comprobar que llegaron la 016 y la 017:

```bash
docker compose exec -T db psql -U mapfi -d mapfi -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 3;"
```

Cuentas para las pruebas (ver `docs/OPERACION.md`):

| Cuenta | Rol | Carrera de su entidad |
|--------|-----|------------------------|
| `informatica@mapfi.cl` | APORTANTE | 7 (Ing. Civil Informática) |
| `mecanica@mapfi.cl` | APORTANTE | 9 (Ing. Civil Mecánica) |
| `vinculacion@mapfi.cl` | APORTANTE | ninguna (`NULL`) |
| la cuenta admin del despliegue | ADMIN | — |
| `super@mapfi.cl` | SUPERADMIN | — |

## Pruebas automatizadas

```bash
npm test
```

Debe quedar en verde, incluyendo:

- `__tests__/services/horarioService.test.js` — geometría: 45 min = 3 filas, 90 min =
  6 filas, ajuste al cuarto de hora, sub-columnas de solapados, fuera de rango.
- `__tests__/horario-csv.test.js` — los tres separadores, encabezado desordenado,
  alias de columnas, BOM, detección de binarios, errores con número de fila.
- `__tests__/dao/bloqueHorarioDao.test.js` — borrado por segmento, importación
  transaccional.
- `__tests__/routes/api.test.js` — matriz de autorización y ausencia de rutas de
  subida de archivos.

Con la zona horaria forzada, para descartar que la geometría dependa del reloj:

```bash
npm run test:tz
```

---

## US1 · Limpiar un horario con datos de ejemplo

**Punto de partida**: base recién creada. Comprobar que **no** quedan bloques de
muestra (FR-004):

```bash
docker compose exec -T db psql -U mapfi -d mapfi -c "SELECT count(*) FROM bloque_horario WHERE descripcion = 'Cálculo I';"
```

Esperado: `0`.

Verificar que la migración es idempotente y respeta datos reales: cargar a mano un
bloque en Industrial 1.er año, volver a aplicar la migración 016 y comprobar que
sigue ahí.

**En el navegador**, con sesión de administrador en `/horarios.html`:

1. Elegir una carrera y generación con bloques cargados.
2. Pulsar la × de un bloque → aparece confirmación con el ramo y el horario → al
   confirmar, el bloque desaparece sin recargar la página.
3. Pulsar "Vaciar horario de este segmento" → el diálogo indica el número exacto de
   bloques, ofrece descargar el CSV y exige confirmación explícita.
4. Descargar el CSV ofrecido y comprobar que se puede reimportar tal cual: es la
   prueba real de que FR-003 sirve de vuelta atrás.

**Con sesión SUPERADMIN** (D-2): los controles de edición y borrado deben verse. Antes
de esta feature no se veían.

---

## US2 · Grilla de 08:00 a 21:00 con 45 y 90 minutos

En un segmento vacío: la grilla se dibuja igual, de 08:00 a 21:00, con las cinco
columnas y un mensaje de que no hay horario cargado.

Cargar dos bloques el lunes: `08:00–08:45` y `09:00–10:30`. En el navegador,
comprobar la proporción exacta (SC-002):

```js
// consola del navegador
const b = [...document.querySelectorAll('.tt-block')];
b.map(x => x.getBoundingClientRect().height);   // el segundo debe ser el doble del primero
```

Casos que deben cubrirse en la misma pantalla:

| Caso | Esperado |
|------|----------|
| Bloque `11:50–13:20` (no múltiplo de 15) | Se dibuja ajustado al cuarto de hora; la etiqueta dice `11:50–13:20` |
| Bloque `07:00–08:00` (antes del rango) | La grilla no se deforma; aparece un aviso que lo identifica |
| Dos bloques solapados el mismo día | Se ven lado a lado, ninguno tapa al otro |

Comprobar además que ningún bloque genera `grid-row` con decimales:

```js
[...document.querySelectorAll('.tt-block')]
  .map(x => getComputedStyle(x).gridRow)
  .filter(v => v.includes('.'));                // debe quedar vacío
```

---

## US3 · Importar desde archivo

Descargar la plantilla desde la interfaz (o `GET /api/plantilla-horario.csv`) y
comprobar que Excel en español la abre con los acentos correctos.

**Los tres caminos de entrada deben dar el mismo resultado**:

1. Archivo `.csv` separado por `;`.
2. Archivo `.txt` separado por tabulaciones.
3. Celdas copiadas desde una planilla y pegadas en el cuadro de texto.

En los tres casos, antes de confirmar debe verse la vista previa con las filas
interpretadas y los errores por fila.

**Archivo con errores deliberados** — comprobar que cada uno produce un mensaje que
identifica la fila y el motivo, y que las filas válidas del mismo archivo sí se cargan:

```csv
dia;inicio;fin;ramo;tipo
LUN;08:00;09:30;Cálculo I;CLASE
XXX;08:00;09:30;Ramo con día inválido;CLASE
MAR;10:00;09:00;Ramo con fin antes del inicio;CLASE
MIE;;;Ramo sin horas;CLASE
JUE;09:00;10:30;;CLASE
VIE;09:00;10:30;Ramo válido al final;CLASE
```

**Reemplazar vs. agregar** (FR-014): con un segmento que ya tiene bloques, confirmar
que el diálogo obliga a elegir y que el resultado corresponde a lo elegido. Comprobar
también que reemplazar con un archivo cuyas filas son **todas** inválidas no borra
nada.

**Archivo que no es texto** (R-5): arrastrar un `.xlsx` real y comprobar que el
mensaje explica cómo exportar a CSV, en lugar de mostrar caracteres ilegibles.

**Transaccionalidad**: forzar un fallo a mitad de una importación con `reemplazar`
(por ejemplo, con un `nivel` inexistente en la última fila) y verificar que el
horario anterior sigue completo.

---

## US3b · Ningún archivo en el servidor (FR-018/019/020)

Tras ejecutar todas las importaciones anteriores:

```bash
docker compose exec -T server sh -c 'find /app -newermt "-30 minutes" -type f \
  \( -name "*.csv" -o -name "*.txt" -o -name "*.xlsx" -o -name "*.pdf" \) \
  -not -path "*/node_modules/*"'
```

Esperado: **sin salida**.

Comprobar que ninguna ruta acepta `multipart`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -F "archivo=@cualquier.csv" http://127.0.0.1:3000/api/bloques/importar
```

Esperado: `400` o `401`/`403` — nunca un `200` que indique que el archivo fue
aceptado.

Y que no se incorporó una dependencia de subida:

```bash
grep -rn "multer\|busboy\|formidable\|express-fileupload" package.json server.js js/ || echo "sin dependencias de subida"
```

---

## US4 · Autorización por carrera

Matriz mínima a verificar contra la API. Con sesión de `informatica@mapfi.cl`
(carrera 7):

| Operación | Esperado |
|-----------|----------|
| `POST /api/bloques` con `carreraId: 7` | `201` |
| `POST /api/bloques` con `carreraId: 9` | `403` |
| `POST /api/bloques/importar` con `carreraId: 9` | `403` |
| `DELETE /api/bloques?carreraId=9&nivel=1` | `403` |
| `DELETE /api/bloques/:id` sobre un bloque de la carrera 9 | `403` |
| `GET /api/bloques?carreraId=9&nivel=1` | `200` — la lectura es pública |

Con `vinculacion@mapfi.cl` (entidad sin carrera): **toda** escritura debe dar `403`.

Sin sesión: toda escritura debe dar `401`, nunca `403` — la diferencia importa para
que la interfaz sepa si debe pedir login o informar falta de permiso.

Con ADMIN y con SUPERADMIN: todas las operaciones anteriores deben dar `201`/`200`.

**Prueba del atajo obvio**: borrar un bloque ajeno enviando el `carreraId` propio en
el cuerpo. Debe dar `403`, porque la carrera del bloque se lee de la base y no del
cliente.

---

## US5 · Filtros e impresión

Con un horario cargado:

1. Escribir en el buscador el nombre de un ramo → solo quedan visibles los bloques que
   coinciden en ramo, sala, docente o código.
2. Filtrar por tipo y por día → la grilla mantiene 08:00–21:00 y las cinco columnas;
   los bloques restantes no se recolocan.
3. `Ctrl+P` → la vista previa muestra el horario con sus colores, sin navegación,
   filtros ni formularios, con carrera, generación, fecha y el filtro aplicado.
4. Imprimir con un filtro activo → la hoja indica qué filtro estaba puesto.
5. Comprobar en modo oscuro que la impresión sale legible (fondo claro, texto oscuro).

---

## Regresión

- **Match**: tras vaciar el horario de Industrial 1.er año, el match ya no debe
  reportar choque con el "Bloque protegido FI" (R-10). Verificar que sigue reportando
  choques donde sí hay bloques `PROTEGIDO` reales.
- **Actividades**: la importación de actividades por CSV
  (`dashboard.html` → "Importar CSV") debe seguir funcionando; comparte
  `js/csv-utils.js`, que esta feature amplía con la tabulación como separador.
- **Zona horaria**: los bloques son `TIME` sin zona y son independientes del arreglo
  H-01. Un bloque de 08:00 debe seguir viéndose a las 08:00 con `TZ=UTC`
  (`npm run test:tz`).
