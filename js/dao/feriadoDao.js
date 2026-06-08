"use strict";
/** DAO de feriados (nacionales, sandwich, academicos). */
const { query } = require("../db");

module.exports = {
  async listar() {
    const { rows } = await query(
      `SELECT id, fecha, nombre, tipo, es_nacional FROM feriado ORDER BY fecha`
    );
    return rows;
  },

  /** Fechas de feriado dentro de un rango (para holidayService). */
  async listarFechasEntre(desde, hasta) {
    const { rows } = await query(
      `SELECT fecha FROM feriado WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha`,
      [desde, hasta]
    );
    return rows.map((r) => r.fecha);
  },

  // TODO(F2): CRUD admin + sincronizacion con fuente nacional de feriados.
};
