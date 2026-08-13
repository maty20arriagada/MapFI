"use strict";

const request = require("supertest");

jest.mock("../../js/db", () => {
  // Fixtures T020 (H-02): una actividad vigente y una archivada, ambas de la
  // entidad 6 — para probar que la visibilidad depende del alcance de
  // sesión. Deben vivir DENTRO del factory: jest.mock() no permite referenciar
  // variables externas salvo que empiecen con "mock".
  const ACTIVIDAD_VIGENTE = {
    id: 501, titulo: "Evento visible", entidad_id: 6, entidad_nombre: "CEE Industrial",
    fecha_inicio: "2026-04-01T10:00:00Z", fecha_fin: "2026-04-01T12:00:00Z",
    tipo: "EVENTO", ramo: null, estado: "PROPUESTA", ubicacion: null,
    alcance_estimado: null, compatibilidad_pct: null,
  };
  const ACTIVIDAD_ARCHIVADA = {
    ...ACTIVIDAD_VIGENTE, id: 502, titulo: "Evento retirado", estado: "ARCHIVADA",
  };

  // T057 (H-06): flag mutable para simular que el admin desactiva la cuenta
  // del aportante DESPUES de que ya inicio sesion.
  let aportanteActivo = true;

  const mockPool = {
    query: jest.fn().mockImplementation(async (sql, params) => {
      // userDao.obtener(id) — usado por la revalidacion de sesion (T058).
      if (sql.includes("FROM usuario WHERE id")) {
        if (params && params[0] === 1) {
          return { rows: [{ id: 1, email: "admin@mapfi.cl", nombre: "Admin", rol: "ADMIN", entidad_id: null, activo: true }] };
        }
        if (params && params[0] === 2) {
          return { rows: [{ id: 2, email: "aportante@mapfi.cl", nombre: "CEE Industrial", rol: "APORTANTE", entidad_id: 6, activo: aportanteActivo }] };
        }
        return { rows: [] };
      }
      if (sql.includes("SELECT id, email, password_hash") && sql.includes("lower(email)")) {
        if ((params && params[0]) === "admin@mapfi.cl") {
          const bcrypt = require("bcryptjs");
          const hash = await bcrypt.hash("test1234", 10);
          return { rows: [{ id: 1, email: "admin@mapfi.cl", password_hash: hash, nombre: "Admin", rol: "ADMIN", entidad_id: null, activo: true }] };
        }
        if ((params && params[0]) === "aportante@mapfi.cl") {
          const bcrypt = require("bcryptjs");
          const hash = await bcrypt.hash("test1234", 10);
          return { rows: [{ id: 2, email: "aportante@mapfi.cl", password_hash: hash, nombre: "CEE Industrial", rol: "APORTANTE", entidad_id: 6, activo: true }] };
        }
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO schema_migrations")) return { rows: [] };
      // T045 (H-04): actividad 501, de la entidad 6, con fecha en el futuro
      // lejano — para probar que nadie puede marcarla REALIZADA antes de
      // tiempo (T049).
      if (/^SELECT \* FROM actividad WHERE id/.test(sql)) {
        if (params && params[0] === 501) {
          return { rows: [{ id: 501, entidad_id: 6, titulo: "Evento futuro", fecha_inicio: "2099-01-01T10:00:00Z", fecha_fin: "2099-01-01T12:00:00Z", estado: "CONFIRMADA" }] };
        }
        return { rows: [] };
      }
      // Aviso publico de cancelaciones: debe ir ANTES del comodin de abajo,
      // que si no se lo tragaria (tambien es "FROM actividad a JOIN entidad").
      if (sql.includes("eliminada_por")) {
        return { rows: [{
          id: 502, titulo: "Evento retirado", tipo: "EVENTO",
          fecha_inicio: "2026-04-01T10:00:00Z", fecha_fin: "2026-04-01T12:00:00Z",
          entidad_sigla: "CEEIND", entidad_nombre: "CEE Industrial",
          retirada_en: "2026-04-02T09:00:00Z", motivo_retiro: "se reprograma",
          eliminada_por: "CEE Industrial",
        }] };
      }
      // Captura del archivado para comprobar que el motivo llega al DAO.
      if (/^UPDATE actividad\s+SET estado = 'ARCHIVADA'/.test(sql)) {
        mockPool.__ultimoArchivar = params;
        return { rows: [{ id: params[0], estado: "ARCHIVADA" }] };
      }
      if (sql.includes("FROM actividad a") && sql.includes("JOIN entidad e")) {
        mockPool.__ultimoListarSql = sql;
        // Simula el filtro real: "propias" (sin `estado = ANY`) ve ambas;
        // "publico" (con `estado = ANY`) solo ve la vigente.
        const soloVigentes = /estado = ANY/.test(sql);
        return { rows: soloVigentes ? [ACTIVIDAD_VIGENTE] : [ACTIVIDAD_VIGENTE, ACTIVIDAD_ARCHIVADA] };
      }
      if (sql.includes("FROM actividad")) return { rows: [] };
      if (sql.includes("FROM carrera")) {
        return { rows: [{ id: 6, codigo: "ICI", nombre: "Industrial", color: "#2563EB", activa: true }] };
      }
      if (sql.includes("FROM generacion")) {
        return { rows: [{ nivel: 1, etiqueta: "Primer año" }, { nivel: 2, etiqueta: "Segundo año" }] };
      }
      if (sql.includes("FROM entidad")) {
        return { rows: [{ id: 6, tipo: "CENTRO_ALUMNOS", sigla: "CEEIND", nombre: "CEE Industrial", carrera_id: 6, activa: true }] };
      }
      if (sql.includes("FROM periodo_academico") && sql.includes("activo")) {
        return { rows: [{ id: 1, anio: 2026, semestre: 1, fecha_inicio: "2026-03-01", fecha_fin: "2026-07-31", activo: true }] };
      }
      if (sql.includes("FROM feriado")) return { rows: [] };
      if (sql.includes("schema_migrations") && sql.includes("SELECT version")) {
        return { rows: [{ version: "001" }, { version: "002" }, { version: "003" }, { version: "004" }, { version: "005" }, { version: "006" }] };
      }
      return { rows: [] };
    }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockImplementation(async (sql, params) => {
        // T045(a): expone los params del ultimo INSERT para verificar que
        // entidad_id ($3) siempre es el de la SESION, nunca el del body.
        if (/^INSERT INTO actividad\b/.test(sql)) { mockPool.__lastInsertParams = params; return { rows: [{ id: 999 }] }; }
        return { rows: [] };
      }),
      release: jest.fn(),
    }),
    on: jest.fn(),
    __setAportanteActivo: (v) => { aportanteActivo = v; }, // T057
  };
  return { pool: mockPool, query: mockPool.query };
});

let app;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-secret";
  app = require("../../server");
});

describe("API /api/health", () => {
  test("GET /api/health responde ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("API /api/auth", () => {
  test("login con credenciales correctas devuelve 200", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@mapfi.cl", password: "test1234" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.rol).toBe("ADMIN");
  });

  test("login con contraseña incorrecta devuelve 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@mapfi.cl", password: "wrong" });
    expect(res.status).toBe(401);
  });

  test("login sin credenciales devuelve 400", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  test("GET /api/auth/me sin sesión devuelve null", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe("API endpoints públicos", () => {
  test("GET /api/catalogos devuelve estructura esperada", async () => {
    const res = await request(app).get("/api/catalogos");
    expect(res.status).toBe(200);
    expect(res.body.carreras).toBeDefined();
    expect(res.body.generaciones).toBeDefined();
    expect(res.body.entidades).toBeDefined();
  });

  test("GET /api/actividades devuelve array", async () => {
    const res = await request(app).get("/api/actividades");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("POST /api/actividades sin auth devuelve 401", async () => {
    const res = await request(app).post("/api/actividades").send({
      titulo: "Test", tipo: "EVENTO",
      fechaInicio: "2026-04-15T10:00:00Z", fechaFin: "2026-04-15T12:00:00Z",
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/actividades?entidadId=X sin sesión NO incluye actividades archivadas (H-02)", async () => {
    const res = await request(app).get("/api/actividades?entidadId=6");
    expect(res.status).toBe(200);
    expect(res.body.some((a) => a.estado === "ARCHIVADA")).toBe(false);
    expect(res.body.some((a) => a.id === 501)).toBe(true);
  });

  test("GET /api/actividades?entidadId=X con sesión ADMIN SI incluye las archivadas de esa entidad (FR-004b)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@mapfi.cl", password: "test1234" });
    const res = await agent.get("/api/actividades?entidadId=6");
    expect(res.status).toBe(200);
    expect(res.body.some((a) => a.estado === "ARCHIVADA")).toBe(true);
  });

  test("POST /api/actividades ignora compatibilidad/alcance del cliente y usa los del servidor (H-03, H-04, T035)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@mapfi.cl", password: "test1234" });
    const res = await agent.post("/api/actividades").send({
      titulo: "Charla de prueba",
      tipo: "CHARLA",
      fechaInicio: "2026-04-20T10:00:00", // lunes
      fechaFin: "2026-04-20T12:00:00",
      entidadId: 6,
      publico: [{ carreraId: 6, nivel: 1 }],
      compatibilidadPct: 999,
      alcanceEstimado: 999,
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.compatibilidadPct).toBe("number");
    expect(res.body.compatibilidadPct).not.toBe(999);
    expect(res.body.alcanceEstimado).not.toBe(999);
  });

  describe("Autoridad del servidor con sesión de APORTANTE (T045, H-04)", () => {
    test("(a) no puede crear a nombre de otra entidad — el servidor fuerza la propia", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/actividades").send({
        titulo: "Intento ajeno", tipo: "EVENTO",
        fechaInicio: "2026-04-20T10:00:00", fechaFin: "2026-04-20T12:00:00",
        entidadId: 999, // intenta imponer OTRA entidad
        publico: [{ carreraId: 6, nivel: 1 }],
      });
      expect(res.status).toBe(201);
      const db = require("../../js/db");
      expect(db.pool.__lastInsertParams[2]).toBe(6); // entidad_id ($3) = la de la sesion, no 999
    });

    test("(b) no puede restituir una actividad retirada — solo ADMIN", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/admin/actividades/501/restituir");
      expect(res.status).toBe(403);
    });

    test("(c) no puede marcar una actividad como realizada (solo ADMIN ratifica/completa)", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.patch("/api/actividades/501/estado").send({ estado: "REALIZADA" });
      expect(res.status).toBe(403);
    });

    test("(d) no puede imponer compatibilidad ni alcance al crear", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/actividades").send({
        titulo: "Otro intento", tipo: "EVENTO",
        fechaInicio: "2026-04-20T10:00:00", fechaFin: "2026-04-20T12:00:00",
        publico: [{ carreraId: 6, nivel: 1 }],
        compatibilidadPct: 999, alcanceEstimado: 999,
      });
      expect(res.status).toBe(201);
      expect(res.body.compatibilidadPct).not.toBe(999);
      expect(res.body.alcanceEstimado).not.toBe(999);
    });
  });

  test("T063 (H-08) — rechaza crear una actividad con fecha de término anterior a la de inicio", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@mapfi.cl", password: "test1234" });
    const res = await agent.post("/api/actividades").send({
      titulo: "Fechas invertidas", tipo: "EVENTO", entidadId: 6,
      fechaInicio: "2026-04-20T12:00:00", fechaFin: "2026-04-20T10:00:00", // fin antes que inicio
      publico: [{ carreraId: 6, nivel: 1 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/término/i);
  });

  describe("Rol SUPERADMIN y borrado definitivo", () => {
    test("un ADMIN normal no puede usar las rutas de borrado definitivo", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "admin@mapfi.cl", password: "test1234" });
      const res = await agent.get("/api/superadmin/borrados");
      expect(res.status).toBe(403);
    });

    test("un aportante tampoco", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      expect((await agent.get("/api/superadmin/borrados")).status).toBe(403);
      expect((await agent.delete("/api/superadmin/actividades/501")).status).toBe(403);
    });

    test("sin sesión responde 401, no 403", async () => {
      expect((await request(app).get("/api/superadmin/borrados")).status).toBe(401);
    });

    test("el registro de borrados nunca se expone en una ruta pública", async () => {
      // El borrado definitivo no se anuncia, pero tampoco debe filtrarse por
      // el aviso público de cancelaciones, que sí es abierto.
      const res = await request(app).get("/api/actividades/eliminadas");
      expect(res.status).toBe(200);
      const campos = res.body.length ? Object.keys(res.body[0]) : [];
      expect(campos).not.toContain("borrado_por");
      expect(campos).not.toContain("estado_previo");
    });
  });

  describe("Feed iCalendar", () => {
    test("es público: lo descargan los servidores de Google/Outlook, sin sesión", async () => {
      const res = await request(app).get("/api/calendario.ics?carreraId=6&nivel=1");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/calendar/);
      expect(res.text.startsWith("BEGIN:VCALENDAR")).toBe(true);
      expect(res.text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    });

    test("nunca expone actividades ocultas: usa el alcance público", async () => {
      const db = require("../../js/db");
      await request(app).get("/api/calendario.ics?entidadId=6");
      // El alcance "propias" (que ve lo oculto) exige entidadId y se activa
      // solo con sesión; aquí no hay, así que debe filtrar por estado.
      expect(db.pool.__ultimoListarSql).toMatch(/estado = ANY|ARCHIVADA/);
    });

    test("respeta el filtro 'para participar'", async () => {
      const db = require("../../js/db");
      await request(app).get("/api/calendario.ics?carreraId=6&nivel=1&soloParticipacion=1");
      expect(db.pool.__ultimoListarSql).toMatch(/e\.tipo = ANY/);
    });

    test("rechaza una petición con demasiadas actividades", async () => {
      const muchos = Array.from({ length: 101 }, (_, i) => i + 1).join(",");
      const res = await request(app).get("/api/calendario.ics?ids=" + muchos);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/más de 100/i);
    });

    test("con ids acota a esas actividades y no arrastra cancelaciones ajenas", async () => {
      const db = require("../../js/db");
      await request(app).get("/api/calendario.ics?ids=501");
      expect(db.pool.__ultimoListarSql).toMatch(/a\.id = ANY/);
      expect(db.pool.__ultimoListarSql).not.toMatch(/ARCHIVADA/);
    });

    test("el UID no depende de la cabecera Host (auditoría 2026-08-04)", async () => {
      // El UID es lo que hace que editar una actividad ACTUALICE el evento en
      // vez de duplicarlo. Si saliera de req.headers.host, la misma actividad
      // tendría UID distinto según se entrara por IP, localhost o el dominio
      // real — y al pasar a producción los calendarios ya suscritos
      // duplicarían todos los eventos.
      const uid = (t) => (t.split("\r\n").find((l) => l.startsWith("UID:")) || "");
      const a = await request(app).get("/api/calendario.ics?carreraId=6&nivel=1");
      const b = await request(app).get("/api/calendario.ics?carreraId=6&nivel=1").set("Host", "otro.dominio.cl");
      expect(uid(a.text)).toBeTruthy();
      expect(uid(a.text)).toBe(uid(b.text));
    });

    test("se puede cachear: Google reconsulta el feed muy seguido", async () => {
      const res = await request(app).get("/api/calendario.ics");
      expect(res.headers["cache-control"]).toMatch(/max-age=\d+/);
    });
  });

  describe("Enlace de inscripción", () => {
    test("rechaza un enlace que no sea http o https", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/actividades").send({
        titulo: "Con enlace malo", tipo: "CHARLA",
        fechaInicio: "2026-05-20T10:00", fechaFin: "2026-05-20T12:00",
        publico: [{ carreraId: 6, nivel: 1 }],
        urlInscripcion: "javascript:alert(1)",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/http/i);
    });

    test("acepta y guarda un enlace https", async () => {
      const db = require("../../js/db");
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/actividades").send({
        titulo: "Con enlace bueno", tipo: "CHARLA",
        fechaInicio: "2026-05-20T10:00", fechaFin: "2026-05-20T12:00",
        publico: [{ carreraId: 6, nivel: 1 }],
        urlInscripcion: "https://forms.gle/abc",
      });
      expect(res.status).toBe(201);
      expect(db.pool.__lastInsertParams[13]).toBe("https://forms.gle/abc");
    });
  });

  describe("Filtro público 'para participar'", () => {
    test("sin sesión se puede aplicar: es para estudiantes sin cuenta", async () => {
      const db = require("../../js/db");
      const res = await request(app).get("/api/actividades?soloParticipacion=1");
      expect(res.status).toBe(200);
      expect(db.pool.__ultimoListarSql).toMatch(/e\.tipo = ANY/);
    });

    test("no se aplica si no se pide", async () => {
      const db = require("../../js/db");
      await request(app).get("/api/actividades");
      expect(db.pool.__ultimoListarSql).not.toMatch(/e\.tipo = ANY/);
    });

    test("un valor cualquiera no lo activa por accidente", async () => {
      const db = require("../../js/db");
      await request(app).get("/api/actividades?soloParticipacion=0");
      expect(db.pool.__ultimoListarSql).not.toMatch(/e\.tipo = ANY/);
    });
  });

  describe("Eliminar con constancia pública", () => {
    test("el aviso de cancelaciones es PÚBLICO: sin sesión también se ve", async () => {
      // Quien más necesita enterarse de que un evento se canceló es el
      // estudiante que lo vio en el calendario, y ese no tiene cuenta.
      const res = await request(app).get("/api/actividades/eliminadas");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].titulo).toBe("Evento retirado");
      expect(res.body[0].eliminada_por).toBe("CEE Industrial");
    });

    test("el aviso no expone el nombre de la persona que eliminó", async () => {
      const res = await request(app).get("/api/actividades/eliminadas");
      const campos = Object.keys(res.body[0]);
      expect(campos).toContain("eliminada_por");
      expect(campos).not.toContain("retirada_por"); // id del usuario
      expect(campos).not.toContain("usuario_nombre");
    });

    test("el dueño elimina lo suyo y el motivo llega al registro", async () => {
      const db = require("../../js/db");
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.delete("/api/actividades/501").send({ motivo: "se reprograma para el 20 de mayo" });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe("ARCHIVADA");
      // params: [id, usuarioId, motivo]
      expect(db.pool.__ultimoArchivar[2]).toBe("se reprograma para el 20 de mayo");
    });

    test("sin motivo se guarda null, no una cadena vacía", async () => {
      const db = require("../../js/db");
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      await agent.delete("/api/actividades/501").send({ motivo: "   " });
      expect(db.pool.__ultimoArchivar[2]).toBeNull();
    });

    test("un centro no puede eliminar la actividad de otro", async () => {
      // La 501 es de la entidad 6; se prueba con una que no existe para ese
      // aportante (el mock devuelve vacío ⇒ no es suya).
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.delete("/api/actividades/999").send({});
      expect(res.status).toBe(403);
    });
  });

  describe("Regresiones de la revisión de seguridad (2026-08-04)", () => {
    test("SEG-2 — el código de backend no se sirve como estático", async () => {
      // express.static(__dirname) publicaba todo el árbol del proyecto.
      for (const ruta of [
        "/server.js",
        "/package.json",
        "/js/dao/actividadDao.js",
        "/js/services/matchService.js",
        "/js/db/migrate.js",
        "/db/migrations/001_schema_inicial.sql",
        "/jest.setup.js",
      ]) {
        const res = await request(app).get(ruta);
        expect([404, 403]).toContain(res.status);
      }
    });

    test("SEG-2 — el frontend sí se sigue sirviendo", async () => {
      for (const ruta of ["/js/api-client.js", "/js/sanitize.js", "/js/views/event-table.js", "/css/design-system.css"]) {
        const res = await request(app).get(ruta);
        expect(res.status).toBe(200);
      }
    });

    test("SEG-5 — no se puede crear una cuenta con contraseña débil", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "admin@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/admin/usuarios").send({
        email: "nuevo@mapfi.cl", password: "123", nombre: "Nuevo", rol: "APORTANTE",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/al menos 8 caracteres/i);
    });

    test("SEG-5 — el cambio de contraseña propia aplica la misma política", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "admin@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/auth/password").send({ actual: "test1234", nueva: "corta" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/al menos 8 caracteres/i);
    });
  });

  describe("Regresiones de la revisión QA (2026-08-04)", () => {
    test("C-2 — un aportante puede editar su actividad reenviando el estado ACTUAL sin cambiarlo", async () => {
      // Antes del fix esto devolvía 403 ("No puedes cambiar la actividad a
      // ese estado") porque el formulario siempre manda `estado`, y CONFIRMADA
      // no está entre los permitidos a un aportante — aunque no lo cambie.
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.put("/api/actividades/501").send({
        fechaInicio: "2026-05-13T10:00",
        fechaFin: "2026-05-13T12:00",
        estado: "CONFIRMADA", // el MISMO que ya tiene la 501
      });
      expect(res.status).toBe(200);
    });

    test("C-2 — pero cambiarlo de verdad a un estado no permitido sigue dando 403", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.put("/api/actividades/501").send({ estado: "REALIZADA" });
      expect(res.status).toBe(403);
    });

    test("C-1 — la fecha naive del formulario llega al DAO como instante (Date), no como texto", async () => {
      // Si viaja como texto, quien decide qué significan las 21:00 es la zona
      // de sesión de Postgres (que estaba en UTC) y se guardaba 17:00.
      const db = require("../../js/db");
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/actividades").send({
        titulo: "Naive", tipo: "EVENTO",
        fechaInicio: "2026-04-17T21:00", fechaFin: "2026-04-17T23:00",
        publico: [{ carreraId: 6, nivel: 1 }],
      });
      expect(res.status).toBe(201);
      expect(db.pool.__lastInsertParams[4]).toBeInstanceOf(Date); // fecha_inicio
      expect(db.pool.__lastInsertParams[5]).toBeInstanceOf(Date); // fecha_fin
    });

    test("C-1 — una fecha ilegible se rechaza con un mensaje claro", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });
      const res = await agent.post("/api/actividades").send({
        titulo: "Mala", tipo: "EVENTO", fechaInicio: "no-es-una-fecha", fechaFin: "2026-04-17T23:00",
        publico: [{ carreraId: 6, nivel: 1 }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/formato válido/i);
    });

    test("S-3 — el rango de /conflictos está acotado", async () => {
      const res = await request(app).get("/api/actividades/conflictos?desde=1000-01-01&hasta=9999-12-31");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/rango/i);
    });

    test("A-2 — /api/health informa versión y última migración aplicada", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.version).toBeTruthy();
    });
  });

  test("T057 (H-06) — cuenta desactivada tras el login: la siguiente petición autenticada responde 401", async () => {
    const db = require("../../js/db");
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "aportante@mapfi.cl", password: "test1234" });

    // Mientras la cuenta sigue activa, la sesion funciona normalmente.
    const antes = await agent.post("/api/actividades").send({
      titulo: "Antes de desactivar", tipo: "EVENTO",
      fechaInicio: "2026-04-20T10:00:00", fechaFin: "2026-04-20T12:00:00",
    });
    expect(antes.status).toBe(201);

    db.pool.__setAportanteActivo(false); // el admin la desactiva en otra pestaña
    try {
      const despues = await agent.post("/api/actividades").send({
        titulo: "Despues de desactivar", tipo: "EVENTO",
        fechaInicio: "2026-04-20T10:00:00", fechaFin: "2026-04-20T12:00:00",
      });
      expect(despues.status).toBe(401);

      // La sesion quedo destruida: ni siquiera queda un usuario en /me.
      const me = await agent.get("/api/auth/me");
      expect(me.body.user).toBeNull();
    } finally {
      db.pool.__setAportanteActivo(true); // no afectar otros tests
    }
  });

  test("T049 — ni un ADMIN puede marcar como realizada una actividad cuya fecha aún no ocurre", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin@mapfi.cl", password: "test1234" });
    const res = await agent.patch("/api/actividades/501/estado").send({ estado: "REALIZADA" });
    expect(res.status).toBe(400);
  });

  test("GET /api/feriados devuelve array", async () => {
    const res = await request(app).get("/api/feriados");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /api/ranking devuelve array", async () => {
    const res = await request(app).get("/api/ranking");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
