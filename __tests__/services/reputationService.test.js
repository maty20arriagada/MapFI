"use strict";
const rep = require("../../js/services/reputationService");

describe("reputationService.calcular", () => {
  test("sin actividades → reputacion 0 y sin sello", () => {
    const r = rep.calcular([]);
    expect(r.reputacion).toBe(0);
    expect(r.eventos_exitosos).toBe(0);
    expect(r.confiabilidad_pct).toBe(0);
    expect(r.sello_coordinacion).toBe(false);
  });

  test("3 realizadas, con match y a tiempo → sello y confiabilidad 100", () => {
    const acts = [1, 2, 3].map(() => ({
      estado: "REALIZADA",
      created_at: "2026-03-01T10:00:00",
      fecha_inicio: "2026-03-20T10:00:00",
      compatibilidad_pct: 90,
    }));
    const r = rep.calcular(acts);
    expect(r.eventos_exitosos).toBe(3);
    expect(r.confiabilidad_pct).toBe(100);
    expect(r.sello_coordinacion).toBe(true);
    expect(r.reputacion).toBe(3 * 10 + 3 * 3); // realizadas + bonus puntualidad
  });

  test("reprogramaciones bajan confiabilidad y quitan el sello", () => {
    const base = { created_at: "2026-03-01", fecha_inicio: "2026-03-20", compatibilidad_pct: 60 };
    const r = rep.calcular([
      { ...base, estado: "REALIZADA" },
      { ...base, estado: "REPROGRAMADA" },
      { ...base, estado: "SUSPENDIDA" },
    ]);
    expect(r.confiabilidad_pct).toBe(33); // 1 de 3
    expect(r.sello_coordinacion).toBe(false);
  });

  test("sin anticipacion → no suma bonus de puntualidad", () => {
    const r = rep.calcular([
      { estado: "REALIZADA", created_at: "2026-03-19", fecha_inicio: "2026-03-20", compatibilidad_pct: 80 },
    ]);
    expect(r.reputacion).toBe(10);
  });
});
