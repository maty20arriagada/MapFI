/**
 * MapFI — server.js
 * Servidor Express: sirve el frontend estatico, autentica a los aportantes con
 * credenciales propias (bcrypt + sesiones en Postgres) y expone la API REST.
 *
 * Capas:  rutas (aqui)  →  js/dao/*  →  PostgreSQL
 *         rutas (aqui)  →  js/services/*  (logica pura: match, heatmap, fechas)
 *
 * Uso:
 *   npm start            → produccion (PORT desde env)
 *   npm run dev          → desarrollo con nodemon
 *   require('./server')  → en tests NO arranca (se exporta `app` para supertest)
 */
"use strict";

// Cargar .env (dev local) ANTES de leer process.env. No-op en docker/cloud.
require("./js/load-env")();

const express = require("express");
const session = require("express-session");
const path = require("path");

const { pool } = require("./js/db");
const { runMigrations } = require("./js/db/migrate");

// DAOs
const userDao = require("./js/dao/userDao");
const carreraDao = require("./js/dao/carreraDao");
const generacionDao = require("./js/dao/generacionDao");
const entidadDao = require("./js/dao/entidadDao");
const periodoDao = require("./js/dao/periodoDao");
const actividadDao = require("./js/dao/actividadDao");
const bloqueHorarioDao = require("./js/dao/bloqueHorarioDao");
const feriadoDao = require("./js/dao/feriadoDao");
const kpiDao = require("./js/dao/kpiDao");

// Servicios (puros)
const matchService = require("./js/services/matchService");
const heatmapService = require("./js/services/heatmapService");
const reputationService = require("./js/services/reputationService");
const reportService = require("./js/services/reportService");

const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const HAS_DB = !!process.env.DATABASE_URL;

// ── Reverse proxy (Railway/Render/Nginx) para cookies 'secure' ──────────────
app.set("trust proxy", 1);

// ── Middleware base ─────────────────────────────────────────────────────────
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// ── Headers de seguridad (helmet-lite) ──────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// ── Sesiones ────────────────────────────────────────────────────────────────
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "dev-inseguro-cambiar",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8, // 8 horas
  },
};
if (HAS_DB && process.env.NODE_ENV !== "test") {
  const PgSession = require("connect-pg-simple")(session);
  sessionConfig.store = new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: false, // la crea la migracion 001
  });
}
app.use(session(sessionConfig));

// ── Middlewares de autorizacion ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: "No autenticado" });
}
function requireRole(rol) {
  return (req, res, next) => {
    if (req.session && req.session.user && req.session.user.rol === rol) return next();
    return res.status(403).json({ error: "No autorizado" });
  };
}

// Helper: query param a entero o undefined.
const num = (v) => (v !== undefined && v !== "" ? parseInt(v, 10) : undefined);

// ============================================================================
// API
// ============================================================================

// ── Salud ───────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true, service: "mapfi" }));

// ── Autenticacion ────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Faltan credenciales" });
  try {
    const u = await userDao.buscarPorEmail(email);
    if (!u || !u.activo) return res.status(401).json({ error: "Credenciales invalidas" });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales invalidas" });

    req.session.user = { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, entidadId: u.entidad_id };
    res.json({ ok: true, user: req.session.user });
  } catch (e) {
    console.error("[login]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: (req.session && req.session.user) || null });
});

// ── Catalogos (publico — alimenta filtros del calendario) ───────────────────
app.get("/api/catalogos", async (req, res) => {
  try {
    const [carreras, generaciones, entidades, periodoActivo] = await Promise.all([
      carreraDao.listar(),
      generacionDao.listar(),
      entidadDao.listar(),
      periodoDao.obtenerActivo(),
    ]);
    res.json({ carreras, generaciones, entidades, periodoActivo });
  } catch (e) {
    console.error("[catalogos]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── Actividades ──────────────────────────────────────────────────────────────
app.get("/api/actividades", async (req, res) => {
  try {
    const acts = await actividadDao.listar({
      carreraId: num(req.query.carreraId),
      nivel: num(req.query.nivel),
      entidadId: num(req.query.entidadId),
      tipo: req.query.tipo,
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    res.json(acts);
  } catch (e) {
    console.error("[actividades:list]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/api/actividades", requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.titulo || !b.fechaInicio || !b.fechaFin || !b.tipo) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    const entidadId = req.session.user.entidadId || b.entidadId;
    if (!entidadId) return res.status(400).json({ error: "Sin entidad asociada" });

    const created = await actividadDao.crear(
      { ...b, entidadId, createdBy: req.session.user.id },
      b.publico || []
    );
    res.status(201).json(created);
  } catch (e) {
    console.error("[actividades:create]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// Carga masiva de actividades (import CSV de evaluaciones) — solo ADMIN.
app.post("/api/actividades/bulk", requireRole("ADMIN"), async (req, res) => {
  try {
    const lista = (req.body && req.body.actividades) || [];
    if (!Array.isArray(lista) || !lista.length) {
      return res.status(400).json({ error: "No se recibieron actividades" });
    }
    let creadas = 0;
    const errores = [];
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i] || {};
      try {
        if (!a.titulo || !a.fechaInicio || !a.fechaFin || !a.tipo || !a.entidadId) {
          throw new Error("Faltan campos obligatorios");
        }
        await actividadDao.crear(
          { ...a, estado: a.estado || "CONFIRMADA", createdBy: req.session.user.id },
          a.publico || []
        );
        creadas++;
      } catch (e) {
        errores.push({ fila: a.fila || i + 1, error: e.message });
      }
    }
    res.json({ creadas, errores });
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// Helper: el usuario es dueno (su entidad) de la actividad, o es ADMIN.
async function puedeEditarActividad(req, id) {
  if (req.session.user.rol === "ADMIN") return true;
  const act = await actividadDao.obtener(id);
  return act && act.entidad_id === req.session.user.entidadId;
}

app.put("/api/actividades/:id", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    if (!(await puedeEditarActividad(req, id))) return res.status(403).json({ error: "No autorizado" });
    res.json(await actividadDao.actualizar(id, req.body || {}, (req.body || {}).publico));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch("/api/actividades/:id/estado", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    if (!(await puedeEditarActividad(req, id))) return res.status(403).json({ error: "No autorizado" });
    const { estado } = req.body || {};
    if (!estado) return res.status(400).json({ error: "Falta 'estado'" });
    res.json(await actividadDao.cambiarEstado(id, estado));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete("/api/actividades/:id", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    if (!(await puedeEditarActividad(req, id))) return res.status(403).json({ error: "No autorizado" });
    res.json(await actividadDao.eliminar(id));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Calculador de Match (§3.C) ──────────────────────────────────────────────
app.post("/api/match/evaluar", requireAuth, async (req, res) => {
  try {
    const { inicio, fin, publico } = req.body || {};
    if (!inicio || !Array.isArray(publico) || publico.length === 0) {
      return res.status(400).json({ error: "Se requiere 'inicio' y 'publico' objetivo" });
    }
    // Contexto completo (feriados, bloques, actividades, poblacion) de la semana.
    const contexto = await actividadDao.cargarContextoMatch(publico, inicio);
    const out = matchService.evaluar(
      { inicio: new Date(inicio), fin: new Date(fin || inicio), publico },
      contexto
    );
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Mapa de calor (§3.B) ─────────────────────────────────────────────────────
app.get("/api/heatmap", async (req, res) => {
  try {
    const filas = await kpiDao.saturacionSegmento({
      carreraId: num(req.query.carreraId),
      nivel: num(req.query.nivel),
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    res.json(heatmapService.construir(filas));
  } catch (e) {
    console.error("[heatmap]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── Feriados (lectura publica) ───────────────────────────────────────────────
app.get("/api/feriados", async (req, res) => {
  try {
    res.json(await feriadoDao.listar());
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// ── Analitica / KPIs (Fase 4 — solo ADMIN) ──────────────────────────────────
app.get("/api/analytics/ocupacion", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await kpiDao.ocupacionBloques()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});
app.get("/api/analytics/aporte", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await kpiDao.aporteEntidad()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});
app.get("/api/analytics/reprogramados", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await kpiDao.eventosReprogramados()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});
app.get("/api/analytics/resumen", requireRole("ADMIN"), async (req, res) => {
  try {
    const [ocupacion, aporte, reprogramados, ranking] = await Promise.all([
      kpiDao.ocupacionBloques(), kpiDao.aporteEntidad(),
      kpiDao.eventosReprogramados(), entidadDao.ranking(),
    ]);
    res.json({ ocupacion, aporte, reprogramados, ranking });
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Gamificacion (§5) ────────────────────────────────────────────────────────
// Ranking publico de entidades por reputacion.
app.get("/api/ranking", async (req, res) => {
  try { res.json(await entidadDao.ranking()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// Recalcula la reputacion de todas las entidades a partir de sus actividades.
app.post("/api/admin/recalcular-reputacion", requireRole("ADMIN"), async (req, res) => {
  try {
    const entidades = await entidadDao.listar();
    const detalle = [];
    for (const e of entidades) {
      const acts = await actividadDao.listarCompleto(e.id);
      const r = reputationService.calcular(acts);
      await entidadDao.actualizarReputacion(e.id, r);
      detalle.push({ entidadId: e.id, ...r });
    }
    res.json({ ok: true, actualizadas: detalle.length, detalle });
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Reporte de impacto por entidad (§5) ─────────────────────────────────────
function puedeVerEntidad(req, id) {
  return req.session.user.rol === "ADMIN" || req.session.user.entidadId === id;
}

// Resumen en JSON (dashboard / preview).
app.get("/api/entidades/:id/resumen", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    if (!puedeVerEntidad(req, id)) return res.status(403).json({ error: "No autorizado" });
    const entidad = await entidadDao.obtener(id);
    if (!entidad) return res.status(404).json({ error: "Entidad no encontrada" });
    const acts = await actividadDao.listarCompleto(id);
    const periodo = await periodoDao.obtenerActivo();
    res.json(reportService.construirResumen(entidad, acts, periodo));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// Reporte PDF descargable.
app.get("/api/reports/:id/pdf", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    if (!puedeVerEntidad(req, id)) return res.status(403).json({ error: "No autorizado" });
    const entidad = await entidadDao.obtener(id);
    if (!entidad) return res.status(404).json({ error: "Entidad no encontrada" });
    const acts = await actividadDao.listarCompleto(id);
    const periodo = await periodoDao.obtenerActivo();
    const resumen = reportService.construirResumen(entidad, acts, periodo);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="reporte-mapfi-${id}.pdf"`);
    reportService.generarPDF(resumen, res);
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Bloques horarios (lectura publica · escritura ADMIN) ────────────────────
app.get("/api/bloques", async (req, res) => {
  try {
    res.json(await bloqueHorarioDao.listar({
      carreraId: num(req.query.carreraId),
      nivel: num(req.query.nivel),
    }));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});
app.post("/api/bloques", requireRole("ADMIN"), async (req, res) => {
  try { res.status(201).json(await bloqueHorarioDao.crear(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/bloques/:id", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await bloqueHorarioDao.eliminar(num(req.params.id))); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Periodos academicos ─────────────────────────────────────────────────────
app.get("/api/periodos", requireAuth, async (req, res) => {
  try { res.json(await periodoDao.listar()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});
app.post("/api/admin/periodos", requireRole("ADMIN"), async (req, res) => {
  try { res.status(201).json(await periodoDao.crear(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/admin/periodos/:id/activar", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await periodoDao.activar(num(req.params.id))); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Admin · catalogos (carreras / entidades) ────────────────────────────────
app.post("/api/admin/carreras", requireRole("ADMIN"), async (req, res) => {
  try { res.status(201).json(await carreraDao.crear(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put("/api/admin/carreras/:id", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await carreraDao.actualizar(num(req.params.id), req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/admin/entidades", requireRole("ADMIN"), async (req, res) => {
  try { res.status(201).json(await entidadDao.crear(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put("/api/admin/entidades/:id", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await entidadDao.actualizar(num(req.params.id), req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Admin · usuarios (alta de aportantes) ───────────────────────────────────
app.get("/api/admin/usuarios", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await userDao.listar()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});
app.post("/api/admin/usuarios", requireRole("ADMIN"), async (req, res) => {
  try {
    const { email, password, nombre, rol, entidadId } = req.body || {};
    if (!email || !password || !nombre) return res.status(400).json({ error: "Faltan campos obligatorios" });
    const hash = await bcrypt.hash(password, 10);
    const u = await userDao.crear({ email, passwordHash: hash, nombre, rol: rol || "APORTANTE", entidadId });
    res.status(201).json(u);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Activar / desactivar / editar una cuenta (controla la apertura de cuentas).
app.patch("/api/admin/usuarios/:id", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await userDao.actualizar(num(req.params.id), req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Cambio de contrasena propia ─────────────────────────────────────────────
app.post("/api/auth/password", requireAuth, async (req, res) => {
  try {
    const { actual, nueva } = req.body || {};
    if (!nueva || nueva.length < 6) return res.status(400).json({ error: "La nueva contrasena debe tener al menos 6 caracteres" });
    const u = await userDao.buscarPorEmail(req.session.user.email);
    if (!u || !(await bcrypt.compare(actual || "", u.password_hash))) {
      return res.status(401).json({ error: "Contrasena actual incorrecta" });
    }
    await userDao.cambiarPassword(u.id, await bcrypt.hash(nueva, 10));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Frontend estatico ────────────────────────────────────────────────────────
// `dotfiles: deny` evita servir .env y otros dotfiles.
app.use(express.static(__dirname, { dotfiles: "deny", extensions: ["html"] }));

// ============================================================================
// Arranque
// ============================================================================
async function start() {
  if (HAS_DB) {
    try {
      await runMigrations();
    } catch (e) {
      console.error("[start] Fallo al migrar:", e.message);
      process.exit(1);
    }
  }
  app.listen(PORT, () => {
    console.log(`\n  MapFI escuchando en http://localhost:${PORT}\n`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
