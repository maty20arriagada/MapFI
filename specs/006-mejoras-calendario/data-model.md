# Data Model: Spec 006

Esta entrega **no añade tablas ni columnas**. Añade una vista SQL de lectura, cambia qué filas
existen (limpieza del ejemplo) y qué se valida al actualizar. Las entidades del navegador
(posición del calendario) viven en la URL.

---

## 1. Actividad de ejemplo de instalación

No es una tabla: es un **conjunto de filas de `actividad`** reconocible por su huella.

| Campo de la huella | Certamen de ejemplo | Evento de ejemplo |
|---|---|---|
| `titulo` | `Certamen 1 - Cálculo I` | `Semana del Novato` |
| `descripcion` | `Primera evaluación del semestre` | `Actividad de bienvenida a primer año` |
| `ubicacion` | `Aula 301` | `Patio central FI` |
| `entidad.sigla` | `DOCFI` | `CEEIND` |

**Regla**: una fila es de ejemplo **solo si calzan los cuatro campos**. Coincidir en el título no
basta.

**Transición**: `cualquier estado` → **eliminada**, con registro previo en `borrado_definitivo`:

| Columna de `borrado_definitivo` | Valor |
|---|---|
| `actividad_id`, `titulo`, `entidad_id`, `entidad_nombre`, `fecha_inicio`, `estado_previo` | Los de la fila eliminada |
| `borrado_por` | `NULL` (lo hace el despliegue, no una persona) |
| `motivo` | `Dato de ejemplo de instalacion (migracion 018)` |

`actividad_publico` se va con la fila por `ON DELETE CASCADE`. No se escribe en
`schema_migrations` (lo hace el runner, Principio V).

---

## 2. Actividad — reglas de actualización nuevas

Tabla existente, sin cambios de esquema. Se añaden dos reglas al `PUT /api/actividades/:id`:

| Regla | Condición | Respuesta |
|---|---|---|
| Título no vacío | `titulo` presente y vacío tras recortar espacios | **400** · `El título no puede quedar vacío` |
| Versión vigente | `actualizadoEn` presente y distinto de `updated_at` actual | **409** · `Esta actividad cambió mientras la editabas. Recarga para ver la versión actual.` |

Las reglas existentes no cambian: propiedad (403), actividad inexistente (404), rango de fechas
(400), tipo fuera del catálogo (400 por restricción de la base), cambios de estado permitidos
según rol.

**Comparación de `updated_at`**: por instante, no por texto. El cliente devuelve el valor que
recibió en `GET /api/actividades` (ISO con milisegundos); el servidor compara
`new Date(actualizadoEn).getTime()` contra el de la fila. Un valor ilegible se trata como
distinto (409): es más seguro pedir recargar que sobrescribir.

---

## 3. Posición del calendario (navegador)

Objeto que produce y consume `js/calendario-estado.js`. Vive en la URL de `calendario.html`.

| Campo | Parámetro URL | Valores válidos | Si es inválido |
|---|---|---|---|
| `vista` | `vista` | `mes`, `semana`, `agenda` | `mes` |
| `fecha` | `fecha` | `AAAA-MM-DD` que sea una fecha real | se omite (FullCalendar abre hoy) |
| `filtros.carreraId` | `carreraId` | entero positivo, o vacío = todas | se omite |
| `filtros.nivel` | `nivel` | 1-5, o vacío = todos | se omite |
| `filtros.entidadId` | `entidadId` | entero positivo | se omite |
| `filtros.tipo` | `tipo` | un tipo del catálogo | se omite |
| `filtros.soloParticipacion` | `soloParticipacion` | `1` | se omite |

Correspondencia con FullCalendar: `mes` ↔ `dayGridMonth`, `semana` ↔ `timeGridWeek`,
`agenda` ↔ `listWeek`.

**Invariante**: cada valor se valida por separado; un parámetro inválido no invalida a los demás
(FR-013). Leer y volver a escribir una URL válida devuelve la misma URL.

**Presencia frente a valor**: `carreraId=` (vacío) significa "Todas las carreras" elegido a
propósito, y es distinto de que el parámetro no exista. Solo en el segundo caso se aplica la
preselección de la carrera propia (research R-03).

---

## 4. Permiso de edición en la interfaz

Función pura `puedeEditar(actividad, usuario)`:

| Usuario | Actividad | Resultado |
|---|---|---|
| sin sesión | cualquiera | `false` |
| `ADMIN` o `SUPERADMIN` | cualquiera | `true` |
| `APORTANTE` con `entidadId = N` | `entidad_id = N` | `true` |
| `APORTANTE` con `entidadId = N` | `entidad_id ≠ N` | `false` |
| `APORTANTE` sin `entidadId` | cualquiera | `false` |

Espejo exacto de `puedeEditarActividad` en `server.js`. **Solo decide qué panel se muestra**; la
autorización real la sigue haciendo el servidor.

---

## 5. Público del mapa de calor

| Selección | Público resultante | Grupos |
|---|---|---|
| 1 carrera, año 3 | `[(c, 3)]` | 1 |
| 3 carreras, año 2 | `[(c1,2), (c2,2), (c3,2)]` | 3 |
| 1 carrera, todas | `[(c,1)…(c,5)]` | 5 |
| 4 carreras, todas | 4 × 5 | **20** (máximo) |
| 5 carreras, todas | 5 × 5 | 25 → **rechazado** |

**Conteo del semestre**: por día, número de **actividades distintas** cuyo público toca algún
grupo de la selección (una actividad de varios días cuenta en cada uno de ellos).

---

## 6. Vista `vw_saturacion_actividad` (migración 019, nueva)

Una fila por actividad vigente, por grupo de su público y por día que ocupa.

| Columna | Origen |
|---|---|
| `actividad_id` | `actividad.id` |
| `tipo` | `actividad.tipo` |
| `carrera_id`, `nivel` | `actividad_publico` |
| `fecha` | cada día entre `fecha_inicio` y `fecha_fin`, en hora de Chile |

Filtro: estados `PROPUESTA`, `CONFIRMADA`, `REALIZADA`, con el comentario de sincronización con
`ESTADOS_VIGENTES` que ya llevan las vistas 009 y 011. Es la granularidad de
`vw_saturacion_segmento` **antes** de agrupar: por eso permite contar actividades distintas. La
vista existente no se modifica.
