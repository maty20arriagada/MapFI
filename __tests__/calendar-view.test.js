"use strict";
/**
 * `js/calendar-view.js` no tenia ninguna prueba. Se cubren las dos piezas que
 * se pueden probar sin DOM: la composicion de la etiqueta del evento y el
 * interruptor de las señales de choque.
 *
 * Contexto: tras cargar el semestre de Industrial habia 23 actividades
 * tituladas "Certamen 1" y 22 "Certamen 2". El ramo ya venia en el JSON de
 * /api/actividades; nadie lo pintaba.
 */
const {
  etiquetaEvento,
  COLOR_TIPO,
  NOMBRE_TIPO,
  ALERTAS_CHOQUE,
} = require("../js/calendar-view");

describe("etiquetaEvento — el ramo identifica la evaluacion", () => {
  test("con ramo y titulo: los separa y compone la version plana", () => {
    const e = etiquetaEvento({ ramo: "Cálculo II", titulo: "Certamen 1" });
    expect(e.ramo).toBe("Cálculo II");
    expect(e.titulo).toBe("Certamen 1");
    expect(e.plano).toBe("Cálculo II · Certamen 1");
  });

  test("sin ramo: el titulo queda solo, sin separador colgando", () => {
    const e = etiquetaEvento({ titulo: "Feria de Empleabilidad" });
    expect(e.ramo).toBeNull();
    expect(e.plano).toBe("Feria de Empleabilidad");
  });

  test("ramo vacio o solo espacios cuenta como ausente", () => {
    expect(etiquetaEvento({ ramo: "   ", titulo: "Certamen 1" }).ramo).toBeNull();
    expect(etiquetaEvento({ ramo: "", titulo: "Certamen 1" }).plano).toBe("Certamen 1");
  });

  test("recorta los espacios sobrantes de la planilla", () => {
    const e = etiquetaEvento({ ramo: "  Física II  ", titulo: "  Certamen 2  " });
    expect(e.plano).toBe("Física II · Certamen 2");
  });

  test("no revienta con la actividad vacia ni con undefined", () => {
    expect(etiquetaEvento({}).plano).toBe("");
    expect(etiquetaEvento(undefined).plano).toBe("");
    expect(etiquetaEvento(null).ramo).toBeNull();
  });

  test("solo ramo, sin titulo: devuelve el ramo en vez de un separador suelto", () => {
    expect(etiquetaEvento({ ramo: "Termodinámica" }).plano).toBe("Termodinámica");
  });

  test("devuelve texto plano, sin HTML: el escapado es de quien lo pinta", () => {
    // eventContent usa textContent y el .ics pasa por escaparTexto; aqui solo
    // se comprueba que la funcion no inventa marcado por su cuenta.
    const e = etiquetaEvento({ ramo: '<b>x</b>', titulo: '"Certamen"' });
    expect(e.plano).toBe('<b>x</b> · "Certamen"');
  });
});

describe("señales de choque — apagadas a la espera de la proxima iteracion", () => {
  test("el interruptor esta en false", () => {
    // Si esto falla es que alguien reactivo las alertas. Es un booleano y es
    // reversible a proposito; la prueba solo obliga a que sea deliberado.
    expect(ALERTAS_CHOQUE).toBe(false);
  });
});

describe("paleta por tipo", () => {
  test("cada tipo tiene color y nombre legible", () => {
    Object.keys(NOMBRE_TIPO).forEach((t) => {
      expect(COLOR_TIPO[t]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(typeof NOMBRE_TIPO[t]).toBe("string");
      expect(NOMBRE_TIPO[t].length).toBeGreaterThan(0);
    });
  });

  test("los 7 colores son distintos entre si", () => {
    // Antes habia dos violetas casi identicos (HITO vs ENTREGA) y dos verdes
    // casi identicos (EXTRAPROGRAMATICA vs TALLER).
    const usados = Object.values(COLOR_TIPO);
    expect(new Set(usados).size).toBe(usados.length);
  });

  test("ningun tipo usa el naranja reservado al choque", () => {
    // CHARLA era #F59E0B, el mismo naranja del borde de conflicto: una charla
    // con choque no se distinguia de una sin el.
    expect(Object.values(COLOR_TIPO).map((c) => c.toUpperCase())).not.toContain("#F59E0B");
  });

  test("el certamen sigue siendo rojo: es lo que mas se consulta", () => {
    expect(COLOR_TIPO.EXAMEN).toBe("#DC2626");
  });
});
