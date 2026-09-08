"use strict";
/**
 * El CLI que repara una importacion CSV equivocada. Lo que mas importa aqui
 * no es que borre, sino que NO borre por accidente: sin --confirmar es una
 * simulacion, y sin rango de fechas no arranca.
 */
jest.mock("../../js/db", () => ({
  query: jest.fn(() => Promise.resolve({ rows: [] })),
  pool: { connect: jest.fn(), query: jest.fn(), end: jest.fn() },
}));

const { parsearArgs, consultaCandidatas } = require("../../js/db/borrar-actividades");

describe("parsearArgs — puertas de seguridad", () => {
  test("sin --confirmar es SIMULACION", () => {
    const r = parsearArgs(["--entidad", "CEEIND", "--desde", "2026-08-01", "--hasta", "2026-12-31"]);
    expect(r.ok).toBe(true);
    expect(r.confirmar).toBe(false);
  });

  test("con --confirmar sí ejecuta", () => {
    const r = parsearArgs(["--entidad", "CEEIND", "--desde", "2026-08-01", "--hasta", "2026-12-31", "--confirmar"]);
    expect(r.confirmar).toBe(true);
  });

  test("exige entidad: sin ella no se sabe de quien se borra", () => {
    const r = parsearArgs(["--desde", "2026-08-01", "--hasta", "2026-12-31"]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/entidad/i);
  });

  test("exige AMBAS fechas — es lo que impide vaciar la tabla entera", () => {
    expect(parsearArgs(["--entidad", "CEEIND"]).ok).toBe(false);
    expect(parsearArgs(["--entidad", "CEEIND", "--desde", "2026-08-01"]).ok).toBe(false);
    expect(parsearArgs(["--entidad", "CEEIND", "--hasta", "2026-12-31"]).ok).toBe(false);
  });

  test("rechaza fechas mal formadas en vez de mandarlas a la base", () => {
    const r = parsearArgs(["--entidad", "CEEIND", "--desde", "01-08-2026", "--hasta", "2026-12-31"]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/AAAA-MM-DD/);
  });

  test("rechaza el rango invertido", () => {
    const r = parsearArgs(["--entidad", "CEEIND", "--desde", "2026-12-31", "--hasta", "2026-08-01"]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/posterior/i);
  });

  test("la sigla se normaliza a mayusculas", () => {
    const r = parsearArgs(["--entidad", "ceeind", "--desde", "2026-08-01", "--hasta", "2026-12-31"]);
    expect(r.filtros.entidadSigla).toBe("CEEIND");
  });

  test("acepta --entidad-id como alternativa a la sigla", () => {
    const r = parsearArgs(["--entidad-id", "6", "--desde", "2026-08-01", "--hasta", "2026-12-31"]);
    expect(r.ok).toBe(true);
    expect(r.filtros.entidadId).toBe(6);
  });

  test("una bandera pegada a otra no se toma como valor", () => {
    // `--entidad --confirmar` no debe interpretar "--confirmar" como sigla.
    const r = parsearArgs(["--entidad", "--confirmar", "--desde", "2026-08-01", "--hasta", "2026-12-31"]);
    expect(r.ok).toBe(false);
  });

  test("hay motivo por defecto para que la constancia nunca quede vacia", () => {
    const r = parsearArgs(["--entidad", "CEEIND", "--desde", "2026-08-01", "--hasta", "2026-12-31"]);
    expect(r.filtros.motivo).toMatch(/importacion/i);
  });
});

describe("consultaCandidatas — el filtro que decide que se borra", () => {
  const base = { entidadId: 6, desde: "2026-08-01", hasta: "2026-12-31" };

  test("filtra por entidad y por rango de fecha_inicio", () => {
    const { sql, args } = consultaCandidatas(base);
    expect(sql).toMatch(/a\.entidad_id = \$1/);
    expect(sql).toMatch(/a\.fecha_inicio >= \$2/);
    expect(args).toEqual([6, "2026-08-01", "2026-12-31"]);
  });

  test("el limite superior incluye el dia entero de --hasta", () => {
    // `< hasta + 1 dia` en vez de `<= hasta`: si no, una actividad del 31 de
    // diciembre a las 19:10 se escaparia del borrado.
    expect(consultaCandidatas(base).sql).toMatch(/\$3::date \+ 1/);
  });

  test("--creadas-desde acota a la ventana de la subida", () => {
    const { sql, args } = consultaCandidatas({ ...base, creadasDesde: "2026-09-07T00:00:00Z" });
    expect(sql).toMatch(/a\.created_at >= \$4/);
    expect(args).toContain("2026-09-07T00:00:00Z");
  });

  test("--ramo permite deshacer una sola asignatura", () => {
    const { sql, args } = consultaCandidatas({ ...base, ramo: "Cálculo II" });
    expect(sql).toMatch(/a\.ramo = \$4/);
    expect(args).toContain("Cálculo II");
  });

  test("todo va parametrizado: ni un valor interpolado en el SQL", () => {
    const { sql } = consultaCandidatas({ ...base, ramo: "'; DROP TABLE actividad; --" });
    expect(sql).not.toMatch(/DROP TABLE/);
    expect(sql).toMatch(/\$\d/);
  });

  test("devuelve el ramo, para poder revisar la lista antes de confirmar", () => {
    expect(consultaCandidatas(base).sql).toMatch(/a\.ramo/);
  });
});
