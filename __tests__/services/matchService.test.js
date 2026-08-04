"use strict";
const path = require("path");
const { execFileSync } = require("child_process");
const matchService = require("../../js/services/matchService");

// T011 · H-01: dentro de un mismo proceso Node, TZ se fija al arrancar y no
// se puede reasignar a mitad de ejecucion (V8/ICU cachean la zona local).
// Por eso, para probar como responde matchService.evaluar segun la TZ del
// proceso, se lanza un subproceso real por cada zona — igual que hace
// `npm run test:tz` con la suite completa.
const MATCH_SERVICE_PATH = path.resolve(__dirname, "../../js/services/matchService.js");
function evaluarBajoTZ(tz, propuesta, contexto) {
  const script = `
    const matchService = require(${JSON.stringify(MATCH_SERVICE_PATH)});
    const r = matchService.evaluar(${JSON.stringify(propuesta)}, ${JSON.stringify(contexto)});
    console.log(JSON.stringify({
      compat: r.compatibilidad_pct,
      esFinde: r.conflictos.some((c) => c.tipo === "FIN_DE_SEMANA"),
    }));
  `;
  const out = execFileSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
  }).trim();
  return JSON.parse(out);
}

// Lunes 8-jun-2026 10:00–12:00 como propuesta base; publico = ICI 2.o anio.
const LUNES_10 = "2026-06-08T10:00:00";
const LUNES_12 = "2026-06-08T12:00:00";
const publico = [{ carreraId: 1, nivel: 2 }];
const poblacion = { "1-2": 100 };

describe("matchService.evaluar — descartes duros", () => {
  test("fin de semana → compatibilidad 0", () => {
    const r = matchService.evaluar(
      { inicio: "2026-06-06T10:00:00", fin: "2026-06-06T12:00:00", publico }, // sabado
      { poblacion }
    );
    expect(r.compatibilidad_pct).toBe(0);
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
});

describe("matchService.evaluar — sin conflictos", () => {
  test("dia habil limpio → ALTO y alcance = poblacion total", () => {
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { poblacion });
    expect(r.nivel).toBe("ALTO");
    expect(r.compatibilidad_pct).toBe(100);
    expect(r.alcance_estimado).toBe(100);
    expect(r.sugerencias).toHaveLength(0); // compat alta → sin sugerencias
  });
});

describe("matchService.evaluar — Paso 1: malla academica", () => {
  test("choque con CLASE penaliza y reduce alcance", () => {
    const bloques = [
      { carreraId: 1, nivel: 2, diaSemana: 1, horaInicio: "09:00:00", horaFin: "11:00:00", tipo: "CLASE" },
    ];
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { bloques, poblacion });
    expect(r.compatibilidad_pct).toBe(88); // 100 - 12
    expect(r.conflictos.some((c) => c.tipo === "CLASE")).toBe(true);
    expect(r.alcance_estimado).toBe(15); // 100 * 0.15
  });

  test("choque con bloque PROTEGIDO penaliza fuerte", () => {
    const bloques = [
      { carreraId: 1, nivel: 2, diaSemana: 1, horaInicio: "10:30:00", horaFin: "12:30:00", tipo: "PROTEGIDO" },
    ];
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { bloques, poblacion });
    expect(r.compatibilidad_pct).toBe(70); // 100 - 30
    expect(r.conflictos.some((c) => c.tipo === "PROTEGIDO")).toBe(true);
  });

  test("bloque LIBRE no penaliza", () => {
    const bloques = [
      { carreraId: 1, nivel: 2, diaSemana: 1, horaInicio: "10:00:00", horaFin: "12:00:00", tipo: "LIBRE" },
    ];
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { bloques, poblacion });
    expect(r.compatibilidad_pct).toBe(100);
  });

  test("clase de OTRO segmento no afecta", () => {
    const bloques = [
      { carreraId: 2, nivel: 2, diaSemana: 1, horaInicio: "10:00:00", horaFin: "12:00:00", tipo: "CLASE" },
    ];
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { bloques, poblacion });
    expect(r.compatibilidad_pct).toBe(100);
  });
});

describe("matchService.evaluar — Paso 2: examenes", () => {
  test("choque con examen → penaliza, alcance 0 y genera sugerencias", () => {
    const actividades = [
      { inicio: LUNES_10, fin: LUNES_12, tipo: "EXAMEN", estado: "CONFIRMADA", publico },
    ];
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { actividades, poblacion });
    expect(r.compatibilidad_pct).toBe(55); // 100 - 45
    expect(r.nivel).toBe("MEDIO");
    expect(r.alcance_estimado).toBe(0);
    expect(r.conflictos.some((c) => c.tipo === "EXAMEN")).toBe(true);
    expect(r.sugerencias.length).toBeGreaterThan(0);
    expect(r.sugerencias.length).toBeLessThanOrEqual(3);
  });
});

describe("matchService.evaluar — Paso 3: saturacion", () => {
  test("eventos confirmados misma semana penalizan y reducen alcance", () => {
    const actividades = [
      { inicio: "2026-06-09T15:00:00", fin: "2026-06-09T17:00:00", tipo: "EVENTO", estado: "CONFIRMADA", publico },
      { inicio: "2026-06-10T15:00:00", fin: "2026-06-10T17:00:00", tipo: "EVENTO", estado: "CONFIRMADA", publico },
    ];
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { actividades, poblacion });
    expect(r.compatibilidad_pct).toBe(80); // 100 - 2*10
    expect(r.alcance_estimado).toBe(80);   // 100 * (1 - 0.2)
  });

  test("eventos en PROPUESTA (no confirmados) no saturan", () => {
    const actividades = [
      { inicio: "2026-06-09T15:00:00", fin: "2026-06-09T17:00:00", tipo: "EVENTO", estado: "PROPUESTA", publico },
    ];
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { actividades, poblacion });
    expect(r.compatibilidad_pct).toBe(100);
  });
});

describe("matchService.evaluar — Paso 6: sugerencias", () => {
  test("las sugerencias son dias habiles, ordenadas y <= 3", () => {
    const actividades = [
      { inicio: LUNES_10, fin: LUNES_12, tipo: "EXAMEN", estado: "CONFIRMADA", publico },
    ];
    const r = matchService.evaluar({ inicio: LUNES_10, fin: LUNES_12, publico }, { actividades, poblacion });
    expect(r.sugerencias.length).toBeLessThanOrEqual(3);
    for (const s of r.sugerencias) {
      const d = new Date(s.inicio).getDay();
      expect(d).toBeGreaterThanOrEqual(1); // no domingo
      expect(d).toBeLessThanOrEqual(5);    // no sabado
    }
    // ordenadas de mayor a menor compatibilidad
    for (let i = 1; i < r.sugerencias.length; i++) {
      expect(r.sugerencias[i - 1].compatibilidad_pct).toBeGreaterThanOrEqual(r.sugerencias[i].compatibilidad_pct);
    }
  });
});

describe("matchService.evaluar — Paso 0 bajo TZ incorrecta (H-01)", () => {
  test("un instante correcto de viernes tarde se clasifica como fin de semana si el proceso corre sin TZ (UTC)", () => {
    // Viernes 5-jun-2026 23:30 hora de Chile, ya como instante absoluto real
    // (equivalente a lo que devuelve Postgres para una columna TIMESTAMPTZ
    // una vez aplicado el fix de zona horaria — T012/T013).
    const instanteCorrectoDeViernes = "2026-06-06T03:30:00.000Z";
    const propuesta = { inicio: instanteCorrectoDeViernes, fin: instanteCorrectoDeViernes, publico };
    const contexto = { poblacion };

    const bajoChile = evaluarBajoTZ("America/Santiago", propuesta, contexto);
    const bajoUTC = evaluarBajoTZ("UTC", propuesta, contexto);

    expect(bajoChile.esFinde).toBe(false); // correcto: sigue siendo viernes en Chile
    expect(bajoChile.compat).toBe(100);

    expect(bajoUTC.esFinde).toBe(true); // bug: un contenedor sin TZ (UTC) lee el mismo instante como sabado
    expect(bajoUTC.compat).toBe(0);

    expect(bajoChile.compat).not.toBe(bajoUTC.compat);
  });
});

describe("matchService.evaluar — Paso 0, actividad que cruza medianoche (T068, E-12)", () => {
  test("el criterio de fin de semana se evalua SOLO sobre el inicio, aunque el termino caiga en fin de semana", () => {
    // Viernes 5-jun-2026 23:00 a sabado 6-jun-2026 01:00: cruza a sabado,
    // pero el inicio (lo unico que cuenta segun la regla fijada en spec.md)
    // sigue siendo viernes.
    const r = matchService.evaluar(
      { inicio: "2026-06-05T23:00:00", fin: "2026-06-06T01:00:00", publico },
      { poblacion }
    );
    expect(r.conflictos.some((c) => c.tipo === "FIN_DE_SEMANA")).toBe(false);
  });

  test("en cambio, si el INICIO cae en fin de semana, si se descarta (aunque termine un dia habil)", () => {
    // Sabado 6-jun-2026 23:00 a domingo 7-jun-2026 01:00.
    const r = matchService.evaluar(
      { inicio: "2026-06-06T23:00:00", fin: "2026-06-07T01:00:00", publico },
      { poblacion }
    );
    expect(r.conflictos.some((c) => c.tipo === "FIN_DE_SEMANA")).toBe(true);
  });
});

describe("matchService.evaluar — validacion", () => {
  test("publico vacio → lanza error", () => {
    expect(() => matchService.evaluar({ inicio: LUNES_10, publico: [] }, {})).toThrow();
  });
});
