"use strict";
/**
 * DAO de KPIs / analitica. Lee las vistas definidas en 003_vistas_analitica.sql.
 * Punto de integracion para el panel de indicadores y herramientas BI (Fase 4).
 */
const { query } = require("../db");

module.exports = {
  /** Saturacion por (carrera, nivel, fecha) — alimenta el mapa de calor. */
  async saturacionSegmento({ carreraId, nivel, desde, hasta } = {}) {
    const cond = [];
    const args = [];
    let i = 1;
    if (carreraId) { cond.push(`carrera_id = $${i++}`); args.push(carreraId); }
    if (nivel)     { cond.push(`nivel = $${i++}`); args.push(nivel); }
    if (desde)     { cond.push(`fecha >= $${i++}`); args.push(desde); }
    if (hasta)     { cond.push(`fecha <= $${i++}`); args.push(hasta); }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT carrera_id, nivel, fecha, eventos, examenes
         FROM vw_saturacion_segmento ${where} ORDER BY fecha`,
      args
    );
    return rows;
  },

  async ocupacionBloques() {
    const { rows } = await query(`SELECT * FROM vw_ocupacion_bloques ORDER BY carrera_id, nivel`);
    return rows;
  },

  async aporteEntidad() {
    const { rows } = await query(`SELECT * FROM vw_aporte_entidad ORDER BY actividades_total DESC`);
    return rows;
  },

  async eventosReprogramados() {
    const { rows } = await query(`SELECT * FROM vw_eventos_reprogramados ORDER BY anio DESC`);
    return rows;
  },
};
