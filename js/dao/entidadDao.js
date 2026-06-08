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

  // TODO(F1): CRUD admin.  TODO(F4): actualizar reputacion / sellos.
};
