"use strict";
/**
 * DAO de usuarios. Soporta el login con credenciales propias (Fase 1).
 */
const { query } = require("../db");

module.exports = {
  async buscarPorEmail(email) {
    const { rows } = await query(
      `SELECT id, email, password_hash, nombre, rol, entidad_id, activo
         FROM usuario WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async obtener(id) {
    const { rows } = await query(
      `SELECT id, email, nombre, rol, entidad_id, activo, created_at
         FROM usuario WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async listar() {
    const { rows } = await query(
      `SELECT id, email, nombre, rol, entidad_id, activo
         FROM usuario ORDER BY nombre`
    );
    return rows;
  },

  async crear({ email, passwordHash, nombre, rol, entidadId }) {
    const { rows } = await query(
      `INSERT INTO usuario (email, password_hash, nombre, rol, entidad_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, nombre, rol, entidad_id, activo`,
      [email, passwordHash, nombre, rol, entidadId || null]
    );
    return rows[0];
  },

  // TODO(F1): actualizar, desactivar, cambiar contrasena.
};
