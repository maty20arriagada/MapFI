"use strict";
/**
 * DAO de actividades (eventos/hitos) — entidad nucleo del calendario.
 * Incluye CRUD (Fase 2) y el armado del contexto para el match (Fase 3).
 */
const { pool, query } = require("../db");

/** YYYY-MM-DD de un Date (local). */
function iso(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Rango lunes..domingo (timestamps ISO) de la semana que contiene `fecha`. */
function semanaDe(fecha) {
  const base = new Date(fecha); base.setHours(0, 0, 0, 0);
  const dow = base.getDay() === 0 ? 7 : base.getDay();
  const lunes = new Date(base); lunes.setDate(base.getDate() - (dow - 1));
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6); domingo.setHours(23, 59, 59, 999);
  return { lunes, domingo };
}

module.exports = {
  async listar(f = {}) {
    const cond = [];
    const args = [];
    let i = 1;
    if (f.entidadId) { cond.push(`a.entidad_id = $${i++}`); args.push(f.entidadId); }
    if (f.desde)     { cond.push(`a.fecha_inicio >= $${i++}`); args.push(f.desde); }
    if (f.hasta)     { cond.push(`a.fecha_inicio <= $${i++}`); args.push(f.hasta); }
    if (f.carreraId) { cond.push(`EXISTS (SELECT 1 FROM actividad_publico ap WHERE ap.actividad_id = a.id AND ap.carrera_id = $${i++})`); args.push(f.carreraId); }
    if (f.nivel)     { cond.push(`EXISTS (SELECT 1 FROM actividad_publico ap WHERE ap.actividad_id = a.id AND ap.nivel = $${i++})`); args.push(f.nivel); }

    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT a.id, a.titulo, a.descripcion, a.entidad_id, e.nombre AS entidad_nombre,
              a.fecha_inicio, a.fecha_fin, a.tipo, a.estado, a.ubicacion,
              a.alcance_estimado, a.compatibilidad_pct
         FROM actividad a
         JOIN entidad e ON e.id = a.entidad_id
         ${where}
         ORDER BY a.fecha_inicio`,
      args
    );
    return rows;
  },

  async obtener(id) {
    const { rows } = await query(`SELECT * FROM actividad WHERE id = $1`, [id]);
    if (!rows[0]) return null;
    const pub = await query(
      `SELECT carrera_id, nivel FROM actividad_publico WHERE actividad_id = $1`,
      [id]
    );
    return { ...rows[0], publico: pub.rows };
  },

  async crear(a, publico = []) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO actividad
           (titulo, descripcion, entidad_id, periodo_id, fecha_inicio, fecha_fin,
            tipo, estado, ubicacion, alcance_estimado, compatibilidad_pct, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [a.titulo, a.descripcion, a.entidadId, a.periodoId || null,
         a.fechaInicio, a.fechaFin, a.tipo, a.estado || "PROPUESTA",
         a.ubicacion || null, a.alcanceEstimado || null,
         a.compatibilidadPct || null, a.createdBy || null]
      );
      const id = rows[0].id;
      for (const p of publico) {
        await client.query(
          `INSERT INTO actividad_publico (actividad_id, carrera_id, nivel)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [id, p.carreraId, p.nivel]
        );
      }
      await client.query("COMMIT");
      return { id };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  async actualizar(id, a, publico) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE actividad SET
           titulo = COALESCE($2, titulo),
           descripcion = COALESCE($3, descripcion),
           fecha_inicio = COALESCE($4, fecha_inicio),
           fecha_fin = COALESCE($5, fecha_fin),
           tipo = COALESCE($6, tipo),
           estado = COALESCE($7, estado),
           ubicacion = COALESCE($8, ubicacion),
           updated_at = now()
         WHERE id = $1`,
        [id, a.titulo, a.descripcion, a.fechaInicio, a.fechaFin, a.tipo, a.estado, a.ubicacion]
      );
      if (Array.isArray(publico)) {
        await client.query(`DELETE FROM actividad_publico WHERE actividad_id = $1`, [id]);
        for (const p of publico) {
          await client.query(
            `INSERT INTO actividad_publico (actividad_id, carrera_id, nivel)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [id, p.carreraId, p.nivel]
          );
        }
      }
      await client.query("COMMIT");
      return { id };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  async cambiarEstado(id, estado) {
    await query(`UPDATE actividad SET estado = $2, updated_at = now() WHERE id = $1`, [id, estado]);
    return { id, estado };
  },

  async eliminar(id) {
    await query(`DELETE FROM actividad WHERE id = $1`, [id]); // cascade borra actividad_publico
    return { id };
  },

  /** Todas las actividades de una entidad con campos para reputacion/reportes. */
  async listarCompleto(entidadId) {
    const { rows } = await query(
      `SELECT id, titulo, fecha_inicio, fecha_fin, tipo, estado,
              alcance_estimado, compatibilidad_pct, created_at
         FROM actividad WHERE entidad_id = $1 ORDER BY fecha_inicio`,
      [entidadId]
    );
    return rows;
  },

  /**
   * Arma el contexto que necesita matchService.evaluar() para una propuesta:
   * feriados de la semana, bloques de la malla, actividades del mismo publico
   * en la semana y la poblacion (matricula) de cada segmento.
   * @param {Array<{carreraId,nivel}>} publico
   * @param {Date|string} fecha
   */
  async cargarContextoMatch(publico, fecha) {
    if (!publico || !publico.length) return { feriados: [], bloques: [], actividades: [], poblacion: {} };

    const { lunes, domingo } = semanaDe(fecha);

    // Condicion de pares (carrera, nivel) reutilizable.
    const condPairs = publico.map((_, i) => `(carrera_id = $${2 * i + 1} AND nivel = $${2 * i + 2})`).join(" OR ");
    const argsPairs = publico.flatMap((s) => [s.carreraId, s.nivel]);

    // Feriados de la semana.
    const fer = await query(
      `SELECT fecha FROM feriado WHERE fecha BETWEEN $1 AND $2`,
      [iso(lunes), iso(domingo)]
    );

    // Bloques de la malla de los segmentos.
    const blo = await query(
      `SELECT carrera_id, nivel, dia_semana, hora_inicio, hora_fin, tipo
         FROM bloque_horario WHERE ${condPairs}`,
      argsPairs
    );

    // Matricula (poblacion) de los segmentos.
    const mat = await query(
      `SELECT carrera_id, nivel, cantidad FROM matricula WHERE ${condPairs}`,
      argsPairs
    );

    // Actividades del mismo publico durante la semana.
    const condAp = publico.map((_, i) => `(ap.carrera_id = $${2 * i + 1} AND ap.nivel = $${2 * i + 2})`).join(" OR ");
    const rangeIni = `$${argsPairs.length + 1}`;
    const rangeFin = `$${argsPairs.length + 2}`;
    const act = await query(
      `SELECT DISTINCT a.id, a.fecha_inicio, a.fecha_fin, a.tipo, a.estado
         FROM actividad a
         JOIN actividad_publico ap ON ap.actividad_id = a.id
        WHERE (${condAp}) AND a.fecha_inicio BETWEEN ${rangeIni} AND ${rangeFin}`,
      [...argsPairs, lunes.toISOString(), domingo.toISOString()]
    );

    const actividades = [];
    for (const a of act.rows) {
      const pub = await query(`SELECT carrera_id, nivel FROM actividad_publico WHERE actividad_id = $1`, [a.id]);
      actividades.push({
        inicio: a.fecha_inicio,
        fin: a.fecha_fin,
        tipo: a.tipo,
        estado: a.estado,
        publico: pub.rows.map((r) => ({ carreraId: r.carrera_id, nivel: r.nivel })),
      });
    }

    const poblacion = {};
    mat.rows.forEach((r) => { poblacion[`${r.carrera_id}-${r.nivel}`] = r.cantidad; });

    return {
      feriados: fer.rows.map((r) => r.fecha),
      bloques: blo.rows.map((b) => ({
        carreraId: b.carrera_id, nivel: b.nivel, diaSemana: b.dia_semana,
        horaInicio: b.hora_inicio, horaFin: b.hora_fin, tipo: b.tipo,
      })),
      actividades,
      poblacion,
    };
  },
};
