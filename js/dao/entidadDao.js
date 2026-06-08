"use strict";
/** DAO de entidades organizadoras (centros, Vinculacion, Gearbox). */
const { query } = require("../db");

module.exports = {
  async listar() {
    const { rows } = await query(
      `SELECT id, tipo, nombre, carrera_id, reputacion, sello_coordinacion, activa
         FROM entidad WHERE activa = TRUE ORDER BY nombre`
    );
    return rows;
  },

  async obtener(id) {
    const { rows } = await query(`SELECT * FROM entidad WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async crear(e) {
    const { rows } = await query(
      `INSERT INTO entidad (tipo, nombre, carrera_id) VALUES ($1,$2,$3) RETURNING *`,
      [e.tipo, e.nombre, e.carreraId || null]
    );
    return rows[0];
  },

  async actualizar(id, e) {
    const { rows } = await query(
      `UPDATE entidad SET
         nombre = COALESCE($2, nombre),
         carrera_id = COALESCE($3, carrera_id),
         activa = COALESCE($4, activa)
       WHERE id = $1 RETURNING *`,
      [id, e.nombre, e.carreraId, e.activa]
    );
    return rows[0];
  },

  // TODO(F4): actualizar reputacion / sellos de coordinacion.
};
