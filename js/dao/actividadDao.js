"use strict";
/**
 * DAO de actividades (eventos/hitos) — entidad nucleo del calendario.
 * `listar` y `crear` estan implementados (capa de datos). El armado del
 * contexto para el algoritmo de match queda como TODO de la Fase 3.
 */
const { pool, query } = require("../db");

module.exports = {
  /**
   * Lista actividades con filtros opcionales para el calendario.
   * @param {{carreraId?:number, nivel?:number, entidadId?:number,
   *          desde?:string, hasta?:string}} f
   */
  async listar(f = {}) {
    const cond = [];
    const args = [];
    let i = 1;

    if (f.entidadId) { cond.push(`a.entidad_id = $${i++}`); args.push(f.entidadId); }
    if (f.desde)     { cond.push(`a.fecha_inicio >= $${i++}`); args.push(f.desde); }
    if (f.hasta)     { cond.push(`a.fecha_inicio <= $${i++}`); args.push(f.hasta); }
    // Filtro por segmento (carrera/nivel) via subconsulta sobre actividad_publico.
    if (f.carreraId) { cond.push(`EXISTS (SELECT 1 FROM actividad_publico ap WHERE ap.actividad_id = a.id AND ap.carrera_id = $${i++})`); args.push(f.carreraId); }
    if (f.nivel)     { cond.push(`EXISTS (SELECT 1 FROM actividad_publico ap WHERE ap.actividad_id = a.id AND ap.nivel = $${i++})`); args.push(f.nivel); }

    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT a.id, a.titulo, a.descripcion, a.entidad_id, e.nombre AS entidad_nombre,
              a.fecha_inicio, a.fecha_fin, a.tipo, a.estado, a.ubicacion,
              a.alcance_estimado, a.compatibilidad_pct
         FROM actividad a
         JOIN entidad e ON e.id = a.entidad_id
         ${where}
         ORDER BY a.fecha_inicio`,
      args
    );
    return rows;
  },

  async obtener(id) {
    const { rows } = await query(`SELECT * FROM actividad WHERE id = $1`, [id]);
    if (!rows[0]) return null;
    const pub = await query(
      `SELECT carrera_id, nivel FROM actividad_publico WHERE actividad_id = $1`,
      [id]
    );
    return { ...rows[0], publico: pub.rows };
  },

  /**
   * Crea una actividad + su publico objetivo en una transaccion.
   * @param {object} a  datos de la actividad
   * @param {Array<{carreraId,nivel}>} publico
   */
  async crear(a, publico = []) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO actividad
           (titulo, descripcion, entidad_id, periodo_id, fecha_inicio, fecha_fin,
            tipo, estado, ubicacion, alcance_estimado, compatibilidad_pct, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [a.titulo, a.descripcion, a.entidadId, a.periodoId || null,
         a.fechaInicio, a.fechaFin, a.tipo, a.estado || "PROPUESTA",
         a.ubicacion || null, a.alcanceEstimado || null,
         a.compatibilidadPct || null, a.createdBy || null]
      );
      const id = rows[0].id;
      for (const p of publico) {
        await client.query(
          `INSERT INTO actividad_publico (actividad_id, carrera_id, nivel)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [id, p.carreraId, p.nivel]
        );
      }
      await client.query("COMMIT");
      return { id };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  // TODO(F2): actualizar, cambiarEstado, eliminar.
  // TODO(F3): cargarContextoMatch(segmentos, semana) -> { feriados, bloques,
  //           actividades, poblacion } para alimentar matchService.evaluar().
};
