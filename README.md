# 🗺️ MapFI — Plataforma de Mapeo de la Facultad de Ingeniería

> Centraliza, planifica y co-diseña las actividades de la Facultad de Ingeniería. Calendario interactivo, mapa de calor de saturación y un calculador inteligente de compatibilidad y alcance para que ningún evento pise a otro.

[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🎯 ¿Qué resuelve?

La facultad sufre **topes de horario**, **sobrecarga de actividades** y **falta de visibilidad del público objetivo** al levantar iniciativas. MapFI interconecta a los **centros de estudiantes (13 carreras)**, **Vinculación con el Medio** y **Gearbox** sobre un calendario común con inteligencia de coordinación.

---

## ✨ Funcionalidades

| | Módulo | Descripción |
|---|--------|-------------|
| 📅 | **Calendario centralizado** | Todas las actividades en una vista, con filtros por carrera, generación y entidad |
| 🔥 | **Mapa de calor** | Saturación de eventos por segmento de público (verde → rojo) |
| 🎯 | **Calculador de Match** | Compatibilidad %, alcance estimado y 3 mejores bloques alternativos |
| 🗓️ | **Lógica cronológica** | Feriados nacionales, exclusión de findes, años académicos paramétricos |
| 🔐 | **Acceso por roles** | Aportantes (con login) y público general (solo lectura) |
| 📊 | **KPIs & BI** | Vistas analíticas conectables a Looker / PowerBI / Python |
| 🏆 | **Gamificación** | Reputación, sello de coordinación, ranking público |
| 📄 | **Reportes PDF** | Informe de impacto descargable por entidad |
| 📥 | **Importación CSV** | Carga masiva de fechas desde Excel |
| 📖 | **Centro de ayuda** | Tutoriales interactivos, tour guiado y FAQ integrada |

---

## ⚡ Inicio rápido (Docker)

```bash
cp .env.example .env       # completa SESSION_SECRET y credenciales
docker-compose up --build  # levanta Postgres + server y migra
# → http://localhost:3000
```

En Windows, doble clic en **`start.bat`**.

### 🔑 Acceso de administrador (por defecto)

En la primera migración se crea automáticamente una cuenta de administrador:

| Correo | Contraseña |
|--------|------------|
| `admin@mapfi.cl` | `admin1234` |

> Cámbiala en producción: edita `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` en `.env` **antes** del primer arranque, o cámbiala luego desde la app.

Inicia sesión en `/login.html` y, desde **Admin → Cuentas de usuario**, crea el resto de cuentas (centros de estudiantes, Vinculación, Gearbox e incluso otras cuentas de administrador).

### Sin Docker

```bash
npm install
npm run docker:db          # solo Postgres
cp .env.example .env
npm run db:migrate
npm run dev                # → http://localhost:3000
```

---

## 🗂️ Estructura

```
mapfi/
├── server.js               ← Express: rutas, auth, estáticos
├── db/migrations/          ← esquema SQL numerado + seeds
├── js/
│   ├── db/                 ← pool + runner de migraciones
│   ├── dao/                ← acceso a datos por entidad
│   ├── services/           ← matchService, heatmapService, holidayService
│   └── *-view.js, icons.js ← frontend (sin build)
├── css/design-system.css
├── *.html                  ← index, login, dashboard, calendario, mapa-calor, match
├── __tests__/              ← Jest
└── docs/                   ← documentación completa
```

---

## 📚 Documentación

| Documento | Para quién |
|-----------|-----------|
| [PLAN_DE_IMPLEMENTACION.md](PLAN_DE_IMPLEMENTACION.md) | **Visión completa del proyecto y fases** |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Desarrollador: capas, flujos, decisiones |
| [docs/MODELO_DATOS.md](docs/MODELO_DATOS.md) | Esquema de base de datos |
| [docs/ALGORITMO_MATCH.md](docs/ALGORITMO_MATCH.md) | Cómo funciona el calculador de compatibilidad |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases, hitos y criterios de aceptación |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Hosting local, facultad y nube |
| [docs/DESPLIEGUE_SERVIDOR.md](docs/DESPLIEGUE_SERVIDOR.md) | **Plan de despliegue en el servidor** (DB privada, HTTPS, backups) |
| [docs/GUIA_TECNICA.md](docs/GUIA_TECNICA.md) | Cómo extender el código |
| [docs/GUIA_APORTANTE.md](docs/GUIA_APORTANTE.md) | Manual del usuario (centros, Vinculación, Gearbox) |

---

## 🛠️ Stack

**Node.js + Express** · **PostgreSQL 16** (`tstzrange` + GiST) · **HTML/CSS/JS vanilla** (sin build) · **Docker** · **Jest**

---

## 🗺️ Estado

✅ **Fases 1–4 operativas.** Autenticación, **calendario con FullCalendar**, multi-carrera, **algoritmo de Match completo**, mapa de calor, **gamificación** (reputación + sello + ranking), **reportes PDF**, **panel de KPIs/BI**, **importación CSV híbrida**, **sistema de tutoriales** (tour guiado + centro de ayuda + tooltips). 60 tests en verde. Ver [plan de implementación](PLAN_DE_IMPLEMENTACION.md) y [roadmap](docs/ROADMAP.md).

---

*MapFI · Facultad de Ingeniería · 2026 · Licencia MIT*
