"use strict";
const request = require("supertest");
const app = require("../../server");

describe("API basica", () => {
  test("GET /api/health → 200 { ok: true }", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("GET /api/auth/me sin sesion → user null", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  test("POST /api/auth/login sin credenciales → 400", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  test("POST /api/match/evaluar sin sesion → 401", async () => {
    const res = await request(app).post("/api/match/evaluar").send({ inicio: "x", publico: [] });
    expect(res.status).toBe(401);
  });

  // T058 (H-06): requireRole ahora revalida la sesion antes de comparar el
  // rol; sin sesion en absoluto, la respuesta correcta es 401 (no
  // autenticado), no 403 (autenticado pero sin permiso) — igual que ya
  // hacia /api/match/evaluar arriba. El caso "autenticado pero rol
  // incorrecto → 403" esta cubierto en routes/api.test.js.
  test("GET /api/admin/usuarios sin sesión → 401", async () => {
    const res = await request(app).get("/api/admin/usuarios");
    expect(res.status).toBe(401);
  });

  test("POST /api/bloques sin sesión → 401", async () => {
    const res = await request(app).post("/api/bloques").send({});
    expect(res.status).toBe(401);
  });
});
