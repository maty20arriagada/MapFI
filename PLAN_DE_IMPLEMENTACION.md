# 🗺️ MapFI — Plan de Implementación

> **Plataforma de Mapeo, Planificación y Co-diseño de Actividades de la Facultad de Ingeniería.**
> Documento maestro de planificación técnica. Versión 2.0 posterior a auditoría integral de julio 2026.

| | |
|---|---|
| **Estado** | MVP núcleo completo (F0–F4). En fase de cierre de brechas y pulido (F5–F8). |
| **Versión del plan** | 2.0 |
| **Última actualización** | 2026-07-01 |
| **Stack** | Node.js + Express · PostgreSQL 16 · HTML/CSS/JS vanilla · Docker |
| **Identidad visual** | UdeC Facultad de Ingeniería: navy #0E3257 · dorado #C8A24B · Lexend + Source Sans 3 |

---

## 1. Resumen ejecutivo

MapFI centraliza la agenda de eventos, hitos académicos y actividades extraprogramáticas de la Facultad de Ingeniería, interconectando a los **centros de estudiantes (14 carreras)**, la **Dirección de Vinculación con el Medio** y **Gearbox**. Resuelve tres problemas históricos:

1. **Topes de horario** entre actividades dirigidas al mismo público.
2. **Sobrecarga** de eventos en ciertos días/semanas.
3. **Falta de visibilidad** del público objetivo real al levantar una iniciativa.

El producto se apoya en tres piezas diferenciadoras:

- **Calendario centralizado e interactivo** con filtros avanzados (carrera, generación, entidad).
- **Mapa de calor** que muestra la saturación de eventos por segmento de estudiantes.
- **Calculador inteligente de compatibilidad y alcance** (algoritmo de _match_) que evalúa una fecha propuesta contra exámenes, eventos agendados, feriados y horarios críticos, y sugiere mejores bloques.

La arquitectura **replica el patrón del Simulador Marketing B2B**: backend Express monolítico con capa DAO, PostgreSQL con migraciones SQL numeradas, frontend en HTML/JS vanilla sin paso de build, y despliegue con `docker-compose up --build` en un solo comando.

---

## 2. Objetivos y alcance

### 2.1 Objetivos del producto

| # | Objetivo | Métrica de éxito |
|---|----------|------------------|
| O1 | Centralizar todas las actividades de la facultad en un solo calendario | ≥ 80 % de las entidades cargando datos al cierre del 1.er semestre de uso |
| O2 | Reducir topes de horario entre eventos del mismo público | Caída medible en eventos suspendidos/reprogramados por tope (KPI interno) |
| O3 | Dar visibilidad del público objetivo real antes de agendar | Uso del calculador de _match_ antes de confirmar ≥ 60 % de los eventos |
| O4 | Operar sin capacitación previa | Un integrante nuevo de un centro publica un evento sin asistencia |

### 2.2 Estado actual del MVP (julio 2026)

✅ **Completado (F0–F4):**

- Autenticación de Usuarios Aportantes con credenciales propias (email + contraseña).
- Calendario centralizado interactivo con vista mensual/semanal.
- Filtros avanzados: carrera, generación/año, entidad organizadora.
- Carga y gestión (CRUD) de actividades por parte de los aportantes.
- Carga de bloques horarios base por carrera/generación.
- Sincronización de feriados nacionales + exclusión de fines de semana.
- **Algoritmo de Match**: porcentaje de compatibilidad, alcance estimado y 3 sugerencias.
- **Mapa de calor** de saturación por segmento de público.
- Vista pública (sin login) del calendario para alumnado/docentes.
- Gamificación: indicador de confiabilidad, sello de coordinación, ranking público.
- Reportes de impacto en PDF por entidad.
- Panel de KPIs + endpoints analíticos para BI.
- Importación masiva de evaluaciones vía CSV (solo ADMIN).

🔧 **En ejecución (F5–F8, este plan):**

- Cierre de brechas funcionales que impiden uso real por los CEE.
- Sistema de tutoriales y onboarding para cumplir O4 ("cero capacitación").
- Correcciones de seguridad, UX y calidad de código.
- Multi-carrera en dashboard de aportantes, edición inline, conflictos visuales.

### 2.3 Fuera de alcance (por ahora)

- App móvil nativa (la web es responsiva — cubre móvil).
- Integración con sistemas académicos internos (SIES/Banner).
- Notificaciones push / email transaccional.
- SSO institucional (Google/Microsoft).

---

## 3. Decisiones de arquitectura

> Detalle completo en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

| Decisión | Elección | Por qué |
|----------|----------|---------|
| Lenguaje backend | **Node.js + Express** | Mismo patrón que el Simulador Marketing; bajo costo de entrada, ecosistema maduro |
| Base de datos | **PostgreSQL 16** | Tipos nativos `tstzrange`, índices GiST para solapamiento de fechas, vistas para analítica |
| Frontend | **HTML/CSS/JS vanilla** (sin build) | Cero pipeline de compilación, fácil de mantener por estudiantes; espeja el simulador |
| Calendario UI | **FullCalendar** (vendoreado/CDN) | Estándar de facto, soporta vistas mes/semana y eventos densos |
| Autenticación | **express-session + bcryptjs + connect-pg-simple** | Credenciales propias, sesiones persistidas en Postgres (cluster-safe) |
| Migraciones | **SQL numerado** (`db/migrations/00X_*.sql`) | Transparente, versionable, sin ORM; corre al arrancar |
| Acceso a datos | **Patrón DAO** (`js/dao/*.js`) | Separa SQL de la lógica de rutas; testeable con `pg-mem` |
| Lógica de negocio | **Servicios** (`js/services/*.js`) | `matchService`, `heatmapService`, `holidayService` aislados y puros |
| Testing | **Jest + supertest + pg-mem** | Mismo stack del simulador; BD en memoria para tests rápidos |
| Empaquetado | **Docker + docker-compose** | `docker-compose up --build` levanta todo en un comando |
| Hosting | **Servidor de la facultad (Docker)**, opción Railway/Render | Procfile + nixpacks incluidos como alternativa cloud |

### 3.1 Principios rectores

- **Backend desacoplado:** la lógica de KPIs vive detrás de vistas SQL y endpoints `/api/analytics/*`, de modo que agregar un indicador mañana no rompe el código base (requisito §7 de la descripción).
- **Esquema abierto:** vistas analíticas pensadas para conectar Looker/PowerBI/Python directamente.
- **Parametrización temporal:** el año académico es un parámetro (`periodo_academico`), permitiendo clonar/reajustar el calendario anual sin tocar código.
- **Cero capacitación:** UI limpia, responsiva, con iconografía coherente (Lucide vendoreado en `js/icons.js`) y sistema de tutoriales integrado (Fase 7).

---

## 4. Actores y roles

| Actor | Acceso | Capacidades |
|-------|--------|-------------|
| **Centro de Estudiantes** (×14) | Login (rol `APORTANTE`) | CRUD de sus actividades, multi-carrera, usar match, ver mapa de calor, importar CSV |
| **Vinculación con el Medio** | Login (rol `APORTANTE`) | Igual que centros; entidad de tipo `VINCULACION` |
| **Gearbox** | Login (rol `APORTANTE`) | Igual que centros; entidad de tipo `GEARBOX` |
| **Administrador** | Login (rol `ADMIN`) | Gestiona catálogos, usuarios, bloques horarios, revisa y aprueba importaciones CSV |
| **Público general** (alumnado, docentes, autoridades) | Sin login | Visualiza calendario y mapa de calor (solo lectura), navega centro de ayuda |

---

## 5. Módulos funcionales

Trazabilidad directa con la descripción funcional (`Descripcion_MapFI.txt`):

| Módulo | Sección origen | Componentes principales | Estado |
|--------|----------------|-------------------------|--------|
| **M1 · Autenticación** | §5 | `login.html`, sesiones, `userDao`, middleware `requireAuth` | ✅ |
| **M2 · Catálogos** | §2, §4 | carreras, generaciones, entidades, periodos académicos | ✅ |
| **M3 · Calendario centralizado** | §3.A | `calendario.html`, `calendar-view.js`, `actividadDao`, filtros | ✅ |
| **M4 · Bloques horarios académicos** | §3.A | `bloqueHorarioDao`, carga por carrera/generación | ✅ |
| **M5 · Lógica cronológica** | §4 | `holidayService` (feriados + exclusión findes + años) | ✅ |
| **M6 · Calculador de Match** | §3.C | `matchService`, `match.html`, sugerencias de bloques | ✅ |
| **M7 · Mapa de calor** | §3.B | `heatmapService`, `mapa-calor.html`, vistas SQL | ✅ |
| **M8 · Gamificación** | §5 | reputación, sellos, ranking público | ✅ |
| **M9 · Reportes PDF** | §5 | generación de informe semestral por entidad (`pdfkit`) | ✅ |
| **M10 · Panel de KPIs / BI** | §7 | vistas analíticas + endpoints `/api/analytics` | ✅ |
| **M11 · Dashboard multi-carrera** | §3.A | Selección de múltiples carreras/años por evento en dashboard | 🔧 F6 |
| **M12 · Tabla de eventos** | §3.A | Vista "Mis Eventos" con edición inline y cambio rápido de estado | 🔧 F6 |
| **M13 · Conflictos visuales** | §3.C | Señalización de choques en calendario (badge ⚠️, borde naranja) | 🔧 F6 |
| **M14 · Importación CSV híbrida** | §3.A | CEE sube → estado PROPUESTA → admin aprueba/rechaza | 🔧 F6 |
| **M15 · Sistema de tutoriales** | §5 | Onboarding, tour guiado 5 pasos, tooltips, centro de ayuda | 🔧 F7 |

---

## 6. Modelo de datos (resumen)

> Esquema completo en [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) y migraciones en [`db/migrations/`](db/migrations/).

Entidades núcleo:

- **`carrera`** — las 14 especialidades (código, nombre, color para UI).
- **`generacion` / nivel académico** — 1.er a 5.º año (o más), paramétrico.
- **`entidad`** — organizador: centro de alumnos, Vinculación o Gearbox (incluye campos de reputación).
- **`usuario`** — credenciales (email, `password_hash` bcrypt), rol, entidad asociada.
- **`actividad`** — el evento: rango de tiempo (`tstzrange` con índice GiST para solapamiento), tipo, estado, alcance estimado, compatibilidad cacheada, ramo.
- **`actividad_publico`** — público objetivo: pares (carrera, nivel) en relación N:M.
- **`bloque_horario`** — malla horaria base recurrente por carrera/nivel/día.
- **`feriado`** — feriados nacionales, sándwich y académicos.
- **`periodo_academico`** — año/semestre paramétrico (clonación anual).
- **`matricula`** — cantidad de alumnos por carrera/nivel (alimenta cálculo de alcance).
- **Vistas analíticas** — `vw_saturacion_segmento`, `vw_ocupacion_bloques`, `vw_aporte_entidad`, `vw_eventos_reprogramados`.

**Migraciones pendientes en este plan:**

| Migración | Contenido | Fase |
|-----------|-----------|------|
| `006_tags_y_ramo.sql` | Tags CHARLA, TALLER, ENTREGA + columna `ramo TEXT` | F6 |
| `007_fix_seeds.sql` | Fechas semilla relativas (no hardcodeadas a 2026) + advertencia de matrícula placeholder | F8 |

Decisión clave: usar `tstzrange` + operador de solapamiento `&&` con índice GiST resuelve elegante y eficientemente las consultas de tope de horario y densidad del mapa de calor (requisito §6 de la descripción).

---

## 7. Algoritmo de Match (resumen)

> Especificación detallada en [`docs/ALGORITMO_MATCH.md`](docs/ALGORITMO_MATCH.md).

**Entrada:** fecha/hora propuesta + público objetivo (conjunto de pares carrera×nivel) + entidad.

**Proceso (puntaje ponderado 0–100):**

1. **Descartes duros:** fin de semana o feriado → compatibilidad muy baja.
2. **Choque con clases/bloques protegidos** del público en ese día/hora → penaliza.
3. **Choque con exámenes** del segmento en la ventana → penaliza fuerte.
4. **Saturación**: otros eventos confirmados al mismo público en la semana/bloque → penaliza.
5. **Cómputo de alcance estimado:** población base de los segmentos × (1 − fracción bloqueada por topes).

**Salida:** `{ compatibilidad_pct, alcance_estimado, conflictos[], sugerencias[] }` — donde `sugerencias` son los **3 mejores bloques alternativos** de la semana si la compatibilidad es baja.

El servicio es **puro** (sin estado, sin I/O directo): recibe datos ya cargados por el DAO y devuelve el cálculo, lo que lo hace 100 % testeable con Jest.

---

## 8. Estructura del repositorio

```
mapfi/
├── PLAN_DE_IMPLEMENTACION.md      ← este documento (v2.0)
├── README.md                      ← inicio rápido
├── docker-compose.yaml            ← orquestación db + server
├── docker-compose.dev.yaml        ← desarrollo (DB expuesta al host)
├── Dockerfile                     ← imagen del server (node:20-alpine)
├── .env.example                   ← variables de entorno requeridas
├── .gitignore
├── package.json
├── server.js                      ← Express: rutas, auth, estáticos
├── Procfile                       ← Railway/Heroku
├── nixpacks.toml                  ← Railway/Render
│
├── db/migrations/                 ← esquema SQL numerado
│   ├── 001_schema_inicial.sql     ← tablas núcleo + tstzrange GiST
│   ├── 002_seed_catalogos.sql     ← 14 carreras, entidades, feriados
│   ├── 003_vistas_analitica.sql   ← 4 vistas para KPIs
│   ├── 004_matricula.sql          ← tabla de matrícula por segmento
│   ├── 005_reputacion_log.sql     ← log de cambios de reputación
│   ├── 006_tags_y_ramo.sql        ← 🔧 tags CHARLA/TALLER/ENTREGA + ramo
│   └── 007_fix_seeds.sql          ← 🔧 fechas semilla relativas
│
├── js/
│   ├── db/
│   │   ├── index.js               ← pg Pool
│   │   ├── migrate.js             ← runner de migraciones + seed admin
│   │   └── reset-admin.js         ← CLI para reset de admin
│   ├── dao/                       ← acceso a datos por entidad
│   │   ├── actividadDao.js
│   │   ├── bloqueHorarioDao.js
│   │   ├── carreraDao.js
│   │   ├── entidadDao.js
│   │   ├── feriadoDao.js
│   │   ├── generacionDao.js
│   │   ├── kpiDao.js
│   │   ├── periodoDao.js
│   │   └── userDao.js
│   ├── services/                  ← lógica pura (sin I/O)
│   │   ├── matchService.js
│   │   ├── heatmapService.js
│   │   ├── holidayService.js
│   │   ├── reputationService.js
│   │   └── reportService.js
│   ├── views/                     ← 🔧 módulos de vista (extraídos de HTML inline)
│   │   ├── dashboard-view.js
│   │   ├── calendario-view.js
│   │   ├── event-table.js
│   │   ├── onboarding.js
│   │   ├── tour.js
│   │   └── tooltips.js
│   ├── scripts/
│   │   └── convert-giia.js        ← 🔧 PNG → SVG (logo GIIA)
│   ├── vendor/                    ← 🔧 copia local de FullCalendar (fallback)
│   ├── sanitize.js                ← 🔧 helper escapeHtml()
│   ├── api-client.js              ← wrapper fetch único
│   ├── app-boot.js                ← sesión + visibilidad nav
│   ├── calendar-view.js           ← integración FullCalendar
│   ├── heatmap-view.js            ← render mapa de calor
│   ├── horarios-view.js           ← grilla horaria semanal
│   ├── match-calculator.js        ← UI del calculador
│   ├── admin-panel.js             ← UI admin CRUD
│   ├── kpis-view.js               ← UI panel KPIs
│   ├── filters.js                 ← carga catálogos + dropdowns
│   ├── theme-toggle.js            ← modo claro/oscuro
│   ├── ui-toast.js                ← notificaciones toast
│   ├── layout.js                  ← header + footer + navbar
│   ├── icons.js                   ← Lucide vendoreado
│   └── load-env.js                ← carga .env (desarrollo local)
│
├── css/
│   └── design-system.css          ← sistema de diseño UdeC FI
│
├── img/
│   ├── udec_FI.svg                ← logo oficial facultad
│   └── GIIA.svg                   ← 🔧 logo GIIA vectorizado (antes .png)
│
├── *.html                         ← 11 páginas (index, login, dashboard,
│   │                                 calendario, horarios, mapa-calor, match,
│   │                                 kpis, admin, cuenta, ayuda)
│
├── __tests__/
│   ├── dao/                       ← 🔧 tests de integración DAO
│   ├── routes/                    ← 🔧 tests de API con supertest
│   └── services/                  ← match, holiday, reputation, report
│
└── docs/                          ← arquitectura, modelo de datos, guías, etc.
```

---

## 9. Roadmap por fases

### Fases completadas (F0–F4)

| Fase | Nombre | Entregable | Estado |
|------|--------|-----------|--------|
| **F0** | Scaffold & DevOps | Repo ejecutable, Docker, CI básico | ✅ |
| **F1** | Auth & Catálogos | Login, CRUD de carreras/entidades/usuarios, periodos | ✅ |
| **F2** | Calendario & Cronología | FullCalendar con filtros, CRUD actividades, bloques, feriados | ✅ |
| **F3** | Match & Mapa de calor | Algoritmo de compatibilidad + sugerencias + heatmap | ✅ |
| **F4** | Gamificación, PDF & BI | Reputación, reportes PDF, panel KPIs, endpoints analíticos | ✅ |

### Fases en ejecución (F5–F8)

| Fase | Nombre | Objetivo | Horas |
|------|--------|----------|-------|
| **F5** | Seguridad y Robustez Base | Sanitización, rate limiting, sin credenciales expuestas | 6.5 h |
| **F6** | Cierre de Brechas MVP | Multi-carrera, tabla eventos, conflictos visuales, tags, CSV híbrido | 22 h |
| **F7** | Tutoriales y Experiencia de Usuario | Onboarding, tour guiado, tooltips, centro de ayuda, arreglos UX | 16 h |
| **F8** | Robustez Técnica | JS modularizado, tests DAO/API, namespace, docs actualizados | 12 h |
| **Total** | | | **~56.5 h** |

---

## 10. Estrategia de pruebas

- **Unitarias (servicios):** `matchService` y `heatmapService` son puros → cobertura alta con casos límite (feriados, findes, topes totales/parciales, segmentos vacíos).
- **Integración (DAO):** con `pg-mem` (Postgres en memoria) para validar el SQL sin contenedor. **Pendiente**: implementar en Fase 8.
- **API (supertest):** rutas de auth, CRUD de actividades, endpoint de match. **Pendiente**: implementar en Fase 8.
- **Smoke E2E manual:** checklist de despliegue (ver `docs/DESPLIEGUE.md`).
- Objetivo de cobertura final: **≥ 70 %** en `js/services/`, `js/dao/` y `server.js`.

---

## 11. Despliegue

> Guía completa en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

**Local / servidor de la facultad (recomendado):**

```bash
cp .env.example .env      # completar secretos
docker-compose up --build # levanta Postgres + server; migraciones automáticas
# → http://localhost:3000
```

**Cloud (alternativa):** Railway / Render usando `Procfile` + `nixpacks.toml`; la `DATABASE_URL` la provee el dashboard del servicio Postgres.

---

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Datos desactualizados (abandono de aportantes) | Alto | Gamificación (F4 completada) + UI de cero fricción + tutoriales (F7) |
| Calidad de los bloques horarios base | Alto | Carga asistida por admin + import masivo CSV |
| Complejidad del algoritmo de match | Medio | Servicio puro + tests exhaustivos + parámetros configurables |
| Feriados regionales/decretados de último minuto | Medio | Tabla `feriado` editable por admin + sync con fuente nacional |
| Escalamiento (muchos eventos) | Bajo | Índices GiST sobre `tstzrange`; vistas materializables si crece |
| Cambio de año académico | Medio | `periodo_academico` paramétrico + función de clonación (backlog) |
| Confusión del usuario en primera experiencia | Alto | Sistema de tutoriales integrado (F7): banner, tour, tooltips, centro de ayuda |
| CEE no puede crear ramos compartidos | Alto | Dashboard multi-carrera/nivel (F6.2) — **brecha crítica actual** |

---

## 13. Próximos pasos

1. Ejecutar **Fase 5** (Seguridad) en orden — es el pre-requisito para exponer la plataforma a usuarios reales.
2. Ejecutar **Fase 6** (Brechas MVP) en este orden:
   - 6.1 Tags CHARLA/TALLER/ENTREGA + campo `ramo`
   - 6.2 Dashboard multi-carrera/nivel (crítico)
   - 6.3 Tabla "Mis Eventos" con edición inline
   - 6.4 Conflictos visuales en calendario
   - 6.5 Importación CSV híbrida (CEE → admin aprueba)
   - 6.6 Plantilla CSV descargable
   - 6.7 Conversión GIIA.png → SVG
3. Ejecutar **Fase 7** (Tutoriales + UX):
   - 7.1 Banner de bienvenida (primer login)
   - 7.2 Tour guiado de 5 pasos con capturas anotadas
   - 7.3 Tooltips contextuales en formularios
   - 7.4 Centro de ayuda (`ayuda.html`)
   - 7.5 Correcciones UX (errores amigables, loaders, mensajes claros)
   - 7.6 Estilos CSS para tutoriales
4. Ejecutar **Fase 8** (Robustez):
   - 8.1–8.2 Extraer JS inline de HTML a módulos
   - 8.3–8.4 Tests de integración DAO y API
   - 8.5 Namespace `window.MapFI`
   - 8.6 Migración 007 (fix seeds)
   - 8.7 Actualizar docs

---

## 14. Trazabilidad con la descripción funcional

| Requisito (`Descripcion_MapFI.txt`) | Dónde se resuelve |
|---|---|
| §1 Centralización | M3 Calendario + M2 Catálogos |
| §2 Actores y roles | `usuario.rol`, `entidad.tipo`, vista pública |
| §3.A Calendario + filtros + horarios | M3 + M4 |
| §3.B Mapa de calor | M7 + `vw_saturacion_segmento` |
| §3.C Calculador de match | M6 `matchService` |
| §4 Feriados, findes, años | M5 `holidayService` + `periodo_academico` |
| §5 Login + gamificación | M1 + M8 + M9 |
| §6 Docker + PostgreSQL + UI simple | Secciones 3 y 15 (arquitectura + tutoriales) |
| §7 KPIs desacoplados + BI | M10 + vistas analíticas |

---

## 15. Fase 5 · Seguridad y Robustez Base

> **Objetivo**: Eliminar vulnerabilidades que impedirían exponer la plataforma a usuarios reales.
> **Pre-requisito para F6–F8.** No depende de ninguna otra fase.

### Tareas

| # | Tarea | H | Archivos | Descripción |
|---|-------|---|----------|-------------|
| 5.1 | Rate limiting en login | 1.5 | `server.js:114`, `package.json` | Instalar `express-rate-limit`. Limitar `/api/auth/login` a 5 intentos cada 15 min por IP. |
| 5.2 | Quitar credenciales hardcodeadas | 0.5 | `js/db/migrate.js:75-76`, `.env.example` | Borrar `admin@mapfi.cl` / `admin1234` del código fuente. Solo variables de entorno. Agregar validación que niegue seed en producción sin `SEED_ADMIN_*`. |
| 5.3 | Sanitización XSS | 1.5 | Nuevo `js/sanitize.js`, `calendar-view.js:80-81`, `match-calculator.js` | Función `escapeHtml()` para títulos, descripciones y nombres de entidad en todo renderizado de eventos. |
| 5.4 | Cookies SameSite strict | 1.0 | `server.js:70-81` | Cambiar `sameSite: "lax"` → `"strict"`. Agregar validación de `Origin`/`Referer` en POST/PUT/DELETE. |
| 5.5 | Contraseña type="password" en admin | 0.3 | `admin.html:29` | Cambiar `<input type="text">` → `<input type="password">` en formulario de creación de usuarios. |
| 5.6 | Eliminar alert() fallback | 0.5 | `calendar-view.js:62` | Si `ui-toast.js` no cargó, usar `console.warn` + renderizar texto en un div en lugar de `alert()`. |
| 5.7 | Borrar "TODO(F3)" visible | 0.2 | `js/heatmap-view.js:12-13` | Reemplazar texto "TODO(F3): grilla coloreada…" por mensaje profesional: "Sin datos de saturación para este filtro." |
| 5.8 | CDN con integrity + fallback local | 1.0 | `dashboard.html:75-77`, `calendario.html:109-111`, `js/vendor/` | Agregar atributo `integrity` + `crossorigin` a los `<script>` de FullCalendar. Copiar `.min.js` a `js/vendor/fullcalendar/` como fallback offline. |
| **Subtotal** | | **6.5 h** | | |

### Criterio de aceptación

- Login bloquea tras 5 intentos fallidos desde misma IP.
- No existe ninguna credencial hardcodeada en el código fuente.
- Títulos de eventos con `<script>` no ejecutan código.
- Sin `alert()` en ninguna circunstancia.
- Sin texto "TODO" visible para el usuario final.
- FullCalendar funciona offline (copia local).

---

## 16. Fase 6 · Cierre de Brechas del MVP

> **Objetivo**: Corregir las brechas funcionales que impiden el uso real por parte de los Centros de Estudiantes.
> **Depende de**: Fase 5.

### 16.1 — Tags CHARLA, TALLER, ENTREGA + campo `ramo` [2 h]

**Problema**: El `CHECK` de `actividad.tipo` solo permite EVENTO, HITO_ACADEMICO, EXAMEN, EXTRAPROGRAMATICA. Los CEE necesitan clasificar como "Charla", "Taller", "Entrega". Tampoco existe campo para el nombre del ramo.

**Migración `006_tags_y_ramo.sql`**:
```sql
ALTER TABLE actividad DROP CONSTRAINT IF EXISTS actividad_tipo_check;
ALTER TABLE actividad ADD CONSTRAINT actividad_tipo_check
  CHECK (tipo IN ('EVENTO','HITO_ACADEMICO','EXAMEN','EXTRAPROGRAMATICA','CHARLA','TALLER','ENTREGA'));
ALTER TABLE actividad ADD COLUMN IF NOT EXISTS ramo TEXT;
```

**Archivos**: `db/migrations/006_tags_y_ramo.sql`, `js/dao/actividadDao.js`, `calendar-view.js:6-11`, `dashboard.html`, `calendario.html`

**Colores nuevos en `calendar-view.js`**:
```js
CHARLA: "#F59E0B", TALLER: "#10B981", ENTREGA: "#8B5CF6"
```

### 16.2 — Dashboard multi-carrera/nivel para APORTANTES [4 h]

**Problema**: `dashboard.html:36` usa `<select name="carreraId">` — solo permite UNA carrera. La BD soporta N:M vía `actividad_publico` pero la UI no lo expone. Esto rompe el caso de uso principal: "Cálculo I lo dan Industrial, Civil e Informática".

**Solución**: Reemplazar selects únicos por checkboxes multi-selección (mismo patrón que `calendario.html:52-58`).

**Cambios en `dashboard.html`**:

```html
<!-- ANTES -->
<select name="carreraId" id="aCarrera" required></select>
<select name="nivel" id="aNivel" required></select>

<!-- DESPUÉS -->
<div id="aCarreras" class="checklist"></div>
<div id="aNiveles" class="checklist"></div>
```

**Cambios en JS inline del dashboard**:
```js
// Construir público como producto cartesiano
const carreras = [...document.querySelectorAll('#aCarreras input:checked')].map(cb => +cb.value);
const niveles  = [...document.querySelectorAll('#aNiveles input:checked')].map(cb => +cb.value);
const publico  = carreras.flatMap(carreraId => niveles.map(nivel => ({ carreraId, nivel })));
```

**Defaults inteligentes**: Carrera del CEE pre-chequeada. Último contexto guardado en `localStorage`.

**Validación**: Al menos 1 carrera y 1 nivel seleccionados. Toast amigable si no.

### 16.3 — Tabla "Mis Eventos" con edición inline [5 h]

**Problema**: El dashboard solo muestra un calendario. No hay vista de lista/tabla para gestionar rápidamente los eventos propios.

**Solución**: Nueva sección debajo de las KPI cards con tabla:

| Título | Ramo | Tipo | Fecha | Carreras | Estado | Acciones |
|--------|------|------|-------|----------|--------|----------|
| Certamen 1 | Cálculo I | EXAMEN | 15/04 18:30 | ICI, ICINF, ICM | CONFIRMADA | [✏️] [🗑️] |

**Modal de edición inline**: Al hacer clic en [✏️]:
- Datepicker para fecha_inicio y fecha_fin (`datetime-local`)
- Select para cambiar estado
- Botón "Guardar cambios" → `PUT /api/actividades/:id`
- Botón "Eliminar" → `DELETE /api/actividades/:id` con confirmación

**Archivos**: `dashboard.html`, nuevo `js/views/event-table.js`

### 16.4 — Conflictos visuales en calendario [4 h]

**Problema**: El algoritmo de Match detecta choques, pero no hay señalización visual proactiva en el calendario público.

**Solución**:

1. **Endpoint** `GET /api/actividades/conflictos?carreraId=X&nivel=Y`
   ```sql
   SELECT a1.id, a2.id AS conflicta_con
   FROM actividad a1
   JOIN actividad a2 ON a1.id <> a2.id AND a1.periodo && a2.periodo
   JOIN actividad_publico ap1 ON ap1.actividad_id = a1.id
   JOIN actividad_publico ap2 ON ap2.actividad_id = a2.id
     AND ap2.carrera_id = ap1.carrera_id AND ap2.nivel = ap1.nivel
   WHERE a1.estado = 'CONFIRMADA' AND a2.estado = 'CONFIRMADA'
   ```

2. **Visualización** en `calendar-view.js`:
   - Eventos con conflicto reciben clase CSS `evento-conflicto`
   - Borde naranja + badge ⚠️ en tooltip de FullCalendar
   - Tooltip muestra: "⚠️ Choque detectado con [nombre del otro evento]"

3. **Estilos** nuevos en `design-system.css`:
   ```css
   .fc-event.evento-conflicto { border: 2px solid #F59E0B !important; }
   .fc-event.evento-conflicto::after { content: "⚠️"; position: absolute; top: 2px; right: 4px; font-size: .7rem; }
   ```

### 16.5 — Importación CSV híbrida (CEE → admin revisa) [5 h]

**Problema**: `POST /api/actividades/bulk` requiere rol ADMIN (`server.js:194`). Los CEE no pueden importar su propio Excel. El usuario quiere flujo con revisión.

**Solución — Flujo en 3 pasos**:

```
PASO 1: CEE sube CSV desde su dashboard
  → POST /api/actividades/bulk (requireAuth, ya no requireRole ADMIN)
  → estado = 'PROPUESTA'
  → entidad_id = session.user.entidadId

PASO 2: Admin ve panel "Pendientes de revisión"
  → GET /api/admin/pendientes → lista actividades en PROPUESTA
  → Nueva sección en admin.html o calendario.html

PASO 3: Admin aprueba o rechaza
  → POST /api/admin/actividades/revisar
  → body: { ids: [1,2,3], accion: 'APROBAR'|'RECHAZAR' }
  → APROBAR → estado = 'CONFIRMADA'
  → RECHAZAR → estado = 'SUSPENDIDA' (o DELETE)
```

**Archivos**: `server.js`, `admin.html`, `calendario.html`, `dashboard.html`

### 16.6 — Plantilla CSV descargable [1.5 h]

**Problema**: El botón "Descargar plantilla" en `calendario.html:70` existe pero no tiene evento onclick implementado. No hay endpoint que sirva el archivo.

**Solución**: `GET /api/plantilla-csv` → responde con:
```csv
titulo,ramo,tipo,inicio,fin,carreras,niveles,ubicacion
"Certamen 1","Cálculo I",EXAMEN,2026-04-15 18:30,2026-04-15 20:00,ICI|ICINF|ICM,1,"Aula Magna"
```

**Headers HTTP**: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="plantilla-mapfi.csv"`

**UI**: Conectar onclick del botón existente. También agregar botón en dashboard del APORTANTE.

### 16.7 — Conversión GIIA.png → SVG [0.5 h]

**Problema**: El logo GIIA en el footer es PNG (1254×1254, raster). El logo de la facultad es SVG (nítido a cualquier resolución). En dark mode el PNG no tiene filtro de inversión como el SVG, y en pantallas de alta densidad se ve borroso junto al otro logo.

**Solución**:

1. Crear script `js/scripts/convert-giia.js` con `sharp` + `potrace`
2. Ejecutar: `node js/scripts/convert-giia.js`
3. Resultado: `img/GIIA.svg` y `addons/GIIA.svg`
4. Cambiar `js/layout.js:63`: `src="img/GIIA.png"` → `src="img/GIIA.svg"`
5. Agregar filtro dark mode en CSS:
   ```css
   [data-theme="dark"] .giia-logo { filter: brightness(0) invert(1); opacity: .92; }
   ```
6. Eliminar `img/GIIA.png` y `addons/GIIA.png`

### Resumen Fase 6

| # | Tarea | Horas |
|---|-------|-------|
| 6.1 | Tags CHARLA/TALLER/ENTREGA + campo ramo | 2 |
| 6.2 | Dashboard multi-carrera/nivel | 4 |
| 6.3 | Tabla "Mis Eventos" + edición inline | 5 |
| 6.4 | Conflictos visuales en calendario | 4 |
| 6.5 | Importación CSV híbrida | 5 |
| 6.6 | Plantilla CSV descargable | 1.5 |
| 6.7 | GIIA.png → SVG | 0.5 |
| **Total** | | **22 h** |

---

## 17. Fase 7 · Tutoriales y Experiencia de Usuario

> **Objetivo**: Que la plataforma sea auto-explicativa. Un integrante nuevo de un CEE publica su primer evento sin asistencia externa (objetivo O4).
> **Depende de**: Fase 6 (necesita multi-carrera, tags y tabla de eventos implementados para las capturas).

### Estrategia: 4 capas de ayuda progresiva

```
Capa 1 (primer login)  → Banner de bienvenida
Capa 2 (proactivo)     → Tour guiado de 5 pasos
Capa 3 (en el momento) → Tooltips contextuales (ícono ?)
Capa 4 (permanente)    → Centro de ayuda (página ayuda.html)
```

### 17.1 — Banner de bienvenida [2 h]

Se muestra **solo en el primer login** (control por `localStorage`). El usuario puede iniciar el tour o saltarlo.

```
┌──────────────────────────────────────────────────────────────┐
│  👋 ¡Bienvenido a MapFI, [nombre del CEE]!                   │
│                                                              │
│  Esta plataforma centraliza todas las actividades de la      │
│  Facultad de Ingeniería. Como Centro de Estudiantes puedes:  │
│                                                              │
│  📅 Publicar certámenes, charlas y talleres                  │
│  📥 Importar tu calendario desde Excel                       │
│  🎯 Evaluar si una fecha choca con otros eventos             │
│                                                              │
│  [Comenzar recorrido guiado]   [Saltar]                      │
└──────────────────────────────────────────────────────────────┘
```

**Estilo**: fondo `var(--brand-soft)`, borde `var(--gold)` 1px, ícono dorado. Tipografía `Lexend` para título, `Source Sans 3` para cuerpo.

**Archivo**: `js/views/onboarding.js`

### 17.2 — Tour guiado de 5 pasos [4 h]

Modal con dots de progreso, captura de pantalla anotada, texto explicativo y navegación.

| Paso | Título | Contenido |
|------|--------|-----------|
| 1 | "Tu panel" | "Aquí gestionas tus actividades. Haz clic en **Nuevo evento** para empezar. Las tarjetas superiores muestran tus KPIs: total de eventos, confiabilidad y reputación." |
| 2 | "Crear un evento" | "Completa título, tipo y fecha. Luego selecciona las **carreras** y **años** a los que afecta. Un certamen de Cálculo I puede marcar Industrial, Civil e Informática a la vez — así se crea una sola vez y aparece en los tres calendarios." |
| 3 | "Evaluar compatibilidad" | "Antes de confirmar, haz clic en **Evaluar compatibilidad**. MapFI revisa si tu fecha choca con exámenes, clases o feriados y te muestra un porcentaje. Si es bajo, te sugiere 3 horarios alternativos." |
| 4 | "Importar desde Excel" | "¿Ya tienes todas las fechas del semestre? Descarga nuestra **plantilla CSV**, llénala con tus datos y súbela. Tus fechas quedarán como propuestas para revisión." |
| 5 | "El calendario público" | "Todo lo que publiques aparecerá en el calendario público. Los estudiantes pueden filtrar por su carrera y año. También pueden ver el mapa de calor para saber qué días están más cargados." |

**UI del modal**:

```
┌─────────────────────────────────────────────────────┐
│  ● ○ ○ ○ ○                    Paso 1 de 5    [✕]   │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │          [CAPTURA DE PANTALLA ANOTADA]       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Tu panel                                           │
│  Aquí gestionas tus actividades. Haz clic...        │
│                                                     │
│  ← Anterior        [Siguiente →]    [Saltar tour]   │
└─────────────────────────────────────────────────────┘
```

- **Dots**: `var(--gold)` activo, `var(--border)` inactivo
- **Capturas**: imágenes PNG estáticas con anotaciones (flechas + texto) sobre la UI real
- **Teclado**: Escape cierra, ← → navega entre pasos
- **Responsivo**: modal se adapta a móvil (max-width: 95vw)
- **Archivo**: `js/views/tour.js`

### 17.3 — Tooltips contextuales [2 h]

Íconos `?` junto a campos que pueden generar dudas. Se activan con hover (desktop) o click (móvil).

| Campo | Tooltip |
|-------|---------|
| Carreras (público) | "Selecciona todas las carreras a las que aplica este evento. Ej: Cálculo I lo cursan Industrial, Civil e Informática." |
| Años (público) | "Elige los años académicos afectados. Un ramo de primer año solo impacta a la generación 1." |
| Evaluar compatibilidad | "MapFI revisa si tu fecha choca con exámenes, clases o feriados del público seleccionado y te sugiere alternativas." |
| Importar CSV | "Descarga la plantilla, completa las columnas con tus fechas y súbela. Las actividades quedarán como propuestas." |
| Tipo de evento | "Certamen: evaluación calificada. Charla: evento de difusión. Taller: actividad práctica. Entrega: fecha límite de trabajo." |

**Estilo**:
```css
.tooltip-trigger {
  width: 18px; height: 18px; border-radius: 50%;
  border: 1.5px solid var(--border); color: var(--text-soft);
  font-size: .72rem; font-weight: 700; cursor: help;
}
.tooltip-trigger:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-soft); }
.tooltip-bubble {
  background: var(--text); color: var(--surface);
  padding: 8px 12px; border-radius: var(--radius-sm);
  max-width: 280px; box-shadow: var(--shadow-lg);
}
```

**Archivo**: `js/views/tooltips.js`

### 17.4 — Centro de ayuda (`ayuda.html`) [3 h]

Página accesible desde navbar (ícono `help-circle`) y footer. Contenido:

1. **Primeros pasos** — Mismo contenido del tour en formato texto + capturas
2. **Cómo importar desde Excel** — Paso a paso con captura de la plantilla y el proceso
3. **Cómo interpretar el Match** — Significado de cada nivel (ALTO/MEDIO/BAJO) y color
4. **Preguntas frecuentes** — Acordeones expandibles:
   - ¿Quién puede crear eventos?
   - ¿Cómo cambio mi contraseña?
   - ¿Qué significa "compatibilidad baja"?
   - ¿Puedo editar un evento ya publicado?
   - ¿Cómo agrego eventos para varias carreras a la vez?
   - ¿Mis eventos se ven de inmediato en el calendario público?
5. **Contacto** — Email del administrador desde variable de entorno `SUPPORT_EMAIL`

**Layout**: Sidebar izquierdo (sticky) + contenido derecho. En móvil, sidebar se vuelve horizontal con scroll.

**Archivos**: `ayuda.html`, `js/layout.js` (agregar link en NAV), `css/design-system.css` (estilos FAQ)

### 17.5 — Correcciones UX que incomodan al usuario [3 h]

Correcciones puntuales encontradas en la auditoría de julio 2026:

| # | Problema | Ubicación | Solución |
|---|----------|-----------|----------|
| 17.5.1 | Errores silenciosos (app parece muerta) | `dashboard.html:88,185,192`, `calendario.html:150`, `cuenta.html:57,69`, `js/app-boot.js:25`, `js/admin-panel.js:70`, `js/kpis-view.js:54` | Reemplazar `catch (_) {}` por placeholder "No se pudo conectar con el servidor. [Reintentar]". |
| 17.5.2 | HTTP codes crudos en toasts | `js/api-client.js:14` | Mapear 400→"Datos inválidos", 401→"Sesión expirada", 403→"No autorizado", 500→"Error del servidor", etc. |
| 17.5.3 | "Credenciales inválidas" ambiguo | `server.js:119` | Cambiar a "Correo o contraseña incorrectos." |
| 17.5.4 | Login sin feedback de carga | `login.html:40` | Deshabilitar botón + mostrar "Ingresando…" mientras la promesa se resuelve. |
| 17.5.5 | Sin contacto para registro | `login.html:24` | Agregar email de contacto dinámico: `Solicítala a <a href="mailto:...">...</a>`. |
| 17.5.6 | Toast "listo para el siguiente" confuso | `dashboard.html:162` | Cambiar a "Evento creado correctamente." + reset completo del formulario. |
| 17.5.7 | Admin ve botón "Descargar PDF" inútil | `dashboard.html:174-177` | Ocultar botón si `!user.entidadId`. |
| 17.5.8 | "Ve a la sección Horarios" sin link | `calendario.html:15` | Convertir en `<a href="horarios.html">sección Horarios</a>`. |
| 17.5.9 | KPIs vacíos tras error | `kpis.html` | Mostrar placeholder "Sin datos disponibles" en cada tabla si falla la carga. |
| 17.5.10 | Cuenta sin fallback de entidad | `cuenta.html:64-69` | Si `e` no se encuentra, mostrar "—". |
| 17.5.11 | Botón "Evaluar" sin estado de carga | `match.html`, `dashboard.html:139-149` | Deshabilitar botón mientras `api.post` está en vuelo, texto "Evaluando…". |
| 17.5.12 | "MARKETING SIMULATOR" en código | `js/icons.js:2` | Cambiar header a "MapFI — icons.js". |
| 17.5.13 | Typo "REALEZAS" | `Descripcion_MapFI.txt:48` | Cambiar a "REALES". |

### 17.6 — Estilos CSS para tutoriales [2 h]

~130 líneas nuevas en `design-system.css`:

- `.onboarding-banner` — banner de bienvenida
- `.tour-overlay` / `.tour-modal` / `.tour-steps` / `.tour-image` / `.tour-body` / `.tour-footer` — modal del tour
- `.tooltip-trigger` / `.tooltip-bubble` — tooltips contextuales
- `.help-sidebar` / `.help-nav` / `.faq-item` / `.faq-q` / `.faq-a` — centro de ayuda
- `.skip-link` — link "Saltar al contenido" para accesibilidad
- `:focus-visible` en `.topbar nav a` — foco visible en navegación por teclado
- `.giia-logo` dark mode filter — inversión de SVG en tema oscuro
- `@media (forced-colors: active)` — soporte básico para High Contrast Mode

### Resumen Fase 7

| # | Tarea | Horas |
|---|-------|-------|
| 7.1 | Banner de bienvenida | 2 |
| 7.2 | Tour guiado 5 pasos + capturas anotadas | 4 |
| 7.3 | Tooltips contextuales | 2 |
| 7.4 | Centro de ayuda (`ayuda.html`) | 3 |
| 7.5 | Correcciones UX (13 items) | 3 |
| 7.6 | Estilos CSS (~130 líneas) | 2 |
| **Total** | | **16 h** |

---

## 18. Fase 8 · Robustez Técnica

> **Objetivo**: Código mantenible, testeado y documentado. Preparado para traspaso a nuevo equipo desarrollador.
> **Depende de**: Fase 6 (necesita las features implementadas para testearlas).

### Tareas

| # | Tarea | H | Archivos | Descripción |
|---|-------|---|----------|-------------|
| 8.1 | Extraer JS inline de dashboard | 2.0 | `dashboard.html` → `js/views/dashboard-view.js` | ~120 líneas de lógica de negocio salen del HTML. El HTML solo declara estructura. |
| 8.2 | Extraer JS inline de calendario | 2.0 | `calendario.html` → `js/views/calendario-view.js` | ~210 líneas de lógica (CSV parser, filtros, carga) a módulo separado. |
| 8.3 | Tests de integración DAO | 3.0 | `__tests__/dao/` | `actividadDao`, `userDao`, `entidadDao`, `bloqueHorarioDao` con `pg-mem`. |
| 8.4 | Tests de API con supertest | 3.0 | `__tests__/routes/` | Auth (login/logout/me), CRUD actividades, POST match, GET heatmap, GET analytics. |
| 8.5 | Namespace `window.MapFI` | 1.5 | Todos los `js/*.js` y `*.html` | Unificar `api`, `CalendarView`, `Filters`, `MatchCalculator`, `Icons`, `toast` bajo `window.MapFI`. |
| 8.6 | Migración 007: fix seeds | 0.5 | `db/migrations/007_fix_seeds.sql` | Reemplazar fechas hardcodeadas (2026-06-23) por relativas (`now() + interval`). Agregar constraint o warning sobre datos placeholder de matrícula. |
| 8.7 | Actualizar documentación | 1.0 | `README.md`, `docs/GUIA_APORTANTE.md`, `docs/ROADMAP.md`, `docs/MODELO_DATOS.md` | Corregir "próximamente", "29 tests" → conteo real, estado del roadmap, migraciones nuevas. |
| **Subtotal** | | **12 h** | | |

### Criterio de aceptación

- `npm test` ejecuta ≥ 40 tests (unitarios + integración + API).
- No hay lógica de negocio en archivos `.html` (solo estructura y bindings).
- `window.MapFI.api.get()`, `window.MapFI.CalendarView.montar()`, etc. funcionan sin colisiones.
- Las fechas semilla no muestran eventos del año incorrecto en 2027+.
- `README.md` refleja el estado real del proyecto.

---

## 19. Resumen de horas por fase

| Fase | Enfoque | Horas | Depende de |
|------|---------|-------|------------|
| **F5** | Seguridad y Robustez Base | 6.5 h | — |
| **F6** | Cierre de Brechas MVP | 22 h | F5 |
| **F7** | Tutoriales y UX | 16 h | F6 |
| **F8** | Robustez Técnica | 12 h | F6 |
| **Total** | | **56.5 h** | |

---

## 20. Orden de ejecución recomendado

```
F5 (Seguridad)
 │
 ├─ 5.1 Rate limiting
 ├─ 5.2 Quitar credenciales hardcodeadas
 ├─ 5.3 Sanitización XSS
 ├─ 5.4 Cookies SameSite strict
 ├─ 5.5 type="password" en admin
 ├─ 5.6 Eliminar alert()
 ├─ 5.7 Borrar TODO(F3)
 └─ 5.8 CDN integrity + fallback

         ↓

F6 (Brechas MVP)
 │
 ├─ 6.1 Tags + ramo (migración 006)
 ├─ 6.2 Dashboard multi-carrera/nivel
 ├─ 6.3 Tabla "Mis Eventos"
 ├─ 6.4 Conflictos visuales
 ├─ 6.6 Plantilla CSV descargable
 ├─ 6.5 CSV híbrido (depende de 6.1, 6.2, 6.6)
 └─ 6.7 GIIA.png → SVG

         ↓

F7 (Tutoriales + UX)
 │
 ├─ 7.1 Banner de bienvenida
 ├─ 7.6 Estilos CSS (base para 7.2–7.5)
 ├─ 7.2 Tour guiado 5 pasos
 ├─ 7.3 Tooltips contextuales
 ├─ 7.4 Centro de ayuda
 └─ 7.5 Correcciones UX

         ↓

F8 (Robustez)
 │
 ├─ 8.6 Migración 007 (fix seeds)
 ├─ 8.1–8.2 Extraer JS inline
 ├─ 8.5 Namespace MapFI
 ├─ 8.3–8.4 Tests DAO + API
 └─ 8.7 Actualizar docs
```

---

## 21. Identidad visual

La plataforma sigue los lineamientos de la Facultad de Ingeniería de la Universidad de Concepción:

| Elemento | Valor | Uso |
|----------|-------|-----|
| **Color primario** | `#0E3257` (navy profundo, derivado del logo `#12395E`) | Header, botones principales, links, títulos de sección |
| **Color secundario** | `#081F39` (navy oscuro) | Hover de botones, fondos de hero |
| **Dorado institucional** | `#C8A24B` | Acentos, dots de tour, badges de gamificación |
| **Tipografía títulos** | `Lexend` (geométrica, moderna) | H1–H4, navegación, badges, KPI cards |
| **Tipografía cuerpo** | `Source Sans 3` (legible, profesional) | Párrafos, formularios, tablas, tooltips |
| **Logo header** | `img/udec_FI.svg` | SVG oficial de la Facultad |
| **Logo footer** | `img/GIIA.svg` | SVG vectorizado del grupo de investigación |
| **Radio de bordes** | `12px` (cards), `8px` (botones, inputs) | Consistencia visual |
| **Sombras** | Sutiles (`rgba(18,34,54,.06)`) | Profundidad sin distracción |

El sistema de diseño completo está definido en `css/design-system.css` con variables CSS (`:root` y `[data-theme="dark"]`), soporte para `prefers-reduced-motion` y `prefers-color-scheme`.

---

*MapFI · Facultad de Ingeniería · Universidad de Concepción · Plan de Implementación v2.0 · Julio 2026*
