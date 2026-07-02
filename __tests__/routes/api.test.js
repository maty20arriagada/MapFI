"use strict";

const request = require("supertest");

jest.mock("../../js/db", () => {
  const mockPool = {
    query: jest.fn().mockImplementation(async (sql, params) => {
      if (sql.includes("SELECT id, email, password_hash") && sql.includes("lower(email)")) {
        if ((params && params[0]) === "admin@mapfi.cl") {
          const bcrypt = require("bcryptjs");
          const hash = await bcrypt.hash("test1234", 10);
          return { rows: [{ id: 1, email: "admin@mapfi.cl", password_hash: hash, nombre: "Admin", rol: "ADMIN", entidad_id: null, activo: true }] };
        }
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO schema_migrations")) return { rows: [] };
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
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    on: jest.fn(),
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
