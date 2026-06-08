# 🗺️ MapFI — Plan de Implementación

> **Plataforma de Mapeo, Planificación y Co-diseño de Actividades de la Facultad de Ingeniería.**
> Documento maestro de planificación técnica. Listo para versionar en GitHub y ejecutar por fases.

| | |
|---|---|
| **Estado** | Planificación / Scaffold inicial |
| **Versión del plan** | 1.0 |
| **Última actualización** | 2026-06-08 |
| **Stack** | Node.js + Express · PostgreSQL · HTML/CSS/JS vanilla · Docker |
| **Referencia arquitectónica** | Simulador Marketing B2B (mismo patrón de despliegue) |

---

## 1. Resumen ejecutivo

MapFI centraliza la agenda de eventos, hitos académicos y actividades extraprogramáticas de la Facultad de Ingeniería, interconectando a los **centros de estudiantes (13 carreras)**, la **Dirección de Vinculación con el Medio** y **Gearbox**. Resuelve tres problemas históricos:

1. **Topes de horario** entre actividades dirigidas al mismo público.
2. **Sobrecarga** de eventos en ciertos días/semanas.
3. **Falta de visibilidad** del público objetivo real al levantar una iniciativa.

El producto se apoya en tres piezas diferenciadoras:

- **Calendario centralizado e interactivo** con filtros avanzados (carrera, generación, entidad).
- **Mapa de calor** que muestra la saturación de eventos por segmento de estudiantes.
- **Calculador inteligente de compatibilidad y alcance** (algoritmo de *match*) que evalúa una fecha propuesta contra exámenes, eventos agendados, feriados y horarios críticos, y sugiere mejores bloques.

La arquitectura **replica el patrón del Simulador Marketing B2B**: backend Express monolítico con capa DAO, PostgreSQL con migraciones SQL numeradas, frontend en HTML/JS vanilla sin paso de build, y despliegue con `docker-compose up --build` en un solo comando.

---

## 2. Objetivos y alcance

### 2.1 Objetivos del producto

| # | Objetivo | Métrica de éxito |
|---|----------|------------------|
| O1 | Centralizar todas las actividades de la facultad en un solo calendario | ≥ 80 % de las entidades cargando datos al cierre del 1.er semestre de uso |
| O2 | Reducir topes de horario entre eventos del mismo público | Caída medible en eventos suspendidos/reprogramados por tope (KPI interno) |
| O3 | Dar visibilidad del público objetivo real antes de agendar | Uso del calculador de *match* antes de confirmar ≥ 60 % de los eventos |
| O4 | Operar sin capacitación previa | Un integrante nuevo de un centro publica un evento sin asistencia |

### 2.2 Alcance de la v1 (MVP — "núcleo diferenciador")

✅ **Dentro de la v1:**

- Autenticación de Usuarios Aportantes con credenciales propias (email + contraseña).
- Calendario centralizado interactivo con vista mensual/semanal.
- Filtros avanzados: carrera, generación/año, entidad organizadora.
- Carga y gestión (CRUD) de actividades por parte de los aportantes.
- Carga de bloques horarios base por carrera/generación.
- Sincronización de feriados nacionales + exclusión de fines de semana.
- **Algoritmo de Match**: porcentaje de compatibilidad, alcance estimado y sugerencia de 3 mejores bloques.
- **Mapa de calor** de saturación por segmento de público.
- Vista pública (sin login) del calendario para alumnado/docentes.

🔜 **Diferido a fases posteriores** (el esquema de BD ya lo contempla):

- Gamificación: indicador de confiabilidad, sello de coordinación eficiente.
- Reportes de impacto automatizados en PDF.
- Panel de KPIs avanzado y endpoints/vistas para BI (Looker, PowerBI).
- SSO institucional (Google/Microsoft), si la facultad lo solicita.

### 2.3 Fuera de alcance (por ahora)

- App móvil nativa (la web es responsiva — cubre móvil).
- Integración con sistemas académicos internos (SIES/Banner) — se evaluará a futuro.
- Notificaciones push / email transaccional (candidato a fase 3).

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
- **Cero capacitación:** UI limpia, responsiva, con iconografía coherente (Lucide vendoreado en `js/icons.js`).

---

## 4. Actores y roles

| Actor | Acceso | Capacidades |
|-------|--------|-------------|
| **Centro de Estudiantes** (×13) | Login (rol `APORTANTE`) | CRUD de sus actividades, usar match, ver mapa de calor |
| **Vinculación con el Medio** | Login (rol `APORTANTE`) | Igual que centros; entidad de tipo `VINCULACION` |
| **Gearbox** | Login (rol `APORTANTE`) | Igual que centros; entidad de tipo `GEARBOX` |
| **Administrador** | Login (rol `ADMIN`) | Gestiona catálogos (carreras, feriados, periodos), usuarios, bloques horarios |
| **Público general** (alumnado, docentes, autoridades) | Sin login | Visualiza calendario y mapa de calor (solo lectura) |

---

## 5. Módulos funcionales

Trazabilidad directa con la descripción funcional (`Descripcion_MapFI.txt`):

| Módulo | Sección origen | Componentes principales | Fase |
|--------|----------------|-------------------------|------|
| **M1 · Autenticación** | §5 | `login.html`, sesiones, `userDao`, middleware `requireAuth` | F1 |
| **M2 · Catálogos** | §2, §4 | carreras, generaciones, entidades, periodos académicos | F1 |
| **M3 · Calendario centralizado** | §3.A | `calendario.html`, `calendar-view.js`, `actividadDao`, filtros | F2 |
| **M4 · Bloques horarios académicos** | §3.A | `bloqueHorarioDao`, carga por carrera/generación | F2 |
| **M5 · Lógica cronológica** | §4 | `holidayService` (feriados + exclusión findes + años) | F2 |
| **M6 · Calculador de Match** | §3.C | `matchService`, `match.html`, sugerencias de bloques | F3 |
| **M7 · Mapa de calor** | §3.B | `heatmapService`, `mapa-calor.html`, vistas SQL | F3 |
| **M8 · Gamificación** | §5 | reputación, sellos (esquema listo, UI diferida) | F4 |
| **M9 · Reportes PDF** | §5 | generación de informe semestral por entidad | F4 |
| **M10 · Panel de KPIs / BI** | §7 | vistas analíticas + endpoints `/api/analytics` | F4 |

---

## 6. Modelo de datos (resumen)

> Esquema completo en [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) y migraciones en [`db/migrations/`](db/migrations/).

Entidades núcleo:

- **`carrera`** — las 13 especialidades (código, nombre, color para UI).
- **`generacion` / nivel académico** — 1.er a 5.º año (o más), paramétrico.
- **`entidad`** — organizador: centro de alumnos, Vinculación o Gearbox (incluye campos de reputación para gamificación futura).
- **`usuario`** — credenciales (email, `password_hash` bcrypt), rol, entidad asociada.
- **`actividad`** — el evento: rango de tiempo (`tstzrange` con índice GiST para solapamiento), tipo, estado, alcance estimado, compatibilidad cacheada.
- **`actividad_publico`** — público objetivo: pares (carrera, nivel).
- **`bloque_horario`** — malla horaria base recurrente por carrera/nivel/día.
- **`feriado`** — feriados nacionales, sándwich y académicos.
- **`periodo_academico`** — año/semestre paramétrico (clonación anual).
- **Vistas analíticas** — `vw_saturacion_segmento` (mapa de calor), `vw_ocupacion_bloques`, `vw_aporte_entidad`.

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
├── PLAN_DE_IMPLEMENTACION.md      ← este documento
├── README.md                      ← inicio rápido
├── docker-compose.yaml            ← orquestación db + server
├── Dockerfile                     ← imagen del server (node:20-alpine)
├── .env.example                   ← variables de entorno requeridas
├── package.json
├── server.js                      ← Express: rutas, auth, estáticos
│
├── db/migrations/                 ← esquema SQL numerado
│   ├── 001_schema_inicial.sql
│   ├── 002_seed_catalogos.sql     ← 13 carreras, entidades, feriados
│   └── 003_vistas_analitica.sql
│
├── js/                            ← backend (db/dao/services) + frontend modules
│   ├── db/{index,migrate}.js      ← pool + runner de migraciones
│   ├── dao/*.js                   ← acceso a datos por entidad
│   ├── services/*.js              ← matchService, heatmapService, holidayService
│   ├── icons.js                   ← set Lucide vendoreado (provisto)
│   ├── api-client.js              ← cliente fetch del frontend
│   ├── calendar-view.js           ← integración FullCalendar
│   ├── heatmap-view.js            ← render del mapa de calor
│   └── match-calculator.js        ← UI del calculador
│
├── css/design-system.css          ← sistema de diseño único
│
├── *.html                         ← index, login, dashboard, calendario,
│                                     mapa-calor, match
│
├── __tests__/                     ← Jest (services, server, helpers)
└── docs/                          ← guías técnica, despliegue, aportante, etc.
```

---

## 9. Roadmap por fases

> Versión detallada con criterios de aceptación en [`docs/ROADMAP.md`](docs/ROADMAP.md).

| Fase | Nombre | Entregable | Duración estim. |
|------|--------|-----------|-----------------|
| **F0** | Scaffold & DevOps | Repo ejecutable, Docker levanta server + db, CI básico | ✅ (este entregable) |
| **F1** | Auth & Catálogos | Login funcional, CRUD de carreras/entidades/usuarios, periodos | ~1–2 sem |
| **F2** | Calendario & Cronología | Calendario con filtros, CRUD actividades, bloques, feriados | ~2–3 sem |
| **F3** | Match & Mapa de calor | Algoritmo de compatibilidad + sugerencias + heatmap | ~2–3 sem |
| **F4** | Gamificación, PDF & BI | Reputación, reportes PDF, panel KPIs, endpoints analíticos | ~3–4 sem |

**Hito MVP demostrable** = fin de F3 (núcleo diferenciador funcionando end-to-end).

---

## 10. Estrategia de pruebas

- **Unitarias (servicios):** `matchService` y `heatmapService` son puros → cobertura alta con casos límite (feriados, findes, topes totales/parciales, segmentos vacíos).
- **Integración (DAO):** con `pg-mem` (Postgres en memoria) para validar el SQL sin contenedor.
- **API (supertest):** rutas de auth, CRUD de actividades, endpoint de match.
- **Smoke E2E manual:** checklist de despliegue (ver `docs/DESPLIEGUE.md`).
- Objetivo de cobertura inicial: **≥ 70 %** en `js/services/` y `js/dao/`.

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
| Datos desactualizados (abandono de aportantes) | Alto | Gamificación (F4) + UI de cero fricción; recordatorios |
| Calidad de los bloques horarios base | Alto | Carga asistida por admin + import masivo CSV (F2) |
| Complejidad del algoritmo de match | Medio | Servicio puro + tests exhaustivos + parámetros configurables |
| Feriados regionales/decretados de último minuto | Medio | Tabla `feriado` editable por admin + sync con fuente nacional |
| Escalamiento (muchos eventos) | Bajo | Índices GiST sobre `tstzrange`; vistas materializables si crece |
| Cambio de año académico | Medio | `periodo_academico` paramétrico + función de clonación |

---

## 13. Próximos pasos inmediatos

1. **Revisar este plan** y los documentos en `docs/`.
2. `cp .env.example .env` y completar `SESSION_SECRET`, credenciales de Postgres.
3. `docker-compose up --build` → verificar que el server arranca y aplica migraciones.
4. Crear el repositorio en GitHub y subir (`git remote add origin … && git push -u origin main`).
5. Arrancar **Fase 1** siguiendo los TODOs marcados en `server.js`, `js/dao/` y `js/services/`.

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
| §6 Docker + PostgreSQL + UI simple | Sección 3 (arquitectura) |
| §7 KPIs desacoplados + BI | M10 + vistas analíticas |

---

*MapFI · Facultad de Ingeniería · Documento de planificación v1.0*
