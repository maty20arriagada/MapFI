"use strict";
/**
 * Spec 002 (auditoría de robustez) · T019 · H-02.
 *
 * Verifica, inspeccionando el SQL/params que actividadDao envía a `query()`,
 * que existe UNA sola forma de construir el filtro de visibilidad:
 *   - alcance "publico" (default): solo ESTADOS_VIGENTES.
 *   - alcance "propias" (el autor viendo su calendario): sin filtro de
 *     estado, ve todo lo suyo (incluidas ocultas/archivadas).
 * y que `conflictos()` usa el mismo conjunto vigente (no solo CONFIRMADA) y
 * exige un rango de fechas para acotar la consulta (H-14).
 */
let lastCall = null;
jest.mock("../../js/db", () => ({
  query: jest.fn((sql, params) => {
    lastCall = { sql, params };
    return Promise.resolve({ rows: [] });
  }),
  pool: { connect: jest.fn(), query: jest.fn() },
}));

const dao = require("../../js/dao/actividadDao");

beforeEach(() => {
  lastCall = null;
  jest.clearAllMocks();
});

describe("actividadDao.listar — visibilidad unificada (H-02, FR-003)", () => {
  test("alcance publico (default): filtra por el conjunto ESTADOS_VIGENTES", async () => {
    await dao.listar({});
    expect(lastCall.sql).toMatch(/a\.estado = ANY\(\$\d+::text\[\]\)/);
    const vigentesArg = lastCall.params.find((p) => Array.isArray(p));
    expect(vigentesArg).toEqual(["PROPUESTA", "CONFIRMADA", "REALIZADA"]);
  });

  test("alcance propias + entidadId: NO aplica el filtro de vigentes (ve todo lo suyo)", async () => {
    await dao.listar({ entidadId: 17, alcance: "propias" });
    expect(lastCall.sql).not.toMatch(/estado = ANY/);
    expect(lastCall.sql).toMatch(/a\.entidad_id = \$1/);
  });

  test("alcance propias sin entidadId: se rechaza (no existe 'propias' sin dueño)", async () => {
    await expect(dao.listar({ alcance: "propias" })).rejects.toThrow();
  });

  test("alcance publico con entidadId: filtra por esa entidad Y por vigentes a la vez", async () => {
    await dao.listar({ entidadId: 17 });
    expect(lastCall.sql).toMatch(/a\.entidad_id = \$1/);
    expect(lastCall.sql).toMatch(/estado = ANY/);
  });
});

describe("actividadDao.conflictos — conjunto vigente + rango acotado (H-02, H-14)", () => {
  test("usa el conjunto vigente completo (no solo CONFIRMADA) y acota por rango de fechas", async () => {
    await dao.conflictos("2026-04-01", "2026-04-30");
    expect(lastCall.sql).toMatch(/estado = ANY/);
    expect(lastCall.sql).not.toMatch(/estado = 'CONFIRMADA'/);
    expect(lastCall.sql).toMatch(/periodo && tstzrange/);
    expect(lastCall.params).toContain("2026-04-01");
    expect(lastCall.params).toContain("2026-04-30");
  });
});
