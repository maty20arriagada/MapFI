# Data Model: entidades documentales

**Feature**: 001-fix-guia-tecnica · **Fase**: 1 (Design)

Esta feature no toca la base de datos: no hay tablas, columnas ni migraciones. Las
"entidades" aquí son los **artefactos documentales** que se editan y la **fuente
de verdad** contra la que se validan. Se modelan sus secciones relevantes, las
reglas de validación (derivadas de los FR) y sus relaciones.

---

## Entidad: Guía Técnica (`docs/GUIA_TECNICA.md`)

Documento de patrones para desarrolladores que extienden el código.

| Sección (campo) | Contenido que DEBE reflejar | Regla de validación |
|-----------------|-----------------------------|---------------------|
| §2 Agregar una entidad | Test del DAO nuevo va en `__tests__/dao/` con mock manual de `js/db` | FR-001, FR-002; ruta existe (FR-008) |
| §6 Testing (tabla) | Filas: servicios→`__tests__/services/` (Jest); DAO→`__tests__/dao/` (jest.mock js/db); API→`__tests__/server/` y `__tests__/routes/` (supertest) | FR-001, FR-004; nota de `pg-mem` no usado (FR-003) |
| §7 Estructura de `js/` | Diagrama con `dao/`, `services/`, `views/`, `db/`, `vendor/` + módulos raíz faltantes | FR-005; un ejemplo por carpeta (no exhaustivo) |
| §3–§5, §8 (convenciones, endpoint, migraciones, errores) | Se conservan | FR-009 (no reducir alcance) |
| Menciones a "el simulador" | Eliminadas / re-justificadas | FR-006; SC-003 |

## Entidad: Arquitectura (`docs/ARQUITECTURA.md`)

Documento de más alto nivel (lectura previa a la Guía Técnica).

| Sección (campo) | Contenido que DEBE reflejar | Regla de validación |
|-----------------|-----------------------------|---------------------|
| Encabezado (línea 3) | Propósito propio de MapFI, sin "espeja el Simulador Marketing B2B" | FR-006 |
| Configuración por entorno (`DATABASE_URL` en Docker) | Justificado por la red interna de Docker, sin "igual que el simulador" | FR-006 |
| Decisiones técnicas (sin framework) | Justificado por mantenibilidad + "cero capacitación", sin "con el simulador" | FR-006 |
| Capas, flujo de match, seguridad, escalabilidad | **Intactas** (ya verificadas correctas) | FR-007 |

## Entidad: Estructura real del repositorio (fuente de verdad, solo lectura)

Conjunto contra el que se valida cada afirmación. **No se modifica.**

- `js/` → carpetas: `dao/`, `services/`, `views/`, `db/`, `vendor/`; 16 módulos raíz.
- `__tests__/` → carpetas: `services/`, `dao/`, `routes/`, `server/`.
- `db/migrations/` → `001`…`007` (numeradas, aditivas).
- `package.json` → `pg-mem` en `devDependencies` (declarado, sin uso en tests).

**Relación**: Guía Técnica y Arquitectura *describen* la Estructura real; cada ruta
citada en ellas debe **existir** en esa estructura (FR-008, SC-001). La corrección
consiste en re-alinear las dos primeras entidades con la tercera.

## Transiciones de estado

`spec.md (Draft)` → `plan.md + research.md + data-model.md + quickstart.md (este paso)`
→ `tasks.md` (/speckit-tasks) → edición de los 2 documentos (/speckit-implement)
→ validación (quickstart) → `Status: Done`.
