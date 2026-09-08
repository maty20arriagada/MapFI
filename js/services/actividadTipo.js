"use strict";
/**
 * MapFI · actividadTipo.js — clasifica una actividad como certamen, tarea o
 * evento a partir de su titulo y de quien la publica.
 *
 * Servicio PURO (Principio II): sin I/O, sin red, sin base de datos. Recibe
 * datos y devuelve una decision, para que la regla se pueda probar sin
 * levantar un contenedor y para que el script de reclasificacion no esconda
 * la logica dentro de un bucle.
 *
 * REGLA (decidida con el usuario el 2026-09-07):
 *   1. Lo que publican Vinculacion con el Medio (VcM) y Gearbox (GBX) es
 *      EVENTO, sin mirar el titulo. Son las dos entidades cuyo proposito es
 *      acompañar al estudiante, no evaluarlo.
 *   2. Todo lo demas es CERTAMEN si el titulo lo delata, y TAREA si no.
 *      El fallback es TAREA a proposito: marcar de mas como "certamen"
 *      alarma al estudiante y ensucia el algoritmo de choques, que penaliza
 *      los examenes con el peso mas alto (P_EXAMEN = 45 en matchService).
 *
 * Los tipos que se guardan son los del CHECK de la tabla (migracion 006):
 * EXAMEN es el certamen y ENTREGA es la tarea. No se inventan tipos nuevos.
 */

/** Entidades cuyo trabajo NO es academico: lo suyo queda como evento. */
const SIGLAS_ACOMPANAMIENTO = Object.freeze(["VCM", "GBX"]);

const TIPO_CERTAMEN = "EXAMEN";
const TIPO_TAREA = "ENTREGA";
const TIPO_EVENTO = "EVENTO";

/**
 * Quita tildes y pasa a minusculas, para que "Evaluación" y "evaluacion"
 * crucen igual. Es la misma normalizacion que usa horarioMalla.
 */
function normalizar(s) {
  return String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // combinantes, escapados: literales se corrompen
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Señales de que un titulo describe una evaluacion con nota.
 *
 * Van con limite de palabra a proposito. Sin el, "control" pescaria
 * "Controlador logico" y "er" pescaria absolutamente todo. Las abreviaturas
 * cortas (C1, E2, EV3, ER) son las que mas se usan en la Facultad y las que
 * mas facil se rompen con un regex laxo, asi que se listan una a una.
 */
const PATRONES_CERTAMEN = [
  /\bcertamen(es)?\b/,
  /\bexamen(es)?\b/,
  /\bprueba(s)?\b/,
  /\btest(s)?\b/,
  /\bcontrol(es)?\b/,
  /\bevaluacion(es)?\b/,
  /\bparcial(es)?\b/,
  /\bsolemne(s)?\b/,
  /\binterrogacion(es)?\b/,
  /\bquiz(z?es)?\b/,
  /\brecuperacion\b/,
  /\bglobal\b/,
  // Abreviaturas: C1, C2, E1, E2, E3, EV1, ER. Con espacio opcional
  // ("C 1") porque en las planillas aparece de las dos formas.
  /\b[ce]\s?\d\b/,
  /\bev\s?\d\b/,
  /\ber\b/,
];

/**
 * Clasifica una actividad.
 *
 * @param {{titulo?: string, entidadSigla?: string, tipo?: string}} act
 * @returns {{tipo: string, motivo: string, ambigua: boolean}}
 *   `ambigua` marca las que cayeron en el fallback sin ninguna señal: no
 *   cambia lo que se guarda, pero permite listarlas en el informe para que
 *   alguien las mire.
 */
function clasificar(act) {
  act = act || {};
  const sigla = normalizar(act.entidadSigla).toUpperCase();

  if (SIGLAS_ACOMPANAMIENTO.indexOf(sigla) !== -1) {
    return {
      tipo: TIPO_EVENTO,
      motivo: "entidad de acompañamiento (" + sigla + ")",
      ambigua: false,
    };
  }

  const titulo = normalizar(act.titulo);
  const ramo = normalizar(act.ramo);
  // Se mira el titulo y, si no dice nada, tambien el ramo: hay filas cuyo
  // titulo es solo "C1" y otras donde la señal esta en el nombre del ramo.
  const texto = titulo + " " + ramo;

  for (const re of PATRONES_CERTAMEN) {
    if (re.test(texto)) {
      return { tipo: TIPO_CERTAMEN, motivo: "el titulo dice " + re.source, ambigua: false };
    }
  }

  return {
    tipo: TIPO_TAREA,
    motivo: "sin señal de evaluacion en el titulo",
    // Si el titulo trae una palabra tipica de entrega, la decision es firme;
    // si no trae nada, cayo en el fallback y conviene revisarla.
    ambigua: !/\b(tarea|entrega|proyecto|informe|avance|pitch|presentacion|trabajo|memoria|laboratorio|practica)\b/.test(texto),
  };
}

/**
 * Aplica `clasificar` a una lista y devuelve solo lo que CAMBIA, mas el
 * resumen. No muta la entrada.
 *
 * @param {Array} actividades  filas con { id, titulo, ramo, tipo, entidadSigla }
 * @returns {{cambios: Array, sinCambio: number, ambiguas: Array, resumen: Object}}
 */
function planificar(actividades) {
  const cambios = [];
  const ambiguas = [];
  const resumen = {};
  let sinCambio = 0;

  (actividades || []).forEach((a) => {
    const d = clasificar({ titulo: a.titulo, ramo: a.ramo, entidadSigla: a.entidadSigla });
    const clave = (a.tipo || "?") + " -> " + d.tipo;
    resumen[clave] = (resumen[clave] || 0) + 1;

    if (d.ambigua) ambiguas.push({ id: a.id, titulo: a.titulo, tipoPrevio: a.tipo, tipoNuevo: d.tipo });

    if (d.tipo === a.tipo) { sinCambio++; return; }
    cambios.push({
      id: a.id,
      titulo: a.titulo,
      ramo: a.ramo || null,
      entidadSigla: a.entidadSigla,
      tipoPrevio: a.tipo,
      tipoNuevo: d.tipo,
      motivo: d.motivo,
    });
  });

  return { cambios, sinCambio, ambiguas, resumen };
}

module.exports = {
  clasificar,
  planificar,
  normalizar,
  SIGLAS_ACOMPANAMIENTO,
  TIPO_CERTAMEN,
  TIPO_TAREA,
  TIPO_EVENTO,
};
