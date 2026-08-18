"use strict";
/**
 * Guard de FR-006 (Spec 004): si el modulo de geometria no esta cargado, la
 * vista DEBE decir que paso en vez de morir en silencio.
 *
 * Por que existe esta prueba: en produccion `horarios.html` pedia
 * js/services/horarioService.js, que server.js bloquea con 404 (SEG-2). El
 * modulo quedaba indefinido y `HS().geometria(...)` lanzaba un TypeError que
 * nadie veia: la pagina simplemente no dibujaba nada. Se arreglo la causa
 * (el modulo vive ahora en js/shared/), pero un fallo de carga puede volver por
 * otra via — red caida, error de sintaxis, un despliegue a medias — y entonces
 * el sintoma tiene que ser legible sin abrir DevTools.
 *
 * Se prueba sin jsdom: el proyecto corre Jest en entorno `node` y no hay
 * dependencia de DOM (Principio I). Al guard le basta un objeto con
 * `innerHTML`, porque no toca nada mas del elemento.
 */

const { montar } = require("../js/horarios-view");

/** Lo minimo que el guard necesita de un contenedor. */
function elFalso() {
  return { innerHTML: "" };
}

const RUTA = "js/shared/horarioService.js";
const SELECCION_COMPLETA = { carreraId: 1, nivel: 1 };
const SIN_SELECCION = { carreraId: null, nivel: null };

/** Silencia console.error y devuelve lo que se registro. */
function capturarErrores() {
  const capturado = [];
  const original = console.error;
  console.error = (...args) => capturado.push(args.join(" "));
  return { capturado, restaurar: () => { console.error = original; } };
}

describe("horarios-view — guard cuando falta HorarioService (FR-006)", () => {
  let cap;

  beforeEach(() => {
    delete globalThis.HorarioService;
    cap = capturarErrores();
  });

  afterEach(() => {
    cap.restaurar();
    delete globalThis.HorarioService;
  });

  test("no lanza: la promesa se resuelve en vez de reventar", async () => {
    await expect(montar(elFalso(), SELECCION_COMPLETA, {})).resolves.toBeDefined();
  });

  test("deja un mensaje visible, no una zona en blanco", async () => {
    const el = elFalso();
    await montar(el, SELECCION_COMPLETA, {});
    expect(el.innerHTML).not.toBe("");
    const texto = el.innerHTML.toLowerCase();
    expect(texto).toContain("no se pudo cargar");
    expect(texto).toContain("recarga");
  });

  test("registra en consola la ruta que no cargo, para poder diagnosticarlo", async () => {
    await montar(elFalso(), SELECCION_COMPLETA, {});
    expect(cap.capturado.join("\n")).toContain(RUTA);
  });

  test("devuelve la forma vacia esperada, asi la pagina no rompe al leerla", async () => {
    const r = await montar(elFalso(), SELECCION_COMPLETA, {});
    expect(r).toMatchObject({ secciones: [], ramos: [], carreras: [] });
  });

  test("avisa desde el primer render, sin esperar a que se elija carrera", async () => {
    // Es la leccion del incidente: el usuario eligio carrera y año, pulso el
    // boton y no paso nada. Si la pagina esta rota conviene decirlo YA, no tras
    // rellenar los filtros.
    const el = elFalso();
    await montar(el, SIN_SELECCION, {});
    expect(el.innerHTML.toLowerCase()).toContain("no se pudo cargar");
  });
});

describe("horarios-view — el guard no se dispara si el modulo esta", () => {
  let cap;

  beforeEach(() => {
    // Solo hace falta que exista: la peticion de bloques falla despues (no hay
    // `api` global en Node), y eso es justo lo que distingue los dos caminos.
    globalThis.HorarioService = { geometria: (b) => b, HORA_INICIO: 480, PASO: 15 };
    cap = capturarErrores();
  });

  afterEach(() => {
    cap.restaurar();
    delete globalThis.HorarioService;
  });

  test("con seleccion completa el fallo es el de la peticion, no el del modulo", async () => {
    const el = elFalso();
    await montar(el, SELECCION_COMPLETA, {});
    expect(el.innerHTML.toLowerCase()).toContain("no se pudo cargar el horario");
    expect(el.innerHTML).not.toContain(RUTA);
  });

  test("sin seleccion sigue pidiendo elegir carrera y año", async () => {
    const el = elFalso();
    await montar(el, SIN_SELECCION, {});
    const texto = el.innerHTML.toLowerCase();
    expect(texto).toContain("carrera");
    expect(texto).toContain("año");
    expect(el.innerHTML).not.toContain(RUTA);
  });
});
