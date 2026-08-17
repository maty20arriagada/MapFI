"use strict";
/**
 * horarioMalla — resuelve a que ANIO de carrera pertenece cada ramo.
 *
 * Servicio PURO (Principio II). Solo Node (lo usa js/db/importar-horarios.js).
 *
 * EL PROBLEMA: `bloque_horario.nivel` es NOT NULL (1..5) pero el archivo de
 * horarios de la Facultad no dice el anio de ningun ramo, y las mallas HTML no
 * traen codigos de asignatura — solo `nombre -> anio -> semestre`. No hay una
 * fuente que cruce ambas cosas.
 *
 * LA SOLUCION (aprobada por el usuario: "mejor esfuerzo + marcar dudosos") es
 * una cascada de tres niveles, cada uno con su confianza declarada, para que
 * el informe de revision liste exactamente que hay que corregir a mano:
 *
 *   1. alta  — el nombre del ramo esta en la malla DE SU CARRERA.
 *   2. media — el 4.o digito del codigo indica el avance de carrera.
 *   3. baja  — no se pudo determinar; se asume 1.er anio y se reporta.
 *
 * El paso 1 se consulta dentro de la carrera porque el mismo nombre cae en
 * semestres distintos segun la carrera ("Mecanica" es SEM IV en Industrial y
 * SEM V en Biomedica).
 *
 * MALLAS DESCARTADAS: dos archivos estan mal etiquetados (verificado ramo a
 * ramo) — "Malla Curricular - Ingenieria Civil.html" contiene en realidad
 * Industrial, y "Malla ingenieria civil informatica.html" contiene en realidad
 * Metalurgica. Se ignoran los dos; Informatica se queda sin malla y su anio
 * sale del codigo.
 */

const { CARRERA, normalizar } = require("./horarioCarrera");

const NIVEL_MIN = 1;
const NIVEL_MAX = 5;

/** Archivo de malla -> carrera de MapFI. Solo las 7 verificadas como correctas. */
const MALLAS_VALIDAS = {
  "Malla Ingenieria civil.html": CARRERA.IC,
  "Malla ingenieria cilvil aeroespacial.html": CARRERA.ICAE,
  "Malla ingenieria civil biomedica.html": CARRERA.ICB,
  "Malla ingenieria civil electronica.html": CARRERA.ICEL,
  "Malla ingenieria civil metalurgica.html": CARRERA.ICMET,
  "Malla ingeniería civil industrial.html": CARRERA.ICI,
  "Malla ingenieria plan común.html": CARRERA.ICPC,
};

/**
 * Archivos descartados y por que. Se listan explicitamente para que nadie los
 * vuelva a incluir por el nombre sin revisar el contenido.
 */
const MALLAS_DESCARTADAS = {
  "Malla Curricular - Ingeniería Civil.html":
    "su contenido es Industrial (difiere en 1 de 52 ramos del archivo de industrial)",
  "Malla ingenieria civil informatica.html":
    "su contenido es Metalúrgica (50 de 52 ramos idénticos; su propio <title> lo delata)",
};

const ROMANOS = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

const RE_SEMESTRE = /class="semestre-title"\s*>\s*SEM\s+([IVX]+)\s*</gi;
const RE_RAMO = /class="ramo-header"[\s\S]{0,80}?<span>([\s\S]*?)<\/span>/gi;

/** semestre 1..10 -> anio 1..5. SEM I y II son 1.er anio, III y IV el 2.o, etc. */
function semestreANivel(semestre) {
  return Math.min(NIVEL_MAX, Math.max(NIVEL_MIN, Math.ceil(semestre / 2)));
}

/** Quita etiquetas y entidades HTML de un fragmento de texto. */
function limpiarHtml(s) {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Indexa UNA malla: recorre el HTML en orden documental llevando el semestre
 * actual, y asocia cada ramo al semestre en que aparece.
 * @param {string} html
 * @returns {Map<string, number>} nombre normalizado -> semestre (1..10)
 */
function indexarMalla(html) {
  const indice = new Map();
  const texto = String(html);

  // Se recogen todas las marcas (semestre y ramo) con su posicion y se
  // recorren ordenadas: cada ramo pertenece al ultimo semestre que lo precede.
  const marcas = [];
  let m;

  RE_SEMESTRE.lastIndex = 0;
  while ((m = RE_SEMESTRE.exec(texto)) !== null) {
    const semestre = ROMANOS[m[1].toUpperCase()];
    if (semestre) marcas.push({ pos: m.index, tipo: "semestre", valor: semestre });
  }

  RE_RAMO.lastIndex = 0;
  while ((m = RE_RAMO.exec(texto)) !== null) {
    const nombre = limpiarHtml(m[1]);
    if (nombre) marcas.push({ pos: m.index, tipo: "ramo", valor: nombre });
  }

  marcas.sort((a, b) => a.pos - b.pos);

  let semestreActual = null;
  marcas.forEach((marca) => {
    if (marca.tipo === "semestre") { semestreActual = marca.valor; return; }
    if (!semestreActual) return;
    const clave = normalizar(marca.valor);
    // Si un ramo aparece dos veces, gana el semestre mas temprano: es cuando
    // le toca al alumno que va al dia.
    if (!indice.has(clave) || indice.get(clave) > semestreActual) {
      indice.set(clave, semestreActual);
    }
  });

  return indice;
}

/**
 * Indexa todas las mallas validas.
 * @param {Array<{archivo: string, html: string}>} mallas
 * @returns {{indice: Map<number, Map<string, number>>, descartadas: string[]}}
 */
function indexarMallas(mallas) {
  const indice = new Map();
  const descartadas = [];

  (mallas || []).forEach(({ archivo, html }) => {
    if (MALLAS_DESCARTADAS[archivo]) {
      descartadas.push(`${archivo} — ${MALLAS_DESCARTADAS[archivo]}`);
      return;
    }
    const carreraId = MALLAS_VALIDAS[archivo];
    if (!carreraId) { descartadas.push(`${archivo} — archivo no reconocido`); return; }
    indice.set(carreraId, indexarMalla(html));
  });

  return { indice, descartadas };
}

/**
 * Nivel deducido del 4.o digito del codigo (confianza media).
 * Verificado sobre el archivo real: 541126 Comunicacion Grafica(1) ->
 * 541202 Mecanica(2) -> 541352 Integracion CDIO(3) -> 541408 Centrales(4) ->
 * 541562 Habilidades Directivas(5) -> 541690 Practica Profesional(6) ->
 * 5417xx/5418xx electivos avanzados.
 *
 * NO aplica al prefijo 500: alli el 4.o digito es TEMATICO, no de nivel
 * (5001=matematicas, 5005=quimica, 5006=comunicacion, 5007=ingles), asi que
 * Calculo I y Calculo II comparten el 1 sin ser ambos de primer anio.
 */
function nivelPorCodigo(codigo) {
  if (!codigo || !/^\d{6}$/.test(codigo)) return null;
  if (codigo.startsWith("500")) return null; // prefijo comun: sin senal de nivel
  const d = parseInt(codigo[3], 10);
  if (isNaN(d)) return null;
  if (d <= 1) return 1;
  if (d >= 5) return 5; // 5, 6 (memorias/practicas), 7 y 8 (electivos) = ultimo anio
  return d;
}

/**
 * Resuelve el anio de un ramo aplicando la cascada.
 * @param {object} args
 * @param {string} args.ramo
 * @param {string|null} args.codigo
 * @param {number} args.carreraId
 * @param {Map<number, Map<string,number>>} args.indice
 * @returns {{nivel: number, confianza: "alta"|"media"|"baja", fuente: string}}
 */
function resolverNivel({ ramo, codigo, carreraId, indice }) {
  const clave = normalizar(ramo);

  // 1) La malla de su propia carrera.
  const deSuCarrera = indice && indice.get(carreraId);
  if (deSuCarrera && deSuCarrera.has(clave)) {
    const semestre = deSuCarrera.get(clave);
    return { nivel: semestreANivel(semestre), confianza: "alta", fuente: `malla (SEM ${semestre})` };
  }

  // 1b) Para los ramos comunes, la malla de Plan Comun sirve para cualquier
  // carrera: son los mismos ramos en el mismo anio.
  const planComun = indice && indice.get(CARRERA.ICPC);
  if (planComun && planComun.has(clave)) {
    const semestre = planComun.get(clave);
    return { nivel: semestreANivel(semestre), confianza: "alta", fuente: `malla Plan Común (SEM ${semestre})` };
  }

  // 2) El 4.o digito del codigo.
  const porCodigo = nivelPorCodigo(codigo);
  if (porCodigo) {
    return { nivel: porCodigo, confianza: "media", fuente: `4.º dígito del código (${codigo})` };
  }

  // 3) Sin señal: se asume 1.er año y se reporta para revision manual.
  return { nivel: 1, confianza: "baja", fuente: "sin señal — asumido 1.er año" };
}

module.exports = {
  indexarMalla,
  indexarMallas,
  resolverNivel,
  nivelPorCodigo,
  semestreANivel,
  limpiarHtml,
  MALLAS_VALIDAS,
  MALLAS_DESCARTADAS,
  NIVEL_MIN,
  NIVEL_MAX,
};
