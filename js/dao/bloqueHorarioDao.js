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

  // TODO(F2): crear, eliminar e importacion masiva por CSV.
};
