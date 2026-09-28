# Contratos HTTP — Spec 006

Solo se documentan los cambios. Todo lo no mencionado conserva su contrato actual. Errores con
`{ "error": "..." }`, como en el resto de la API.

---

## `PUT /api/actividades/:id` — dos reglas nuevas, retrocompatibles

**Autenticación**: sesión (`requireAuth`), sin cambios. **Autorización**: `puedeEditarActividad`,
sin cambios.

### Cuerpo — campo nuevo opcional

```json
{
  "titulo": "Certamen 2",
  "ramo": "Termodinámica",
  "tipo": "EXAMEN",
  "ubicacion": "Aula 104",
  "fechaInicio": "2026-11-12T18:30",
  "fechaFin": "2026-11-12T20:30",
  "actualizadoEn": "2026-09-20T14:03:11.482Z"
}
```

`actualizadoEn` es el `updated_at` que el cliente recibió. **Si no viene, no se comprueba**: los
clientes actuales («Mi panel») no cambian.

### Respuestas nuevas

| Código | Cuándo | Cuerpo |
|---|---|---|
| 400 | `titulo` presente y vacío tras recortar | `{ "error": "El título no puede quedar vacío" }` |
| 409 | `actualizadoEn` presente y ≠ `updated_at` actual | `{ "error": "Esta actividad cambió mientras la editabas. Recarga para ver la versión actual." }` |

### Respuestas que no cambian

| Código | Cuándo |
|---|---|
| 200 | Actualizada; cuerpo con la actividad y su `updated_at` nuevo |
| 400 | Fecha ilegible, fin anterior al inicio, tipo fuera del catálogo |
| 403 | La actividad no es de tu entidad y no eres administrador — **o no existe y no eres administrador** |
| 404 | La actividad no existe (solo lo recibe un administrador) |

**Orden de validación**: 403 → 404 → 400 (campos) → 409 (versión) → escritura. La versión se
comprueba lo más tarde posible, justo antes de escribir, para que un 409 signifique siempre
"los datos eran válidos pero otra persona llegó antes".

**"La eliminaron mientras la editaba"**: el "eliminar" de un centro **archiva**, y `archivar`
actualiza `updated_at`. Por eso ese caso llega como **409** por la regla de versión, no como 404.
Un borrado físico solo lo hace un superadministrador; en ese caso un centro recibe 403 (no puede
distinguirse de "no es tuya" sin revelar qué ids existen).

**Mensajes en la interfaz**: 409 muestra el texto del servidor y ofrece recargar; 403 y 404 se
muestran como *"Esta actividad ya no está disponible para editar. Recarga el calendario."*

---

## `GET /api/heatmap/semana` — `nivel=todos`

### Parámetros

| Parámetro | Antes | Ahora |
|---|---|---|
| `carreraId` (repetible) | obligatorio | sin cambios |
| `nivel` | obligatorio, entero | obligatorio, entero **o `todos`** |
| `fecha` | opcional | sin cambios |

Con `nivel=todos` el público es carreras × niveles 1-5.

### Respuestas

| Código | Cuándo | Cuerpo |
|---|---|---|
| 200 | Sin cambios de forma | la misma rejilla semanal |
| 400 | Falta `carreraId` o `nivel` (omitir `nivel` sigue siendo error) | `{ "error": "Se requieren carreraId y nivel" }` |
| 400 | Supera 20 grupos con un año concreto | `{ "error": "Máximo 20 carreras a la vez" }` (sin cambios) |
| 400 | Supera 20 grupos con `todos` | `{ "error": "Con todas las generaciones puedes combinar hasta 4 carreras" }` |

---

## `GET /api/heatmap/semestre` — varias carreras, `nivel=todos`, conteo distinto

### Parámetros

| Parámetro | Antes | Ahora |
|---|---|---|
| `carreraId` | uno, opcional | **repetible**, opcional |
| `nivel` | uno, opcional | entero, **`todos`**, u omitido |
| `desde`, `hasta` | opcionales | sin cambios |

### Semántica del conteo — cambio de comportamiento

| Selección | Antes | Ahora |
|---|---|---|
| 1 carrera, 1 año | filas de `vw_saturacion_segmento` | **igual resultado**, nueva consulta |
| 1 carrera, sin año | **suma por segmento** — una actividad para 5 años cuenta 5 | cuenta la actividad **una vez** |
| varias carreras | no soportado | actividades distintas del conjunto |

La forma de la respuesta (`{ semanas, celdas, total }`) no cambia. El límite de 20 grupos se
aplica igual que en `/semana` cuando hay carreras y `nivel=todos`.

---

## Contrato de interfaz: URL de `calendario.html`

```
/calendario.html?vista=semana&fecha=2026-11-09&carreraId=6&nivel=2
```

| Parámetro | Valores | Ver |
|---|---|---|
| `vista` | `mes` · `semana` · `agenda` | data-model §3 |
| `fecha` | `AAAA-MM-DD` | data-model §3 |
| `carreraId`, `nivel`, `entidadId`, `tipo`, `soloParticipacion` | los filtros actuales | data-model §3 |

Se escribe con `history.replaceState` al navegar y al filtrar. Cualquier valor inválido se ignora
por separado.

## Contrato de interfaz: URL de `mapa-calor.html`

Sin cambios de forma; `nivel` acepta además `todos`:

```
/mapa-calor.html?carreraId=6&carreraId=7&nivel=todos
```
