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

  async crear(p) {
    const { rows } = await query(
      `INSERT INTO periodo_academico (anio, semestre, fecha_inicio, fecha_fin)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [p.anio, p.semestre, p.fechaInicio, p.fechaFin]
    );
    return rows[0];
  },

  /** Marca un periodo como activo (y desactiva el resto). */
  async activar(id) {
    await query(`UPDATE periodo_academico SET activo = (id = $1)`, [id]);
    return { id, activo: true };
  },

  // TODO(F4): clonar calendario academico anual de forma parametrica.
};
