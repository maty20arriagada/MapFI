"use strict";
/** DAO de carreras (catalogo). */
const { query } = require("../db");

module.exports = {
  async listar() {
    const { rows } = await query(
      `SELECT id, codigo, nombre, color, activa
         FROM carrera WHERE activa = TRUE ORDER BY nombre`
    );
    return rows;
  },

  // TODO(F1): crear/actualizar/desactivar (CRUD admin de catalogos).
};
