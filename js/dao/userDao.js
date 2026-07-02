"use strict";
/**
 * DAO de usuarios. Soporta el login con credenciales propias (Fase 1).
 */
const { query } = require("../db");

module.exports = {
  async buscarPorEmail(email) {
    const { rows } = await query(
      `SELECT id, email, password_hash, nombre, rol, entidad_id, activo
         FROM usuario WHERE lower(email) = lower($1)`,
      [String(email || "").trim()]
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
      `SELECT u.id, u.email, u.nombre, u.rol, u.entidad_id, u.activo,
              e.sigla AS entidad_sigla, e.nombre AS entidad_nombre
         FROM usuario u
         LEFT JOIN entidad e ON e.id = u.entidad_id
         ORDER BY u.activo DESC, u.nombre`
    );
    return rows;
  },

  async crear({ email, passwordHash, nombre, rol, entidadId }) {
    const { rows } = await query(
      `INSERT INTO usuario (email, password_hash, nombre, rol, entidad_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, nombre, rol, entidad_id, activo`,
      [String(email).trim().toLowerCase(), passwordHash, nombre, rol, entidadId || null]
    );
    return rows[0];
  },

  async listarPorEntidad(entidadId) {
    const { rows } = await query(
      `SELECT id, email, nombre, rol, activo FROM usuario WHERE entidad_id = $1 ORDER BY nombre`,
      [entidadId]
    );
    return rows;
  },

  async actualizar(id, u) {
    const { rows } = await query(
      `UPDATE usuario SET
         nombre = COALESCE($2, nombre),
         entidad_id = COALESCE($3, entidad_id),
         activo = COALESCE($4, activo)
       WHERE id = $1
       RETURNING id, email, nombre, rol, entidad_id, activo`,
      [id, u.nombre, u.entidadId, u.activo]
    );
    return rows[0];
  },

  async cambiarPassword(id, passwordHash) {
    await query(`UPDATE usuario SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
    return { id };
  },
};
