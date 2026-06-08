"use strict";
/**
 * reputationService — Gamificacion: indicador de confiabilidad y sello de
 * coordinacion eficiente (§5). SERVICIO PURO (sin I/O).
 *
 * Recibe las actividades de una entidad y devuelve sus metricas de reputacion.
 * La logica de puntajes es parametrizable para calibrarla con datos reales.
 */

const PARAMS = {
  PTS_REALIZADA: 10,       // evento realizado con exito
  PTS_REPROGRAMADA: -5,    // evento reprogramado (mala coordinacion)
  PTS_SUSPENDIDA: -8,      // evento suspendido
  PTS_A_TIEMPO: 3,         // registrado con suficiente anticipacion
  DIAS_ANTICIPACION: 7,
  MIN_EVENTOS_SELLO: 3,    // minimo de actividades para optar al sello
  MAX_TASA_REPROG_SELLO: 0.2,
  MIN_USO_MATCH_SELLO: 0.7, // fraccion de eventos evaluados con el match
};

function diasEntre(a, b) {
  return (new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

/**
 * @param {Array<{estado, fecha_inicio, created_at, compatibilidad_pct}>} actividades
 * @returns {{reputacion, eventos_exitosos, confiabilidad_pct, sello_coordinacion}}
 */
function calcular(actividades = [], params = PARAMS) {
  let reputacion = 0;
  let realizadas = 0, reprogramadas = 0, suspendidas = 0, conMatch = 0;
  const total = actividades.length;

  for (const a of actividades) {
    if (a.estado === "REALIZADA") { reputacion += params.PTS_REALIZADA; realizadas++; }
    else if (a.estado === "REPROGRAMADA") { reputacion += params.PTS_REPROGRAMADA; reprogramadas++; }
    else if (a.estado === "SUSPENDIDA") { reputacion += params.PTS_SUSPENDIDA; suspendidas++; }

    if (a.created_at && a.fecha_inicio &&
        diasEntre(a.fecha_inicio, a.created_at) >= params.DIAS_ANTICIPACION) {
      reputacion += params.PTS_A_TIEMPO;
    }
    if (a.compatibilidad_pct != null) conMatch++;
  }

  reputacion = Math.max(0, Math.round(reputacion));
  const finalizados = realizadas + reprogramadas + suspendidas;
  const confiabilidad_pct = finalizados ? Math.round((realizadas / finalizados) * 100) : 0;
  const tasaReprog = total ? (reprogramadas + suspendidas) / total : 0;
  const usoMatch = total ? conMatch / total : 0;

  const sello_coordinacion =
    total >= params.MIN_EVENTOS_SELLO &&
    tasaReprog <= params.MAX_TASA_REPROG_SELLO &&
    usoMatch >= params.MIN_USO_MATCH_SELLO;

  return { reputacion, eventos_exitosos: realizadas, confiabilidad_pct, sello_coordinacion };
}

module.exports = { calcular, PARAMS };
