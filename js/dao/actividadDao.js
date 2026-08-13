"use strict";
/**
 * DAO de actividades (eventos/hitos) — entidad nucleo del calendario.
 * Incluye CRUD (Fase 2) y el armado del contexto para el match (Fase 3).
 */
const { pool, query } = require("../db");

// ── Modelo de visibilidad (moderacion reactiva, Spec 002 / data-model.md) ───
// FUENTE UNICA DE VERDAD: toda consulta que decida que actividades son
// "vigentes" (visibles al publico, cuentan en saturacion, cuentan en choques)
// DEBE usar ESTADOS_VIGENTES. No se debe volver a escribir la lista de estados
// a mano en ningun otro archivo (server.js, kpiDao, vistas SQL).
//
// Con moderacion reactiva (no hay revisor diario, Spec 002 Clarifications):
// una actividad se publica de inmediato al crearse (PROPUESTA es publica) y
// el administrador puede retirarla despues. El archivado (antes: borrado
// fisico) es reversible.
const ESTADOS_VIGENTES = Object.freeze(["PROPUESTA", "CONFIRMADA", "REALIZADA"]);
const ESTADOS_OCULTOS = Object.freeze(["SUSPENDIDA", "REPROGRAMADA", "ARCHIVADA"]);

// ── Constancia publica de eliminaciones ─────────────────────────────────────
// Cuando un centro borra algo del calendario casi siempre es porque se
// CANCELO. Si desaparece en silencio, quien ya lo habia visto llega a un
// evento que no existe. Por eso la constancia no es un registro de auditoria
// escondido: es un aviso de cancelacion dirigido a los estudiantes, y por eso
// la ruta que lo expone es publica.
// ── Foco "para participar" (filtro publico del calendario) ──────────────────
// Separa lo que el estudiante PUEDE elegir de lo que TIENE que cumplir. Una
// evaluacion, un hito o una entrega son obligaciones; una charla, un taller o
// un evento son oportunidades. Se incluyen ademas TODAS las actividades de
// Vinculacion con el Medio y Gearbox, cuyo proposito es justamente acompanar
// al estudiante, sin importar como esten tipificadas.
//
// FUENTE UNICA: si se agrega un tipo de actividad nuevo hay que decidir aqui
// de que lado cae. Los obligatorios que quedan fuera hoy son EXAMEN,
// HITO_ACADEMICO y ENTREGA.
const TIPOS_PARTICIPACION = Object.freeze(["EVENTO", "CHARLA", "TALLER", "EXTRAPROGRAMATICA"]);
const ENTIDADES_ACOMPANAMIENTO = Object.freeze(["VINCULACION", "GEARBOX"]);

const DIAS_AVISO_ELIMINACION = 30;
// Margen de correccion: si se elimina dentro de la hora siguiente a su
// creacion se entiende que fue un error de tipeo, no una cancelacion (nadie
// planifico nada en 40 minutos). No se publica, para que publicar algo por
// equivocacion no deje su titulo a la vista aunque lo borres enseguida.
const HORAS_MARGEN_CORRECCION = 1;

/**
 * Agrega a `cond`/`args` la condicion "alias.estado = ANY(vigentes)", usando
 * un solo parametro (arreglo) en vez de generar N placeholders a mano.
 * @param {string} alias  alias de la tabla actividad en la consulta (ej. "a")
 */
function agregarFiltroVigente(alias, cond, args) {
  args.push(ESTADOS_VIGENTES);
  cond.push(`${alias}.estado = ANY($${args.length}::text[])`);
}

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
  /**
   * @param {object} f
   * @param {"publico"|"propias"} [f.alcance="publico"] "propias" muestra
   *   TODAS las actividades de `f.entidadId` (incluidas ocultas/archivadas) —
   *   es el calendario del propio autor (FR-004). "publico" (default) solo
   *   muestra ESTADOS_VIGENTES, sea o no que tambien se filtre por entidad.
   * @param {boolean} [f.soloParticipacion] Deja solo lo que el estudiante
   *   puede elegir: actividades de Vinculacion con el Medio y Gearbox, MAS
   *   los tipos de participacion (evento, charla, taller, extraprogramatica),
   *   vengan de quien vengan. Es un OR entre ambas cosas, no un AND.
   */
  async listar(f = {}) {
    if (f.alcance === "propias" && !f.entidadId) {
      throw new Error("alcance 'propias' requiere entidadId");
    }
    const cond = [];
    const args = [];
    let i = 1;
    if (f.entidadId) { cond.push(`a.entidad_id = $${i++}`); args.push(f.entidadId); }
    if (f.tipo)      { cond.push(`a.tipo = $${i++}`); args.push(f.tipo); }
    if (f.desde)     { cond.push(`a.fecha_inicio >= $${i++}`); args.push(f.desde); }
    if (f.hasta)     { cond.push(`a.fecha_inicio <= $${i++}`); args.push(f.hasta); }
    if (f.carreraId) { cond.push(`EXISTS (SELECT 1 FROM actividad_publico ap WHERE ap.actividad_id = a.id AND ap.carrera_id = $${i++})`); args.push(f.carreraId); }
    if (f.nivel)     { cond.push(`EXISTS (SELECT 1 FROM actividad_publico ap WHERE ap.actividad_id = a.id AND ap.nivel = $${i++})`); args.push(f.nivel); }
    // Para el feed iCalendar: ademas de lo vigente, se incluyen las
    // eliminadas recientes, que el generador emite como CANCELLED. Asi la
    // cancelacion llega al calendario de quien ya tenia la fecha, en vez de
    // dejarle un evento fantasma. Se reutilizan la ventana y el margen de
    // correccion ya definidos arriba, sin duplicar el criterio.
    if (f.alcance !== "propias" && f.incluirCanceladas) {
      args.push(ESTADOS_VIGENTES, String(DIAS_AVISO_ELIMINACION), String(HORAS_MARGEN_CORRECCION));
      const iv = args.length - 2, id = args.length - 1, ih = args.length;
      cond.push(
        `(a.estado = ANY($${iv}::text[]) OR (` +
        `a.estado = 'ARCHIVADA' AND a.retirada_en IS NOT NULL` +
        ` AND a.retirada_en >= now() - ($${id} || ' days')::interval` +
        ` AND a.retirada_en >= a.created_at + ($${ih} || ' hours')::interval))`
      );
    } else if (f.alcance !== "propias") {
      agregarFiltroVigente("a", cond, args);
    }
    // Seleccion explicita de actividades (el estudiante marca las que quiere).
    if (Array.isArray(f.ids) && f.ids.length) {
      args.push(f.ids);
      cond.push(`a.id = ANY($${args.length}::int[])`);
    }
    // Se agrega al final, con el patron `args.length`, para no interferir con
    // el contador `i` que usan las condiciones de arriba.
    if (f.soloParticipacion) {
      args.push(ENTIDADES_ACOMPANAMIENTO, TIPOS_PARTICIPACION);
      cond.push(
        `(e.tipo = ANY($${args.length - 1}::text[]) OR a.tipo = ANY($${args.length}::text[]))`
      );
    }

    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT a.id, a.titulo, a.descripcion, a.entidad_id, e.nombre AS entidad_nombre,
              a.fecha_inicio, a.fecha_fin, a.tipo, a.ramo, a.estado, a.ubicacion,
              a.alcance_estimado, a.compatibilidad_pct, a.url_inscripcion,
              a.updated_at
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
            tipo, ramo, estado, ubicacion, alcance_estimado, compatibilidad_pct, created_by,
            url_inscripcion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        // OJO con `||` en los campos NUMERICOS: un 0 legitimo es falsy y se
        // guardaba como NULL (revision QA, hallazgo A-1). Una actividad
        // evaluada con compatibilidad 0 (p.ej. cae en fin de semana) quedaba
        // indistinguible de una nunca evaluada, y eso subestima el "uso del
        // Match" del que depende el Sello de Coordinacion. Por eso `??`.
        [a.titulo, a.descripcion, a.entidadId, a.periodoId || null,
         a.fechaInicio, a.fechaFin, a.tipo, a.ramo || null, a.estado || "PROPUESTA",
         a.ubicacion || null, a.alcanceEstimado ?? null,
         a.compatibilidadPct ?? null, a.createdBy || null,
         a.urlInscripcion || null]
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
           ramo = COALESCE($7, ramo),
           estado = COALESCE($8, estado),
           ubicacion = COALESCE($9, ubicacion),
           compatibilidad_pct = COALESCE($10, compatibilidad_pct),
           alcance_estimado = COALESCE($11, alcance_estimado),
           url_inscripcion = COALESCE($12, url_inscripcion),
           updated_at = now()
         WHERE id = $1`,
        [id, a.titulo, a.descripcion, a.fechaInicio, a.fechaFin, a.tipo, a.ramo, a.estado, a.ubicacion,
         a.compatibilidadPct, a.alcanceEstimado, a.urlInscripcion]
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

  /** Cambia el estado de varias actividades (revision de importaciones). */
  async cambiarEstadoBulk(ids, estado) {
    if (!ids.length) return { actualizadas: 0 };
    const { rowCount } = await query(
      `UPDATE actividad SET estado = $2, updated_at = now() WHERE id = ANY($1::int[])`,
      [ids, estado]
    );
    return { actualizadas: rowCount };
  },

  /**
   * Eliminaciones recientes para el aviso publico de cancelaciones.
   * Devuelve el CENTRO responsable, nunca el nombre de la persona que pulso
   * el boton: para quien lee, el responsable es el centro, y exponer el
   * nombre individual seria exposicion innecesaria.
   * @param {number} [dias=30]
   */
  async listarEliminadasRecientes(dias) {
    const ventana = dias || DIAS_AVISO_ELIMINACION;
    const { rows } = await query(
      `SELECT a.id, a.titulo, a.tipo, a.fecha_inicio, a.fecha_fin,
              e.sigla AS entidad_sigla, e.nombre AS entidad_nombre,
              a.retirada_en, a.motivo_retiro,
              COALESCE(elim.nombre, 'Administración') AS eliminada_por
         FROM actividad a
         JOIN entidad e ON e.id = a.entidad_id
         LEFT JOIN usuario u ON u.id = a.retirada_por
         LEFT JOIN entidad elim ON elim.id = u.entidad_id
        WHERE a.estado = 'ARCHIVADA'
          AND a.retirada_en IS NOT NULL
          AND a.retirada_en >= now() - ($1 || ' days')::interval
          AND a.retirada_en >= a.created_at + ($2 || ' hours')::interval
        ORDER BY a.retirada_en DESC`,
      [String(ventana), String(HORAS_MARGEN_CORRECCION)]
    );
    return rows;
  },

  /**
   * Todo lo eliminado (cualquier entidad, sin ventana de tiempo), para la
   * seccion del panel de administracion desde la que se puede restituir.
   */
  async listarRetiradas() {
    const { rows } = await query(
      `SELECT a.id, a.titulo, a.tipo, a.fecha_inicio, a.fecha_fin,
              e.sigla AS entidad_sigla, e.nombre AS entidad_nombre,
              a.retirada_por, a.retirada_en, a.motivo_retiro
         FROM actividad a JOIN entidad e ON e.id = a.entidad_id
        WHERE a.estado = 'ARCHIVADA'
        ORDER BY a.retirada_en DESC NULLS LAST`
    );
    return rows;
  },

  /** Actividades en PROPUESTA (pendientes de revision del admin). */
  async listarPendientes() {
    const { rows } = await query(
      `SELECT a.id, a.titulo, a.tipo, a.ramo, a.fecha_inicio, a.fecha_fin,
              a.ubicacion, e.sigla AS entidad_sigla, e.nombre AS entidad_nombre
         FROM actividad a JOIN entidad e ON e.id = a.entidad_id
        WHERE a.estado = 'PROPUESTA'
        ORDER BY a.fecha_inicio`
    );
    return rows;
  },

  /**
   * Pares de actividades VIGENTES (no solo CONFIRMADA — H-02) que se
   * solapan en el tiempo y comparten al menos un segmento de publico
   * (§16.4). `desde`/`hasta` acotan la consulta a la ventana que el
   * calendario esta mostrando (H-14: sin rango, la consulta crece
   * cuadraticamente con el historial completo de actividades).
   * @param {string|Date} desde
   * @param {string|Date} hasta
   */
  async conflictos(desde, hasta) {
    const cond = [];
    const args = [];
    agregarFiltroVigente("a1", cond, args);
    cond.push(`a2.estado = ANY($${args.length}::text[])`); // mismo arreglo, sin repetir el parametro
    if (desde && hasta) {
      args.push(desde, hasta);
      cond.push(`a1.periodo && tstzrange($${args.length - 1}, $${args.length})`);
    }
    const { rows } = await query(
      `SELECT DISTINCT a1.id, a2.id AS conflicta_con, a2.titulo AS conflicta_titulo
         FROM actividad a1
         JOIN actividad a2 ON a1.id <> a2.id AND a1.periodo && a2.periodo
         JOIN actividad_publico ap1 ON ap1.actividad_id = a1.id
         JOIN actividad_publico ap2 ON ap2.actividad_id = a2.id
          AND ap2.carrera_id = ap1.carrera_id AND ap2.nivel = ap1.nivel
        WHERE ${cond.join(" AND ")}`,
      args
    );
    return rows;
  },

  /**
   * Archiva una actividad (E-07: una cuenta saliente podria borrar el
   * trabajo de un semestre sin retorno). Reemplaza el borrado fisico:
   * pasa a ARCHIVADA y registra quien/cuando/por que (FR-009b, FR-009c).
   * Usada tanto por el autor que "elimina" lo suyo como por el admin que
   * retira lo de otra entidad (ver `retirar`, que delega aqui).
   */
  async archivar(id, usuarioId, motivo = null) {
    const { rows } = await query(
      `UPDATE actividad
          SET estado = 'ARCHIVADA', retirada_por = $2, retirada_en = now(),
              motivo_retiro = $3, updated_at = now()
        WHERE id = $1
        RETURNING id, estado`,
      [id, usuarioId, motivo]
    );
    return rows[0] || { id, estado: null };
  },

  /**
   * Borrado DEFINITIVO: destruye la fila de verdad (el ON DELETE CASCADE se
   * lleva su publico objetivo). Solo para el rol SUPERADMIN.
   *
   * A diferencia de `archivar`, esto NO aparece en el aviso publico de
   * cancelaciones: es una accion de operacion —limpiar datos de prueba,
   * retirar algo publicado por error— y no una cancelacion que los
   * estudiantes deban conocer.
   *
   * Que no sea publico no significa que no quede registro: antes de borrar se
   * copian los datos a `borrado_definitivo`. Si algo desaparece, tiene que
   * poder averiguarse que paso. Todo en una transaccion, para que no exista
   * el caso de "borrado sin registro".
   */
  async borrarDefinitivo(id, usuarioId, motivo = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT a.id, a.titulo, a.entidad_id, e.nombre AS entidad_nombre,
                a.fecha_inicio, a.estado
           FROM actividad a LEFT JOIN entidad e ON e.id = a.entidad_id
          WHERE a.id = $1`,
        [id]
      );
      if (!rows[0]) { await client.query("ROLLBACK"); return null; }
      const a = rows[0];
      await client.query(
        `INSERT INTO borrado_definitivo
           (actividad_id, titulo, entidad_id, entidad_nombre, fecha_inicio,
            estado_previo, borrado_por, motivo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [a.id, a.titulo, a.entidad_id, a.entidad_nombre, a.fecha_inicio,
         a.estado, usuarioId, motivo]
      );
      await client.query(`DELETE FROM actividad WHERE id = $1`, [id]);
      await client.query("COMMIT");
      return { id: a.id, titulo: a.titulo, borrado: true };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  /** Registro interno de borrados definitivos (nunca se expone en publico). */
  async listarBorradosDefinitivos(limite = 100) {
    const { rows } = await query(
      `SELECT b.id, b.actividad_id, b.titulo, b.entidad_nombre, b.fecha_inicio,
              b.estado_previo, b.borrado_en, b.motivo, u.email AS borrado_por
         FROM borrado_definitivo b
         LEFT JOIN usuario u ON u.id = b.borrado_por
        ORDER BY b.borrado_en DESC
        LIMIT $1`,
      [Math.min(Number(limite) || 100, 500)]
    );
    return rows;
  },

  /** Alias semantico de `archivar` para la accion administrativa de retiro. */
  async retirar(id, usuarioId, motivo) {
    return module.exports.archivar(id, usuarioId, motivo);
  },

  /**
   * Restituye una actividad archivada o retirada: vuelve a PROPUESTA (el
   * estado inicial de publicacion bajo moderacion reactiva) y limpia la
   * trazabilidad de retiro, dejando constancia de quien/cuando restituyo
   * (FR-009c).
   */
  async restituir(id, usuarioId) {
    const { rows } = await query(
      `UPDATE actividad
          SET estado = 'PROPUESTA', retirada_por = NULL, retirada_en = NULL,
              motivo_retiro = NULL, restituida_por = $2, restituida_en = now(),
              updated_at = now()
        WHERE id = $1
        RETURNING id, estado`,
      [id, usuarioId]
    );
    return rows[0] || { id, estado: null };
  },

  /**
   * Segmentos (carrera, nivel) distintos que alcanzan las actividades de una
   * entidad — usado para saber si corresponde rotular el alcance como
   * estimacion referencial (T041/T042, H-10).
   */
  async segmentosDe(entidadId) {
    const { rows } = await query(
      `SELECT DISTINCT ap.carrera_id, ap.nivel
         FROM actividad_publico ap
         JOIN actividad a ON a.id = ap.actividad_id
        WHERE a.entidad_id = $1`,
      [entidadId]
    );
    return rows.map((r) => ({ carreraId: r.carrera_id, nivel: r.nivel }));
  },

  /** Todas las actividades de una entidad con campos para reputacion/reportes. */
  async listarCompleto(entidadId) {
    const { rows } = await query(
      `SELECT id, titulo, fecha_inicio, fecha_fin, tipo, ramo, estado,
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
