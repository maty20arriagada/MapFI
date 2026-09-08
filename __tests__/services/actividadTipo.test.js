"use strict";
/**
 * Clasificador de actividades. Es lo que decide si una fila de la base pasa a
 * ser certamen o tarea, asi que las pruebas cubren sobre todo los casos donde
 * equivocarse cuesta caro: falsos positivos de "certamen" (alarman al
 * estudiante y disparan la penalizacion mas alta del match) y abreviaturas
 * cortas que un regex laxo destroza.
 */
const {
  clasificar,
  planificar,
  normalizar,
  TIPO_CERTAMEN,
  TIPO_TAREA,
  TIPO_EVENTO,
} = require("../../js/services/actividadTipo");

describe("Vinculacion y Gearbox quedan como evento", () => {
  test.each(["VcM", "vcm", "GBX", "gbx"])("%s -> EVENTO sin mirar el titulo", (sigla) => {
    expect(clasificar({ titulo: "Certamen 1", entidadSigla: sigla }).tipo).toBe(TIPO_EVENTO);
  });

  test("un centro de estudiantes NO se libra por tener un titulo de evento", () => {
    expect(clasificar({ titulo: "Feria de empleabilidad", entidadSigla: "CEEMET" }).tipo).toBe(TIPO_TAREA);
  });
});

describe("titulos que SI son certamen", () => {
  test.each([
    "Certamen 1", "Certámenes", "Examen de recuperación", "Prueba parcial",
    "Test 3", "Control 2", "Evaluación global", "Evaluacion 1",
    "Solemne 2", "Interrogación oral", "Quiz sorpresa", "E. Global",
  ])("%s -> certamen", (titulo) => {
    expect(clasificar({ titulo, entidadSigla: "CEEIND" }).tipo).toBe(TIPO_CERTAMEN);
  });

  test.each(["C1", "C2", "C3", "E1", "E2", "E3", "EV1", "ER", "C 1", "Ev 2"])(
    "la abreviatura %s se reconoce", (titulo) => {
      expect(clasificar({ titulo, entidadSigla: "CEEIC" }).tipo).toBe(TIPO_CERTAMEN);
    }
  );

  test("la señal tambien vale si viene en el ramo", () => {
    // Hay filas cuyo titulo es generico y el ramo lleva la pista.
    expect(clasificar({ titulo: "Sesión", ramo: "Taller de Certamen", entidadSigla: "CEEIC" }).tipo)
      .toBe(TIPO_CERTAMEN);
  });
});

describe("falsos positivos — lo caro es marcar de mas", () => {
  test.each([
    ["Controlador lógico programable", "control dentro de otra palabra"],
    ["Charla sobre Testimonios", "test dentro de otra palabra"],
    ["Feria Interescolar", "er dentro de otra palabra"],
    ["Presentación de Ceremonia", "ce sin numero"],
  ])("%s NO es certamen (%s)", (titulo) => {
    expect(clasificar({ titulo, entidadSigla: "CEEIND" }).tipo).toBe(TIPO_TAREA);
  });
});

describe("todo lo demas es tarea, y el fallback se marca", () => {
  test.each(["Entrega informe", "Tarea 2", "Proyecto grupal", "Pitch", "Avance 1", "Trabajo final"])(
    "%s -> tarea, decision firme", (titulo) => {
      const d = clasificar({ titulo, entidadSigla: "CEEIND" });
      expect(d.tipo).toBe(TIPO_TAREA);
      expect(d.ambigua).toBe(false);
    }
  );

  test.each(["Actividad 3", "Sesión", "Charla de titulación"])(
    "%s -> tarea, pero marcada como ambigua para revisar", (titulo) => {
      const d = clasificar({ titulo, entidadSigla: "CEEIND" });
      expect(d.tipo).toBe(TIPO_TAREA);
      expect(d.ambigua).toBe(true);
    }
  );

  test("no revienta con titulo vacio ni con la actividad indefinida", () => {
    expect(clasificar({}).tipo).toBe(TIPO_TAREA);
    expect(clasificar(undefined).tipo).toBe(TIPO_TAREA);
    expect(clasificar({ titulo: null, entidadSigla: null }).tipo).toBe(TIPO_TAREA);
  });
});

describe("normalizar", () => {
  test("quita tildes y unifica mayusculas y espacios", () => {
    expect(normalizar("  Evaluación   GLOBAL ")).toBe("evaluacion global");
  });
});

describe("planificar — solo devuelve lo que cambia", () => {
  const filas = [
    { id: 1, titulo: "Certamen 1", tipo: "EVENTO", entidadSigla: "CEEMET" },
    { id: 2, titulo: "Certamen 2", tipo: "EXAMEN", entidadSigla: "CEEMET" },  // ya correcta
    { id: 3, titulo: "Entrega informe", tipo: "EVENTO", entidadSigla: "CEEMET" },
    { id: 4, titulo: "Feria de Empleabilidad", tipo: "EVENTO", entidadSigla: "VcM" }, // ya correcta
    { id: 5, titulo: "Charla de titulación", tipo: "CHARLA", entidadSigla: "CEEIND" },
  ];

  test("una fila ya bien clasificada no se toca", () => {
    const plan = planificar(filas);
    expect(plan.cambios.map((c) => c.id)).not.toContain(2);
    expect(plan.cambios.map((c) => c.id)).not.toContain(4);
    expect(plan.sinCambio).toBe(2);
  });

  test("devuelve el tipo previo, imprescindible para poder revertir", () => {
    const plan = planificar(filas);
    const c1 = plan.cambios.find((c) => c.id === 1);
    expect(c1.tipoPrevio).toBe("EVENTO");
    expect(c1.tipoNuevo).toBe(TIPO_CERTAMEN);
  });

  test("una CHARLA de un centro se convierte: es la regla acordada", () => {
    const plan = planificar(filas);
    const c5 = plan.cambios.find((c) => c.id === 5);
    expect(c5.tipoPrevio).toBe("CHARLA");
    expect(c5.tipoNuevo).toBe(TIPO_TAREA);
  });

  test("no muta la entrada", () => {
    const copia = JSON.parse(JSON.stringify(filas));
    planificar(filas);
    expect(filas).toEqual(copia);
  });

  test("lista vacia o indefinida no revienta", () => {
    expect(planificar([]).cambios).toEqual([]);
    expect(planificar(undefined).cambios).toEqual([]);
  });
});
