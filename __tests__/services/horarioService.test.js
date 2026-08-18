"use strict";

const {
  geometria, aMinutos, aHHMM, disponibilidad, mejoresFranjas,
  HORA_INICIO, HORA_FIN, PASO, FILAS,
} = require("../../js/services/horarioService");

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

// ── Disponibilidad semanal: "¿a qué hora hago mi actividad?" ───────────────
const fila = (hora) => (hora * 60 - HORA_INICIO) / PASO;
const clase = (over) => ({
  carrera_id: 7, nivel: 1, dia_semana: 1,
  hora_inicio: "08:00", hora_fin: "10:00", tipo: "CLASE", ...over,
});

describe("horarioService — disponibilidad", () => {
  const SEGS = [
    { carreraId: 7, nivel: 1, poblacion: 100 },
    { carreraId: 9, nivel: 1, poblacion: 50 },
  ];

  test("una franja sin clases deja a todos libres", () => {
    const d = disponibilidad([], SEGS);
    expect(d.celdas[1][fila(10)]).toMatchObject({ ocupados: 0, libres: 2, pctLibre: 100 });
  });

  test("cuenta la población ocupada, no solo los segmentos", () => {
    const d = disponibilidad([clase()], SEGS);
    // Solo Informática (100 de 150) está en clase → queda libre el 33%.
    expect(d.celdas[1][fila(8.5)]).toMatchObject({ ocupados: 1, poblacionOcupada: 100, pctLibre: 33 });
  });

  test("dos secciones del MISMO segmento no cuentan doble", () => {
    // Un estudiante está en una sección o en la otra, nunca en ambas.
    const d = disponibilidad([clase(), clase({ hora_inicio: "08:00", hora_fin: "10:00" })], SEGS);
    expect(d.celdas[1][fila(9)].ocupados).toBe(1);
    expect(d.celdas[1][fila(9)].poblacionOcupada).toBe(100);
  });

  test("segmentos distintos sí se suman", () => {
    const d = disponibilidad([clase(), clase({ carrera_id: 9 })], SEGS);
    expect(d.celdas[1][fila(9)]).toMatchObject({ ocupados: 2, poblacionOcupada: 150, pctLibre: 0 });
  });

  test("solo las CLASES ocupan: un bloque PROTEGIDO o LIBRE no", () => {
    const protegido = disponibilidad([clase({ tipo: "PROTEGIDO" })], SEGS);
    const libre = disponibilidad([clase({ tipo: "LIBRE" })], SEGS);
    expect(protegido.celdas[1][fila(9)].ocupados).toBe(0);
    expect(libre.celdas[1][fila(9)].ocupados).toBe(0);
  });

  test("ignora bloques de segmentos que no se pidieron", () => {
    const d = disponibilidad([clase({ carrera_id: 99, nivel: 4 })], SEGS);
    expect(d.celdas[1][fila(9)].ocupados).toBe(0);
  });

  test("sin población declarada cada segmento pesa igual", () => {
    const d = disponibilidad([clase()], [{ carreraId: 7, nivel: 1 }, { carreraId: 9, nivel: 1 }]);
    expect(d.celdas[1][fila(9)].pctLibre).toBe(50);
  });

  test("la ocupación termina donde termina la clase", () => {
    const d = disponibilidad([clase()], SEGS);
    expect(d.celdas[1][fila(9.75)].ocupados).toBe(1);  // 09:45, dentro
    expect(d.celdas[1][fila(10)].ocupados).toBe(0);    // 10:00, ya fuera
  });

  test("un bloque de otro día no contamina el lunes", () => {
    const d = disponibilidad([clase({ dia_semana: 3 })], SEGS);
    expect(d.celdas[1][fila(9)].ocupados).toBe(0);
    expect(d.celdas[3][fila(9)].ocupados).toBe(1);
  });

  test("cubre los 5 días y las 52 filas de la grilla", () => {
    const d = disponibilidad([], SEGS);
    for (let dia = 1; dia <= 5; dia++) expect(d.celdas[dia]).toHaveLength(FILAS);
  });
});

describe("horarioService — mejoresFranjas", () => {
  const SEGS = [{ carreraId: 7, nivel: 1, poblacion: 100 }];

  test("ordena de mayor a menor porcentaje libre", () => {
    const d = disponibilidad([clase()], SEGS);
    const f = mejoresFranjas(d, 90);
    for (let i = 1; i < f.length; i++) {
      expect(f[i - 1].pctLibre).toBeGreaterThanOrEqual(f[i].pctLibre);
    }
  });

  test("descarta las franjas más cortas que la duración pedida", () => {
    const d = disponibilidad([], SEGS);
    // Con toda la semana libre, cada día es una sola franja de 08:00 a 21:00.
    const f = mejoresFranjas(d, 90);
    expect(f).toHaveLength(5);
    f.forEach((x) => expect(x).toMatchObject({ horaInicio: "08:00", horaFin: "21:00", pctLibre: 100 }));
  });

  test("parte el día en tramos según cambie la ocupación", () => {
    const d = disponibilidad([clase({ hora_inicio: "10:00", hora_fin: "12:00" })], SEGS);
    const lunes = mejoresFranjas(d, 60).filter((x) => x.diaSemana === 1);
    // 08:00-10:00 libre · 10:00-12:00 ocupado · 12:00-21:00 libre
    expect(lunes.map((x) => `${x.horaInicio}-${x.horaFin}:${x.pctLibre}`)).toEqual(
      expect.arrayContaining(["08:00-10:00:100", "12:00-21:00:100", "10:00-12:00:0"])
    );
  });

  test("con todo ocupado no se inventa una franja buena", () => {
    const d = disponibilidad([clase({ hora_inicio: "08:00", hora_fin: "21:00" })], SEGS);
    const lunes = mejoresFranjas(d, 90).filter((x) => x.diaSemana === 1);
    expect(lunes.every((x) => x.pctLibre === 0)).toBe(true);
  });
});
