# 🗃️ Modelo de Datos — MapFI

Esquema relacional en **PostgreSQL 16**. El detalle ejecutable está en [`db/migrations/`](../db/migrations/). Este documento explica el *porqué* de cada tabla y las relaciones.

---

## 1. Diagrama entidad-relación (resumen)

```
carrera ──┐
          ├──< bloque_horario >── (nivel)
          │
          ├──< actividad_publico >── actividad ──> entidad ──< usuario
          │                              │
generacion┘                              └── periodo_academico
                                         
feriado            (catálogo independiente, cruzado por fecha)
session            (gestionado por connect-pg-simple)
schema_migrations  (control de migraciones)
```

Leyenda: `──<` = uno-a-muchos · `>──` = muchos-a-uno.

---

## 2. Tablas

### 2.1 Catálogos base

#### `carrera`
Las 13 especialidades de la Facultad de Ingeniería.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `smallint` PK | |
| `codigo` | `text` UNIQUE | ej. `ICI`, `ICC` |
| `nombre` | `text` | "Ingeniería Civil Industrial" |
| `color` | `text` | hex para la UI (calendario/heatmap) |
| `activa` | `boolean` | soft-disable |

#### `generacion` (nivel académico)
Año académico 1.º a 5.º (o más). Modelado como catálogo paramétrico para flexibilidad.

| Columna | Tipo | Notas |
|---------|------|-------|
| `nivel` | `smallint` PK | 1..N |
| `etiqueta` | `text` | "Primer año", "Segundo año"… |

> El **público objetivo** de una actividad se expresa como pares `(carrera, nivel)` en `actividad_publico`.

#### `entidad`
Organizadores aportantes.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `tipo` | `text` CHECK | `CENTRO_ALUMNOS` \| `VINCULACION` \| `GEARBOX` \| `FACULTAD` |
| `sigla` | `text` | iniciales para la UI, ej. `CEEIND`, `DOCFI` |
| `nombre` | `text` | razón completa, ej. "Centro de Estudiantes de Ingeniería Civil Industrial" |
| `carrera_id` | `smallint` FK→carrera | NULL salvo centros de alumnos |
| `reputacion` | `numeric` | **gamificación (F4)** — default 0 |
| `eventos_exitosos` | `int` | **gamificación (F4)** |
| `sello_coordinacion` | `boolean` | **gamificación (F4)** |
| `activa` | `boolean` | |

#### `periodo_academico`
Año/semestre paramétrico — habilita la actualización dinámica de años (§4).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `anio` | `smallint` | ej. 2026 |
| `semestre` | `smallint` CHECK (1,2) | |
| `fecha_inicio` | `date` | |
| `fecha_fin` | `date` | |
| `activo` | `boolean` | solo uno activo a la vez |

### 2.2 Usuarios y seguridad

#### `usuario`
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `email` | `text` UNIQUE | login |
| `password_hash` | `text` | bcrypt |
| `nombre` | `text` | |
| `rol` | `text` CHECK | `ADMIN` \| `APORTANTE` |
| `entidad_id` | `int` FK→entidad | NULL para admins |
| `activo` | `boolean` | |
| `created_at` | `timestamptz` | |

#### `session`
Tabla gestionada por `connect-pg-simple` (sid, sess, expire). Se crea vía migración para tenerla versionada.

### 2.3 Actividades (núcleo)

#### `actividad`
El evento/hito. Corazón del calendario y del match.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `titulo` | `text` | |
| `descripcion` | `text` | |
| `entidad_id` | `int` FK→entidad | organizador |
| `periodo_id` | `int` FK→periodo_academico | |
| `fecha_inicio` | `timestamptz` | |
| `fecha_fin` | `timestamptz` | |
| `periodo` | `tstzrange` GENERATED | `tstzrange(fecha_inicio, fecha_fin)` — índice **GiST** |
| `tipo` | `text` CHECK | `EVENTO` \| `HITO_ACADEMICO` \| `EXAMEN` \| `EXTRAPROGRAMATICA` \| `CHARLA` \| `TALLER` \| `ENTREGA` |
| `ramo` | `text` | asignatura asociada (ej. "Cálculo I") — migración 006 |
| `estado` | `text` CHECK | `PROPUESTA` \| `CONFIRMADA` \| `REALIZADA` \| `SUSPENDIDA` \| `REPROGRAMADA` |
| `ubicacion` | `text` | |
| `alcance_estimado` | `int` | cacheado del último cálculo de match |
| `compatibilidad_pct` | `numeric` | cacheado |
| `created_by` | `int` FK→usuario | |
| `created_at` / `updated_at` | `timestamptz` | |

**Índice clave:** `GIST (periodo)` → permite `WHERE periodo && tstzrange($1,$2)` para detectar topes de forma eficiente.

#### `actividad_publico`
Público objetivo (relación N:M con segmentos).

| Columna | Tipo | Notas |
|---------|------|-------|
| `actividad_id` | `int` FK→actividad ON DELETE CASCADE | |
| `carrera_id` | `smallint` FK→carrera | |
| `nivel` | `smallint` FK→generacion | |
| | | PK compuesta (actividad_id, carrera_id, nivel) |

### 2.4 Horarios académicos base

#### `bloque_horario`
Malla horaria recurrente por carrera/nivel — define ventanas ocupadas/protegidas/libres (§3.A).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `carrera_id` | `smallint` FK→carrera | |
| `nivel` | `smallint` FK→generacion | |
| `dia_semana` | `smallint` CHECK (1–5) | Lun=1 … Vie=5 (sin findes) |
| `hora_inicio` | `time` | |
| `hora_fin` | `time` | |
| `tipo` | `text` CHECK | `CLASE` \| `PROTEGIDO` \| `LIBRE` |
| `descripcion` | `text` | opcional |

### 2.5 Cronología

#### `feriado`
Feriados nacionales, sándwich y académicos (§4).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `fecha` | `date` UNIQUE | |
| `nombre` | `text` | |
| `tipo` | `text` CHECK | `IRRENUNCIABLE` \| `LEGAL` \| `SANDWICH` \| `ACADEMICO` |
| `es_nacional` | `boolean` | |

> Los **fines de semana** no se almacenan: se excluyen por lógica en `holidayService` (sáb/dom ignorados por defecto).

### 2.6 Población y gamificación

#### `matricula`
Cantidad de estudiantes por segmento — alimenta el **alcance estimado** del match (migración 004).

| Columna | Tipo | Notas |
|---------|------|-------|
| `carrera_id` | `smallint` FK→carrera | PK compuesta |
| `nivel` | `smallint` FK→generacion | PK compuesta |
| `cantidad` | `int` | ⚠️ el seed carga 100 por segmento como *placeholder*: ajustar a la matrícula real |

#### `reputacion_log`
Historial de ajustes de reputación por entidad (migración 005, trazabilidad de la gamificación).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `serial` PK | |
| `entidad_id` | `int` FK→entidad ON DELETE CASCADE | |
| `delta` | `numeric` | puntos sumados/restados |
| `motivo` | `text` | |
| `created_at` | `timestamptz` | |

---

## 3. Vistas analíticas (backend desacoplado para KPIs)

Definidas en `003_vistas_analitica.sql`. Punto de integración para BI (§7).

| Vista | Propósito |
|-------|-----------|
| `vw_saturacion_segmento` | Densidad de actividades por (carrera, nivel, fecha) → alimenta el **mapa de calor** |
| `vw_ocupacion_bloques` | Tasa de ocupación de bloques horarios por carrera (KPI) |
| `vw_aporte_entidad` | Nivel de aporte/participación por entidad (KPI + gamificación) |
| `vw_eventos_reprogramados` | Índice de eventos suspendidos/reprogramados por topes (KPI) |

Estas vistas se exponen vía `/api/analytics/*` y pueden conectarse directamente desde Looker/PowerBI/Python.

---

## 4. Reglas de integridad y convenciones

- **Cascada:** borrar una `actividad` elimina su `actividad_publico`.
- **Restricción temporal:** `CHECK (fecha_fin > fecha_inicio)`.
- **Solapamiento:** se consulta con `&&` sobre `periodo`, nunca comparando columnas manualmente.
- **Soft-disable:** catálogos usan `activa/activo` en lugar de borrado físico.
- **Timestamps:** todo en `timestamptz` (UTC en BD, se formatea en cliente a hora local de Chile).
- **Seeds:** las 14 carreras, niveles 1–5, entidades base (16 + Dirección de Docencia) y feriados del año vigente se cargan en `002_seed_catalogos.sql`.

---

## 5. Historial de migraciones

| Migración | Contenido |
|-----------|-----------|
| `001_schema_inicial.sql` | Tablas núcleo + `tstzrange` GENERATED con índice GiST + tabla `session` |
| `002_seed_catalogos.sql` | 14 carreras, generaciones, 17 entidades (con sigla), periodos, feriados y datos de muestra |
| `003_vistas_analitica.sql` | 4 vistas `vw_*` para heatmap y KPIs |
| `004_matricula.sql` | Tabla `matricula` (alcance del match) con placeholder de 100/segmento |
| `005_reputacion_log.sql` | Historial de reputación (gamificación) |
| `006_tags_y_ramo.sql` | Tipos `CHARLA`/`TALLER`/`ENTREGA` + columna `ramo` |
| `007_fix_seeds.sql` | Fechas de muestra relativas al deploy (no quedan en el pasado) |

Reglas: las migraciones son **aditivas** (nunca se edita una aplicada), corren automáticamente al arrancar y el registro en `schema_migrations` lo hace **solo el runner** (`js/db/migrate.js`).

---

*Ver migraciones ejecutables en [`db/migrations/`](../db/migrations/).*
