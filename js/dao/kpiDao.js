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

  /**
   * Actividades DISTINTAS por dia para un conjunto de grupos (carrera, nivel)
   * — alimenta el semestre del mapa de calor (Spec 006, US5).
   *
   * No usa vw_saturacion_segmento: esa vista ya agrupo por segmento y perdio
   * el id de la actividad, asi que al sumar varios segmentos una charla para
   * cinco años contaba cinco. Misma forma de fila que saturacionSegmento
   * (fecha, eventos, examenes) para que heatmapService.semestrePorDia no
   * cambie.
   *
   * @param {Array<{carreraId:number, nivel:number}>} publico
   */
  async saturacionPublico(publico, desde, hasta) {
    if (!publico || !publico.length) return [];
    const args = [publico.map((p) => p.carreraId), publico.map((p) => p.nivel)];
    const cond = ["(carrera_id, nivel) IN (SELECT * FROM unnest($1::int[], $2::int[]))"];
    if (desde) { args.push(desde); cond.push(`fecha >= $${args.length}`); }
    if (hasta) { args.push(hasta); cond.push(`fecha <= $${args.length}`); }
    const { rows } = await query(
      `SELECT fecha,
              COUNT(DISTINCT actividad_id) AS eventos,
              COUNT(DISTINCT actividad_id) FILTER (WHERE tipo = 'EXAMEN') AS examenes
         FROM vw_saturacion_actividad
        WHERE ${cond.join(" AND ")}
        GROUP BY fecha
        ORDER BY fecha`,
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

  /**
   * ¿Alguno de los segmentos dados usa matrícula REFERENCIAL (no oficial)?
   * Decide si una cifra de alcance debe rotularse como estimación mientras
   * no se cargue la matrícula oficial de Docencia (T041, H-10, FR-007).
   * @param {Array<{carreraId:number, nivel:number}>} segmentos
   */
  async usaMatriculaReferencial(segmentos = []) {
    if (!segmentos.length) return false;
    const cond = segmentos.map((_, i) => `(carrera_id = $${2 * i + 1} AND nivel = $${2 * i + 2})`).join(" OR ");
    const args = segmentos.flatMap((s) => [s.carreraId, s.nivel]);
    const { rows } = await query(
      `SELECT 1 FROM matricula WHERE (${cond}) AND origen = 'REFERENCIAL' LIMIT 1`,
      args
    );
    return rows.length > 0;
  },
};
