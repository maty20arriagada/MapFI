"use strict";
const matchService = require("../../js/services/matchService");

describe("matchService.evaluar", () => {
  const publico = [{ carreraId: 1, nivel: 2 }];
  const poblacion = { "1-2": 100 };

  test("fin de semana → compatibilidad 0", () => {
    const r = matchService.evaluar(
      { inicio: "2026-06-06T10:00:00", fin: "2026-06-06T12:00:00", publico }, // sabado
      { poblacion }
    );
    expect(r.compatibilidad_pct).toBe(0);
    expect(r.nivel).toBe("BAJO");
    expect(r.conflictos[0].tipo).toBe("FIN_DE_SEMANA");
  });

  test("feriado → compatibilidad <= 10", () => {
    const r = matchService.evaluar(
      { inicio: "2026-09-18T10:00:00", fin: "2026-09-18T12:00:00", publico }, // viernes feriado
      { feriados: [new Date(2026, 8, 18)], poblacion }
    );
    expect(r.compatibilidad_pct).toBeLessThanOrEqual(10);
    expect(r.conflictos[0].tipo).toBe("FERIADO");
  });

  test("dia habil sin conflictos → ALTO y alcance = poblacion (placeholder F0)", () => {
    const r = matchService.evaluar(
      { inicio: "2026-06-08T10:00:00", fin: "2026-06-08T12:00:00", publico }, // lunes
      { poblacion }
    );
    expect(r.nivel).toBe("ALTO");
    expect(r.alcance_estimado).toBe(100);
  });

  test("publico vacio → lanza error de validacion", () => {
    expect(() =>
      matchService.evaluar({ inicio: "2026-06-08T10:00:00", publico: [] }, {})
    ).toThrow();
  });
});
