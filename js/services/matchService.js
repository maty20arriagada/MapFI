"use strict";
/**
 * matchService — Calculador inteligente de Compatibilidad y Alcance (§3.C).
 * SERVICIO PURO. Especificacion completa en docs/ALGORITMO_MATCH.md.
 *
 * ESTADO (scaffold Fase 0):
 *   ✔ Validacion de entrada.
 *   ✔ Paso 0: descartes duros (fin de semana / feriado).
 *   ☐ Pasos 1-6: scoring por topes, saturacion, alcance y sugerencias → Fase 3.
 *
 * Mantener este servicio SIN I/O: el contexto (feriados, bloques, actividades,
 * poblacion) lo arma el DAO y se pasa por parametro. Asi es 100% testeable.
 */
const holiday = require("./holidayService");

/** Pesos configurables del algoritmo (a futuro, movibles a BD). */
const PARAMS = {
  P_CLASE: 12,
  P_PROTEGIDO: 30,
  P_EXAMEN: 45,
  P_SATURACION: 10,
  UMBRAL_SUGERENCIA: 70,
  DURACION_BLOQUE_MIN: 90,
};

function semaforo(pct) {
  if (pct >= 75) return "ALTO";
  if (pct >= 45) return "MEDIO";
  return "BAJO";
}

function poblacionTotal(publico, poblacion = {}) {
  return publico.reduce(
    (acc, s) => acc + (poblacion[`${s.carreraId}-${s.nivel}`] || 0),
    0
  );
}

function resultado(pct, alcance, conflictos = [], sugerencias = []) {
  return {
    compatibilidad_pct: pct,
    alcance_estimado: alcance,
    nivel: semaforo(pct),
    conflictos,
    sugerencias,
  };
}

/**
 * Evalua una propuesta de fecha/hora contra el contexto del publico objetivo.
 * @param {{inicio:Date|string, fin:Date|string,
 *          publico:Array<{carreraId:number, nivel:number}>}} propuesta
 * @param {{feriados?:Array, bloques?:Array, actividades?:Array,
 *          poblacion?:Object}} contexto
 * @param {object} [params]
 * @returns {{compatibilidad_pct:number, alcance_estimado:number,
 *            nivel:string, conflictos:Array, sugerencias:Array}}
 */
function evaluar(propuesta, contexto = {}, params = PARAMS) {
  if (
    !propuesta ||
    !propuesta.inicio ||
    !Array.isArray(propuesta.publico) ||
    propuesta.publico.length === 0
  ) {
    throw new Error("Propuesta invalida: se requiere 'inicio' y 'publico' objetivo.");
  }

  const feriados = contexto.feriados || [];

  // ── Paso 0 · Descartes duros (implementado) ──────────────────────────────
  if (holiday.esFinDeSemana(propuesta.inicio)) {
    return resultado(0, 0, [
      { tipo: "FIN_DE_SEMANA", detalle: "La fecha cae en fin de semana", peso: 100 },
    ]);
  }
  if (holiday.esFeriado(propuesta.inicio, feriados)) {
    return resultado(10, 0, [
      { tipo: "FERIADO", detalle: "La fecha es feriado", peso: 90 },
    ]);
  }

  // ── Pasos 1-6 · TODO(F3) ─────────────────────────────────────────────────
  // 1) Choque con malla (bloques CLASE/PROTEGIDO de cada segmento).
  // 2) Choque con examenes en la ventana.
  // 3) Saturacion: eventos confirmados al mismo segmento en la semana.
  // 4) compatibilidad_pct = clamp(100 - Σ penalizaciones, 0, 100).
  // 5) alcance_estimado = poblacion * (1 - fraccion_bloqueada).
  // 6) si compatibilidad < UMBRAL_SUGERENCIA -> top-3 bloques de la semana.
  //
  // Placeholder mientras no se implementa el scoring: sin conflictos conocidos,
  // devuelve compatibilidad plena y el alcance = poblacion total del publico.
  return resultado(
    100,
    poblacionTotal(propuesta.publico, contexto.poblacion),
    [],
    []
  );
}

module.exports = { evaluar, semaforo, poblacionTotal, PARAMS };
