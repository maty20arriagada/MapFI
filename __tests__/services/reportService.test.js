"use strict";
const { PassThrough } = require("stream");
const reportService = require("../../js/services/reportService");

const entidad = { id: 1, nombre: "CEE ICI", tipo: "CENTRO_ALUMNOS" };
const acts = [
  { titulo: "Feria", fecha_inicio: "2026-04-10T10:00:00", estado: "REALIZADA", alcance_estimado: 120, compatibilidad_pct: 85, created_at: "2026-03-01" },
  { titulo: "Charla", fecha_inicio: "2026-05-10T10:00:00", estado: "REPROGRAMADA", alcance_estimado: 0, compatibilidad_pct: 40, created_at: "2026-05-08" },
];

describe("reportService.construirResumen", () => {
  test("agrega totales y metricas", () => {
    const r = reportService.construirResumen(entidad, acts, { anio: 2026, semestre: 1 });
    expect(r.entidad.nombre).toBe("CEE ICI");
    expect(r.totales.total).toBe(2);
    expect(r.totales.realizadas).toBe(1);
    expect(r.totales.reprogramadas).toBe(1);
    expect(r.totales.alcanceTotal).toBe(120);
    expect(r.periodo.anio).toBe(2026);
    expect(r.actividades).toHaveLength(2);
    expect(typeof r.reputacion).toBe("number");
  });

  test("sin actividades → totales en cero y periodo null", () => {
    const r = reportService.construirResumen(entidad, [], null);
    expect(r.totales.total).toBe(0);
    expect(r.periodo).toBeNull();
  });
});

describe("reportService.generarPDF", () => {
  test("escribe un PDF no vacio en el stream", (done) => {
    const s = new PassThrough();
    let bytes = 0;
    s.on("data", (c) => { bytes += c.length; });
    s.on("end", () => { expect(bytes).toBeGreaterThan(0); done(); });
    const resumen = reportService.construirResumen(entidad, acts, { anio: 2026, semestre: 1 });
    reportService.generarPDF(resumen, s);
  });
});
