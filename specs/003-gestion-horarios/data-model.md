# Phase 1 · Modelo de datos — Gestión de horarios

**Feature**: `003-gestion-horarios` | **Fecha**: 2026-08-15

---

## Estado actual

```sql
-- db/migrations/001_schema_inicial.sql:114
CREATE TABLE bloque_horario (
    id          SERIAL   PRIMARY KEY,
    carrera_id  SMALLINT NOT NULL REFERENCES carrera(id),
    nivel       SMALLINT NOT NULL REFERENCES generacion(nivel),
    dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
    hora_inicio TIME     NOT NULL,
    hora_fin    TIME     NOT NULL,
    tipo        TEXT     NOT NULL CHECK (tipo IN ('CLASE','PROTEGIDO','LIBRE')),
    descripcion TEXT,
    CHECK (hora_fin > hora_inicio)
);
CREATE INDEX idx_bloque_segmento ON bloque_horario (carrera_id, nivel, dia_semana);
```

Se conserva íntegro. Los cambios son **aditivos** (Principio V).

---

## Cambios

### Migración `016_limpiar_horario_muestra.sql`

Elimina las siete filas de muestra sembradas por `002_seed_catalogos.sql:96`,
comparando las tuplas completas para no tocar datos editados o reales. Idempotente.
Ver R-9 en `research.md`.

### Migración `017_horario_detalle.sql`

Cuatro columnas opcionales, todas `NULL`-ables, ninguna con valor por defecto:

| Columna | Tipo | Semántica |
|---------|------|-----------|
| `codigo` | `TEXT` | Código de asignatura, p. ej. `525101` |
| `seccion` | `TEXT` | Sección, cuando la carrera dicta secciones paralelas |
| `sala` | `TEXT` | Sala o laboratorio |
| `docente` | `TEXT` | Nombre del profesor |

Se añade también un índice para el borrado y la consulta por segmento completo:

```sql
CREATE INDEX IF NOT EXISTS idx_bloque_carrera_nivel
    ON bloque_horario (carrera_id, nivel);
```

El índice existente incluye `dia_semana` como tercera columna, de modo que ya sirve
para filtrar por `(carrera_id, nivel)`; el índice nuevo es más estrecho y beneficia al
borrado masivo de un segmento. Si el análisis de rendimiento muestra que no aporta, se
retira: la tabla es pequeña (decenas de filas por segmento).

**Nota sobre `descripcion`**: no se renombra a `ramo`. La columna ya contiene ese dato
y renombrarla obligaría a tocar el DAO, el `matchService`, la vista y las pruebas a
cambio de nada observable por el usuario. En el formato de importación y en la interfaz
la columna se **presenta** como "Ramo"; en la base sigue siendo `descripcion`.

**Nota sobre restricciones de solapamiento**: no se añade una restricción de exclusión
(`EXCLUDE USING GIST`) sobre las franjas. Los solapamientos son legítimos —secciones
paralelas, un bloque protegido que cubre una franja con clases— y R-3 los resuelve
dibujándolos lado a lado.

---

## Entidades del dominio

### Bloque (fila de `bloque_horario`)

Estado que viaja del servidor al navegador, en `snake_case` como el resto de la API:

```
{ id, carrera_id, nivel, dia_semana, hora_inicio, hora_fin,
  tipo, descripcion, codigo, seccion, sala, docente }
```

**Reglas de validación** (aplicadas en el servidor, FR-024):

| Regla | Origen |
|-------|--------|
| `dia_semana` entre 1 y 5 | `CHECK` existente |
| `hora_fin > hora_inicio` | `CHECK` existente |
| `tipo` ∈ {CLASE, PROTEGIDO, LIBRE} | `CHECK` existente |
| `carrera_id` y `nivel` existen | claves foráneas |
| longitud de textos ≤ 200 | nuevo, en `server.js` |
| el usuario puede editar esa carrera | nuevo, `puedeEditarHorario()` |

### Segmento

Par `(carrera_id, nivel)`. No es una tabla: es la unidad sobre la que se importa, se
vacía, se filtra y se imprime. Un segmento puede tener cero bloques, y ese es un
estado válido y visible (grilla vacía de 08:00 a 21:00).

### Geometría (derivada, nunca almacenada)

Producida por `js/services/horarioService.js` a partir de un bloque:

```
{ filaInicio, filaFin, subColumna, subColumnas, ajustado, fueraDeRango }
```

- `filaInicio` / `filaFin`: fila CSS, `2 + (minutos - 480) / 15`.
- `subColumna` / `subColumnas`: posición horizontal dentro del día cuando hay
  solapamiento (R-3).
- `ajustado`: `true` si la hora real no caía en un cuarto de hora y el dibujo se
  ajustó (R-2). Alimenta la etiqueta, que siempre muestra la hora real.
- `fueraDeRango`: `true` si el bloque cae total o parcialmente fuera de 08:00–21:00.
  Alimenta el aviso de FR-010.

Se recalcula en cada render. Almacenarla sería duplicar estado derivado.

### Fila importada (transitoria, solo en el navegador)

Producida por `js/horario-csv.js` a partir del texto del archivo:

```
{ fila, dia, inicio, fin, ramo, tipo, codigo, seccion, sala, docente }
```

`fila` es el número de línea en el archivo original: es lo que permite que un error
diga "fila 14: hora de término anterior a la de inicio" en vez de "hay un error".

Nunca se persiste. El archivo del que proviene nunca abandona el navegador (FR-018).

---

## Autorización

No requiere esquema nuevo. Se apoya en lo que ya existe:

```
usuario.entidad_id  →  entidad.carrera_id  →  carrera.id
```

| Rol | Alcance de escritura |
|-----|----------------------|
| SUPERADMIN | cualquier carrera y generación |
| ADMIN | cualquier carrera y generación |
| APORTANTE con `entidad.carrera_id = N` | solo carrera `N`, cualquier generación |
| APORTANTE con `entidad.carrera_id IS NULL` | ninguna (VcM, Gearbox, DOCFI) |
| sin sesión | ninguna; la lectura sigue siendo pública |

El `NULL` de las entidades no ligadas a una carrera implementa FR-023 sin código
adicional: ninguna comparación con `NULL` resulta verdadera.

---

## Flujo de la importación

```
archivo .csv/.txt  ─┐
                    ├─► FileReader.readAsText()  ─► js/horario-csv.js
texto pegado       ─┘         (navegador)              (navegador)
                                                            │
                                    ┌───────────────────────┴──────────┐
                                    ▼                                  ▼
                             filas válidas                      errores por fila
                                    │                            (se muestran,
                                    ▼                             no se envían)
                          vista previa + elección
                          Reemplazar / Agregar
                                    │
                                    ▼  JSON (nunca el archivo)
                    POST /api/bloques/importar  ─► revalidación en servidor
                                                   ─► transacción
                                                      (DELETE del segmento si
                                                       modo = reemplazar)
                                                   ─► INSERT de las filas
```

La revalidación en el servidor no es redundante: el parser vive en el navegador y
por tanto está bajo control del cliente. El servidor trata cada fila del JSON como
entrada no confiable (H-04, autoridad del servidor).

El reemplazo es **transaccional**: el `DELETE` del segmento y los `INSERT` ocurren en
la misma transacción. Si un `INSERT` falla, el horario anterior sigue intacto. Sin
esto, una importación fallida dejaría el segmento vacío — el peor resultado posible,
porque destruye sin construir.
