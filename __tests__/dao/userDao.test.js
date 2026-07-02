"use strict";

jest.mock("../../js/db", () => ({
  query: jest.fn().mockImplementation(async (sql, params) => {
    const email = (params && params[0]) ? String(params[0]).trim().toLowerCase() : "";
    if (sql.includes("SELECT id, email, password_hash") && sql.includes("lower(email)")) {
      if (email === "admin@mapfi.cl") {
        return { rows: [{ id: 1, email: "admin@mapfi.cl", password_hash: "hashed", nombre: "Admin", rol: "ADMIN", entidad_id: null, activo: true }] };
      }
      if (email === "inactivo@mapfi.cl") {
        return { rows: [{ id: 3, email: "inactivo@mapfi.cl", password_hash: "hashed", nombre: "Inactivo", rol: "APORTANTE", entidad_id: 6, activo: false }] };
      }
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO usuario")) {
      return { rows: [{ id: 99, email: params[0], nombre: params[2], rol: params[3], entidad_id: params[4], activo: true }] };
    }
    if (sql.includes("LEFT JOIN entidad")) {
      return { rows: [{ id: 1, email: "admin@mapfi.cl", nombre: "Admin", rol: "ADMIN", entidad_id: null, activo: true }] };
    }
    return { rows: [] };
  }),
  pool: { on: jest.fn() },
}));

const dao = require("../../js/dao/userDao");

describe("userDao", () => {
  test("buscarPorEmail encuentra usuario activo", async () => {
    const u = await dao.buscarPorEmail("admin@mapfi.cl");
    expect(u).not.toBeNull();
    expect(u.email).toBe("admin@mapfi.cl");
    expect(u.activo).toBe(true);
  });

  test("buscarPorEmail devuelve null si no existe", async () => {
    const u = await dao.buscarPorEmail("noexiste@test.cl");
    expect(u).toBeNull();
  });

  test("buscarPorEmail es case-insensitive (simula lower() en SQL)", async () => {
    const u = await dao.buscarPorEmail("ADMIN@MAPFI.CL");
    expect(u).not.toBeNull();
  });

  test("crear devuelve usuario con id", async () => {
    const u = await dao.crear({
      email: "nuevo@test.cl", passwordHash: "hash", nombre: "Nuevo",
      rol: "APORTANTE", entidadId: 6,
    });
    expect(u.id).toBe(99);
  });

  test("buscarPorEmail devuelve usuario aunque esté inactivo", async () => {
    const u = await dao.buscarPorEmail("inactivo@mapfi.cl");
    expect(u).not.toBeNull();
    expect(u.activo).toBe(false);
  });
});
