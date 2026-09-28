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

describe("contraste de la paleta (WCAG AA)", () => {
  // En vista mes el evento es un bloque solido con texto BLANCO encima, asi
  // que cada color de relleno tiene que dar >= 4.5:1 contra blanco. Medido en
  // el navegador: de 4.83:1 (rojo del certamen) a 7.10:1 (violeta del hito).
  const luminancia = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contraMasBlanco = (hex) => 1.05 / (luminancia(hex) + 0.05);

  test.each(Object.entries(COLOR_TIPO))("%s (%s) cumple AA sobre texto blanco", (tipo, hex) => {
    expect(contraMasBlanco(hex)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("aviso de verificacion (Spec 006, US2)", () => {
  // Las actividades las cargan los centros, muchas veces convertidas con IA
  // desde un PDF: sin el aviso, un error de carga se lee como fecha oficial.
  const { htmlAviso } = require("../js/calendar-view");

  test("dice lo acordado: lo publican los centros, puede tener errores, verificar", () => {
    const h = htmlAviso();
    expect(h).toMatch(/publican los centros de estudiantes/);
    expect(h).toMatch(/pueden contener errores/);
    expect(h).toMatch(/confírmala con tu profesor o con el programa de la asignatura/);
  });

  test("es una nota, no una alerta: no interrumpe al lector de pantalla en cada carga", () => {
    expect(htmlAviso()).toMatch(/role="note"/);
    expect(htmlAviso()).not.toMatch(/role="alert"/);
  });

  test("siempre visible: no trae boton de cierre", () => {
    expect(htmlAviso()).not.toMatch(/<button/i);
  });

  test("icono SVG del sistema, sin emoji (constitucion VI)", () => {
    expect(htmlAviso()).toMatch(/data-icon="info"/);
    expect(htmlAviso()).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("iconos usados por las paginas", () => {
  // icons.js devuelve "" ante un nombre desconocido para no romper el layout.
  // Eso es robusto pero silencioso: la portada llevaba tiempo mostrando
  // "Acerca de MapFI" sin icono porque "info" no existia.
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  const RAIZ = path.join(__dirname, "..");

  function cargarIcons() {
    const ctx = { window: {}, document: { readyState: "complete", querySelectorAll: () => [] } };
    vm.runInNewContext(fs.readFileSync(path.join(RAIZ, "js/icons.js"), "utf8"), ctx);
    return ctx.window.Icons;
  }

  test("existe el icono del aviso", () => {
    expect(cargarIcons().has("info")).toBe(true);
  });

  test("todo data-icon de las paginas HTML existe en icons.js", () => {
    const Icons = cargarIcons();
    const faltan = [];
    fs.readdirSync(RAIZ).filter((f) => f.endsWith(".html")).forEach((f) => {
      const html = fs.readFileSync(path.join(RAIZ, f), "utf8");
      for (const m of html.matchAll(/data-icon="([a-z0-9-]+)"/g)) {
        if (!Icons.has(m[1])) faltan.push(f + ": " + m[1]);
      }
    });
    expect(faltan).toEqual([]);
  });
});
