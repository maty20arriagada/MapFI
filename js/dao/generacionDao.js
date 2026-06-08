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

  async crear(g) {
    const { rows } = await query(
      `INSERT INTO generacion (nivel, etiqueta) VALUES ($1,$2)
       ON CONFLICT (nivel) DO UPDATE SET etiqueta = EXCLUDED.etiqueta RETURNING *`,
      [g.nivel, g.etiqueta]
    );
    return rows[0];
  },
};
