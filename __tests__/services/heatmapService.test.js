"use strict";

const h = require("../../js/services/heatmapService");
const { HORA_INICIO, PASO, FILAS } = h;

/** Fila de la rejilla que corresponde a una hora decimal (9.5 = 09:30). */
const fila = (hora) => (hora * 60 - HORA_INICIO) / PASO;

const SEG = [{ carreraId: 7, nivel: 1 }];
// 2026-09-07 es LUNES; se usa como ancla de todas las pruebas semanales.
const LUNES = "2026-09-07";

function contexto(over) {
  return {
    bloques: [], actividades: [], feriados: [], poblacion: { "7-1": 100 },
    ...over,
  };
}
const claseDe = (over) => ({
  carreraId: 7, nivel: 1, diaSemana: 1,
  horaInicio: "08:00", horaFin: "10:00", tipo: "CLASE", ...over,
});

describe("heatmapService — fechas locales (regresión tipo H-01)", () => {
  test("una fecha 'AAAA-MM-DD' NO se interpreta como UTC", () => {
    // new Date("2026-09-07") daría el 6 de septiembre al oeste de Greenwich,
    // y el lunes de la semana se corría entera.
    expect(h.iso("2026-09-07")).toBe("2026-09-07");
    expect(h.iso("2026-01-01")).toBe("2026-01-01");
  });

  test("lunesDe() de un lunes es ese mismo lunes", () => {
    expect(h.iso(h.lunesDe("2026-09-07"))).toBe("2026-09-07");
  });

  test("lunesDe() retrocede al lunes desde cualquier día de la semana", () => {
    ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"].forEach((d) => {
      expect(h.iso(h.lunesDe(d))).toBe("2026-09-07");
    });
  });

  test("el domingo pertenece a la semana que termina, no a la que empieza", () => {
    expect(h.iso(h.lunesDe("2026-09-13"))).toBe("2026-09-07");
  });

  test("acepta también un Date y un ISO con hora", () => {
    expect(h.iso(new Date(2026, 8, 7))).toBe("2026-09-07");
    expect(h.iso("2026-09-07T15:30:00")).toBe("2026-09-07");
  });
});

describe("heatmapService — escala de niveles", () => {
  test("por eventos: 0 es libre y crece hasta saturado", () => {
    expect(h.nivelPorEventos(0).id).toBe("LIBRE");
    expect(h.nivelPorEventos(1).id).toBe("BAJA");
    expect(h.nivelPorEventos(3).id).toBe("MEDIA");
    expect(h.nivelPorEventos(5).id).toBe("ALTA");
    expect(h.nivelPorEventos(9).id).toBe("SATURADO");
  });

  test("por porcentaje: 0% libre, 100% saturado", () => {
    expect(h.nivelPorPct(0).id).toBe("LIBRE");
    expect(h.nivelPorPct(20).id).toBe("BAJA");
    expect(h.nivelPorPct(50).id).toBe("MEDIA");
    expect(h.nivelPorPct(80).id).toBe("ALTA");
    expect(h.nivelPorPct(100).id).toBe("SATURADO");
  });

  test("las dos escalas usan la MISMA rampa de 5 colores", () => {
    const ids = h.NIVELES.map((n) => n.id);
    expect(ids).toEqual(["LIBRE", "BAJA", "MEDIA", "ALTA", "SATURADO"]);
    [0, 1, 3, 5, 9].forEach((e) => expect(ids).toContain(h.nivelPorEventos(e).id));
    [0, 20, 50, 80, 100].forEach((p) => expect(ids).toContain(h.nivelPorPct(p).id));
  });
});

describe("heatmapService — construir (compatibilidad con /api/heatmap)", () => {
  test("mantiene la forma antigua y añade el nivel nuevo", () => {
    const [c] = h.construir([{ carrera_id: 7, nivel: 1, fecha: "2026-09-07", eventos: 4, examenes: 1 }]);
    expect(c).toMatchObject({ carreraId: 7, nivel: 1, eventos: 4, examenes: 1, color: "ROJO" });
    expect(c.nivelClase).toBeTruthy();
  });

  test("sin filas devuelve lista vacía", () => {
    expect(h.construir([])).toEqual([]);
  });
});

describe("heatmapService — semanaPorHora: clases", () => {
  test("una clase ocupa a todo su segmento", () => {
    const r = h.semanaPorHora(contexto({ bloques: [claseDe()] }), SEG, { fecha: LUNES });
    expect(r.celdas[1][fila(9)]).toMatchObject({ pctOcupado: 100, enClase: 1, nivelId: "SATURADO" });
  });

  test("fuera del horario de clase queda libre", () => {
    const r = h.semanaPorHora(contexto({ bloques: [claseDe()] }), SEG, { fecha: LUNES });
    expect(r.celdas[1][fila(11)]).toMatchObject({ pctOcupado: 0, nivelId: "LIBRE" });
  });

  test("un bloque PROTEGIDO NO ocupa: es el que la Facultad reserva", () => {
    const r = h.semanaPorHora(contexto({ bloques: [claseDe({ tipo: "PROTEGIDO" })] }), SEG, { fecha: LUNES });
    expect(r.celdas[1][fila(9)].pctOcupado).toBe(0);
  });

  test("dos secciones del mismo ramo no cuentan doble", () => {
    const r = h.semanaPorHora(contexto({ bloques: [claseDe(), claseDe()] }), SEG, { fecha: LUNES });
    expect(r.celdas[1][fila(9)].pctOcupado).toBe(100);
  });

  test("en feriado no hay clases", () => {
    const r = h.semanaPorHora(
      contexto({ bloques: [claseDe()], feriados: ["2026-09-07"] }), SEG, { fecha: LUNES }
    );
    expect(r.celdas[1][fila(9)].pctOcupado).toBe(0);
    expect(r.dias[0].esFeriado).toBe(true);
  });

  test("pondera por matrícula: el segmento grande pesa más", () => {
    const segs = [{ carreraId: 7, nivel: 1 }, { carreraId: 9, nivel: 1 }];
    const ctx = contexto({ bloques: [claseDe()], poblacion: { "7-1": 300, "9-1": 100 } });
    const r = h.semanaPorHora(ctx, segs, { fecha: LUNES });
    // Solo el segmento de 300 está en clase: 300/400 = 75%.
    expect(r.celdas[1][fila(9)].pctOcupado).toBe(75);
  });

  test("sin matrícula cargada lo declara en vez de fingir precisión", () => {
    const r = h.semanaPorHora(contexto({ poblacion: {} }), SEG, { fecha: LUNES });
    expect(r.sinMatricula).toBe(true);
  });
});

describe("heatmapService — semanaPorHora: actividades del calendario", () => {
  const actividad = (over) => ({
    inicio: "2026-09-07T15:00:00", fin: "2026-09-07T17:00:00",
    tipo: "CHARLA", publico: [{ carreraId: 7, nivel: 1 }], ...over,
  });

  test("una actividad agendada ocupa su franja real", () => {
    const r = h.semanaPorHora(contexto({ actividades: [actividad()] }), SEG, { fecha: LUNES });
    expect(r.celdas[1][fila(16)]).toMatchObject({ pctOcupado: 100, conActividad: 1 });
    expect(r.celdas[1][fila(14)].pctOcupado).toBe(0);
  });

  test("cae en el día correcto de la semana", () => {
    const r = h.semanaPorHora(
      contexto({ actividades: [actividad({ inicio: "2026-09-09T10:00:00", fin: "2026-09-09T11:00:00" })] }),
      SEG, { fecha: LUNES }
    );
    expect(r.celdas[3][fila(10.5)].conActividad).toBe(1); // miércoles
    expect(r.celdas[1][fila(10.5)].conActividad).toBe(0);
  });

  test("una actividad de OTRO público no ocupa", () => {
    const r = h.semanaPorHora(
      contexto({ actividades: [actividad({ publico: [{ carreraId: 99, nivel: 5 }] })] }),
      SEG, { fecha: LUNES }
    );
    expect(r.celdas[1][fila(16)].pctOcupado).toBe(0);
  });

  test("clase y actividad a la vez no suman más de 100%", () => {
    const ctx = contexto({
      bloques: [claseDe({ horaInicio: "15:00", horaFin: "17:00" })],
      actividades: [actividad()],
    });
    const r = h.semanaPorHora(ctx, SEG, { fecha: LUNES });
    const c = r.celdas[1][fila(16)];
    expect(c.pctOcupado).toBe(100);
    expect(c.enClase).toBe(1);
    expect(c.conActividad).toBe(1);
  });
});

describe("heatmapService — semanaPorHora: forma de la rejilla", () => {
  test("devuelve los 5 días con su fecha real", () => {
    const r = h.semanaPorHora(contexto(), SEG, { fecha: LUNES });
    expect(r.dias.map((d) => d.fecha)).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11",
    ]);
  });

  test("cada día tiene las 52 filas de la grilla 08:00-21:00", () => {
    const r = h.semanaPorHora(contexto(), SEG, { fecha: LUNES });
    for (let d = 1; d <= 5; d++) expect(r.celdas[d]).toHaveLength(FILAS);
    expect(r.celdas[1][0].hora).toBe("08:00");
    expect(r.celdas[1][FILAS - 1].hora).toBe("20:45");
  });

  test("cualquier día de la semana produce la misma rejilla", () => {
    const lunes = h.semanaPorHora(contexto({ bloques: [claseDe()] }), SEG, { fecha: LUNES });
    const jueves = h.semanaPorHora(contexto({ bloques: [claseDe()] }), SEG, { fecha: "2026-09-10" });
    expect(jueves.lunes).toBe(lunes.lunes);
    expect(jueves.celdas[1][fila(9)].pctOcupado).toBe(lunes.celdas[1][fila(9)].pctOcupado);
  });
});

describe("heatmapService — mejoresFranjas", () => {
  test("ordena de menos a más ocupada", () => {
    const r = h.semanaPorHora(contexto({ bloques: [claseDe()] }), SEG, { fecha: LUNES });
    const f = h.mejoresFranjas(r, 90);
    for (let i = 1; i < f.length; i++) {
      expect(f[i - 1].pctOcupado).toBeLessThanOrEqual(f[i].pctOcupado);
    }
  });

  test("cada franja lleva su fecha real, no solo el día", () => {
    const r = h.semanaPorHora(contexto(), SEG, { fecha: LUNES });
    const f = h.mejoresFranjas(r, 90);
    expect(f[0].fecha).toMatch(/^2026-09-\d{2}$/);
  });

  test("descarta las franjas más cortas que la duración pedida", () => {
    const r = h.semanaPorHora(contexto(), SEG, { fecha: LUNES });
    h.mejoresFranjas(r, 90).forEach((x) => {
      const dur = (Number(x.horaFin.slice(0, 2)) * 60 + Number(x.horaFin.slice(3)))
        - (Number(x.horaInicio.slice(0, 2)) * 60 + Number(x.horaInicio.slice(3)));
      expect(dur).toBeGreaterThanOrEqual(90);
    });
  });

  test("un día feriado no se ofrece como franja", () => {
    const r = h.semanaPorHora(contexto({ feriados: ["2026-09-07"] }), SEG, { fecha: LUNES });
    expect(h.mejoresFranjas(r, 90).some((x) => x.diaSemana === 1)).toBe(false);
  });
});

describe("heatmapService — semestrePorDia", () => {
  const filas = [
    { carrera_id: 7, nivel: 1, fecha: "2026-09-07", eventos: 1, examenes: 0 },
    { carrera_id: 7, nivel: 1, fecha: "2026-09-09", eventos: 4, examenes: 2 },
    { carrera_id: 9, nivel: 1, fecha: "2026-09-09", eventos: 2, examenes: 0 },
    { carrera_id: 7, nivel: 1, fecha: "2026-09-21", eventos: 7, examenes: 0 },
  ];

  test("agrupa por semanas de lunes a viernes", () => {
    const r = h.semestrePorDia(filas);
    expect(r.semanas).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
  });

  test("suma los eventos de todos los segmentos en la misma fecha", () => {
    const r = h.semestrePorDia(filas);
    expect(r.celdas["2026-09-09"]).toMatchObject({ eventos: 6, examenes: 2, nivelId: "SATURADO" });
  });

  test("un día sin actividades queda libre, no ausente", () => {
    const r = h.semestrePorDia(filas);
    expect(r.celdas["2026-09-08"]).toMatchObject({ eventos: 0, nivelId: "LIBRE" });
  });

  test("marca los feriados", () => {
    const r = h.semestrePorDia(filas, { feriados: ["2026-09-18"] });
    expect(r.celdas["2026-09-18"].esFeriado).toBe(true);
    expect(r.celdas["2026-09-07"].esFeriado).toBe(false);
  });

  test("respeta un rango explícito de fechas", () => {
    const r = h.semestrePorDia(filas, { desde: "2026-09-07", hasta: "2026-09-11" });
    expect(r.semanas).toEqual(["2026-09-07"]);
  });

  test("sin datos no revienta", () => {
    expect(h.semestrePorDia([])).toEqual({ semanas: [], celdas: {}, total: 0 });
  });

  test("cada celda sabe su día de la semana y su columna", () => {
    const r = h.semestrePorDia(filas);
    expect(r.celdas["2026-09-09"]).toMatchObject({ diaSemana: 3, semana: "2026-09-07" });
  });
});
