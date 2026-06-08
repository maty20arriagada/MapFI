"use strict";
const h = require("../../js/services/holidayService");

// Nota: se usan strings con hora (parseo LOCAL) y objetos Date (como los
// devuelve node-pg para columnas DATE) para evitar el pitfall de parsear
// "YYYY-MM-DD" como UTC.

describe("holidayService", () => {
  test("esFinDeSemana detecta sabado y domingo", () => {
    expect(h.esFinDeSemana("2026-06-06T10:00:00")).toBe(true);  // sabado
    expect(h.esFinDeSemana("2026-06-07T10:00:00")).toBe(true);  // domingo
    expect(h.esFinDeSemana("2026-06-08T10:00:00")).toBe(false); // lunes
  });

  test("esFeriado compara por fecha", () => {
    const feriados = [new Date(2026, 8, 18)]; // 18-sep (mes 0-indexado)
    expect(h.esFeriado("2026-09-18T10:00:00", feriados)).toBe(true);
    expect(h.esFeriado("2026-09-17T10:00:00", feriados)).toBe(false);
  });

  test("esDiaHabil = lun-vie y no feriado", () => {
    expect(h.esDiaHabil("2026-06-08T10:00:00", [])).toBe(true);            // lunes
    expect(h.esDiaHabil("2026-06-06T10:00:00", [])).toBe(false);           // sabado
    expect(h.esDiaHabil("2026-09-18T10:00:00", [new Date(2026, 8, 18)])).toBe(false);
  });

  test("diasHabilesEntre cuenta solo lun-vie sin feriados", () => {
    // lunes 8-jun a domingo 14-jun → 5 dias habiles
    expect(h.diasHabilesEntre(new Date(2026, 5, 8), new Date(2026, 5, 14), [])).toBe(5);
    // con feriado el miercoles 10-jun → 4
    expect(
      h.diasHabilesEntre(new Date(2026, 5, 8), new Date(2026, 5, 14), [new Date(2026, 5, 10)])
    ).toBe(4);
  });
});
