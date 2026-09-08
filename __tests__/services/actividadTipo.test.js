"use strict";
/**
 * Reordenador de actividades ya cargadas.
 *
 * Los casos salen de los 58 titulos REALES que habia en la base el
 * 2026-09-07, no de ejemplos inventados: el centro de Metalurgia usa una
 * convencion de sufijos y un clasificador por palabras clave fallaba en 42 de
 * las 51 filas. Estas pruebas fijan esa convencion.
 */
const {
  analizar,
  planificar,
  normalizar,
  TIPO_CERTAMEN,
  TIPO_TAREA,
  TIPO_EVENTO,
} = require("../../js/services/actividadTipo");

const met = (titulo, extra) => Object.assign({ titulo, tipo: "EVENTO", entidadSigla: "CEEMET" }, extra || {});

describe("la convencion de sufijos de Metalurgia", () => {
  test.each([
    ["Topografía", TIPO_CERTAMEN, "Topografía", "Certamen"],
    ["Cielo abierto", TIPO_CERTAMEN, "Cielo abierto", "Certamen"],
    ["Mineralogía aplicada a la metalurgia", TIPO_CERTAMEN, "Mineralogía aplicada a la metalurgia", "Certamen"],
    ["Topografía TEST", TIPO_TAREA, "Topografía", "Test"],
    ["Hidrometalurgia TEST", TIPO_TAREA, "Hidrometalurgia", "Test"],
    ["Física II EX", TIPO_CERTAMEN, "Física II", "Examen"],
    ["Química II EX", TIPO_CERTAMEN, "Química II", "Examen"],
    ["Dibujo asistido por computadora TAREA", TIPO_TAREA, "Dibujo asistido por computadora", "Tarea"],
  ])("%s -> %s, ramo %s, etiqueta %s", (titulo, tipo, ramo, etiqueta) => {
    const p = analizar(met(titulo));
    expect(p.tipo).toBe(tipo);
    expect(p.ramo).toBe(ramo);
    expect(p.etiqueta).toBe(etiqueta);
  });

  test("el sufijo va ANCLADO al final: 'Metalurgia extractiva' no es un EX", () => {
    // Sin el ancla, /EX/ pescaria "extractiva" y convertiria un certamen en
    // examen. Es el falso positivo mas facil de introducir aqui.
    const p = analizar(met("Metalurgia extractiva"));
    expect(p.etiqueta).toBe("Certamen");
    expect(p.ramo).toBe("Metalurgia extractiva");
  });

  test.each(["Metalurgia extractiva TEST", "Flotación TEST"])(
    "%s si lleva el sufijo, y el ramo queda limpio", (titulo) => {
      const p = analizar(met(titulo));
      expect(p.etiqueta).toBe("Test");
      expect(p.ramo).not.toMatch(/TEST/);
    }
  );

  test("el sufijo no distingue mayusculas ni sobra el espacio", () => {
    expect(analizar(met("Topografía test ")).etiqueta).toBe("Test");
    expect(analizar(met("Física II ex")).etiqueta).toBe("Examen");
  });
});

describe("lo que NO se toca", () => {
  test.each(["VcM", "GBX", "vcm"])("%s queda como evento, sin mirar el titulo", (sigla) => {
    const p = analizar({ titulo: "Certamen 1", tipo: "EVENTO", entidadSigla: sigla });
    expect(p.accion).toBe("respetar");
    expect(p.tipo).toBe(TIPO_EVENTO);
  });

  test.each(["ENTREGA", "CHARLA", "TALLER", "EXAMEN", "EXTRAPROGRAMATICA", "HITO_ACADEMICO"])(
    "una fila ya clasificada a mano como %s se respeta", (tipo) => {
      // "Introduccion a la sustentabilidad" ya era ENTREGA y "Geologia y
      // Mineralogia" ya era CHARLA: alguien lo decidio sabiendo algo que el
      // titulo no dice.
      const p = analizar(met("Introducción a la sustentabilidad", { tipo }));
      expect(p.accion).toBe("respetar");
      expect(p.tipo).toBe(tipo);
    }
  );

  test("solo se reordena lo que quedo como EVENTO", () => {
    expect(analizar(met("Topografía")).accion).toBe("reclasificar");
  });
});

describe("numeracion de repeticiones", () => {
  const cuatroTopografias = [
    met("Topografía", { id: 4, fechaInicio: "2026-12-01" }),
    met("Topografía", { id: 1, fechaInicio: "2026-09-01" }),
    met("Topografía", { id: 3, fechaInicio: "2026-11-01" }),
    met("Topografía", { id: 2, fechaInicio: "2026-10-01" }),
  ];

  test("numera por FECHA, no por el orden de llegada", () => {
    const { cambios } = planificar(cuatroTopografias);
    const porId = Object.fromEntries(cambios.map((c) => [c.id, c.tituloNuevo]));
    expect(porId[1]).toBe("Certamen 1");
    expect(porId[2]).toBe("Certamen 2");
    expect(porId[3]).toBe("Certamen 3");
    expect(porId[4]).toBe("Certamen 4");
  });

  test("certamenes y tests del mismo ramo se numeran por separado", () => {
    const { cambios } = planificar([
      met("Topografía", { id: 1, fechaInicio: "2026-09-01" }),
      met("Topografía", { id: 2, fechaInicio: "2026-10-01" }),
      met("Topografía TEST", { id: 3, fechaInicio: "2026-09-15" }),
      met("Topografía TEST", { id: 4, fechaInicio: "2026-10-15" }),
    ]);
    const porId = Object.fromEntries(cambios.map((c) => [c.id, c.tituloNuevo]));
    expect(porId[1]).toBe("Certamen 1");
    expect(porId[3]).toBe("Test 1");
    expect(porId[4]).toBe("Test 2");
  });

  test("si solo hay uno, no se numera", () => {
    const { cambios } = planificar([met("Metalurgia extractiva TEST", { id: 9, fechaInicio: "2026-09-01" })]);
    expect(cambios[0].tituloNuevo).toBe("Test");
  });

  test("agrupa aunque el ramo difiera en tildes o espacios", () => {
    const { cambios } = planificar([
      met("Topografía", { id: 1, fechaInicio: "2026-09-01" }),
      met("Topografia", { id: 2, fechaInicio: "2026-10-01" }),
      met("Topografía  ", { id: 3, fechaInicio: "2026-11-01" }),
    ]);
    expect(cambios.map((c) => c.tituloNuevo).sort()).toEqual(["Certamen 1", "Certamen 2", "Certamen 3"]);
  });

  test("fechas iguales: desempata por id, sin quedar indefinido", () => {
    const { cambios } = planificar([
      met("Flotación", { id: 20, fechaInicio: "2026-09-01" }),
      met("Flotación", { id: 10, fechaInicio: "2026-09-01" }),
    ]);
    const porId = Object.fromEntries(cambios.map((c) => [c.id, c.tituloNuevo]));
    expect(porId[10]).toBe("Certamen 1");
    expect(porId[20]).toBe("Certamen 2");
  });
});

describe("planificar — lo que necesita el script", () => {
  const muestra = [
    met("Topografía", { id: 1, fechaInicio: "2026-09-01" }),
    met("Topografía TEST", { id: 2, fechaInicio: "2026-09-15" }),
    met("Física II EX", { id: 3, fechaInicio: "2026-12-20" }),
    met("Introducción a la sustentabilidad", { id: 4, tipo: "ENTREGA", fechaInicio: "2026-09-08" }),
    met("Geología y Mineralogía", { id: 5, tipo: "CHARLA", fechaInicio: "2026-09-09" }),
    { id: 6, titulo: "Feria de Empleabilidad", tipo: "EVENTO", entidadSigla: "VcM", fechaInicio: "2026-09-07" },
    { id: 7, titulo: "Certamen 1 - Cálculo I", tipo: "EXAMEN", entidadSigla: "DOCFI", fechaInicio: "2026-09-11" },
  ];

  test("separa lo que cambia de lo que se respeta", () => {
    const p = planificar(muestra);
    expect(p.cambios.map((c) => c.id).sort()).toEqual([1, 2, 3]);
    expect(p.respetadas.map((r) => r.id).sort()).toEqual([4, 5, 6, 7]);
  });

  test("conserva los valores previos: sin ellos no hay reversion", () => {
    const c = planificar(muestra).cambios.find((x) => x.id === 2);
    expect(c.tipoPrevio).toBe("EVENTO");
    expect(c.tituloPrevio).toBe("Topografía TEST");
    expect(c.ramoPrevio).toBeNull();
    expect(c.tipoNuevo).toBe(TIPO_TAREA);
    expect(c.ramoNuevo).toBe("Topografía");
    expect(c.tituloNuevo).toBe("Test");
  });

  test("no muta la entrada", () => {
    const copia = JSON.parse(JSON.stringify(muestra));
    planificar(muestra);
    expect(muestra).toEqual(copia);
  });

  test("lista vacia o indefinida no revienta", () => {
    expect(planificar([]).cambios).toEqual([]);
    expect(planificar(undefined).cambios).toEqual([]);
  });

  test("titulo vacio o actividad indefinida no revientan", () => {
    expect(() => analizar({})).not.toThrow();
    expect(() => analizar(undefined)).not.toThrow();
    expect(analizar({ titulo: "", tipo: "EVENTO" }).tipo).toBe(TIPO_CERTAMEN);
  });
});

describe("normalizar", () => {
  test("quita tildes y unifica mayusculas y espacios", () => {
    expect(normalizar("  Topografía   II ")).toBe("topografia ii");
  });
});
