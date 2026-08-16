# Implementation Plan: Gestión de horarios

**Branch**: `003-gestion-horarios` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-gestion-horarios/spec.md`

## Summary

La página de Horarios tiene cinco defectos y una carencia. Muestra datos de muestra
como si fueran reales; no deja al SUPERADMIN editarlos; rompe la maqueta con cualquier
clase de 45 minutos; cambia de forma cada vez que se agrega un bloque; y no tiene ni
carga masiva, ni filtros, ni impresión.

El plan corrige los cinco y añade la carencia con tres piezas nuevas, todas dentro del
stack actual y sin dependencias:

1. Un **servicio puro** `horarioService` que traduce bloques a geometría de grilla
   —filas de 15 minutos sobre un rango fijo de 08:00 a 21:00, ajuste al cuarto de hora
   para los datos heredados, y apilado lado a lado de los solapamientos.
2. Una **utilidad de navegador** `horario-csv` que interpreta CSV, TXT y texto pegado
   bajo un mismo formato con tres separadores autodetectados, produce una vista previa
   con errores por fila y **nunca envía el archivo al servidor**.
3. Una **ampliación de la autorización** que deja a cada centro mantener el horario de
   su carrera, apoyada en la relación `entidad.carrera_id` que ya existe y ya está
   poblada.

Dos migraciones aditivas acompañan el cambio: una retira las siete filas de muestra
sin tocar datos reales, otra añade cuatro columnas opcionales (sala, docente, sección,
código).

## Technical Context

**Language/Version**: Node.js ≥ 18, CommonJS en el backend; JavaScript vanilla ES2017
en el navegador, sin paso de compilación.

**Primary Dependencies**: ninguna nueva. Express 4, `pg`, `express-session` +
`connect-pg-simple`, `bcryptjs` ya presentes. En el navegador, solo módulos propios
(`csv-utils`, `sanitize`, `api-client`, `icons`).

**Storage**: PostgreSQL 16. Tabla `bloque_horario` existente, ampliada de forma
aditiva. Sin almacenamiento de archivos de ningún tipo — es un requisito explícito
(FR-018), no un detalle de implementación.

**Testing**: Jest. Servicios y utilidades puras con pruebas unitarias; DAO con
`jest.mock` de `js/db`; rutas con `supertest`. Verificación en navegador real para
todo lo observable (Principio IV).

**Target Platform**: navegadores de escritorio y móviles actuales; servidor Linux en
contenedor Docker.

**Project Type**: aplicación web de una sola pieza — backend Express que sirve una
API JSON y páginas HTML estáticas.

**Performance Goals**: el render de la grilla debe ser imperceptible (< 50 ms) para el
tamaño real del problema: un segmento tiene decenas de bloques, no miles. La
interpretación de un archivo de 200 filas debe ser inmediata en el navegador.

**Constraints**:
- Ningún archivo aportado por el usuario puede escribirse en el servidor, ni siquiera
  temporalmente (FR-018/019), y esa garantía debe quedar bajo prueba (FR-020).
- Sin dependencias nuevas de terceros (Principio I) — lo que descarta leer `.xlsx`
  nativo y descarta también cualquier biblioteca de calendario.
- Migraciones estrictamente aditivas e idempotentes (Principio V).
- Cuerpo JSON limitado a 100 kB: la importación se acota a 200 bloques por operación.
- El horario alimenta al `matchService`; su calidad afecta las recomendaciones de
  fecha que la plataforma da a los centros.

**Scale/Scope**: 14 carreras × 5 generaciones = 70 segmentos; entre 20 y 40 bloques
por segmento. Unas 2 800 filas en el caso de que toda la Facultad cargue su horario:
una tabla pequeña, en la que la corrección importa mucho más que el rendimiento.

## Constitution Check

*GATE: debe pasar antes de la Fase 0. Reevaluado tras la Fase 1.*

### I. Simplicidad sin build (Vanilla-First) — ✅ PASA

Cero dependencias nuevas. La decisión de no aceptar `.xlsx` nativo (R-6) es
directamente una aplicación de este principio: soportarlo exigiría incorporar una
biblioteca de terceros al navegador para descomprimir y leer un formato binario. Se
resuelve con lo que ya existe — el usuario exporta a CSV o pega las celdas, y la
tabulación como separador hace que pegar funcione sin conversión.

La impresión usa `window.print()` y `@media print` en vez de generar PDF en el
servidor, aunque el proyecto ya tenga `pdfkit` para los reportes de analítica: el
navegador ya sabe hacer esto y añadir una segunda vía sería duplicar.

### II. Arquitectura por capas — ✅ PASA

| Capa | Qué se añade |
|------|--------------|
| `js/services/horarioService.js` | Geometría de la grilla. **Puro**: sin I/O, sin red, sin base de datos. |
| `js/dao/bloqueHorarioDao.js` | Solo SQL parametrizado: borrado por segmento e importación transaccional. |
| `server.js` | Rutas delgadas: autorización, validación, orquestación. |
| `js/horario-csv.js` | Utilidad de navegador, con doble exportación para poder probarla con Jest (mismo patrón que `js/csv-utils.js`). |

El navegador nunca toca la base: solo consume `/api/*`.

### III. Seguridad por defecto — ✅ PASA, con obligaciones explícitas

- **SQL parametrizado**: el borrado por segmento y la importación reciben valores por
  `$1, $2…`. El borrado masivo es la ruta de esta feature con más potencial
  destructivo; su SQL no se construye por concatenación bajo ninguna circunstancia.
- **Autoridad del servidor**: ampliar los permisos a los aportantes obliga a verificar
  cada escritura en el servidor. En particular, la carrera de un bloque que se va a
  borrar **se lee de la base**, nunca del cliente — de lo contrario un aportante
  borraría bloques ajenos declarando su propia carrera.
- **XSS**: los cuatro campos nuevos (sala, docente, sección, código) provienen de un
  archivo del usuario y se renderizan con `innerHTML` dentro de la grilla. Todos pasan
  por `escapeHtml`. Es exactamente el vector que la revisión de seguridad de la Spec
  002 encontró en otras vistas.
- **Sin subida de archivos**: FR-019 se convierte en una propiedad verificada del
  sistema, no en una intención. La prueba de FR-020 falla si alguien añade `multer`,
  `busboy` o similares.
- **Rutas públicas**: `GET /api/bloques` y la plantilla siguen sin sesión, como hoy.
  No exponen nada que no sea ya público en la página de horarios.

### IV. Calidad verificada — ✅ PASA

`horarioService` y `horario-csv` son puros y concentran la lógica difícil (aritmética
de filas, apilado de solapamientos, interpretación de texto delimitado), de modo que la
parte con más aristas queda cubierta por pruebas rápidas y deterministas. Las rutas se
prueban con supertest, incluida la matriz completa de autorización de US4. Lo
observable —proporción 45/90, ajuste al cuarto de hora, impresión— se verifica en
navegador real (`quickstart.md`).

### V. Migraciones aditivas versionadas — ✅ PASA

Dos migraciones nuevas, ninguna edición de las existentes:

- `016_limpiar_horario_muestra.sql` — un `DELETE` acotado a las siete tuplas
  **completas** sembradas por la 002. Es una excepción aparente al carácter "aditivo"
  del principio, y por eso el criterio importa: comparar todas las columnas garantiza
  que solo desaparece lo que sigue siendo literalmente el dato de muestra, y que
  cualquier fila editada o real sobrevive. Idempotente por construcción.
- `017_horario_detalle.sql` — cuatro columnas `NULL`-ables y un índice, todo con
  `IF NOT EXISTS`.

Ninguna de las dos inserta en `schema_migrations`: eso lo hace el runner.

### VI. Experiencia sin capacitación — ✅ PASA

El diseño está construido sobre esta obligación más que sobre ninguna otra:

- **Vista previa antes de confirmar**: nadie importa a ciegas.
- **Errores por fila con número y motivo**, no un "hubo un error".
- **Detección de archivos binarios** con instrucción concreta de qué hacer (R-5), en
  lugar de mostrar mojibake.
- **Tres separadores autodetectados**, para que pegar celdas desde una planilla
  funcione sin que nadie sepa qué es un CSV.
- **Descarga del horario antes de vaciarlo**, para que una operación destructiva tenga
  vuelta atrás sin pedirle nada al usuario.
- **Elección explícita entre reemplazar y agregar**, sin valor por defecto: el sistema
  no decide por el usuario entre "no pasa nada" y "se borra el semestre".
- Iconos de `js/icons.js`, sin emoji estructural; colores y tipografías de
  `design-system.css`; foco visible y `aria-label` en los controles de borrado.

### Nota sobre la Propuesta 1 de la constitución (no ratificada)

La constitución tiene escrita, sin ratificar, una propuesta según la cual ninguna
operación destructiva iniciada por un usuario debería ser un `DELETE` físico sin
retorno. Esta feature introduce dos borrados físicos: el de un bloque y el de un
segmento completo.

Se opta por **no** añadir soft-delete a `bloque_horario`, por dos razones. Un horario
no tiene el valor probatorio de una actividad publicada: no hay aviso público que
sostener, ni disputa posible sobre "quién canceló qué". Y es reconstruible en un
minuto desde el archivo del que salió. En su lugar, FR-003 ofrece descargar el horario
en el mismo formato que se importa, justo antes de vaciarlo — que da la reversibilidad
que la propuesta busca, sin una tabla de archivado que nadie consultaría.

Queda anotado para cuando el equipo ratifique o descarte la propuesta.

**Resultado del gate**: sin violaciones. La sección Complexity Tracking queda vacía.

## Project Structure

### Documentation (this feature)

```text
specs/003-gestion-horarios/
├── spec.md              # Especificación funcional
├── plan.md              # Este archivo
├── research.md          # Fase 0 — R-1 a R-10
├── data-model.md        # Fase 1 — esquema y entidades
├── quickstart.md        # Fase 1 — guía de validación
├── contracts/
│   └── api-horarios.md  # Fase 1 — contratos de API y de módulos internos
└── tasks.md             # Fase 2 — lo genera /speckit-tasks, NO este comando
```

### Source Code (repository root)

```text
db/migrations/
├── 016_limpiar_horario_muestra.sql   # NUEVO · retira los 7 bloques de muestra
└── 017_horario_detalle.sql           # NUEVO · sala, docente, seccion, codigo + indice

js/
├── services/
│   └── horarioService.js             # NUEVO · geometria de la grilla (puro)
├── dao/
│   └── bloqueHorarioDao.js           # borrado por segmento + importacion transaccional
├── horario-csv.js                    # NUEVO · interpreta CSV/TXT/pegado (navegador)
├── horarios-view.js                  # grilla fija 08-21, paso 15 min, solapamientos
└── csv-utils.js                      # + tabulacion como separador autodetectado

server.js                             # puedeEditarHorario() + 2 rutas nuevas + 3 ajustadas
horarios.html                         # importacion, filtros, borrado masivo, impresion
css/design-system.css                 # grilla de 15 min, sub-columnas, @media print

__tests__/
├── services/horarioService.test.js   # NUEVO
├── horario-csv.test.js               # NUEVO
├── dao/bloqueHorarioDao.test.js      # NUEVO
└── routes/api.test.js                # + autorizacion de horarios + ausencia de subidas

docs/
├── IMPORTACION_HORARIOS.md           # NUEVO · el formato, para los centros
└── GUIA_TECNICA.md                   # referencia al modulo nuevo
```

**Structure Decision**: se mantiene la estructura de una sola pieza del proyecto —
backend Express en la raíz, capas en `js/`, páginas HTML estáticas en la raíz. No se
introduce ninguna carpeta ni convención nueva: `horarioService.js` entra en
`js/services/` junto a los demás servicios puros, y `horario-csv.js` en `js/` junto a
`csv-utils.js`, que es su hermano y su precedente directo.

## Orden de implementación sugerido

El detalle lo genera `/speckit-tasks`; esto es la secuencia y sus dependencias.

| Fase | Contenido | Depende de |
|------|-----------|-----------|
| 0 · Base | Migraciones 016 y 017; DAO con los campos nuevos; `puedeEditarHorario()` | — |
| 1 · US1 | Borrado individual con confirmación, borrado por segmento, corrección de D-2 | Fase 0 |
| 2 · US2 | `horarioService` + reescritura de la grilla + CSS de 15 min | Fase 0 |
| 3 · US4 | Autorización por carrera en las cuatro rutas de escritura + `carreraId` en `/api/auth/me` | Fase 0 |
| 4 · US3 | `horario-csv`, vista previa, ruta de importación, plantilla, prueba de no-subida | Fases 1–3 |
| 5 · US5 | Filtros y `@media print` | Fase 2 |
| 6 · Cierre | Documentación, verificación en navegador, `npm test` y `npm run test:tz` | todas |

Las fases 1, 2 y 3 son independientes entre sí y pueden ir en paralelo. La 4 va
después porque la importación se apoya en el borrado por segmento (modo reemplazar),
en la grilla (vista previa) y en la autorización.

**MVP**: fases 0 a 2. Con eso, el horario deja de mostrar datos falsos y deja de
romperse con clases de 45 minutos, que son los dos problemas que el usuario reportó
primero.

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| La migración 016 borra datos reales de alguien | Compara las siete tuplas completas; una fila editada no coincide y sobrevive (R-9). Verificado en `quickstart.md`. |
| Una importación con "reemplazar" falla a mitad y deja el segmento vacío | El borrado y las inserciones van en una sola transacción; si algo falla, el horario previo queda intacto. |
| Ampliar permisos a los aportantes abre una vía de escritura cruzada | La carrera del bloque se lee de la base, no del cliente; matriz completa de autorización bajo prueba (US4). |
| Alguien añade una ruta de subida de archivos en el futuro y se pierde FR-018 | Prueba automatizada que falla ante middleware `multipart` o dependencias de subida (FR-020). |
| Datos heredados con horas fuera del cuarto de hora rompen la grilla nueva | El renderizador ajusta al dibujar y conserva la hora real en la etiqueta (R-2); hay un caso así en el propio seed. |
| Los campos nuevos vienen de un archivo y se renderizan con `innerHTML` | Todos pasan por `escapeHtml`; cubierto en la revisión de la fase de cierre. |

## Complexity Tracking

> Sin violaciones del Constitution Check. Sección vacía.
