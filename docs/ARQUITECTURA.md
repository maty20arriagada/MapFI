# 🏛️ Arquitectura — MapFI

Documento de arquitectura técnica. Espeja el patrón del **Simulador Marketing B2B** para garantizar coherencia, portabilidad y un despliegue de un solo comando.

---

## 1. Vista de alto nivel

```
┌──────────────────────────────────────────────────────────────┐
│                        NAVEGADOR (cliente)                     │
│  HTML vanilla + design-system.css + módulos JS (sin build)     │
│  ├─ index/calendario/mapa-calor (público, solo lectura)        │
│  └─ login/dashboard/match (aportantes, con sesión)             │
└───────────────┬──────────────────────────────────────────────┘
                │ fetch() JSON  (js/api-client.js)
                ▼
┌──────────────────────────────────────────────────────────────┐
│                    SERVER  (server.js · Express)               │
│  • Sirve estáticos (HTML/CSS/JS)                               │
│  • Sesiones (express-session + connect-pg-simple)             │
│  • Middleware de seguridad (headers, límites de payload)       │
│  • Rutas /api/*  →  DAO  →  Services                           │
└───────┬───────────────────────────────┬──────────────────────┘
        │                               │
        ▼                               ▼
┌────────────────┐            ┌───────────────────────────┐
│  js/dao/*.js   │            │   js/services/*.js         │
│ (SQL por       │            │  matchService (puro)       │
│  entidad)      │            │  heatmapService (puro)     │
│                │            │  holidayService            │
└───────┬────────┘            └───────────────────────────┘
        │ pg pool (js/db/index.js)
        ▼
┌──────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16                               │
│  Tablas + tstzrange/GiST + vistas analíticas                  │
│  Migraciones SQL numeradas (corren al arrancar)               │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Capas y responsabilidades

| Capa | Carpeta | Responsabilidad | Regla |
|------|---------|-----------------|-------|
| **Presentación** | `*.html`, `css/`, `js/*-view.js` | Render, interacción, llamadas a la API | No contiene lógica de negocio |
| **Cliente API** | `js/api-client.js` | Envoltorio `fetch` único, manejo de errores y sesión | Punto único de contacto con `/api` |
| **Rutas / Controladores** | `server.js` | Auth, validación de entrada, orquestación | Delgado: delega a DAO/servicios |
| **Servicios** | `js/services/` | Lógica de negocio pura (match, heatmap, feriados) | Sin I/O directo → testeable |
| **Acceso a datos (DAO)** | `js/dao/` | SQL parametrizado por entidad | Sin reglas de negocio |
| **Infraestructura DB** | `js/db/` | Pool de conexiones + runner de migraciones | — |
| **Datos** | `db/migrations/` | Esquema, seeds, vistas | Versionado, idempotente |

> **Por qué servicios "puros":** `matchService` y `heatmapService` reciben datos ya consultados y devuelven el cálculo. Esto permite testearlos sin base de datos y mantener la lógica del algoritmo aislada de SQL y HTTP.

---

## 3. Flujo de una petición típica (calculador de match)

```
1. Usuario completa fecha + público objetivo en match.html
2. match-calculator.js → api-client.post('/api/match/evaluar', payload)
3. server.js valida sesión + payload
4. server.js usa actividadDao + bloqueHorarioDao + feriadoDao
   para reunir el contexto del segmento/semana
5. server.js llama matchService.evaluar(contexto)  ← cálculo puro
6. Devuelve { compatibilidad_pct, alcance_estimado, conflictos, sugerencias }
7. match-calculator.js renderiza el resultado y las 3 sugerencias
```

---

## 4. Patrón de migraciones

- Archivos `db/migrations/NNN_nombre.sql`, ejecutados en orden numérico.
- Una tabla `schema_migrations` registra las aplicadas (idempotencia).
- `js/db/migrate.js` corre **al arrancar el server** (antes de `listen`), garantizando que el esquema y los seeds existan antes de aceptar tráfico.
- Convención: cada migración es **aditiva**; nunca se edita una migración ya aplicada en producción — se crea una nueva.

---

## 5. Seguridad

| Aspecto | Implementación |
|---------|----------------|
| Contraseñas | `bcryptjs` (hash + salt), nunca en texto plano |
| Sesiones | `express-session` + `connect-pg-simple` (persistidas, cluster-safe) |
| Cookies | `httpOnly`; `secure`+`sameSite` en producción (HTTPS) |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS en prod |
| Payloads | Límite explícito (`express.json({ limit: '100kb' })`) anti-DoS |
| Inyección SQL | Siempre consultas parametrizadas (`$1, $2…`) vía `pg` |
| Autorización | Middleware `requireAuth` / `requireRole('ADMIN')` por ruta |
| Trust proxy | `app.set('trust proxy', 1)` para cookies seguras tras reverse proxy |

---

## 6. Configuración por entorno

Toda la configuración entra por variables de entorno (ver `.env.example`):

- **Local con `npm start`** → `.env` apunta a `localhost:5433`.
- **Docker Compose** → construye `DATABASE_URL` con el host interno `db:5432` (ignora el `DATABASE_URL` del `.env`, igual que el simulador).
- **Cloud (Railway/Render)** → las variables se setean en el dashboard.

El server hace **fail-fast** si falta `DATABASE_URL` o `SESSION_SECRET` en producción.

---

## 7. Decisiones técnicas notables

1. **`tstzrange` + GiST** para choques de horario y densidad del mapa de calor (en vez de comparar `inicio/fin` a mano). Permite el operador de solapamiento `&&` con índice eficiente.
2. **Sin framework frontend**: menos superficie de mantenimiento, alineado con "cero capacitación" y con el simulador. Solo se vendorea FullCalendar para el calendario.
3. **Backend desacoplado para KPIs**: los indicadores se exponen como **vistas SQL** + endpoints `/api/analytics/*`, de modo que agregar un KPI no requiere cambiar el esquema base ni romper código (requisito §7).
4. **Año académico paramétrico** (`periodo_academico`): la plataforma se adapta al cambio de año y permite clonar la estructura anual.

---

## 8. Escalabilidad futura

- Vistas analíticas pueden volverse **materializadas** si el volumen crece.
- El server es **stateless** (sesiones en BD) → escalable horizontalmente detrás de un balanceador.
- Endpoints `/api/analytics/*` y vistas son el punto de integración para **Looker Studio, PowerBI o Python**.
- El motor de reportes PDF (F4) puede externalizarse a un worker si la generación es costosa.

---

*Ver también: [`MODELO_DATOS.md`](MODELO_DATOS.md) · [`ALGORITMO_MATCH.md`](ALGORITMO_MATCH.md) · [`DESPLIEGUE.md`](DESPLIEGUE.md)*
