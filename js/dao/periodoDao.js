"use strict";
/** DAO de periodos academicos (anio/semestre parametrico). */
const { query } = require("../db");

module.exports = {
  async listar() {
    const { rows } = await query(
      `SELECT id, anio, semestre, fecha_inicio, fecha_fin, activo
         FROM periodo_academico ORDER BY anio DESC, semestre DESC`
    );
    return rows;
  },

  async obtenerActivo() {
    const { rows } = await query(
      `SELECT id, anio, semestre, fecha_inicio, fecha_fin
         FROM periodo_academico WHERE activo = TRUE LIMIT 1`
    );
    return rows[0] || null;
  },

  // TODO(F1): crear/activar periodo.  TODO(F4): clonar calendario anual.
};
