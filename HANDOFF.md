# MapFI — Documento de Pase (Handoff)

> **Propósito**: Este documento consolida todo el trabajo realizado entre junio y julio 2026, el estado actual del proyecto, las decisiones tomadas y los puntos sensibles que un agente de IA o desarrollador futuro debe conocer antes de continuar.

---

## 1. ¿Qué es MapFI?

Plataforma web para centralizar la agenda de eventos de la Facultad de Ingeniería de la Universidad de Concepción (Chile). Interconecta **14 centros de estudiantes**, **Vinculación con el Medio** y **Gearbox** (hub de innovación) en un calendario compartido con detección inteligente de conflictos.

- **URL local**: `http://localhost:3000`
- **Admin por defecto**: `admin@mapfi.cl` (contraseña seteada en `.env`)
- **Stack**: Node.js 20 + Express + PostgreSQL 16 + HTML/CSS/JS vanilla + Docker

---

## 2. Estado actual del proyecto

### Línea base (junio 2026)
El MVP núcleo existía: autenticación, calendario FullCalendar, algoritmo de Match, mapa de calor, gamificación, KPIs y reportes PDF. **Pero tenía brechas que impedían el uso real por los CEE**.

### Trabajo realizado (julio 2026)

#### Seguridad (F5)
- Rate limiting en `/api/auth/login` (5 intentos/15 min por IP, en memoria)
- CSRF: validación de `Origin`/`Referer` en POST/PUT/PATCH/DELETE
- Cookies `sameSite: strict`
- CSP header agregado (`Content-Security-Policy`)
- Sanitización XSS: `js/sanitize.js` con `escapeHtml()` usado en todas las vistas
- Contraseña `type="password"` en `admin.html`
- Eliminado `alert()` como fallback en `calendar-view.js`
- Dockerfile: `USER node` (no root), healthcheck sin `wget`

#### Brechas funcionales (F6)
- **Dashboard multi-carrera**: el APORTANTE ahora selecciona múltiples carreras y años (checkboxes, producto cartesiano)
- **Tabla "Mis Eventos"**: `js/views/event-table.js` con edición inline (cambiar fecha, estado) y eliminación
- **Conflictos visuales**: eventos solapados muestran badge ⚠️ y borde naranja en FullCalendar
- **Tags nuevos**: `CHARLA`, `TALLER`, `ENTREGA` agregados al CHECK de `actividad.tipo`
- **Campo `ramo`**: columna nueva en `actividad` para nombre de la asignatura
- **Importación CSV híbrida**: CEE sube → estado `PROPUESTA` → admin revisa y aprueba/rechaza
- **Plantilla CSV descargable**: endpoint `GET /api/plantilla-csv`
- **Logo GIIA vectorizado**: convertido de PNG a SVG con filtro dark mode

#### Tutoriales y UX (F7)
- **Banner de bienvenida**: `js/views/onboarding.js` — se muestra solo en primer login
- **Tour guiado**: `js/views/tour.js` — modal de 5 pasos con navegación por teclado
- **Tooltips contextuales**: `js/views/tooltips.js` — íconos `?` en campos complejos
- **Centro de ayuda**: `ayuda.html` — FAQ con acordeones, guías paso a paso, contacto
- **13 correcciones UX**: mensajes de error amigables, loaders en botones, links clickeables, fallbacks "—" en KPIs y cuenta, typo "REALEZAS" corregido

#### Robustez (F8)
- **JS inline extraído**: `dashboard.html` (~195 líneas) → `js/views/dashboard-view.js`, `calendario.html` (~130 líneas) → `js/views/calendario-view.js`
- **Tests**: de 24 a 60 tests (10 suites). Nuevos: `__tests__/dao/actividadDao.test.js` (8 tests), `__tests__/dao/userDao.test.js` (5 tests), `__tests__/routes/api.test.js` (10 tests)
- **Migración 007**: fechas semilla con `now() + interval` (no hardcodeadas a 2026)
- **Docs actualizadas**: `README.md`, `GUIA_APORTANTE.md`, `ROADMAP.md`, `PLAN_DE_IMPLEMENTACION.md`

---

## 3. Inventario de archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `js/views/onboarding.js` | Banner bienvenida primer login |
| `js/views/tour.js` | Tour guiado 5 pasos (modal) |
| `js/views/tooltips.js` | Tooltips contextuales (ícono ?) |
| `js/views/dashboard-view.js` | Lógica del panel (extraída de HTML) |
| `js/views/calendario-view.js` | Lógica del calendario (extraída de HTML) |
| `js/views/event-table.js` | Tabla "Mis Eventos" con edición inline |
| `js/sanitize.js` | `escapeHtml()` anti-XSS |
| `js/csv-utils.js` | Parser CSV compartido |
| `ayuda.html` | Centro de ayuda con FAQ |
| `img/GIIA.svg` | Logo GIIA vectorizado |
| `js/vendor/fullcalendar/` | FullCalendar vendoreado localmente |
| `db/migrations/006_tags_y_ramo.sql` | Tags CHARLA/TALLER/ENTREGA + columna ramo |
| `db/migrations/007_fix_seeds.sql` | Fechas semilla relativas |
| `__tests__/dao/actividadDao.test.js` | Tests DAO (mock) |
| `__tests__/dao/userDao.test.js` | Tests DAO (mock) |
| `__tests__/routes/api.test.js` | Tests API con supertest |
| `__tests__/services/csv-utils.test.js` | Tests parser CSV |
| `__tests__/services/sanitize.test.js` | Tests sanitización |

---

## 4. Archivos modificados significativamente

| Archivo | Cambio principal |
|---------|-----------------|
| `server.js` | Rate limiting, CSRF, CSP header, mensaje login corregido |
| `dashboard.html` | JS extraído, multi-carrera, CSV import, tutoriales |
| `calendario.html` | JS extraído, tags nuevos, link Horarios, tooltips |
| `login.html` | Loading state, email contacto |
| `match.html` | Loading state en botón Evaluar |
| `cuenta.html` | Fallback "—" para entidad |
| `kpis.html` | Integración `kpis-view.js` |
| `js/layout.js` | Link "Ayuda" en nav, GIIA.svg en footer |
| `js/api-client.js` | HTTP codes → mensajes español amigables |
| `js/heatmap-view.js` | Removido texto "TODO(F3)" |
| `js/services/heatmapService.js` | Removido comentario TODO |
| `js/kpis-view.js` | Placeholder tras error de carga |
| `css/design-system.css` | +130 líneas (tutoriales, FAQ, tooltips, dark mode GIIA, skip-link) |
| `Dockerfile` | `USER node` |
| `docker-compose.yaml` | Puerto bind a `127.0.0.1`, healthcheck con Node.js |
| `Descripcion_MapFI.txt` | Typo corregido |
| `README.md` | 60 tests, features actualizadas |
| `docs/GUIA_APORTANTE.md` | "próximamente" → descripción real |
| `docs/ROADMAP.md` | F5-F8 marcadas completadas |
| `PLAN_DE_IMPLEMENTACION.md` | v1.0 → v2.0 (+250 líneas) |

---

## 5. Lo que queda pendiente

### Pospuesto deliberadamente

| Ítem | Motivo |
|------|--------|
| **Namespace `window.MapFI`** | Refactorización que toca 20+ archivos. Los módulos usan `window` individualmente y funciona. Hacerlo bien requiere tests E2E que no existen. **Riesgo alto, beneficio bajo.** |
| **Exportación `.ics`** | Endpoint para Google/Apple Calendar. Requiere librería `ical-generator` o generación manual del formato. **Valor alto para adopción estudiantil.** Recomendado como siguiente feature. |
| **PWA (manifest + service worker)** | Instalable en móvil. Bajo esfuerzo (~2h), alto impacto en adopción. |
| **Notificaciones email** | Requiere servicio externo (SendGrid/Mailgun). Rompe el modelo "sin dependencias externas". |
| **SSO Google/Microsoft** | Requiere registro de app OAuth y cambios en flujo de auth. Solo si la facultad lo pide. |

### Mejoras menores

| Ítem | Ubicación |
|------|-----------|
| `toLocalInput` duplicada entre `dashboard-view.js` y `calendario-view.js` | Mover a `js/utils.js` compartido |
| `toggleAll` y `leerPublico` duplicados | Ídem |
| Sin `integrity` hash en fonts.googleapis.com CSS | `design-system.css:8` |
| `pg-mem` no usado (tests usan mocks manuales) | Se podría eliminar de `devDependencies` o migrar los tests a `pg-mem` |
| Sin tests E2E (Cypress/Playwright) | Recomendado antes de refactorizaciones grandes |

### Últimos cambios (1 julio 2026, cierre de sesión)

| Cambio | Archivo |
|--------|---------|
| Footer actualizado con atribución a CEEIND + Plan Estratégico 2030 | `js/layout.js:54-69` |
| Sección "Acerca de MapFI" agregada a landing page | `index.html:35-45` |
| PNGs residuales de GIIA eliminados, SVG en `img/` y `addons/` | `img/GIIA.svg`, `addons/GIIA.svg` |

---

## 6. Puntos sensibles — revisar antes de tocar

### 6.1 Base de datos
- La migración 001 usa `tstzrange GENERATED ALWAYS AS` y `GiST index`. PostgreSQL vanilla lo soporta, pero **pg-mem NO**. Por eso los tests DAO usan mocks manuales en vez de pg-mem. Si se migra a otra BD o se quiere usar pg-mem, hay que eliminar la columna `periodo` generada.
- La tabla `matricula` tiene valores placeholder (100 estudiantes por segmento). El alcance estimado del Match siempre da múltiplos de 100 hasta que se carguen datos reales. Esto está documentado en `db/migrations/004_matricula.sql`.
- Las migraciones son **aditivas e idempotentes**. NUNCA editar una migración ya aplicada en producción. Crear una nueva.

### 6.2 Sesiones
- Las sesiones se persisten en PostgreSQL vía `connect-pg-simple`. Esto hace el server **stateless** y escalable horizontalmente.
- En desarrollo, `SESSION_SECRET` puede ser cualquier string. En producción, **debe ser un secreto fuerte** o las sesiones son forgeables.
- Cookies usan `sameSite: strict` — esto podría romper enlaces desde emails externos. Si se implementan notificaciones email, evaluar cambiar a `lax`.

### 6.3 Rate limiting
- El rate limiting del login es **en memoria** (un `Map` en el proceso Node.js). Si hay múltiples instancias del server, cada una tiene su propio contador. Para producción multi-instancia, migrar a Redis o a la BD.
- La limpieza del Map corre cada 10 minutos con `setInterval().unref()`.

### 6.4 CSP (Content-Security-Policy)
- Usa `script-src 'unsafe-inline'` porque varias páginas tienen `<script>` inline. Si se extrae **todo** el JS a archivos externos (incluyendo las páginas secundarias como `index.html`, `admin.html`, `kpis.html`, `horarios.html`, `mapa-calor.html`), se puede remover `'unsafe-inline'` y mejorar la seguridad significativamente.

### 6.5 FullCalendar
- Está vendoreado en `js/vendor/fullcalendar/`. Si se actualiza la versión, reemplazar ambos archivos `.min.js`.
- La degradación a lista (si no hay CDN/vendor) está implementada en `calendar-view.js:77-84`.

### 6.6 Docker
- El puerto del server está bindeado a `127.0.0.1` (solo localhost). Para exponer al exterior, usar un reverse proxy (nginx, Caddy) con HTTPS.
- La BD **NO expone puertos** en producción. Solo en desarrollo con `docker-compose.dev.yaml`.
- El healthcheck del server usa `node -e "require('http').get(...)"` — no depende de `wget` ni `curl`.

---

## 7. Cómo levantar el proyecto

```bash
# Desarrollo local (BD en Docker, server en host)
cp .env.example .env
# Editar .env con SESSION_SECRET y credenciales
npm run docker:db        # solo la BD
npm run dev              # server con nodemon

# Producción (todo en Docker)
cp .env.example .env
# Editar .env con secretos fuertes
docker compose up --build -d

# Tests
npm test                 # 60 tests, 10 suites
```

---

## 8. Variables de entorno críticas

| Variable | Obligatoria | Nota |
|----------|:-----------:|------|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `SESSION_SECRET` | ✅ | Secreto de sesión (fuerte en prod) |
| `SEED_ADMIN_EMAIL` | — | Email del admin inicial (default: `admin@mapfi.cl`) |
| `SEED_ADMIN_PASSWORD` | ✅ en prod | Contraseña del admin inicial |
| `PORT` | — | Puerto del server (default: 3000) |
| `NODE_ENV` | — | `development` o `production` |
| `SUPPORT_EMAIL` | — | Email de contacto en centro de ayuda (default: `admin@mapfi.cl`) |

---

## 9. Comandos npm

| Comando | Acción |
|---------|--------|
| `npm start` | Iniciar en producción |
| `npm run dev` | Iniciar con nodemon (hot reload) |
| `npm test` | Ejecutar 60 tests |
| `npm run db:migrate` | Aplicar migraciones manualmente |
| `npm run admin:reset` | Resetear contraseña del admin |
| `npm run docker:up` | Levantar todo con Docker |
| `npm run docker:db` | Solo la BD en Docker (para desarrollo) |

---

## 10. Estructura del proyecto (post-F8)

```
mapfi/
├── server.js                         ← Express: 587 líneas, ~40 endpoints
├── db/migrations/                    ← 7 migraciones SQL (001–007)
├── js/
│   ├── db/                           ← Pool pg + runner migraciones
│   ├── dao/                          ← 9 DAOs (1 por entidad)
│   ├── services/                     ← 5 servicios puros (match, heatmap, etc.)
│   ├── views/                        ← 6 módulos de vista (extraídos de HTML)
│   ├── vendor/fullcalendar/          ← FullCalendar vendoreado
│   ├── sanitize.js                   ← escapeHtml() anti-XSS
│   ├── csv-utils.js                  ← Parser CSV compartido
│   ├── api-client.js                 ← Wrapper fetch con errores amigables
│   └── ... (filtros, tema, toast, etc.)
├── css/design-system.css             ← 460 líneas, identidad UdeC FI
├── img/                              ← udec_FI.svg, GIIA.svg
├── *.html                            ← 11 páginas
├── ayuda.html                        ← Centro de ayuda
├── __tests__/                        ← 10 suites, 60 tests
├── docs/                             ← 9 documentos
├── Dockerfile                        ← USER node, node:20-alpine
├── docker-compose.yaml               ← 127.0.0.1 bind, healthcheck Node.js
└── PLAN_DE_IMPLEMENTACION.md         ← v2.0 (este documento es complementario)
```

---

## 11. Para el siguiente agente de IA

### Si vas a modificar código:
1. **Corré `npm test` antes y después** de tus cambios. Son 60 tests que deben seguir en verde.
2. Las migraciones son aditivas. **Nunca edites una migración existente** — creá una nueva (`008_*.sql`).
3. El frontend usa **IIFE que atan a `window`**. Si creás un nuevo módulo, seguí ese patrón (ver `js/views/onboarding.js` como ejemplo).
4. Las páginas HTML todavía tienen IDs que los módulos JS referencian. Si cambiás un ID en HTML, buscá todas las referencias en `js/views/`.

### Si vas a agregar features:
- **Exportación .ics**: endpoint `GET /api/actividades/ical`, generar formato iCalendar. Alto valor.
- **PWA**: `manifest.json` + `sw.js`. Bajo esfuerzo. Las páginas ya son offline-first parcialmente (FullCalendar vendoreado).
- **Dashboard multi-carrera en match.html**: actualmente solo permite 1 carrera. Replicar el patrón de `dashboard.html`.

### Áreas que necesitan revisión:
- Los valores de matrícula son placeholder (100). Sin datos reales, el cálculo de alcance es simbólico.
- Las fechas de feriados en `002_seed_catalogos.sql` son de 2026. Deben actualizarse cada año o integrarse con una API externa.
- El rate limiting es en memoria. Para multi-instancia, migrar a Redis.
- `SUPPORT_EMAIL` no está en `.env.example` — agregarlo.

---

*Documento generado el 1 de julio de 2026. Última actualización tras completar F5–F8.*
