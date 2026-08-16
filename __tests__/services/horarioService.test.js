"use strict";

const { geometria, aMinutos, aHHMM, HORA_INICIO, HORA_FIN, PASO, FILAS } = require("../../js/services/horarioService");

function bloque(over) {
  return { id: 1, dia_semana: 1, hora_inicio: "08:00", hora_fin: "09:00", tipo: "CLASE", descripcion: "x", ...over };
}

describe("horarioService — constantes", () => {
  test("cubre 08:00 a 21:00 en pasos de 15 minutos", () => {
    expect(HORA_INICIO).toBe(480);
    expect(HORA_FIN).toBe(1260);
    expect(PASO).toBe(15);
    expect(FILAS).toBe(52);
  });
});

describe("horarioService — aMinutos / aHHMM", () => {
  test.each([
    ["08:30", 510],
    ["8:30", 510],
    ["08:30:00", 510],
    ["00:00", 0],
    ["23:45", 1425],
  ])("aMinutos(%s) === %i", (t, esperado) => {
    expect(aMinutos(t)).toBe(esperado);
  });

  test("aMinutos con valor no interpretable devuelve null", () => {
    expect(aMinutos("")).toBeNull();
    expect(aMinutos(null)).toBeNull();
    expect(aMinutos("mediodia")).toBeNull();
  });

  test("aHHMM(510) === '08:30'", () => {
    expect(aHHMM(510)).toBe("08:30");
  });

  test("aHHMM rellena con cero", () => {
    expect(aHHMM(65)).toBe("01:05");
  });
});

describe("horarioService — geometria: proporcion 45 vs 90 minutos", () => {
  test("un bloque de 45 minutos ocupa 3 filas", () => {
    const [g] = geometria([bloque({ hora_inicio: "08:00", hora_fin: "08:45" })]);
    expect(g.filaFin - g.filaInicio).toBe(3);
  });

  test("un bloque de 90 minutos ocupa 6 filas — el doble exacto", () => {
    const [g] = geometria([bloque({ hora_inicio: "08:00", hora_fin: "09:30" })]);
    expect(g.filaFin - g.filaInicio).toBe(6);
  });

  test("90 minutos mide exactamente el doble que 45 minutos", () => {
    const [b45, b90] = geometria([
      bloque({ id: 1, hora_inicio: "08:00", hora_fin: "08:45" }),
      bloque({ id: 2, hora_inicio: "10:00", hora_fin: "11:30" }),
    ]);
    expect(b90.filaFin - b90.filaInicio).toBe((b45.filaFin - b45.filaInicio) * 2);
  });

  test("un bloque que empieza a las 08:00 arranca en la fila 2 (fila 1 = cabecera)", () => {
    const [g] = geometria([bloque({ hora_inicio: "08:00", hora_fin: "09:00" })]);
    expect(g.filaInicio).toBe(2);
  });
});

describe("horarioService — ajuste al cuarto de hora (R-2)", () => {
  test("11:50–13:20 (dato real del seed) se ajusta y se marca 'ajustado'", () => {
    const [g] = geometria([bloque({ hora_inicio: "11:50", hora_fin: "13:20" })]);
    expect(g.ajustado).toBe(true);
    // 11:50 -> floor a 11:45 ; 13:20 -> ceil a 13:30
    const filaEsperadaInicio = 2 + (11 * 60 + 45 - HORA_INICIO) / PASO;
    const filaEsperadaFin = 2 + (13 * 60 + 30 - HORA_INICIO) / PASO;
    expect(g.filaInicio).toBe(filaEsperadaInicio);
    expect(g.filaFin).toBe(filaEsperadaFin);
  });

  test("un bloque ya alineado al cuarto de hora no se marca 'ajustado'", () => {
    const [g] = geometria([bloque({ hora_inicio: "08:00", hora_fin: "09:30" })]);
    expect(g.ajustado).toBe(false);
  });

  test("el ajuste nunca genera una fila fraccionaria", () => {
    const [g] = geometria([bloque({ hora_inicio: "11:50", hora_fin: "13:20" })]);
    expect(Number.isInteger(g.filaInicio)).toBe(true);
    expect(Number.isInteger(g.filaFin)).toBe(true);
  });
});

describe("horarioService — fuera de rango (FR-010)", () => {
  test("un bloque antes de las 08:00 se marca fueraDeRango y no lleva fila", () => {
    const [g] = geometria([bloque({ hora_inicio: "07:00", hora_fin: "08:00" })]);
    expect(g.fueraDeRango).toBe(true);
    expect(g.filaInicio).toBeNull();
    expect(g.filaFin).toBeNull();
  });

  test("un bloque despues de las 21:00 se marca fueraDeRango", () => {
    const [g] = geometria([bloque({ hora_inicio: "21:00", hora_fin: "22:00" })]);
    expect(g.fueraDeRango).toBe(true);
  });

  test("un bloque dentro de rango no se marca fueraDeRango", () => {
    const [g] = geometria([bloque({ hora_inicio: "08:00", hora_fin: "21:00" })]);
    expect(g.fueraDeRango).toBe(false);
  });
});

describe("horarioService — sub-columnas de bloques solapados (R-3)", () => {
  test("dos bloques que no se solapan quedan cada uno en su propia columna, ancho completo", () => {
    const [a, b] = geometria([
      bloque({ id: 1, hora_inicio: "08:00", hora_fin: "09:00" }),
      bloque({ id: 2, hora_inicio: "09:00", hora_fin: "10:00" }), // adyacente, no solapa
    ]);
    expect(a.subColumnas).toBe(1);
    expect(b.subColumnas).toBe(1);
  });

  test("dos bloques solapados el mismo dia se reparten dos sub-columnas", () => {
    const [a, b] = geometria([
      bloque({ id: 1, hora_inicio: "08:00", hora_fin: "09:30" }),
      bloque({ id: 2, hora_inicio: "09:00", hora_fin: "10:30" }),
    ]);
    expect(a.subColumnas).toBe(2);
    expect(b.subColumnas).toBe(2);
    expect(a.subColumna).not.toBe(b.subColumna);
  });

  test("bloques del mismo dia pero no solapados no comparten cluster (subColumnas=1 cada uno)", () => {
    const [maniana, tarde] = geometria([
      bloque({ id: 1, hora_inicio: "08:00", hora_fin: "09:00" }),
      bloque({ id: 2, hora_inicio: "15:00", hora_fin: "16:00" }),
    ]);
    expect(maniana.subColumnas).toBe(1);
    expect(tarde.subColumnas).toBe(1);
  });

  test("racimo encadenado (A-B, B-C, A no solapa C) forma un solo cluster de 2 columnas", () => {
    const [a, b, c] = geometria([
      bloque({ id: 1, hora_inicio: "08:00", hora_fin: "09:00" }),
      bloque({ id: 2, hora_inicio: "08:30", hora_fin: "09:30" }), // solapa con A
      bloque({ id: 3, hora_inicio: "09:15", hora_fin: "10:00" }), // solapa con B, no con A
    ]);
    expect(a.subColumnas).toBe(2);
    expect(b.subColumnas).toBe(2);
    expect(c.subColumnas).toBe(2);
  });

  test("un bloque contenido dentro de otro (protegido cubriendo dos clases) usa 2 columnas", () => {
    const [protegido, clase1, clase2] = geometria([
      bloque({ id: 1, tipo: "PROTEGIDO", hora_inicio: "08:00", hora_fin: "10:00" }),
      bloque({ id: 2, hora_inicio: "08:00", hora_fin: "09:00" }),
      bloque({ id: 3, hora_inicio: "09:00", hora_fin: "10:00" }),
    ]);
    expect(protegido.subColumnas).toBe(2);
    expect(clase1.subColumnas).toBe(2);
    expect(clase2.subColumnas).toBe(2);
    // El protegido debe quedar en una columna distinta a las dos clases,
    // que sí pueden compartir columna entre sí (no se solapan entre ellas).
    expect(clase1.subColumna).toBe(clase2.subColumna);
    expect(protegido.subColumna).not.toBe(clase1.subColumna);
  });

  test("dias distintos no interfieren entre si", () => {
    const [lunes, martes] = geometria([
      bloque({ id: 1, dia_semana: 1, hora_inicio: "08:00", hora_fin: "09:30" }),
      bloque({ id: 2, dia_semana: 2, hora_inicio: "08:30", hora_fin: "10:00" }),
    ]);
    expect(lunes.subColumnas).toBe(1);
    expect(martes.subColumnas).toBe(1);
  });

  test("un bloque fueraDeRango no participa del apilado de sus vecinos", () => {
    const [fuera, normal] = geometria([
      bloque({ id: 1, hora_inicio: "07:00", hora_fin: "08:30" }), // fuera de rango
      bloque({ id: 2, hora_inicio: "08:00", hora_fin: "09:00" }), // dentro, se solaparia con el de arriba
    ]);
    expect(fuera.fueraDeRango).toBe(true);
    expect(normal.subColumnas).toBe(1);
  });
});
