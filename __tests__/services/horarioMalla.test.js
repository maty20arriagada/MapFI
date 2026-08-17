"use strict";

const fs = require("fs");
const path = require("path");
const {
  indexarMalla,
  indexarMallas,
  resolverNivel,
  nivelPorCodigo,
  semestreANivel,
  limpiarHtml,
  MALLAS_VALIDAS,
  MALLAS_DESCARTADAS,
} = require("../../js/services/horarioMalla");
const { CARRERA, normalizar } = require("../../js/services/horarioCarrera");

const DIR_MALLAS = path.join(__dirname, "..", "..", "Extras", "Mallas");

function mallaHtml(nombre, semestres) {
  const bloques = semestres.map(({ sem, ramos }) =>
    `<div class="semestre"><div class="semestre-title">SEM ${sem}</div>` +
    ramos.map((r) => `<div class="ramo"><div class="ramo-header"><span>${r}</span><i></i></div></div>`).join("") +
    "</div>"
  ).join("");
  return `<html><body><h1>${nombre}</h1><div class="malla-container">${bloques}</div></body></html>`;
}

describe("horarioMalla — semestre a año", () => {
  test.each([
    [1, 1], [2, 1],
    [3, 2], [4, 2],
    [5, 3], [6, 3],
    [7, 4], [8, 4],
    [9, 5], [10, 5],
  ])("SEM %i → %iº año", (semestre, anio) => {
    expect(semestreANivel(semestre)).toBe(anio);
  });

  test("nunca sale del rango 1..5 que admite la tabla", () => {
    expect(semestreANivel(12)).toBe(5);
    expect(semestreANivel(0)).toBe(1);
  });
});

describe("horarioMalla — indexar una malla", () => {
  const html = mallaHtml("Prueba", [
    { sem: "I", ramos: ["Cálculo I Aplicado a la Ingeniería", "Física I"] },
    { sem: "II", ramos: ["Cálculo II Aplicado a la Ingeniería"] },
    { sem: "IV", ramos: ["Mecánica"] },
    { sem: "X", ramos: ["Memoria de Título"] },
  ]);

  test("asocia cada ramo al semestre que lo precede", () => {
    const idx = indexarMalla(html);
    expect(idx.get(normalizar("Cálculo I Aplicado a la Ingeniería"))).toBe(1);
    expect(idx.get(normalizar("Física I"))).toBe(1);
    expect(idx.get(normalizar("Cálculo II Aplicado a la Ingeniería"))).toBe(2);
    expect(idx.get(normalizar("Mecánica"))).toBe(4);
    expect(idx.get(normalizar("Memoria de Título"))).toBe(10);
  });

  test("los números romanos se interpretan bien hasta X", () => {
    const idx = indexarMalla(mallaHtml("X", [
      { sem: "VII", ramos: ["Uno"] }, { sem: "VIII", ramos: ["Dos"] },
      { sem: "IX", ramos: ["Tres"] }, { sem: "X", ramos: ["Cuatro"] },
    ]));
    expect([idx.get("uno"), idx.get("dos"), idx.get("tres"), idx.get("cuatro")]).toEqual([7, 8, 9, 10]);
  });

  test("indexa por nombre normalizado: tildes y mayúsculas no importan", () => {
    const idx = indexarMalla(mallaHtml("X", [{ sem: "III", ramos: ["Memoria de Titulo"] }]));
    expect(idx.get(normalizar("MEMORIA DE TÍTULO"))).toBe(3);
  });

  test("si un ramo se repite gana el semestre más temprano", () => {
    const idx = indexarMalla(mallaHtml("X", [
      { sem: "VI", ramos: ["Electiva"] },
      { sem: "II", ramos: ["Electiva"] },
    ]));
    expect(idx.get("electiva")).toBe(2);
  });

  test("un ramo antes del primer SEM se ignora en vez de romper", () => {
    const html2 = '<div class="ramo-header"><span>Huérfano</span></div>' +
      '<div class="semestre-title">SEM I</div><div class="ramo-header"><span>Bueno</span></div>';
    const idx = indexarMalla(html2);
    expect(idx.has("huerfano")).toBe(false);
    expect(idx.get("bueno")).toBe(1);
  });
});

describe("horarioMalla — limpiarHtml", () => {
  test("quita etiquetas internas y entidades", () => {
    expect(limpiarHtml("C&aacute;lculo <b>I</b>")).toBe("Cálculo I");
    expect(limpiarHtml("Dise&ntilde;o  y   Control")).toBe("Diseño y Control");
  });
});

describe("horarioMalla — las dos mallas mal etiquetadas se descartan", () => {
  test("están declaradas como descartadas con su motivo", () => {
    expect(Object.keys(MALLAS_DESCARTADAS)).toEqual([
      "Malla Curricular - Ingeniería Civil.html",
      "Malla ingenieria civil informatica.html",
    ]);
    expect(MALLAS_DESCARTADAS["Malla ingenieria civil informatica.html"]).toMatch(/Metal/i);
  });

  test("indexarMallas las ignora y las reporta", () => {
    const { indice, descartadas } = indexarMallas([
      { archivo: "Malla ingenieria civil informatica.html", html: mallaHtml("X", [{ sem: "I", ramos: ["Lo que sea"] }]) },
      { archivo: "Malla Ingenieria civil.html", html: mallaHtml("Civil", [{ sem: "I", ramos: ["Estática"] }]) },
    ]);
    expect(indice.has(CARRERA.ICINF)).toBe(false);
    expect(indice.get(CARRERA.IC).get("estatica")).toBe(1);
    expect(descartadas).toHaveLength(1);
    expect(descartadas[0]).toMatch(/informatica/i);
  });

  test("Informática no tiene malla asignada", () => {
    expect(Object.values(MALLAS_VALIDAS)).not.toContain(CARRERA.ICINF);
  });
});

describe("horarioMalla — nivel por 4.º dígito del código", () => {
  test.each([
    ["541126", 1], ["541202", 2], ["541352", 3], ["541408", 4],
    ["541562", 5], ["541690", 5], ["541719", 5], ["541802", 5],
  ])("%s → %iº año", (codigo, esperado) => {
    expect(nivelPorCodigo(codigo)).toBe(esperado);
  });

  test("el 6 (memorias y prácticas) y los electivos 7/8 caen en 5.º año", () => {
    expect(nivelPorCodigo("543690")).toBe(5); // Práctica Profesional
    expect(nivelPorCodigo("543808")).toBe(5); // electivo avanzado
  });

  test("EXCEPCIÓN: el prefijo 500 no da señal de nivel (es temático)", () => {
    // 5001 = matemáticas, no "1.er año"; Cálculo I y Cálculo II lo comparten.
    expect(nivelPorCodigo("500107")).toBeNull();
    expect(nivelPorCodigo("500117")).toBeNull();
    expect(nivelPorCodigo("500701")).toBeNull(); // inglés, no 7.º año
  });

  test("un código ausente o malformado no inventa nivel", () => {
    expect(nivelPorCodigo(null)).toBeNull();
    expect(nivelPorCodigo("abc")).toBeNull();
  });
});

describe("horarioMalla — cascada de resolución", () => {
  const indice = new Map([
    [CARRERA.ICI, new Map([[normalizar("Macroeconomía"), 7]])],
    [CARRERA.ICB, new Map([[normalizar("Mecánica"), 9]])],
    [CARRERA.ICPC, new Map([[normalizar("Cálculo I Aplicado a la Ingeniería"), 1]])],
  ]);

  test("1) la malla de su carrera manda, con confianza alta", () => {
    const r = resolverNivel({ ramo: "Macroeconomía", codigo: "580323", carreraId: CARRERA.ICI, indice });
    expect(r).toMatchObject({ nivel: 4, confianza: "alta" });
    expect(r.fuente).toMatch(/SEM 7/);
  });

  test("el mismo nombre resuelve distinto según la carrera", () => {
    const enBiomedica = resolverNivel({ ramo: "Mecánica", codigo: "550300", carreraId: CARRERA.ICB, indice });
    expect(enBiomedica.nivel).toBe(5); // SEM IX
    // En Industrial no está en la malla, así que cae al código.
    const enIndustrial = resolverNivel({ ramo: "Mecánica", codigo: "580300", carreraId: CARRERA.ICI, indice });
    expect(enIndustrial.confianza).toBe("media");
  });

  test("1b) los ramos comunes se resuelven por la malla de Plan Común para cualquier carrera", () => {
    const r = resolverNivel({
      ramo: "Cálculo I Aplicado a la Ingeniería", codigo: "500107",
      carreraId: CARRERA.ICINF, indice,
    });
    expect(r).toMatchObject({ nivel: 1, confianza: "alta" });
    expect(r.fuente).toMatch(/Plan Común/);
  });

  test("2) sin malla, cae al 4.º dígito con confianza media", () => {
    const r = resolverNivel({ ramo: "Ramo Desconocido", codigo: "541408", carreraId: CARRERA.ICM, indice });
    expect(r).toMatchObject({ nivel: 4, confianza: "media" });
  });

  test("3) sin ninguna señal asume 1.er año y lo declara de confianza baja", () => {
    const r = resolverNivel({ ramo: "Ramo Huérfano", codigo: null, carreraId: CARRERA.ICINF, indice });
    expect(r).toMatchObject({ nivel: 1, confianza: "baja" });
    expect(r.fuente).toMatch(/sin señal/i);
  });

  test("el nombre cruza aunque difiera en tildes", () => {
    const r = resolverNivel({ ramo: "MACROECONOMIA", codigo: "580323", carreraId: CARRERA.ICI, indice });
    expect(r.confianza).toBe("alta");
  });

  test("el nivel devuelto siempre cabe en generacion (1..5)", () => {
    [
      { ramo: "Macroeconomía", codigo: "580323", carreraId: CARRERA.ICI },
      { ramo: "X", codigo: "541802", carreraId: CARRERA.ICM },
      { ramo: "Y", codigo: null, carreraId: CARRERA.ICQ },
    ].forEach((caso) => {
      const { nivel } = resolverNivel({ ...caso, indice });
      expect(nivel).toBeGreaterThanOrEqual(1);
      expect(nivel).toBeLessThanOrEqual(5);
    });
  });
});

// ── Contra las mallas reales ──────────────────────────────────────────────
const hayMallas = fs.existsSync(DIR_MALLAS);
const describeReal = hayMallas ? describe : describe.skip;

describeReal("horarioMalla — mallas reales de la Facultad", () => {
  let indice;
  let descartadas;

  beforeAll(() => {
    const archivos = fs.readdirSync(DIR_MALLAS).filter((f) => f.endsWith(".html"));
    const mallas = archivos.map((archivo) => ({
      archivo,
      html: fs.readFileSync(path.join(DIR_MALLAS, archivo), "utf8"),
    }));
    ({ indice, descartadas } = indexarMallas(mallas));
  });

  test("se indexan 7 mallas y se descartan las 2 mal etiquetadas", () => {
    expect(indice.size).toBe(7);
    expect(descartadas).toHaveLength(2);
  });

  test("cada malla de carrera trae ~50 ramos repartidos en 10 semestres", () => {
    [CARRERA.IC, CARRERA.ICB, CARRERA.ICI, CARRERA.ICEL, CARRERA.ICMET, CARRERA.ICAE].forEach((c) => {
      const idx = indice.get(c);
      expect(idx.size).toBeGreaterThan(40);
      const semestres = new Set(idx.values());
      expect(Math.max(...semestres)).toBe(10);
    });
  });

  test("Plan Común tiene los 10 ramos de primer año", () => {
    const pc = indice.get(CARRERA.ICPC);
    expect(pc.size).toBe(10);
    expect(pc.get(normalizar("Cálculo I Aplicado a la Ingeniería"))).toBe(1);
    expect(pc.get(normalizar("Cálculo II Aplicado a la Ingeniería"))).toBe(2);
  });

  test("los ramos comunes del horario resuelven a 1.er año", () => {
    ["Cálculo I Aplicado a la Ingeniería", "Álgebra I Aplicado a la Ingeniería",
      "Cálculo II Aplicado a la Ingeniería", "Álgebra II Aplicado a la Ingeniería"].forEach((ramo) => {
      const r = resolverNivel({ ramo, codigo: "500107", carreraId: CARRERA.ICINF, indice });
      expect(r).toMatchObject({ nivel: 1, confianza: "alta" });
    });
  });

  test("ramos reales de Industrial resuelven por su malla", () => {
    const casos = [["Macroeconomía", 4], ["Optimización II", 3], ["Simulación", 3]];
    casos.forEach(([ramo, anio]) => {
      const r = resolverNivel({ ramo, codigo: "580000", carreraId: CARRERA.ICI, indice });
      expect(r.confianza).toBe("alta");
      expect(r.nivel).toBe(anio);
    });
  });
});
