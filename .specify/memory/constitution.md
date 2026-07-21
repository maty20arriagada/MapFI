<!--
SYNC IMPACT REPORT
==================
Version change: (plantilla sin ratificar) → 1.0.0
Rationale: Ratificación inicial. Se reemplazan todos los placeholders de la
plantilla por los principios concretos derivados del proyecto MapFI (Fases
F0–F8 completas). Al no existir una versión previa ratificada, se adopta 1.0.0.

Principios definidos (6):
  I.   Simplicidad sin build (Vanilla-First)
  II.  Arquitectura por capas (DAO + Servicios puros)
  III. Seguridad por defecto (NO NEGOCIABLE)
  IV.  Calidad verificada (Tests + verificación en navegador)
  V.   Migraciones aditivas versionadas
  VI.  Experiencia sin capacitación (UX cero-fricción)

Secciones añadidas:
  - Restricciones Técnicas y de Despliegue
  - Flujo de Desarrollo y Puertas de Calidad
  - Governance

Secciones eliminadas: ninguna (plantilla → contenido concreto).

Templates revisados:
  ✅ .specify/templates/plan-template.md — usa el placeholder dinámico
     "[Gates determined based on constitution file]"; compatible, sin cambios.
  ✅ .specify/templates/spec-template.md — no referencia la constitución; sin cambios.
  ✅ .specify/templates/tasks-template.md — no referencia la constitución; sin cambios.
  ✅ README.md / docs/ — coherentes con estos principios; sin cambios requeridos.

Follow-up TODOs: ninguno.
-->

# MapFI Constitution

MapFI es la Plataforma de Mapeo, Planificación y Co-diseño de Actividades de la
Facultad de Ingeniería de la Universidad de Concepción, desarrollada por el
CEEIND en colaboración con el GIIA (Grupo de Interés en Inteligencia Artificial).
Esta constitución define las reglas no negociables que rigen su código y su
evolución. Prevalece sobre cualquier preferencia individual o práctica ad-hoc.

## Core Principles

### I. Simplicidad sin build (Vanilla-First)

El frontend DEBE ser HTML/CSS/JS vanilla servido tal cual, **sin paso de
compilación, sin bundler y sin framework de UI**. Las dependencias de terceros
se minimizan y, cuando se usan, se **vendorean localmente** (ej.: FullCalendar en
`js/vendor/`) para funcionar sin CDN ni conexión externa. Se prefiere una
solución inline breve del proyecto antes que agregar una dependencia (patrón
"helmet-lite", rate-limiter inline, `sanitize.js` propio). El backend usa
CommonJS y `"use strict";` en cada módulo.

**Rationale:** la plataforma debe ser mantenible por estudiantes que rotan cada
año y desplegable con un solo comando; cada dependencia o pipeline añadido es
deuda que el próximo equipo hereda. Menos superficie = más longevidad.

### II. Arquitectura por capas (DAO + Servicios puros)

La lógica DEBE separarse en capas con responsabilidades estrictas:
`server.js` (rutas delgadas: auth, validación, orquestación) → `js/dao/*`
(**solo** SQL parametrizado, sin reglas de negocio) → `js/services/*` (lógica de
negocio **pura**: sin I/O, sin acceso a red ni BD, recibe datos y devuelve
resultados). El navegador **NUNCA** accede a la base de datos: solo consume
`/api/*`. Los servicios de dominio (`matchService`, `heatmapService`,
`holidayService`, `reputationService`, `reportService`) DEBEN permanecer puros y
por tanto testeables sin contenedor.

**Rationale:** la pureza de los servicios habilita tests unitarios rápidos y
deterministas; la capa DAO aísla el SQL; el aislamiento del navegador respecto de
la BD es un requisito de seguridad, no una comodidad.

### III. Seguridad por defecto (NO NEGOCIABLE)

Todo cambio DEBE preservar estas garantías:
- Contraseñas con **bcrypt**; sesiones persistidas en Postgres (`connect-pg-simple`).
- **SQL siempre parametrizado** (`$1, $2…`); jamás interpolación de strings.
- **Sanitización XSS**: todo dato de usuario renderizado con `innerHTML` pasa por
  `escapeHtml` (`js/sanitize.js`).
- **CSP**, cabeceras de seguridad, `SameSite=strict` + validación de `Origin`/
  `Referer` en métodos que mutan, y **rate limiting** en login (5/15 min por IP).
- **La base de datos NUNCA se expone**: solo es alcanzable por el backend en la
  red interna de Docker; en producción solo se publica el puerto de la app.
- El contenedor corre como **usuario no-root**. En `NODE_ENV=production` el seed
  **rechaza** crear un admin por defecto: exige `SEED_ADMIN_*`. No hay
  credenciales reales hardcodeadas en el código.

**Rationale:** MapFI se expone a usuarios reales de la facultad con datos
institucionales; una regresión de seguridad no es un bug menor sino un incidente.

### IV. Calidad verificada (Tests + verificación en navegador)

Toda lógica pura (servicios, utilidades como `csv-utils`, `sanitize`) DEBE tener
tests **Jest**; los DAO se prueban con **mock manual de `js/db`** vía `jest.mock` y las rutas con **supertest**.
La suite completa DEBE estar **en verde antes de cada commit** (`npm test`). Los
cambios observables en la interfaz DEBEN verificarse en un navegador real (no
solo `--check` de sintaxis) antes de darlos por hechos. Cobertura objetivo:
≥ 70 % en `js/services/`, `js/dao/` y `server.js`.

**Rationale:** el proyecto será traspasado a nuevos equipos; los tests son el
contrato que evita que una mejora rompa algo ya funcionando.

### V. Migraciones aditivas versionadas

El esquema evoluciona **solo** mediante archivos `db/migrations/NNN_*.sql`
numerados, **aditivos e idempotentes**. Una migración ya aplicada en producción
**NUNCA** se edita: se crea una nueva. El registro en `schema_migrations` lo hace
**exclusivamente** el runner (`js/db/migrate.js`); una migración jamás debe
insertarlo (hacerlo rompe el arranque por clave duplicada). Los seeds usan
`ON CONFLICT DO NOTHING` y las fechas de muestra son relativas al despliegue.

**Rationale:** las migraciones corren automáticamente al arrancar; una que aborte
deja el servicio caído. La disciplina aditiva protege los datos reales.

### VI. Experiencia sin capacitación (UX cero-fricción)

La interfaz DEBE ser usable por un integrante nuevo de un centro **sin asistencia
externa** (objetivo O4). Reglas: **iconos SVG** de `js/icons.js` — **prohibido el
emoji como icono estructural**; identidad visual UdeC consistente (navy `#0E3257`
+ dorado `#C8A24B`, tipografías Lexend + Source Sans 3, tokens en
`design-system.css`); defaults inteligentes y formularios que reducen campos;
sistema de tutoriales (banner de bienvenida, tour guiado, tooltips, centro de
ayuda); mensajes de error claros y accionables. Se DEBE respetar accesibilidad
AA: contraste, navegación por teclado, `prefers-reduced-motion` y `prefers-color-
scheme`.

**Rationale:** si la plataforma es engorrosa, los centros abandonan la carga de
datos y el calendario deja de ser fuente de verdad — el producto fracasa por UX,
no por funcionalidad.

## Restricciones Técnicas y de Despliegue

- **Stack fijo:** Node.js + Express, PostgreSQL 16 (con `tstzrange` + índices
  GiST para topes de horario), frontend vanilla, empaquetado con Docker y
  `docker-compose up --build` (un comando).
- **Portabilidad:** el arranque en el servidor de la facultad DEBE ser un único
  comando; las migraciones y el seed del admin corren automáticamente.
- **Configuración por entorno:** todo secreto entra por variables de entorno
  (`.env` en local/host, variables del orquestador en la nube). `SESSION_SECRET`,
  `POSTGRES_PASSWORD` y `SEED_ADMIN_*` son obligatorios en producción.
- **Backend desacoplado para BI:** los KPIs viven detrás de vistas SQL (`vw_*`) y
  endpoints `/api/analytics/*`; agregar un indicador NO debe requerir cambiar el
  esquema base ni romper el código.
- **Namespace de cliente:** los módulos globales se exponen también bajo
  `window.MapFI` (getters perezosos) para evitar colisiones.

## Flujo de Desarrollo y Puertas de Calidad

- **Ramas y commits:** el trabajo se realiza en ramas de feature; los mensajes de
  commit son descriptivos y en español, agrupando el cambio y su justificación.
- **Puertas antes de commitear (obligatorias):** (1) `npm test` en verde; (2)
  `node --check` de los `.js` tocados y compilación de los scripts inline de HTML;
  (3) ausencia de emoji estructural y de texto "TODO" visible al usuario; (4)
  verificación en navegador si el cambio es observable en la UI.
- **Revisión de aportes externos:** todo cambio de terceros o generado
  automáticamente se **audita** antes de darlo por bueno (buscar APIs
  inexistentes, referencias colgantes, migraciones que rompan el arranque).
- **Consultar ante ambigüedad:** ante una decisión de producto o una
  interpretación con impacto (nombres institucionales, alcance, seguridad) se
  pregunta al equipo en vez de asumir.

## Governance

Esta constitución **prevalece** sobre cualquier otra práctica del proyecto. Su
propósito es preservar la mantenibilidad, la seguridad y la experiencia de uso
que hacen viable MapFI a largo plazo.

- **Enmiendas:** se proponen por escrito con su justificación, se documentan en el
  Sync Impact Report de este archivo y solo se aplican tras acuerdo del equipo
  (CEEIND + GIIA).
- **Versionado (semver):** MAJOR = remoción o redefinición incompatible de un
  principio o de la gobernanza; MINOR = nuevo principio o sección, o expansión
  material de una guía; PATCH = aclaraciones y correcciones no semánticas.
- **Cumplimiento:** toda revisión de código y todo plan de implementación
  (`plan.md` → "Constitution Check") DEBEN verificar el cumplimiento de estos
  principios. Cualquier violación necesaria se justifica explícitamente; si no se
  puede justificar, se rechaza o se simplifica el diseño.
- **Guía en tiempo de desarrollo:** el `README.md` y los documentos de `docs/`
  (arquitectura, modelo de datos, despliegue, guía del aportante) complementan
  esta constitución con el detalle operativo.

**Version**: 1.0.0 | **Ratified**: 2026-07-20 | **Last Amended**: 2026-07-20
