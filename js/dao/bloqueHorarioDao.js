"use strict";
/** DAO de bloques horarios base (malla academica recurrente). */
const { query } = require("../db");

module.exports = {
  async listar() {
    const { rows } = await query(
      `SELECT id, carrera_id, nivel, dia_semana, hora_inicio, hora_fin, tipo, descripcion
         FROM bloque_horario ORDER BY carrera_id, nivel, dia_semana, hora_inicio`
    );
    return rows;
  },

  /** Bloques de un segmento (carrera+nivel), usado por el match. */
  async listarPorSegmento(carreraId, nivel) {
    const { rows } = await query(
      `SELECT dia_semana, hora_inicio, hora_fin, tipo
         FROM bloque_horario WHERE carrera_id = $1 AND nivel = $2`,
      [carreraId, nivel]
    );
    return rows;
  },

  async crear(b) {
    const { rows } = await query(
      `INSERT INTO bloque_horario (carrera_id, nivel, dia_semana, hora_inicio, hora_fin, tipo, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [b.carreraId, b.nivel, b.diaSemana, b.horaInicio, b.horaFin, b.tipo, b.descripcion || null]
    );
    return rows[0];
  },

  async eliminar(id) {
    await query(`DELETE FROM bloque_horario WHERE id = $1`, [id]);
    return { id };
  },

  // TODO(F2): importacion masiva por CSV.
};
