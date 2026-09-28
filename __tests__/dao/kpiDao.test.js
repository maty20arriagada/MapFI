"use strict";
/**
 * Spec 006, US5 — conteo del semestre sin doble conteo.
 *
 * vw_saturacion_segmento agrupa por (carrera, nivel, dia) y el servicio sumaba
 * las filas: una charla dirigida a los cinco años de una carrera contaba 5.
 * saturacionPublico lee la vista nueva, que conserva el id de la actividad, y
 * cuenta actividades DISTINTAS. Se inspecciona el SQL con un mock manual de
 * js/db (patron de actividadVisibilidad.test.js): pg-mem no soporta la
 * columna tstzrange GENERATED.
 */
let ultima = null;
jest.mock("../../js/db", () => ({
  query: jest.fn((sql, params) => {
    ultima = { sql, params };
    return Promise.resolve({ rows: [] });
  }),
  pool: { connect: jest.fn(), query: jest.fn() },
}));

const kpiDao = require("../../js/dao/kpiDao");

beforeEach(() => { ultima = null; });

describe("kpiDao.saturacionPublico", () => {
  const publico = [{ carreraId: 6, nivel: 1 }, { carreraId: 6, nivel: 2 }, { carreraId: 7, nivel: 1 }];

  test("lee la vista nueva, no la agrupada por segmento", async () => {
    await kpiDao.saturacionPublico(publico, "2026-09-01", "2026-12-31");
    expect(ultima.sql).toMatch(/vw_saturacion_actividad/);
    expect(ultima.sql).not.toMatch(/vw_saturacion_segmento/);
  });

  test("cuenta actividades DISTINTAS, en total y en examenes", async () => {
    await kpiDao.saturacionPublico(publico, "2026-09-01", "2026-12-31");
    expect(ultima.sql).toMatch(/COUNT\(DISTINCT actividad_id\)\s+AS eventos/i);
    expect(ultima.sql).toMatch(/COUNT\(DISTINCT actividad_id\)\s+FILTER\s*\(WHERE tipo = 'EXAMEN'\)\s+AS examenes/i);
    expect(ultima.sql).toMatch(/GROUP BY fecha/i);
  });

  test("los pares (carrera, nivel) viajan como parametros, sin interpolar", async () => {
    await kpiDao.saturacionPublico(publico, "2026-09-01", "2026-12-31");
    expect(ultima.params[0]).toEqual([6, 6, 7]);
    expect(ultima.params[1]).toEqual([1, 2, 1]);
    expect(ultima.sql).not.toMatch(/\b6\b.*\b7\b/);
  });

  test("aplica desde/hasta solo si vienen", async () => {
    await kpiDao.saturacionPublico(publico);
    expect(ultima.params).toHaveLength(2);
    expect(ultima.sql).not.toMatch(/fecha >=/);
    await kpiDao.saturacionPublico(publico, "2026-09-01", "2026-12-31");
    expect(ultima.params).toEqual([[6, 6, 7], [1, 2, 1], "2026-09-01", "2026-12-31"]);
    expect(ultima.sql).toMatch(/fecha >= \$3/);
    expect(ultima.sql).toMatch(/fecha <= \$4/);
  });

  test("devuelve la misma forma que saturacionSegmento para que semestrePorDia no cambie", async () => {
    await kpiDao.saturacionPublico(publico);
    expect(ultima.sql).toMatch(/\bfecha\b/);
    expect(ultima.sql).toMatch(/AS eventos/);
    expect(ultima.sql).toMatch(/AS examenes/);
  });

  test("sin publico no consulta y devuelve vacio", async () => {
    expect(await kpiDao.saturacionPublico([])).toEqual([]);
    expect(ultima).toBeNull();
  });
});
