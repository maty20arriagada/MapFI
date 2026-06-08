"use strict";
/** DAO de generaciones / niveles academicos (catalogo). */
const { query } = require("../db");

module.exports = {
  async listar() {
    const { rows } = await query(
      `SELECT nivel, etiqueta FROM generacion ORDER BY nivel`
    );
    return rows;
  },

  // TODO(F1): alta de niveles adicionales (6.o anio, etc.).
};
