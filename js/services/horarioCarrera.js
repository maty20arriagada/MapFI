"use strict";
/**
 * horarioCarrera — decide a que carrera(s) de MapFI pertenece un ramo del
 * horario de la Facultad.
 *
 * Servicio PURO (Principio II). Solo Node (lo usa js/db/importar-horarios.js).
 *
 * POR QUE EL PREFIJO Y NO LA SECCION DEL ARCHIVO: las 8 secciones del .txt son
 * DEPARTAMENTOS, no carreras. Biomedica vive dentro de "INGENIERIA ELECTRICA",
 * Materiales dentro de "INGENIERIA QUIMICA", Minas dentro de "INGENIERIA
 * METALURGICA". Agrupar por seccion mezclaria carreras distintas. El prefijo
 * de 3 digitos del codigo si las separa, y cubre las 14 carreras de MapFI.
 *
 * Verificado por nombre de ramo sobre el archivo real:
 *   547 -> Microelectronica          550 -> Sistemas de Informacion en Salud
 *   548 -> Termodinamica de Materiales   551 -> Metalurgia Extractiva
 *   549 -> Analisis de Fourier para Telecomunicaciones
 */

// ids de db/migrations/002_seed_catalogos.sql
const CARRERA = {
  IC: 1, ICAE: 2, ICB: 3, ICEL: 4, ICE: 5, ICI: 6, ICINF: 7,
  ICMAT: 8, ICM: 9, ICMET: 10, ICMIN: 11, ICQ: 12, ICT: 13, ICPC: 14,
};

const TODAS_LAS_CARRERAS = Object.values(CARRERA);

// Prefijo de 3 digitos -> carrera. El 500 (plan comun) se trata aparte.
const PREFIJO_CARRERA = {
  501: CARRERA.ICINF, 503: CARRERA.ICINF,
  540: CARRERA.ICQ,
  541: CARRERA.ICM,     // Mecanica; Aeroespacial se separa por malla (ver abajo)
  542: CARRERA.ICMET,
  543: CARRERA.ICE,
  544: CARRERA.IC, 554: CARRERA.IC,
  546: CARRERA.ICI, 580: CARRERA.ICI,
  547: CARRERA.ICEL,
  548: CARRERA.ICMAT,
  549: CARRERA.ICT,
  550: CARRERA.ICB,
  551: CARRERA.ICMIN,
};

/** Prefijo de ramos comunes a todas las ingenierias (plan comun). */
const PREFIJO_COMUN = "500";

/**
 * Aeroespacial comparte el prefijo 541 con Mecanica y no hay forma de
 * separarlas por codigo. Se identifican por el nombre del ramo: los que
 * aparecen en la malla de Aeroespacial, mas los que lo dicen explicitamente.
 */
const RE_AEROESPACIAL = /aeroespacial|del vuelo|cohete/i;

function normalizar(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string|null} codigo   codigo de 6 digitos, o null si el registro lo perdio
 * @param {string} ramo          nombre del ramo
 * @param {object} [opts]
 * @param {string|null} [opts.codigoHeredado]  codigo del vecino del mismo bloque (T-2/T-1)
 * @param {Set<string>} [opts.ramosAeroespacial] nombres normalizados de la malla de Aeroespacial
 * @returns {{carreras: number[], prefijo: string|null, esComun: boolean, confianza: "alta"|"media"|"baja"}}
 */
function carrerasDe(codigo, ramo, opts) {
  opts = opts || {};
  const efectivo = codigo || opts.codigoHeredado || null;
  const prefijo = efectivo ? String(efectivo).slice(0, 3) : null;

  if (!prefijo) {
    return { carreras: [], prefijo: null, esComun: false, confianza: "baja" };
  }

  // Ramos comunes: van a las 14 carreras (incluye Plan Comun, que es una de
  // ellas). Decision del usuario: "Plan Comun + las 14".
  if (prefijo === PREFIJO_COMUN) {
    return {
      carreras: TODAS_LAS_CARRERAS.slice(),
      prefijo,
      esComun: true,
      confianza: codigo ? "alta" : "media",
    };
  }

  const base = PREFIJO_CARRERA[prefijo];
  if (!base) {
    return { carreras: [], prefijo, esComun: false, confianza: "baja" };
  }

  // 541 es Mecanica salvo que el ramo sea de Aeroespacial.
  if (base === CARRERA.ICM) {
    const n = normalizar(ramo);
    const enMalla = opts.ramosAeroespacial && opts.ramosAeroespacial.has(n);
    if (enMalla || RE_AEROESPACIAL.test(ramo)) {
      return { carreras: [CARRERA.ICAE], prefijo, esComun: false, confianza: enMalla ? "alta" : "media" };
    }
  }

  return {
    carreras: [base],
    prefijo,
    esComun: false,
    // Si el codigo se heredo del vecino, la carrera es plausible pero no segura.
    confianza: codigo ? "alta" : "media",
  };
}

module.exports = {
  carrerasDe,
  normalizar,
  CARRERA,
  TODAS_LAS_CARRERAS,
  PREFIJO_CARRERA,
  PREFIJO_COMUN,
};
