# Contrato · API de horarios

**Feature**: `003-gestion-horarios`

Convenciones del proyecto que aplican aquí: respuestas JSON; errores como
`{ "error": "mensaje en español" }`; `401` si falta sesión y `403` si la sesión existe
pero no autoriza; validación de `Origin`/`Referer` en métodos que mutan;
`express.json({ limit: "100kb" })`.

**Ninguna ruta acepta `multipart/form-data`** (FR-019). Todas reciben JSON.

---

## `GET /api/bloques`

Pública, sin sesión. Existente; se amplían los campos devueltos.

**Query**: `carreraId`, `nivel` (ambos opcionales; sin ellos devuelve todo).

**200**

```json
[
  {
    "id": 12,
    "carrera_id": 7,
    "nivel": 1,
    "dia_semana": 1,
    "hora_inicio": "08:00:00",
    "hora_fin": "09:30:00",
    "tipo": "CLASE",
    "descripcion": "Cálculo I",
    "codigo": "525101",
    "seccion": "1",
    "sala": "Aula 201",
    "docente": null
  }
]
```

Ordenado por `dia_semana`, `hora_inicio`. Los cuatro campos nuevos son `null` en los
bloques cargados antes de esta feature.

---

## `POST /api/bloques`

Existente. Cambia la autorización: de `requireRole("ADMIN")` a sesión iniciada +
`puedeEditarHorario(user, carreraId)`.

**Body**

```json
{
  "carreraId": 7, "nivel": 1, "diaSemana": 1,
  "horaInicio": "08:00", "horaFin": "09:30",
  "tipo": "CLASE", "descripcion": "Cálculo I",
  "codigo": "525101", "seccion": "1", "sala": "Aula 201", "docente": null
}
```

Obligatorios: `carreraId`, `nivel`, `diaSemana`, `horaInicio`, `horaFin`.
`tipo` por defecto `CLASE`. Los cinco textos se recortan y se limitan a 200
caracteres.

| Código | Cuándo |
|--------|--------|
| `201` | creado; devuelve `{ id }` |
| `400` | validación de campos |
| `401` | sin sesión |
| `403` | la sesión no puede editar esa carrera |

---

## `DELETE /api/bloques/:id`

Existente. Cambia la autorización igual que `POST`, con una diferencia: la carrera
del bloque **se lee de la base**, no del cliente. Sin eso, un aportante podría borrar
un bloque ajeno declarando su propia carrera en la petición.

| Código | Cuándo |
|--------|--------|
| `200` | `{ "id": 12 }` |
| `401` / `403` | sesión ausente / no autorizada para la carrera **del bloque** |
| `404` | el bloque no existe |

---

## `DELETE /api/bloques` *(nueva)*

Vacía un segmento completo (FR-002).

**Query**: `carreraId` y `nivel`, **ambos obligatorios**. Sin ambos → `400`. Es
deliberado: una llamada sin filtros vaciaría la tabla entera.

**200**

```json
{ "eliminados": 7, "carreraId": 6, "nivel": 1 }
```

| Código | Cuándo |
|--------|--------|
| `200` | incluso si `eliminados` es 0 — la operación es idempotente |
| `400` | falta `carreraId` o `nivel` |
| `401` / `403` | como arriba |

La interfaz exige confirmación explícita y ofrece descargar el horario antes de
llamar (FR-003), pero eso es responsabilidad del cliente: la ruta no lo impone.

---

## `POST /api/bloques/importar` *(nueva)*

Carga masiva. Recibe filas **ya interpretadas por el navegador**; el archivo original
nunca se envía (FR-018).

**Body**

```json
{
  "carreraId": 7,
  "nivel": 1,
  "modo": "reemplazar",
  "bloques": [
    { "diaSemana": 1, "horaInicio": "08:00", "horaFin": "09:30",
      "tipo": "CLASE", "descripcion": "Cálculo I",
      "codigo": "525101", "seccion": "1", "sala": "Aula 201", "docente": null }
  ]
}
```

- `modo`: `"reemplazar"` | `"agregar"`. **Obligatorio y sin valor por defecto**
  (FR-014): omitirlo devuelve `400`. Elegir un defecto sería decidir por el usuario
  entre "no pasa nada" y "se borra el semestre".
- `bloques`: entre 1 y **200** elementos. Cada uno lleva su `carreraId`/`nivel`
  implícitos del nivel superior, de modo que una fila no puede escaparse a otra
  carrera.

**200**

```json
{ "insertados": 24, "eliminados": 7, "modo": "reemplazar" }
```

**Comportamiento transaccional**: en modo `reemplazar`, el borrado del segmento y las
inserciones ocurren en una sola transacción. Si algo falla, el horario previo queda
intacto.

| Código | Cuándo |
|--------|--------|
| `200` | importación aplicada |
| `400` | `modo` ausente o inválido; `bloques` vacío o > 200; alguna fila inválida |
| `401` / `403` | como arriba |
| `413` | cuerpo por encima de 100 kB (200 bloques quedan holgadamente debajo) |

El `400` por fila inválida identifica la fila:

```json
{ "error": "Fila 14: la hora de término es anterior a la de inicio" }
```

El servidor rechaza **todo el lote** si alguna fila no valida, mientras que el
navegador ya había separado válidas de inválidas en la vista previa. No es
contradictorio: el navegador negocia con la persona y decide qué enviar; el servidor
recibe algo que debería estar ya limpio, y si no lo está es señal de un cliente
defectuoso o manipulado, no de un usuario distraído.

---

## `GET /api/plantilla-horario.csv` *(nueva)*

Plantilla descargable (FR-016). Pública, en línea con `/api/plantilla-csv`.

`Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`.
Se emite con BOM UTF-8 para que Excel en español muestre los acentos correctamente.

```csv
dia;inicio;fin;ramo;tipo;codigo;seccion;sala;docente
LUN;08:00;09:30;Cálculo I;CLASE;525101;1;Aula 201;
LUN;09:45;10:30;Física I;CLASE;;;Lab. Física;
MIE;11:50;13:20;Bloque protegido FI;PROTEGIDO;;;;
```

---

## `GET /api/auth/me`

Existente. Se añade al usuario el campo `carreraId` (la carrera de su entidad, o
`null`), para que la interfaz sepa qué controles mostrar sin adivinar.

```json
{ "user": { "id": 3, "nombre": "CEE Informática", "rol": "APORTANTE",
            "entidadId": 7, "carreraId": 7 } }
```

Es una comodidad de la interfaz. La autorización real ocurre en el servidor
(FR-024): la interfaz oculta lo que no corresponde, el servidor lo impide.

---

## Contrato interno · `js/services/horarioService.js`

Servicio **puro** (Principio II): sin I/O, sin red, sin base de datos.

```js
geometria(bloques) → [{ ...bloque, filaInicio, filaFin,
                        subColumna, subColumnas, ajustado, fueraDeRango }]
```

- Filas de 15 minutos sobre 08:00–21:00: `fila = 2 + (minutos - 480) / 15`.
- Ajusta al cuarto de hora los bloques que no encajan, marcando `ajustado` (R-2).
- Asigna sub-columnas a los bloques solapados del mismo día (R-3).
- Marca `fueraDeRango` sin descartar el bloque (FR-010).

```js
aMinutos("08:30")  → 510      // tolera "8:30" y "08:30:00"
aHHMM(510)         → "08:30"
```

Constantes exportadas: `HORA_INICIO = 480`, `HORA_FIN = 1260`, `PASO = 15`,
`FILAS = 52`.

---

## Contrato interno · `js/horario-csv.js`

Utilidad de navegador con doble exportación (`window` + `module.exports`), igual que
`js/csv-utils.js`, para poder probarla con Jest sin navegador.

```js
detectarBinario(textoOBuffer) → null | "xlsx" | "pdf" | "xls"
parsear(texto)                → { bloques: [...], errores: [{ fila, error }] }
aCsv(bloques)                 → texto CSV        // para descargar antes de vaciar (FR-003)
```

`parsear` autodetecta el separador entre `;`, `,` y tabulación (R-6), acepta el
encabezado en cualquier orden y con alias, y **nunca lanza**: los problemas salen por
`errores`, con el número de fila del archivo original.
