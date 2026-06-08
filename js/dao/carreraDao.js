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

  async crear(c) {
    const { rows } = await query(
      `INSERT INTO carrera (id, codigo, nombre, color) VALUES ($1,$2,$3,$4) RETURNING *`,
      [c.id, c.codigo, c.nombre, c.color || "#2563EB"]
    );
    return rows[0];
  },

  async actualizar(id, c) {
    const { rows } = await query(
      `UPDATE carrera SET
         codigo = COALESCE($2, codigo),
         nombre = COALESCE($3, nombre),
         color  = COALESCE($4, color),
         activa = COALESCE($5, activa)
       WHERE id = $1 RETURNING *`,
      [id, c.codigo, c.nombre, c.color, c.activa]
    );
    return rows[0];
  },
};
