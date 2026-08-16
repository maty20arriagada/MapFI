"use strict";
/** DAO de bloques horarios base (malla academica recurrente). */
const { query, pool } = require("../db");

const CAMPOS = "id, carrera_id, nivel, dia_semana, hora_inicio, hora_fin, tipo, descripcion, codigo, seccion, sala, docente";

module.exports = {
  async listar(f = {}) {
    const cond = [];
    const args = [];
    let i = 1;
    if (f.carreraId) { cond.push(`carrera_id = $${i++}`); args.push(f.carreraId); }
    if (f.nivel)     { cond.push(`nivel = $${i++}`); args.push(f.nivel); }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT ${CAMPOS} FROM bloque_horario ${where} ORDER BY dia_semana, hora_inicio`,
      args
    );
    return rows;
  },

  /** Bloques de un segmento (carrera+nivel), usado por el match. */
  async listarPorSegmento(carreraId, nivel) {
    const { rows } = await query(
      `SELECT dia_semana, hora_inicio, hora_fin, tipo
         FROM bloque_horario WHERE carrera_id = $1 AND nivel = $2`,
      [carreraId, nivel]
    );
    return rows;
  },

  /** Carrera del bloque, para autorizar el borrado sin confiar en lo que envia el cliente. */
  async carreraDelBloque(id) {
    const { rows } = await query(`SELECT carrera_id FROM bloque_horario WHERE id = $1`, [id]);
    return rows[0] ? rows[0].carrera_id : null;
  },

  async crear(b) {
    const { rows } = await query(
      `INSERT INTO bloque_horario
         (carrera_id, nivel, dia_semana, hora_inicio, hora_fin, tipo, descripcion, codigo, seccion, sala, docente)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [b.carreraId, b.nivel, b.diaSemana, b.horaInicio, b.horaFin, b.tipo,
       b.descripcion || null, b.codigo || null, b.seccion || null, b.sala || null, b.docente || null]
    );
    return rows[0];
  },

  async eliminar(id) {
    await query(`DELETE FROM bloque_horario WHERE id = $1`, [id]);
    return { id };
  },

  /** Vacia todos los bloques de un segmento (carrera+nivel). Ambos parametros son obligatorios. */
  async eliminarPorSegmento(carreraId, nivel) {
    const { rowCount } = await query(
      `DELETE FROM bloque_horario WHERE carrera_id = $1 AND nivel = $2`,
      [carreraId, nivel]
    );
    return { eliminados: rowCount, carreraId, nivel };
  },

  /**
   * Importa un lote de bloques en un segmento. En modo "reemplazar", el
   * borrado del segmento y las inserciones van en la misma transaccion: si
   * una fila falla, el horario anterior queda intacto (ver data-model.md,
   * "Flujo de la importacion").
   */
  async importar(carreraId, nivel, modo, bloques) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let eliminados = 0;
      if (modo === "reemplazar") {
        const r = await client.query(
          `DELETE FROM bloque_horario WHERE carrera_id = $1 AND nivel = $2`,
          [carreraId, nivel]
        );
        eliminados = r.rowCount;
      }
      for (const b of bloques) {
        await client.query(
          `INSERT INTO bloque_horario
             (carrera_id, nivel, dia_semana, hora_inicio, hora_fin, tipo, descripcion, codigo, seccion, sala, docente)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [carreraId, nivel, b.diaSemana, b.horaInicio, b.horaFin, b.tipo || "CLASE",
           b.descripcion || null, b.codigo || null, b.seccion || null, b.sala || null, b.docente || null]
        );
      }
      await client.query("COMMIT");
      return { insertados: bloques.length, eliminados, modo };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },
};
