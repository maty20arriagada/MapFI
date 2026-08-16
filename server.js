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
const icsService = require("./js/services/icsService");
const horarioService = require("./js/services/horarioService");

const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const HAS_DB = !!process.env.DATABASE_URL;

// ── Reverse proxy (Railway/Render/Nginx) ────────────────────────────────────
// Confiar en las cabeceras de proxy SOLO si de verdad hay uno delante
// (revision de seguridad 2026-08-04, hallazgo SEG-1). Antes se hacia siempre,
// y eso permite falsificarlas: con la app expuesta directamente, cualquiera
// manda un `X-Forwarded-For` distinto en cada intento, `req.ip` cambia y el
// limite de 5 intentos de login deja de aplicar — fuerza bruta sin freno.
//
// Por defecto NO se confia (opcion segura). Si pones nginx delante para
// servir HTTPS, DEBES activarlo: sin esto `req.secure` es false y las cookies
// `secure` de produccion no se emiten, con lo que el login no funciona.
const TRUST_PROXY = ["1", "true", "si", "yes"].includes(
  String(process.env.TRUST_PROXY || "").trim().toLowerCase()
);
if (TRUST_PROXY) app.set("trust proxy", 1);

// ── Middleware base ─────────────────────────────────────────────────────────
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// ── Headers de seguridad (helmet-lite) ──────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    // `data:` es necesario: FullCalendar embebe su fuente de iconos como
    // data URI, y sin esto el CSP la bloquea y los botones de anterior y
    // siguiente del calendario quedan VACIOS (auditoria 2026-08-04).
    // Permitir fuentes data: no abre una via de ejecucion, a diferencia de
    // hacerlo en script-src.
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'self'; " +
    "form-action 'self'"
  );
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// ── Sesiones ────────────────────────────────────────────────────────────────
// Fail-fast en produccion si falta el secreto (revision QA, hallazgo S-1):
// antes se caia a un valor por defecto PUBLICO, con el que cualquiera que
// leyera este repositorio podia firmar una cookie de sesion valida y
// suplantar a un administrador. Mismo criterio que DATABASE_URL.
if (isProduction && !process.env.SESSION_SECRET) {
  console.error(
    "[server] FATAL: SESSION_SECRET no esta definida y NODE_ENV=production. " +
    "Genera una con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
  process.exit(1);
}
// En produccion las cookies van con `secure`, que exige HTTPS. Eso casi
// siempre significa un nginx delante — y entonces hace falta TRUST_PROXY, o
// `req.secure` sera false y la cookie de sesion nunca se emitira (login roto,
// sin ningun error visible). Se avisa fuerte en vez de adivinar.
if (isProduction && !TRUST_PROXY) {
  console.warn(
    "[server] AVISO: NODE_ENV=production sin TRUST_PROXY. Si sirves detras de " +
    "un proxy (nginx) con HTTPS, define TRUST_PROXY=true o el login fallara. " +
    "Si la app se expone directamente, dejalo asi: activarlo permitiria " +
    "falsificar la IP y saltarse el limite de intentos de login."
  );
}
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "dev-inseguro-cambiar",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict", // la app es same-origin completa; strict corta CSRF
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

// ── Anti-CSRF: validar Origin/Referer en metodos que mutan ──────────────────
// Complementa sameSite=strict. Si el navegador envia Origin (o Referer) y no
// coincide con el Host propio, se rechaza. Peticiones sin ambos (curl, tests)
// pasan: la proteccion CSRF aplica a navegadores, que siempre los envian.
app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return next();
  try {
    if (new URL(origin).host !== req.headers.host) {
      return res.status(403).json({ error: "Origen no permitido" });
    }
  } catch (_) {
    return res.status(403).json({ error: "Origen no permitido" });
  }
  next();
});

// ── Rate limiting del login (inline, sin dependencias — patron helmet-lite) ─
// Maximo 5 intentos fallidos por IP+CUENTA cada 15 minutos (T065, H-09,
// FR-015). Antes se limitaba solo por IP: detras de un NAT/proxy compartido
// (una sede, una red universitaria) una sola persona que olvida su
// contrasena bloqueaba el login de TODA la facultad (E-09). En memoria del
// proceso: suficiente para una instancia; si algun dia hay varias, mover a
// Redis/BD.
const LOGIN_MAX_INTENTOS = 5;
const LOGIN_VENTANA_MS = 15 * 60 * 1000;
const loginIntentos = new Map(); // "ip|email" -> { count, expira }
function claveIntento(req) {
  const ip = req.ip || "?";
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  return `${ip}|${email}`;
}
function loginLimiter(req, res, next) {
  const key = claveIntento(req);
  const ahora = Date.now();
  const reg = loginIntentos.get(key);
  if (reg && reg.expira <= ahora) loginIntentos.delete(key);
  const activo = loginIntentos.get(key);
  if (activo && activo.count >= LOGIN_MAX_INTENTOS) {
    const min = Math.ceil((activo.expira - ahora) / 60000);
    return res.status(429).json({ error: `Demasiados intentos. Prueba de nuevo en ${min} min.` });
  }
  next();
}
function loginFallido(req) {
  const key = claveIntento(req);
  const reg = loginIntentos.get(key) || { count: 0, expira: Date.now() + LOGIN_VENTANA_MS };
  reg.count++;
  loginIntentos.set(key, reg);
}
function loginExitoso(req) {
  loginIntentos.delete(claveIntento(req));
}
// Limpieza periodica para que el Map no crezca indefinidamente.
setInterval(() => {
  const ahora = Date.now();
  for (const [key, reg] of loginIntentos) if (reg.expira <= ahora) loginIntentos.delete(key);
}, 10 * 60 * 1000).unref();

// ── Middlewares de autorizacion ─────────────────────────────────────────────
// T058/T059 (H-06, FR-012): antes, `req.session.user` se confiaba tal cual
// se guardo en el login — desactivar una cuenta o cambiarle el rol no tenia
// efecto hasta que esa sesion expirara sola. Ahora cada peticion autenticada
// revalida contra la BD (consulta por clave primaria, costo despreciable) y
// refresca rol/entidad; si la cuenta ya no existe o esta inactiva, se
// destruye la sesion para que la siguiente peticion reciba limpiamente la
// pantalla de inicio de sesion en vez de un 401 repetido con una cookie rota.
async function revalidarSesion(req) {
  if (!req.session || !req.session.user) return false;
  const u = await userDao.obtener(req.session.user.id);
  if (!u || !u.activo) return false;
  req.session.user.rol = u.rol;
  req.session.user.entidadId = u.entidad_id;
  return true;
}
function noAutenticado(req, res) {
  if (req.session) return req.session.destroy(() => res.status(401).json({ error: "No autenticado" }));
  return res.status(401).json({ error: "No autenticado" });
}
async function requireAuth(req, res, next) {
  if (await revalidarSesion(req)) return next();
  return noAutenticado(req, res);
}
// ── Jerarquia de roles ──────────────────────────────────────────────────────
// SUPERADMIN es un superconjunto de ADMIN: puede todo lo que puede un
// administrador, y ademas borrar de forma definitiva. Sin esta jerarquia, las
// comprobaciones por igualdad estricta dejarian al SUPERADMIN fuera de las 21
// rutas de administracion, que es justo lo contrario de lo que se busca.
const ROLES_ADMIN = ["ADMIN", "SUPERADMIN"];

/** ¿El usuario tiene atribuciones de administrador? */
function esAdministrador(user) {
  return !!user && ROLES_ADMIN.includes(user.rol);
}

/** ¿Cumple el rol pedido, contando la jerarquia? */
function cumpleRol(user, requerido) {
  if (!user) return false;
  if (requerido === "ADMIN") return esAdministrador(user);
  return user.rol === requerido; // SUPERADMIN se exige de forma exacta
}

function requireRole(rol) {
  return async (req, res, next) => {
    if (!(await revalidarSesion(req))) return noAutenticado(req, res);
    if (!cumpleRol(req.session.user, rol)) return res.status(403).json({ error: "No autorizado" });
    return next();
  };
}

// Helper: query param a entero o undefined.
const num = (v) => (v !== undefined && v !== "" ? parseInt(v, 10) : undefined);

// ── Politica de contrasenas (unica) ─────────────────────────────────────────
// Estaba solo en el cambio de contrasena propia; la creacion de cuentas no
// validaba nada y admitia una clave de un caracter (revision de seguridad
// 2026-08-04, SEG-5). Ahora ambas rutas usan esta funcion.
const PASSWORD_MIN = 8;
function errorPassword(pass) {
  if (!pass || typeof pass !== "string" || pass.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  }
  return null;
}

// ── Seleccion explicita de campos de actividad (Spec 002, H-04, FR-008) ─────
// NUNCA propagar el cuerpo de una peticion con `{ ...b }` hacia el DAO: eso
// permite que el cliente cuele campos que no deberia controlar (estado,
// entidadId, compatibilidad, alcance, createdBy...). Esta funcion es la unica
// via para construir el objeto de escritura a partir de un body de usuario;
// TODAS las rutas de escritura de actividades (creacion individual, carga
// masiva, edicion) DEBEN pasar por aqui. T046 verifica que asi sea.
function camposActividadPermitidos(b) {
  b = b || {};
  return {
    titulo: b.titulo,
    descripcion: b.descripcion,
    tipo: b.tipo,
    ramo: b.ramo,
    ubicacion: b.ubicacion,
    fechaInicio: aInstante(b.fechaInicio),
    fechaFin: aInstante(b.fechaFin),
    urlInscripcion: normalizarUrl(b.urlInscripcion),
    publico: Array.isArray(b.publico) ? b.publico : undefined,
  };
}

// ── Enlace de inscripcion ───────────────────────────────────────────────────
// Este valor termina renderizado como `<a href>` y dentro del feed iCalendar,
// asi que solo se aceptan http y https. Un `javascript:` guardado aqui se
// ejecutaria al pulsarlo; un `data:` puede servir contenido arbitrario.
/**
 * @returns {string|null|undefined} la URL si es valida · null si vino pero no
 *   lo es · undefined si no vino (para no pisar el valor en un update).
 */
function normalizarUrl(valor) {
  if (valor === undefined || valor === null) return undefined;
  const txt = String(valor).trim();
  if (!txt) return null; // vaciar el campo a proposito
  try {
    const u = new URL(txt);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return txt.slice(0, 500);
  } catch (_) {
    return null;
  }
}

/** Mensaje si el enlace vino pero no es una direccion web valida. */
function errorUrlInscripcion(b, original) {
  const vino = original && typeof original.urlInscripcion === "string" && original.urlInscripcion.trim();
  if (vino && b.urlInscripcion === null) {
    return "El enlace de inscripción debe empezar por http:// o https://";
  }
  return null;
}

// ── Normalizacion de fechas (C-1 / H-01, revision QA 2026-08-04) ────────────
// El formulario manda horas SIN zona ("2026-04-17T21:00", de un
// <input type="datetime-local">). Si esa cadena viaja tal cual hasta la BD,
// quien decide que significa es el `timezone` de la SESION de Postgres — que
// en un volumen antiguo seguia en UTC, guardando las 21:00 como 17:00.
//
// Convirtiendola aqui a Date, node-postgres la envia como instante con
// desfase explicito y el resultado deja de depender de la zona de la BD.
// La zona del proceso Node (TZ=America/Santiago, fijada en el Dockerfile y
// en docker-compose) es la que interpreta la hora del formulario, que es
// justo lo que el usuario quiso decir.
/**
 * @returns {Date|null|undefined} Date si es valida · null si vino pero es
 *   ilegible · undefined si no vino (para no pisar valores en un update).
 */
function aInstante(valor) {
  if (valor === undefined || valor === null || valor === "") return undefined;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

/** Mensaje de error si alguna fecha vino presente pero ilegible. */
function errorFechaIlegible(b) {
  if (b.fechaInicio === null || b.fechaFin === null) {
    return "La fecha u hora no tiene un formato válido";
  }
  return null;
}

// ── Traduccion de errores de base de datos (T055, FR-011, SC-009) ───────────
// e.code (SQLSTATE) no depende del texto exacto de una restriccion — a
// diferencia de e.message, que expone nombres internos de tabla/columna que
// no le sirven a quien esta subiendo un CSV y solo confunden (H-05).
const MENSAJES_SQLSTATE = {
  "23505": "Ya existe un registro igual (posible fila duplicada)",
  "23503": "Hace referencia a un dato que no existe (revisa carrera, entidad o tipo)",
  "23502": "Falta un dato obligatorio",
  "23514": "Un valor no cumple una regla del sistema (revisa el tipo o el estado)",
  "22007": "Formato de fecha inválido",
  "22008": "Formato de fecha inválido",
};
// T063 (H-08, FR-014): validar el rango ANTES de llegar a la BD — si no,
// falla como una restriccion CHECK generica que server.js no sabe traducir
// a un mensaje util (ver traducirErrorBD, que no cubre ese caso).
function errorRangoFechas(fechaInicio, fechaFin) {
  if (fechaInicio && fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) {
    return "La fecha de término debe ser posterior a la de inicio";
  }
  return null;
}

function traducirErrorBD(e) {
  return (e && e.code && MENSAJES_SQLSTATE[e.code]) || (e && e.message) || "Error desconocido";
}

// ── Evaluacion de Match reutilizable (Spec 002, H-03, FR-005) ───────────────
// Antes, compatibilidad/alcance solo se calculaban para la PREVIA en
// pantalla (POST /api/match/evaluar) y nunca se guardaban al crear la
// actividad real: el reporte de impacto siempre mostraba 0. El servidor
// ahora los calcula SIEMPRE aqui (nunca confia en lo que mande el cliente:
// ver H-04) tanto en creacion individual como en carga masiva.

/** Lunes (YYYY-MM-DD) de la semana que contiene `fecha` — debe coincidir con actividadDao.semanaDe(). */
function lunesDe(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

/** Clave de cache: mismo contexto de Match para filas de la misma semana + mismo publico. */
function claveContexto(fecha, publico) {
  const pub = publico.map((p) => `${p.carreraId}-${p.nivel}`).sort().join(",");
  return `${lunesDe(fecha)}|${pub}`;
}

/**
 * Evalua compatibilidad y alcance de una propuesta (fechaInicio/fechaFin/
 * publico). `contextoCache` (opcional, Map) evita recargar el contexto de
 * la semana para cada fila de una carga masiva que comparta semana+publico.
 * @returns {Promise<{compatibilidadPct:number|null, alcanceEstimado:number|null}>}
 */
async function evaluarMatchParaActividad({ fechaInicio, fechaFin, publico }, contextoCache) {
  if (!Array.isArray(publico) || !publico.length) {
    return { compatibilidadPct: null, alcanceEstimado: null };
  }
  let contexto;
  if (contextoCache) {
    const clave = claveContexto(fechaInicio, publico);
    if (!contextoCache.has(clave)) {
      contextoCache.set(clave, await actividadDao.cargarContextoMatch(publico, fechaInicio));
    }
    contexto = contextoCache.get(clave);
  } else {
    contexto = await actividadDao.cargarContextoMatch(publico, fechaInicio);
  }
  const r = matchService.evaluar(
    { inicio: new Date(fechaInicio), fin: new Date(fechaFin || fechaInicio), publico },
    contexto
  );
  return { compatibilidadPct: r.compatibilidad_pct, alcanceEstimado: r.alcance_estimado };
}

// ============================================================================
// API
// ============================================================================

// ── Salud ───────────────────────────────────────────────────────────────────
// Incluye version y ultima migracion aplicada (revision QA, hallazgo A-2):
// durante la revision resulto que el contenedor "en marcha" era de dos meses
// atras y le faltaban 7 migraciones — pero /api/health respondia ok, asi que
// "esta corriendo" parecia lo mismo que "esta actualizado". Con esto se
// distingue de un vistazo, sin entrar al contenedor.
app.get("/api/health", async (req, res) => {
  const salida = { ok: true, service: "mapfi", version: require("./package.json").version };
  try {
    const { rows } = await pool.query(
      "SELECT version, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1"
    );
    if (rows[0]) {
      salida.migracion = rows[0].version;
      salida.migradoEn = rows[0].applied_at;
    }
    const tz = await pool.query("SHOW timezone");
    salida.tzBaseDatos = tz.rows[0].TimeZone;
    salida.tzServidor = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_) {
    salida.bd = "sin conexion";
  }
  res.json(salida);
});

// ── Autenticacion ────────────────────────────────────────────────────────────
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Faltan credenciales" });
  try {
    const u = await userDao.buscarPorEmail(email);
    if (!u || !u.activo) { loginFallido(req); return res.status(401).json({ error: "Correo o contraseña incorrectos" }); }
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) { loginFallido(req); return res.status(401).json({ error: "Correo o contraseña incorrectos" }); }

    loginExitoso(req);
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

// Revalida contra la BD igual que requireAuth (revision QA, hallazgo M-6):
// si no, una cuenta ya desactivada seguia devolviendo su usuario aqui y el
// frontend mantenia la interfaz de sesion iniciada hasta que el usuario
// tocara por casualidad una ruta protegida.
app.get("/api/auth/me", async (req, res) => {
  try {
    if (!(await revalidarSesion(req))) {
      if (req.session && req.session.user) {
        return req.session.destroy(() => res.json({ user: null }));
      }
      return res.json({ user: null });
    }
    // carreraId: comodidad para que la interfaz sepa que controles mostrar
    // sin adivinar (Spec 003, US4). La autorizacion real sigue verificandose
    // en el servidor en cada escritura (puedeEditarHorario) — esto solo
    // evita que la UI ofrezca botones que el backend igual rechazaria.
    const carreraId = req.session.user.entidadId
      ? await entidadDao.carreraDeEntidad(req.session.user.entidadId)
      : null;
    res.json({ user: { ...req.session.user, carreraId } });
  } catch (e) {
    console.error("[auth:me]", e);
    res.json({ user: null });
  }
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
    const entidadId = num(req.query.entidadId);
    const u = req.session.user;
    // "propias" (ve tambien lo oculto/archivado) SOLO si la sesion es el
    // ADMIN o la propia entidad consultada — nunca por el solo hecho de que
    // el cliente pida ese entidadId (H-04: la autoridad la decide el
    // servidor, no el parametro de la consulta).
    const esPropia = !!u && !!entidadId && (esAdministrador(u) || u.entidadId === entidadId);
    const acts = await actividadDao.listar({
      carreraId: num(req.query.carreraId),
      nivel: num(req.query.nivel),
      entidadId,
      tipo: req.query.tipo,
      desde: req.query.desde,
      hasta: req.query.hasta,
      alcance: esPropia ? "propias" : "publico",
      // Foco "para participar" del calendario publico: oportunidades en vez
      // de obligaciones academicas. Se acepta cualquier forma afirmativa
      // porque lo manda un checkbox del navegador.
      soloParticipacion: ["1", "true", "si"].includes(
        String(req.query.soloParticipacion || "").toLowerCase()
      ),
    });
    res.json(acts);
  } catch (e) {
    console.error("[actividades:list]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/api/actividades", requireAuth, async (req, res) => {
  try {
    const b = camposActividadPermitidos(req.body);
    const errorIlegible = errorFechaIlegible(b) || errorUrlInscripcion(b, req.body);
    if (errorIlegible) return res.status(400).json({ error: errorIlegible });
    if (!b.titulo || !b.fechaInicio || !b.fechaFin || !b.tipo) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    const errorFechas = errorRangoFechas(b.fechaInicio, b.fechaFin);
    if (errorFechas) return res.status(400).json({ error: errorFechas });
    const esAdmin = esAdministrador(req.session.user);
    // Un aportante NUNCA elige su entidad (H-04): antes, si la sesion no
    // tenia entidad, el `||` dejaba pasar la del cuerpo — una cuenta creada
    // sin centro asignado podia publicar a nombre de cualquier otro centro.
    // La ruta hermana (/bulk) ya cerraba este caso; se replica aqui
    // (revision de seguridad 2026-08-15).
    if (!esAdmin && !req.session.user.entidadId) {
      return res.status(403).json({ error: "Tu cuenta no tiene entidad asociada" });
    }
    const entidadId = esAdmin ? num(req.body.entidadId) : req.session.user.entidadId;
    if (!entidadId) return res.status(400).json({ error: "Sin entidad asociada" });

    // T047: estado inicial derivado SIEMPRE del rol de sesion — nunca del
    // cliente salvo la eleccion propia del admin — igual que ya hacia bien
    // /bulk. Un aportante siempre entra como PROPUESTA (moderacion reactiva).
    const estado = esAdmin ? (req.body.estado || "CONFIRMADA") : "PROPUESTA";

    // El servidor calcula compatibilidad y alcance SIEMPRE (H-03/H-04): lo
    // que el cliente haya enviado para estos campos ya fue descartado por
    // camposActividadPermitidos y se ignora por completo.
    const match = await evaluarMatchParaActividad(b);

    const created = await actividadDao.crear(
      { ...b, entidadId, estado, ...match, createdBy: req.session.user.id },
      b.publico || []
    );
    res.status(201).json({ ...created, estado, ...match });
  } catch (e) {
    console.error("[actividades:create]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// Carga masiva de actividades (import CSV) — flujo HIBRIDO (§16.5):
//   · ADMIN     → las actividades entran CONFIRMADAS directo.
//   · APORTANTE → entran como PROPUESTA a nombre de SU entidad, y el admin
//                 las revisa en "Pendientes de revision" (aprueba/rechaza).
app.post("/api/actividades/bulk", requireAuth, async (req, res) => {
  try {
    const lista = (req.body && req.body.actividades) || [];
    if (!Array.isArray(lista) || !lista.length) {
      return res.status(400).json({ error: "No se recibieron actividades" });
    }
    const esAdmin = esAdministrador(req.session.user);
    if (!esAdmin && !req.session.user.entidadId) {
      return res.status(403).json({ error: "Tu cuenta no tiene entidad asociada" });
    }
    let creadas = 0;
    const errores = [];
    // Contexto de Match compartido entre filas de la misma semana+publico
    // (T038): una carga de cien filas no debe repetir esas consultas cien
    // veces.
    const contextoCache = new Map();
    for (let i = 0; i < lista.length; i++) {
      const filaCruda = lista[i] || {};
      try {
        const a = camposActividadPermitidos(filaCruda);
        // Aportante: no puede elegir entidad ni estado — se fuerzan.
        const entidadId = esAdmin ? num(filaCruda.entidadId) : req.session.user.entidadId;
        const estado = esAdmin ? (filaCruda.estado || "CONFIRMADA") : "PROPUESTA";
        const errorIlegible = errorFechaIlegible(a) || errorUrlInscripcion(a, filaCruda);
        if (errorIlegible) throw new Error(errorIlegible);
        if (!a.titulo || !a.fechaInicio || !a.fechaFin || !a.tipo || !entidadId) {
          throw new Error("Faltan campos obligatorios");
        }
        const errorFechas = errorRangoFechas(a.fechaInicio, a.fechaFin);
        if (errorFechas) throw new Error(errorFechas);
        const match = await evaluarMatchParaActividad(a, contextoCache);
        await actividadDao.crear(
          { ...a, entidadId, estado, ...match, createdBy: req.session.user.id },
          a.publico || []
        );
        creadas++;
      } catch (e) {
        errores.push({ fila: filaCruda.fila || i + 1, error: traducirErrorBD(e) });
      }
    }
    res.json({ creadas, errores, estado: esAdmin ? "CONFIRMADA" : "PROPUESTA" });
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// Pendientes de revision (importaciones de aportantes) — solo ADMIN.
app.get("/api/admin/pendientes", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await actividadDao.listarPendientes()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// Actividades retiradas/archivadas (T029) — solo ADMIN.
app.get("/api/admin/actividades/retiradas", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await actividadDao.listarRetiradas()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// Aprobar / rechazar en bloque. APROBAR→CONFIRMADA · RECHAZAR→SUSPENDIDA.
app.post("/api/admin/actividades/revisar", requireRole("ADMIN"), async (req, res) => {
  try {
    const { ids, accion } = req.body || {};
    if (!Array.isArray(ids) || !ids.length || !["APROBAR", "RECHAZAR"].includes(accion)) {
      return res.status(400).json({ error: "Se requiere 'ids' y accion APROBAR|RECHAZAR" });
    }
    const estado = accion === "APROBAR" ? "CONFIRMADA" : "SUSPENDIDA";
    res.json(await actividadDao.cambiarEstadoBulk(ids.map(Number).filter(Boolean), estado));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Feed iCalendar (suscripcion desde Google / Outlook / Apple) ─────────────
// PUBLICO a proposito: quien se suscribe es un estudiante sin cuenta, y
// ademas quien lo descarga no es su navegador sino los SERVIDORES de Google
// u Outlook, que no tienen sesion. Por eso usa alcance "publico" y no puede
// exponer nada oculto.
//
// Acepta los mismos filtros que el calendario, de modo que la direccion a la
// que alguien se suscribe lleva su carrera y su año dentro. `ids` sirve para
// llevarse actividades sueltas.
const ICS_MAX_IDS = 100;

// Identidad estable del calendario, independiente de como se alcance el
// servidor. Solo se usa para construir los UID, asi que puede (y debe)
// quedarse fija aunque cambie el dominio real de despliegue: cambiarla
// duplicaria los eventos en los calendarios ya suscritos.
const MAPFI_DOMINIO = process.env.MAPFI_DOMINIO || "mapfi.udec.cl";

app.get("/api/calendario.ics", async (req, res) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",").map((s) => parseInt(s, 10)).filter(Number.isFinite);
    if (ids.length > ICS_MAX_IDS) {
      return res.status(400).json({ error: `No se pueden pedir más de ${ICS_MAX_IDS} actividades a la vez` });
    }
    const acts = await actividadDao.listar({
      carreraId: num(req.query.carreraId),
      nivel: num(req.query.nivel),
      entidadId: num(req.query.entidadId),
      tipo: req.query.tipo,
      alcance: "publico",
      soloParticipacion: ["1", "true", "si"].includes(
        String(req.query.soloParticipacion || "").toLowerCase()
      ),
      ids,
      // Al pedir actividades sueltas no tiene sentido arrastrar cancelaciones
      // de otras; en la suscripcion si, porque es lo que mantiene la agenda
      // del estudiante al dia.
      incluirCanceladas: ids.length === 0,
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="mapfi.ics"');
    // Google reconsulta el feed muy seguido; una hora de cache evita golpear
    // la base sin que el calendario quede desactualizado (su propio refresco
    // es de 12-24 h de todos modos).
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(icsService.generar(acts, {
      // OJO: el dominio NO puede salir de `req.headers.host`. Forma parte del
      // UID, y el UID es lo que hace que editar una actividad ACTUALICE el
      // evento en vez de duplicarlo. Si dependiera del host, la misma
      // actividad tendria un UID distinto segun se entrara por IP, por
      // localhost o por el dominio real, y al mover el servidor a produccion
      // todos los calendarios ya suscritos duplicarian cada evento.
      // Detectado en la auditoria del 2026-08-04.
      dominio: MAPFI_DOMINIO,
      nombre: ids.length ? "MapFI · selección" : "MapFI · Facultad de Ingeniería",
    }));
  } catch (e) {
    console.error("[calendario.ics]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// Aviso publico de cancelaciones: que se elimino del calendario en los
// ultimos 30 dias y que centro lo hizo. Es PUBLICA a proposito — quien mas
// necesita enterarse de que un evento se cancelo es el estudiante que lo
// vio en el calendario, y ese no tiene cuenta. Devuelve el centro
// responsable, nunca el nombre de la persona (ver el DAO).
app.get("/api/actividades/eliminadas", async (req, res) => {
  try { res.json(await actividadDao.listarEliminadasRecientes()); }
  catch (e) {
    console.error("[actividades:eliminadas]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// Choques de horario+publico entre actividades vigentes (§16.4, H-02, H-14).
// Requiere rango de fechas: acota la consulta a la ventana visible del
// calendario en vez de recorrer todo el historial.
// Tope de la ventana consultable: la ruta es publica y hace un self-join,
// asi que un rango arbitrario (año 1000 al 9999) seria un coste gratuito
// para cualquiera (revision QA, hallazgo S-3). Dos años cubre de sobra lo
// que muestra el calendario.
const CONFLICTOS_MAX_DIAS = 730;

app.get("/api/actividades/conflictos", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) return res.status(400).json({ error: "Se requiere 'desde' y 'hasta'" });
    const d0 = new Date(desde), d1 = new Date(hasta);
    if (isNaN(d0.getTime()) || isNaN(d1.getTime())) {
      return res.status(400).json({ error: "Las fechas del rango no son válidas" });
    }
    if ((d1 - d0) / 86400000 > CONFLICTOS_MAX_DIAS) {
      return res.status(400).json({ error: `El rango no puede superar ${CONFLICTOS_MAX_DIAS} días` });
    }
    res.json(await actividadDao.conflictos(desde, hasta));
  }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// Plantilla CSV descargable (§16.6) — publica, una sola fuente de verdad.
app.get("/api/plantilla-csv", (req, res) => {
  const csv =
    "titulo,ramo,tipo,inicio,fin,carreras,niveles,ubicacion\n" +
    '"Certamen 1","Cálculo I",EXAMEN,2026-04-15 18:30,2026-04-15 20:00,ICI|ICINF|ICM,1,"Aula Magna"\n' +
    '"Charla de titulación","",CHARLA,2026-05-06 12:00,,ICI,4|5,"Auditorio"\n' +
    '"Entrega informe","Física I",ENTREGA,2026-06-10 23:59,,*,1,\n';
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="plantilla-mapfi.csv"');
  res.send("﻿" + csv); // BOM para que Excel respete UTF-8
});

// Helper: el usuario es dueno (su entidad) de la actividad, o es ADMIN.
async function puedeEditarActividad(req, id) {
  if (esAdministrador(req.session.user)) return true;
  const act = await actividadDao.obtener(id);
  return act && act.entidad_id === req.session.user.entidadId;
}

// Transiciones que puede pedir un APORTANTE sobre lo suyo via PUT/PATCH
// estado (data-model.md, T048): cancelar (SUSPENDIDA) o reprogramar
// (REPROGRAMADA). Ratificar (CONFIRMADA), retirar y restituir son
// exclusivos del administrador — ver /retirar y /restituir mas arriba.
const ESTADOS_APORTANTE = ["SUSPENDIDA", "REPROGRAMADA"];

app.put("/api/actividades/:id", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    if (!(await puedeEditarActividad(req, id))) return res.status(403).json({ error: "No autorizado" });
    const esAdmin = esAdministrador(req.session.user);
    // T046/H-04: JAMAS propagar req.body crudo hacia el DAO — solo los
    // campos de camposActividadPermitidos() pueden llegar aqui.
    const b = camposActividadPermitidos(req.body);
    const errorIlegible = errorFechaIlegible(b) || errorUrlInscripcion(b, req.body);
    if (errorIlegible) return res.status(400).json({ error: errorIlegible });

    // Se carga una sola vez: hace falta tanto para validar el cambio de
    // estado como para recalcular el Match.
    const actual = await actividadDao.obtener(id);
    if (!actual) return res.status(404).json({ error: "Actividad no encontrada" });

    // C-2 (revision QA): la restriccion por rol solo aplica cuando el estado
    // CAMBIA de verdad. Antes se rechazaba tambien el reenvio del estado
    // ACTUAL — y como el formulario de "Mis eventos" siempre manda `estado`,
    // un aportante no podia ni corregir la fecha de su propia actividad.
    let estado;
    const estadoPedido = req.body ? req.body.estado : undefined;
    if (estadoPedido !== undefined && estadoPedido !== actual.estado) {
      if (!esAdmin && !ESTADOS_APORTANTE.includes(estadoPedido)) {
        return res.status(403).json({ error: "No puedes cambiar la actividad a ese estado" });
      }
      estado = estadoPedido;
    }

    // Recalcular compatibilidad/alcance SOLO si cambia lo que los determina
    // (fecha o publico) — evita trabajo innecesario en ediciones de titulo o
    // lugar (T039, H-03). Tambien es donde se valida el rango (T063), porque
    // hasta aqui se conocen los valores EFECTIVOS (los nuevos combinados con
    // los que ya tenia, si solo cambio uno de los dos extremos).
    let match = {};
    if (b.fechaInicio || b.fechaFin || Array.isArray(b.publico)) {
      const fechaInicio = b.fechaInicio || actual.fecha_inicio;
      const fechaFin = b.fechaFin || actual.fecha_fin || fechaInicio;
      const errorFechas = errorRangoFechas(fechaInicio, fechaFin);
      if (errorFechas) return res.status(400).json({ error: errorFechas });
      const publico = Array.isArray(b.publico)
        ? b.publico
        : actual.publico.map((p) => ({ carreraId: p.carrera_id, nivel: p.nivel }));
      match = await evaluarMatchParaActividad({ fechaInicio, fechaFin, publico });
    }
    res.json(await actividadDao.actualizar(id, { ...b, estado, ...match }, b.publico));
  } catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});

app.patch("/api/actividades/:id/estado", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    if (!(await puedeEditarActividad(req, id))) return res.status(403).json({ error: "No autorizado" });
    const { estado } = req.body || {};
    if (!estado) return res.status(400).json({ error: "Falta 'estado'" });

    const act = await actividadDao.obtener(id);
    if (!act) return res.status(404).json({ error: "Actividad no encontrada" });

    const esAdmin = esAdministrador(req.session.user);
    // Igual que en el PUT: solo se restringe cuando el estado cambia de
    // verdad; reenviar el que ya tiene no es un cambio (C-2).
    if (estado !== act.estado && !esAdmin && !ESTADOS_APORTANTE.includes(estado)) {
      return res.status(403).json({ error: "No puedes cambiar la actividad a ese estado" });
    }
    // T049: la reputacion se basa en REALIZADA — no puede ganarse marcando
    // como cumplida una actividad que todavia no ocurre, sea quien sea.
    if (estado === "REALIZADA" && new Date(act.fecha_inicio) > new Date()) {
      return res.status(400).json({ error: "No puedes marcar como realizada una actividad que aún no ha ocurrido" });
    }
    res.json(await actividadDao.cambiarEstado(id, estado));
  } catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});

// "Eliminar" ya no borra: archiva (E-07, reversible). El autor archiva lo
// suyo sin necesidad de motivo; el retiro CON motivo por un administrador
// sobre actividades ajenas usa la ruta /retirar de abajo.
app.delete("/api/actividades/:id", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    if (!(await puedeEditarActividad(req, id))) return res.status(403).json({ error: "No autorizado" });
    // El motivo es opcional pero muy util para quien ya habia visto la
    // fecha: es lo que convierte "desaparecio" en "se cancelo porque...".
    const motivo = (req.body && typeof req.body.motivo === "string")
      ? req.body.motivo.trim().slice(0, 300) || null
      : null;
    res.json(await actividadDao.archivar(id, req.session.user.id, motivo));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// Retiro y restitucion administrativos (FR-004b, FR-009b/c) — solo ADMIN:
// nadie mas puede hacer desaparecer del calendario publico una actividad
// ajena, ni deshacer un archivado/retiro (autoridad del servidor, H-04).
app.post("/api/admin/actividades/:id/retirar", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = num(req.params.id);
    const { motivo } = req.body || {};
    res.json(await actividadDao.retirar(id, req.session.user.id, motivo || null));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Borrado DEFINITIVO (solo SUPERADMIN) ────────────────────────────────────
// Destruye la actividad de verdad y NO la publica en el aviso de
// cancelaciones. Es una accion de operacion (limpiar pruebas, retirar algo
// publicado por error), no el flujo normal de los centros.
//
// Deliberadamente en una ruta aparte y no como un parametro del DELETE
// normal: asi es imposible destruir algo por accidente creyendo que se
// archivaba. Queda registro interno en `borrado_definitivo`.
app.delete("/api/superadmin/actividades/:id", requireRole("SUPERADMIN"), async (req, res) => {
  try {
    const id = num(req.params.id);
    const motivo = (req.body && typeof req.body.motivo === "string")
      ? req.body.motivo.trim().slice(0, 300) || null
      : null;
    const r = await actividadDao.borrarDefinitivo(id, req.session.user.id, motivo);
    if (!r) return res.status(404).json({ error: "Actividad no encontrada" });
    console.warn(`[borrado-definitivo] usuario=${req.session.user.email} actividad=${id} "${r.titulo}"`);
    res.json(r);
  } catch (e) {
    console.error("[borrado-definitivo]", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// Registro interno de borrados definitivos. NO es publico: el borrado no se
// anuncia, pero tiene que poder auditarse.
app.get("/api/superadmin/borrados", requireRole("SUPERADMIN"), async (req, res) => {
  try { res.json(await actividadDao.listarBorradosDefinitivos(num(req.query.limite))); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});

app.post("/api/admin/actividades/:id/restituir", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = num(req.params.id);
    res.json(await actividadDao.restituir(id, req.session.user.id));
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
    res.status(400).json({ error: traducirErrorBD(e) });
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
  return esAdministrador(req.session.user) || req.session.user.entidadId === id;
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
    const segmentos = await actividadDao.segmentosDe(id);
    const matriculaReferencial = await kpiDao.usaMatriculaReferencial(segmentos);
    res.json(reportService.construirResumen(entidad, acts, periodo, { matriculaReferencial }));
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
    const segmentos = await actividadDao.segmentosDe(id);
    const matriculaReferencial = await kpiDao.usaMatriculaReferencial(segmentos);
    const resumen = reportService.construirResumen(entidad, acts, periodo, { matriculaReferencial });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="reporte-mapfi-${id}.pdf"`);
    reportService.generarPDF(resumen, res);
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Bloques horarios (lectura publica · escritura ADMIN o centro de la carrera) ──
// Spec 003, US4: un APORTANTE puede mantener el horario de la carrera de su
// propia entidad (entidad.carrera_id), en cualquier generacion. ADMIN y
// SUPERADMIN pueden cualquiera. Sin carrera asociada (Vinculacion, Gearbox,
// Direccion de Docencia), ninguna escritura procede.
async function puedeEditarHorario(req, carreraId) {
  if (esAdministrador(req.session.user)) return true;
  if (!carreraId) return false;
  const propia = await entidadDao.carreraDeEntidad(req.session.user.entidadId);
  return propia !== null && propia === carreraId;
}

app.get("/api/bloques", async (req, res) => {
  try {
    res.json(await bloqueHorarioDao.listar({
      carreraId: num(req.query.carreraId),
      nivel: num(req.query.nivel),
    }));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});
app.post("/api/bloques", requireAuth, async (req, res) => {
  try {
    const carreraId = num((req.body || {}).carreraId);
    if (!(await puedeEditarHorario(req, carreraId))) return res.status(403).json({ error: "No autorizado" });
    res.status(201).json(await bloqueHorarioDao.crear(req.body || {}));
  } catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});
app.delete("/api/bloques/:id", requireAuth, async (req, res) => {
  try {
    const id = num(req.params.id);
    // La carrera se lee DE LA BASE, nunca del cliente: si no, un aportante
    // borraria bloques ajenos declarando su propia carrera en la peticion.
    const carreraId = await bloqueHorarioDao.carreraDelBloque(id);
    if (!(await puedeEditarHorario(req, carreraId))) return res.status(403).json({ error: "No autorizado" });
    res.json(await bloqueHorarioDao.eliminar(id));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});
// Vacia un segmento completo (carrera+nivel). Ambos parametros son
// obligatorios a proposito: sin ellos, la ruta vaciaria toda la tabla.
app.delete("/api/bloques", requireAuth, async (req, res) => {
  const carreraId = num(req.query.carreraId);
  const nivel = num(req.query.nivel);
  if (!carreraId || !nivel) return res.status(400).json({ error: "Se requieren carreraId y nivel" });
  try {
    if (!(await puedeEditarHorario(req, carreraId))) return res.status(403).json({ error: "No autorizado" });
    res.json(await bloqueHorarioDao.eliminarPorSegmento(carreraId, nivel));
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// Importacion masiva (Spec 003, US3). El archivo NUNCA llega aqui: el
// navegador ya lo interpreto (js/horario-csv.js) y solo envia JSON. Aun asi
// cada fila se revalida como entrada no confiable (H-04, autoridad del
// servidor) — el parser vive en el cliente, bajo control de quien lo llama.
const TIPOS_BLOQUE = ["CLASE", "PROTEGIDO", "LIBRE"];
const IMPORTAR_MAX_BLOQUES = 200;
const IMPORTAR_TEXTO_MAX = 200;
function truncarTexto(v) {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim().slice(0, IMPORTAR_TEXTO_MAX) || null;
}
app.post("/api/bloques/importar", requireAuth, async (req, res) => {
  try {
    const carreraId = num(req.body.carreraId);
    const nivel = num(req.body.nivel);
    const modo = req.body.modo;
    const bloques = Array.isArray(req.body.bloques) ? req.body.bloques : null;

    if (modo !== "reemplazar" && modo !== "agregar") {
      return res.status(400).json({ error: "Se requiere 'modo': 'reemplazar' o 'agregar'" });
    }
    if (!carreraId || !nivel) return res.status(400).json({ error: "Se requieren carreraId y nivel" });
    if (!bloques || !bloques.length) return res.status(400).json({ error: "No hay bloques para importar" });
    if (bloques.length > IMPORTAR_MAX_BLOQUES) {
      return res.status(400).json({ error: `Máximo ${IMPORTAR_MAX_BLOQUES} bloques por importación` });
    }
    if (!(await puedeEditarHorario(req, carreraId))) return res.status(403).json({ error: "No autorizado" });

    const limpios = [];
    for (let i = 0; i < bloques.length; i++) {
      const b = bloques[i] || {};
      const fila = b.fila || i + 2;
      const diaSemana = num(b.diaSemana);
      if (!diaSemana || diaSemana < 1 || diaSemana > 5) {
        return res.status(400).json({ error: `Fila ${fila}: día inválido` });
      }
      const horaInicio = horarioService.aMinutos(b.horaInicio);
      const horaFin = horarioService.aMinutos(b.horaFin);
      if (horaInicio === null || horaFin === null) {
        return res.status(400).json({ error: `Fila ${fila}: hora de inicio o término inválida` });
      }
      if (horaFin <= horaInicio) {
        return res.status(400).json({ error: `Fila ${fila}: la hora de término no puede ser anterior o igual a la de inicio` });
      }
      const tipo = (b.tipo ? String(b.tipo).toUpperCase() : "CLASE");
      if (!TIPOS_BLOQUE.includes(tipo)) {
        return res.status(400).json({ error: `Fila ${fila}: tipo inválido (usa CLASE, PROTEGIDO o LIBRE)` });
      }
      const descripcion = truncarTexto(b.descripcion);
      if (!descripcion) return res.status(400).json({ error: `Fila ${fila}: falta el ramo` });

      limpios.push({
        diaSemana, horaInicio: b.horaInicio, horaFin: b.horaFin, tipo, descripcion,
        codigo: truncarTexto(b.codigo), seccion: truncarTexto(b.seccion),
        sala: truncarTexto(b.sala), docente: truncarTexto(b.docente),
      });
    }

    res.json(await bloqueHorarioDao.importar(carreraId, nivel, modo, limpios));
  } catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});

// Plantilla descargable del formato de horarios (FR-016) — publica.
app.get("/api/plantilla-horario.csv", (req, res) => {
  const csv =
    "dia;inicio;fin;ramo;tipo;codigo;seccion;sala;docente\n" +
    "LUN;08:00;09:30;Cálculo I;CLASE;525101;1;Aula 201;\n" +
    "LUN;09:45;10:30;Física I;CLASE;;;Lab. Física;\n" +
    "MIE;11:50;13:20;Bloque protegido FI;PROTEGIDO;;;;\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="plantilla-horario.csv"');
  res.send("﻿" + csv); // BOM para que Excel respete UTF-8
});

// ── Periodos academicos ─────────────────────────────────────────────────────
app.get("/api/periodos", requireAuth, async (req, res) => {
  try { res.json(await periodoDao.listar()); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});
app.post("/api/admin/periodos", requireRole("ADMIN"), async (req, res) => {
  try { res.status(201).json(await periodoDao.crear(req.body || {})); }
  catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});
app.post("/api/admin/periodos/:id/activar", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await periodoDao.activar(num(req.params.id))); }
  catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Admin · catalogos (carreras / entidades) ────────────────────────────────
app.post("/api/admin/carreras", requireRole("ADMIN"), async (req, res) => {
  try { res.status(201).json(await carreraDao.crear(req.body || {})); }
  catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});
app.put("/api/admin/carreras/:id", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await carreraDao.actualizar(num(req.params.id), req.body || {})); }
  catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});
app.post("/api/admin/entidades", requireRole("ADMIN"), async (req, res) => {
  try { res.status(201).json(await entidadDao.crear(req.body || {})); }
  catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});
app.put("/api/admin/entidades/:id", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await entidadDao.actualizar(num(req.params.id), req.body || {})); }
  catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
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
    const errorPass = errorPassword(password);
    if (errorPass) return res.status(400).json({ error: errorPass });
    const hash = await bcrypt.hash(password, 10);
    const u = await userDao.crear({ email, passwordHash: hash, nombre, rol: rol || "APORTANTE", entidadId });
    res.status(201).json(u);
  } catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});

// Activar / desactivar / editar una cuenta (controla la apertura de cuentas).
app.patch("/api/admin/usuarios/:id", requireRole("ADMIN"), async (req, res) => {
  try { res.json(await userDao.actualizar(num(req.params.id), req.body || {})); }
  catch (e) { res.status(400).json({ error: traducirErrorBD(e) }); }
});

// ── Cambio de contrasena propia ─────────────────────────────────────────────
app.post("/api/auth/password", requireAuth, async (req, res) => {
  try {
    const { actual, nueva } = req.body || {};
    const errorPass = errorPassword(nueva);
    if (errorPass) return res.status(400).json({ error: errorPass });
    const u = await userDao.buscarPorEmail(req.session.user.email);
    if (!u || !(await bcrypt.compare(actual || "", u.password_hash))) {
      return res.status(401).json({ error: "Contrasena actual incorrecta" });
    }
    await userDao.cambiarPassword(u.id, await bcrypt.hash(nueva, 10));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error interno" }); }
});

// ── Frontend estatico ────────────────────────────────────────────────────────
// `express.static(__dirname)` publica TODO el arbol del proyecto. `dotfiles:
// "deny"` tapa .env y .git, pero no server.js, los DAO, las migraciones ni
// package.json: todos quedaban descargables desde el navegador (revision de
// seguridad 2026-08-04, hallazgo SEG-2).
//
// Se bloquean explicitamente las rutas que son solo de backend. Se comprobo
// que ninguna pagina carga js/dao, js/services ni js/db antes de cerrarlas.
//
// Arreglo de fondo pendiente: mover el frontend a un `public/` propio y servir
// solo esa carpeta, en vez de mantener esta lista.
const RUTAS_SOLO_BACKEND = [
  /^\/js\/(dao|services|db)\//i,          // capa de datos y logica de servidor
  /^\/db\//i,                              // migraciones = esquema completo
  /^\/(server|jest\.setup)\.js$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/(Dockerfile|docker-compose[\w.-]*\.ya?ml|run\.sh)$/i,
  /^\/(specs|__tests__|docs|coverage)\//i,
];
app.use((req, res, next) => {
  if (RUTAS_SOLO_BACKEND.some((re) => re.test(req.path))) {
    return res.status(404).json({ error: "No encontrado" });
  }
  next();
});

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
