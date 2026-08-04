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

describe("actividadDao.listarEliminadasRecientes — aviso público de cancelaciones", () => {
  test("acota a los últimos 30 días y respeta el margen de corrección de 1 hora", async () => {
    await dao.listarEliminadasRecientes();
    expect(lastCall.sql).toMatch(/estado = 'ARCHIVADA'/);
    // Ventana de 30 días sobre la fecha de eliminación.
    expect(lastCall.sql).toMatch(/retirada_en >= now\(\) - \(\$1 \|\| ' days'\)::interval/);
    expect(lastCall.params[0]).toBe("30");
    // Margen: lo eliminado dentro de la hora siguiente a su creación es una
    // corrección de un error de tipeo, no una cancelación — no se publica.
    expect(lastCall.sql).toMatch(/retirada_en >= a\.created_at \+ \(\$2 \|\| ' hours'\)::interval/);
    expect(lastCall.params[1]).toBe("1");
  });

  test("expone el CENTRO responsable, nunca el nombre de la persona", async () => {
    await dao.listarEliminadasRecientes();
    // Se selecciona el nombre de la ENTIDAD de quien eliminó (alias `elim`),
    // con "Administración" como respaldo. `u.nombre` (la persona) no se
    // devuelve en ningún caso.
    expect(lastCall.sql).toMatch(/COALESCE\(elim\.nombre, 'Administración'\) AS eliminada_por/);
    expect(lastCall.sql).not.toMatch(/u\.nombre/);
  });

  test("la ventana es configurable", async () => {
    await dao.listarEliminadasRecientes(7);
    expect(lastCall.params[0]).toBe("7");
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
