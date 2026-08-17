"use strict";

const fs = require("fs");
const path = require("path");
const { carrerasDe, normalizar, CARRERA, TODAS_LAS_CARRERAS } = require("../../js/services/horarioCarrera");
const { parsearArchivoFI } = require("../../js/services/horarioFiParser");

describe("horarioCarrera — cada prefijo va a su carrera", () => {
  test.each([
    ["501203", "Programación de Computadores", CARRERA.ICINF, "Informática"],
    ["503307", "Bases de Datos I", CARRERA.ICINF, "Informática"],
    ["540110", "Introduccion a los Bioprocesos", CARRERA.ICQ, "Química"],
    ["541126", "Comunicación Gráfica", CARRERA.ICM, "Mecánica"],
    ["542253", "Fenómenos de Transporte", CARRERA.ICMET, "Metalúrgica"],
    ["543201", "Electromagnetismo", CARRERA.ICE, "Eléctrica"],
    ["544499", "Memoria de Título", CARRERA.IC, "Civil"],
    ["554033", "Hidráulica", CARRERA.IC, "Civil"],
    ["546101", "Gestión de Empresas", CARRERA.ICI, "Industrial"],
    ["580321", "Administración", CARRERA.ICI, "Industrial"],
    ["547243", "Microelectronica", CARRERA.ICEL, "Electrónica"],
    ["548256", "Termodinámica de Materiales", CARRERA.ICMAT, "Materiales"],
    ["549252", "Análisis de Fourier para Telecomunicaciones", CARRERA.ICT, "Telecomunicaciones"],
    ["550155", "Introducción a los Sistemas de Información en Salud", CARRERA.ICB, "Biomédica"],
    ["551321", "Metalurgia Extractiva", CARRERA.ICMIN, "Minas"],
  ])("%s (%s) → %s", (codigo, ramo, esperado) => {
    const r = carrerasDe(codigo, ramo);
    expect(r.carreras).toEqual([esperado]);
    expect(r.confianza).toBe("alta");
  });
});

describe("horarioCarrera — ramos comunes van a las 14 carreras", () => {
  test.each([
    ["500107", "Cálculo I Aplicado a la Ingeniería"],
    ["500118", "Álgebra II Aplicado a la Ingeniería"],
    ["500701", "Inglés Comunicativo 1 Nivel Principiante"],
  ])("%s se replica en las 14", (codigo, ramo) => {
    const r = carrerasDe(codigo, ramo);
    expect(r.esComun).toBe(true);
    expect(r.carreras).toHaveLength(14);
    expect(new Set(r.carreras)).toEqual(new Set(TODAS_LAS_CARRERAS));
  });

  test("Plan Común está incluido entre las 14", () => {
    expect(carrerasDe("500107", "Cálculo I").carreras).toContain(CARRERA.ICPC);
  });
});

describe("horarioCarrera — Aeroespacial se separa de Mecánica dentro del 541", () => {
  test.each([
    "Estructuras Aeroespaciales",
    "Fundamentos de Ingeniería de Sistemas Aeroespaciales",
    "Mecánica del Vuelo",
    "Propulsión De Cohetes",
  ])("'%s' → Aeroespacial", (ramo) => {
    expect(carrerasDe("541242", ramo).carreras).toEqual([CARRERA.ICAE]);
  });

  test.each([
    "Comunicación Gráfica",
    "Termodinámica",
    "Elementos de Máquinas",
    "Soldadura",
  ])("'%s' → Mecánica", (ramo) => {
    expect(carrerasDe("541203", ramo).carreras).toEqual([CARRERA.ICM]);
  });

  test("un ramo de la malla de Aeroespacial se detecta con confianza alta", () => {
    const malla = new Set([normalizar("Diseño de Aeronaves")]);
    const r = carrerasDe("541500", "Diseño de Aeronaves", { ramosAeroespacial: malla });
    expect(r.carreras).toEqual([CARRERA.ICAE]);
    expect(r.confianza).toBe("alta");
  });

  test("detectado solo por el nombre, la confianza baja a media", () => {
    expect(carrerasDe("541242", "Estructuras Aeroespaciales").confianza).toBe("media");
  });
});

describe("horarioCarrera — registros sin código (T-2)", () => {
  test("usa el código heredado del vecino de su bloque", () => {
    const r = carrerasDe(null, "Comportamiento Organizacional", { codigoHeredado: "546101" });
    expect(r.carreras).toEqual([CARRERA.ICI]);
    expect(r.confianza).toBe("media");
  });

  test("T-1: 'Ciencia de Materiales' hereda 548xxx y NO cae en Química", () => {
    const r = carrerasDe(null, "Ciencia de Materiales", { codigoHeredado: "548256" });
    expect(r.carreras).toEqual([CARRERA.ICMAT]);
    expect(r.carreras).not.toContain(CARRERA.ICQ);
  });

  test("sin código ni herencia no inventa una carrera", () => {
    const r = carrerasDe(null, "Ramo huérfano");
    expect(r.carreras).toEqual([]);
    expect(r.confianza).toBe("baja");
  });
});

describe("horarioCarrera — prefijo desconocido", () => {
  test("no asigna carrera y lo marca de confianza baja", () => {
    const r = carrerasDe("999999", "Ramo inventado");
    expect(r.carreras).toEqual([]);
    expect(r.confianza).toBe("baja");
  });
});

describe("horarioCarrera — normalizar", () => {
  test("quita tildes, baja a minúsculas y colapsa espacios", () => {
    expect(normalizar("  Cálculo   I  Aplicado ")).toBe("calculo i aplicado");
    expect(normalizar("Memoria de Título")).toBe(normalizar("Memoria de Titulo"));
    expect(normalizar("Práctica Laboral")).toBe(normalizar("Practica Laboral"));
  });
});

// ── Contra el archivo real ────────────────────────────────────────────────
const RUTA_REAL = path.join(__dirname, "..", "..", "Extras", "Horarios_FI_UDEC.txt");
const describeReal = fs.existsSync(RUTA_REAL) ? describe : describe.skip;

describeReal("horarioCarrera — cobertura sobre el archivo real", () => {
  let registros;
  beforeAll(() => {
    registros = parsearArchivoFI(fs.readFileSync(RUTA_REAL, "utf8")).registros;
  });

  test("todo registro con sesiones recibe al menos una carrera", () => {
    const huerfanos = registros
      .filter((r) => r.sesiones.length)
      .filter((r) => carrerasDe(r.codigo, r.ramo, { codigoHeredado: r.codigoHeredado }).carreras.length === 0);
    expect(huerfanos.map((r) => `${r.nroLinea}: ${r.codigo || "(sin código)"} ${r.ramo}`)).toEqual([]);
  });

  test("las 14 carreras de MapFI reciben al menos un ramo", () => {
    const conRamos = new Set();
    registros.forEach((r) => {
      carrerasDe(r.codigo, r.ramo, { codigoHeredado: r.codigoHeredado })
        .carreras.forEach((c) => conRamos.add(c));
    });
    const faltantes = TODAS_LAS_CARRERAS.filter((c) => !conRamos.has(c));
    expect(faltantes).toEqual([]);
  });

  test("Materiales recibe sus ramos pese a estar en el bloque sin encabezado", () => {
    const deMateriales = registros.filter((r) =>
      carrerasDe(r.codigo, r.ramo, { codigoHeredado: r.codigoHeredado }).carreras.includes(CARRERA.ICMAT)
    );
    expect(deMateriales.length).toBeGreaterThanOrEqual(19);
    expect(deMateriales.map((r) => r.ramo)).toContain("Termodinámica de Materiales");
  });

  test("ningún ramo de Minas termina en Metalúrgica", () => {
    const minas = registros.filter((r) => r.codigo && r.codigo.startsWith("551"));
    expect(minas.length).toBeGreaterThan(0);
    minas.forEach((r) => {
      expect(carrerasDe(r.codigo, r.ramo).carreras).toEqual([CARRERA.ICMIN]);
    });
  });

  test("ningún ramo de Biomédica ni Telecom termina en Eléctrica", () => {
    registros.filter((r) => r.codigo && r.codigo.startsWith("550"))
      .forEach((r) => expect(carrerasDe(r.codigo, r.ramo).carreras).toEqual([CARRERA.ICB]));
    registros.filter((r) => r.codigo && r.codigo.startsWith("549"))
      .forEach((r) => expect(carrerasDe(r.codigo, r.ramo).carreras).toEqual([CARRERA.ICT]));
  });
});
