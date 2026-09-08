"use strict";
/**
 * MapFI · reclasificar-actividades.js — pone al dia `tipo`, `ramo` y `titulo`
 * de las actividades ya cargadas, sin borrar ni recrear nada.
 *
 * POR QUE UN UPDATE Y NO "DESCARGAR, BORRAR Y RESUBIR"
 * ---------------------------------------------------
 * Porque resubir PIERDE DATOS. GET /api/actividades no devuelve el publico
 * objetivo: el SELECT de actividadDao.listar() trae titulo, ramo, fechas y
 * entidad, pero las carreras y los años viven en `actividad_publico` y no
 * salen por ahi. Un ciclo descargar/borrar/resubir dejaria cada actividad sin
 * saber a quien va dirigida, que es lo que hace funcionar el calendario, el
 * mapa de calor y la deteccion de choques.
 *
 * Ademas el .ics usa el id de la actividad como UID: recrearlas cambia todos
 * los ids y descoloca los calendarios ya suscritos.
 *
 * Aqui solo se hace UPDATE de tres columnas. Ids, publico objetivo, fechas,
 * entidad y estado quedan intactos, y no se genera aviso de cancelacion.
 *
 * QUE DECIDE EL CAMBIO
 * --------------------
 * js/services/actividadTipo.js, que es puro y esta probado. Ahi vive la regla
 * de sufijos (`<Ramo>`, `<Ramo> TEST`, `<Ramo> EX`, `<Ramo> TAREA`) y la
 * decision de respetar lo que ya se clasifico a mano.
 *
 * SEGURIDAD DE OPERACION
 * ----------------------
 *   - SIMULACION POR DEFECTO: sin `--confirmar` no se escribe nada.
 *   - RESPALDO de las tres columnas ANTES del primer UPDATE. Si el respaldo
 *     no se puede escribir, aborta sin tocar la base: perder la vuelta atras
 *     no es un riesgo aceptable.
 *   - Todo en UNA transaccion: o cambian las N filas o no cambia ninguna.
 *
 * USO
 *   node js/db/reclasificar-actividades.js --salida /tmp              # simular
 *   node js/db/reclasificar-actividades.js --salida /tmp --confirmar  # aplicar
 *
 * OPCIONES
 *   --entidad <SIGLA>   limita a un centro (CEEMET, CEEIND...).
 *   --salida <dir>      donde dejar respaldo e informe (por defecto, el cwd).
 *   --confirmar         ejecuta. Sin esto es simulacion.
 *
 * REVERTIR
 *   El respaldo es un CSV `id,tipo,ramo,titulo` con los valores ANTERIORES:
 *     CREATE TEMP TABLE t(id int, tipo text, ramo text, titulo text);
 *     \copy t FROM 'respaldo-....csv' CSV HEADER
 *     UPDATE actividad a SET tipo=t.tipo, ramo=NULLIF(t.ramo,''), titulo=t.titulo
 *       FROM t WHERE a.id = t.id;
 */
require("../load-env")();

const fs = require("fs");
const path = require("path");
const { pool, query } = require("./index");
const { planificar } = require("../services/actividadTipo");

function opcion(argv, nombre) {
  const i = argv.indexOf("--" + nombre);
  if (i === -1) return null;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : null;
}
function bandera(argv, nombre) {
  return argv.indexOf("--" + nombre) !== -1;
}

/** Escapa un campo para CSV. */
function campo(v) {
  const s = String(v == null ? "" : v);
  return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Guarda los valores ANTERIORES de las filas que van a cambiar. */
function escribirRespaldo(dir, cambios) {
  const nombre = "respaldo-actividades-" + new Date().toISOString().replace(/[:.]/g, "-") + ".csv";
  const ruta = path.join(dir, nombre);
  const lineas = ["id,tipo,ramo,titulo"].concat(
    cambios.map((c) => [c.id, campo(c.tipoPrevio), campo(c.ramoPrevio), campo(c.tituloPrevio)].join(","))
  );
  fs.writeFileSync(ruta, lineas.join("\n") + "\n", "utf8");
  return ruta;
}

function escribirInforme(dir, plan) {
  const ruta = path.join(dir, "RECLASIFICACION.md");
  const l = [];
  l.push("# Reclasificacion de actividades");
  l.push("");
  l.push("Fecha: " + new Date().toISOString());
  l.push("");
  l.push("## Resumen de tipos");
  l.push("");
  l.push("| Cambio | Filas |");
  l.push("|---|---|");
  Object.keys(plan.resumen).sort().forEach((k) => l.push("| " + k + " | " + plan.resumen[k] + " |"));
  l.push("");
  l.push("Cambian: " + plan.cambios.length + " · Sin cambio: " + plan.sinCambio +
    " · Respetadas: " + plan.respetadas.length);
  l.push("");
  l.push("## Detalle de lo que cambia");
  l.push("");
  l.push("| id | tipo | ramo (nuevo) | titulo (antes -> despues) |");
  l.push("|---|---|---|---|");
  plan.cambios.forEach((c) =>
    l.push("| " + c.id + " | " + c.tipoPrevio + " -> " + c.tipoNuevo + " | " + c.ramoNuevo +
      " | " + c.tituloPrevio + " -> " + c.tituloNuevo + " |"));
  l.push("");
  if (plan.respetadas.length) {
    l.push("## Respetadas (no se tocan)");
    l.push("");
    l.push("| id | tipo | titulo | motivo |");
    l.push("|---|---|---|---|");
    plan.respetadas.forEach((r) =>
      l.push("| " + r.id + " | " + r.tipo + " | " + r.titulo + " | " + r.motivo + " |"));
    l.push("");
  }
  fs.writeFileSync(ruta, l.join("\n") + "\n", "utf8");
  return ruta;
}

async function main() {
  const argv = process.argv.slice(2);
  const confirmar = bandera(argv, "confirmar");
  const sigla = opcion(argv, "entidad");
  const dir = opcion(argv, "salida") || process.cwd();

  const cond = ["a.estado = ANY($1::text[])"];
  const args = [["PROPUESTA", "CONFIRMADA", "REALIZADA"]];
  if (sigla) {
    args.push(sigla.toUpperCase());
    cond.push("upper(e.sigla) = $" + args.length);
  }

  const { rows } = await query(
    `SELECT a.id, a.titulo, a.ramo, a.tipo, a.fecha_inicio AS "fechaInicio",
            e.sigla AS "entidadSigla"
       FROM actividad a
       JOIN entidad e ON e.id = a.entidad_id
      WHERE ${cond.join(" AND ")}
      ORDER BY e.sigla, a.fecha_inicio, a.id`,
    args
  );

  console.log("");
  console.log("  Actividades vigentes: " + rows.length + (sigla ? " (entidad " + sigla.toUpperCase() + ")" : ""));
  console.log("  Modo: " + (confirmar ? "APLICAR" : "SIMULACION — sin --confirmar no se escribe nada"));
  console.log("");

  if (!rows.length) {
    console.log("  No hay nada que analizar.");
    return;
  }

  const plan = planificar(rows);

  console.log("  Tipos:");
  Object.keys(plan.resumen).sort().forEach((k) => console.log("    " + k.padEnd(24) + plan.resumen[k]));
  console.log("");
  console.log("  Cambian: " + plan.cambios.length +
    "   ·   Sin cambio: " + plan.sinCambio +
    "   ·   Respetadas: " + plan.respetadas.length);

  if (plan.cambios.length) {
    console.log("");
    console.log("  " + "id".padEnd(6) + "tipo".padEnd(20) + "ramo".padEnd(38) + "titulo");
    console.log("  " + "-".repeat(86));
    plan.cambios.forEach((c) => {
      console.log("  " + String(c.id).padEnd(6) +
        (c.tipoPrevio + "->" + c.tipoNuevo).padEnd(20) +
        String(c.ramoNuevo).slice(0, 36).padEnd(38) +
        c.tituloNuevo);
    });
  }

  if (plan.respetadas.length) {
    console.log("");
    console.log("  Respetadas (no se tocan):");
    plan.respetadas.forEach((r) =>
      console.log("    " + String(r.id).padEnd(6) + r.tipo.padEnd(9) +
        String(r.titulo).slice(0, 38).padEnd(40) + r.motivo));
  }

  try {
    console.log("");
    console.log("  Informe: " + escribirInforme(dir, plan));
  } catch (e) {
    console.warn("  AVISO: no se pudo escribir el informe (" + e.message + "). Se continua.");
  }

  if (!confirmar) {
    console.log("");
    console.log("  Simulacion: la base NO se toco.");
    console.log("  Revisa el informe y repite con --confirmar para aplicar.");
    return;
  }

  if (!plan.cambios.length) {
    console.log("");
    console.log("  No hay nada que cambiar.");
    return;
  }

  // El respaldo va ANTES de escribir. Si falla, no se aplica nada.
  let rutaRespaldo;
  try {
    rutaRespaldo = escribirRespaldo(dir, plan.cambios);
  } catch (e) {
    console.error("  ERROR: no se pudo escribir el respaldo (" + e.message + ").");
    console.error("  NO se aplico ningun cambio. Usa --salida <dir> con permiso de escritura.");
    process.exitCode = 1;
    return;
  }
  console.log("  Respaldo de los valores anteriores: " + rutaRespaldo);

  // Todo o nada: si una fila falla, ninguna queda a medias.
  const cliente = await pool.connect();
  let actualizadas = 0;
  try {
    await cliente.query("BEGIN");
    const res = await cliente.query(
      `UPDATE actividad a
          SET tipo = v.tipo, ramo = v.ramo, titulo = v.titulo, updated_at = now()
         FROM (SELECT unnest($1::int[])  AS id,
                      unnest($2::text[]) AS tipo,
                      unnest($3::text[]) AS ramo,
                      unnest($4::text[]) AS titulo) v
        WHERE a.id = v.id`,
      [
        plan.cambios.map((c) => c.id),
        plan.cambios.map((c) => c.tipoNuevo),
        plan.cambios.map((c) => c.ramoNuevo),
        plan.cambios.map((c) => c.tituloNuevo),
      ]
    );
    actualizadas = res.rowCount;
    await cliente.query("COMMIT");
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error("  ERROR al aplicar, se deshizo TODO: " + e.message);
    console.error("  La base quedo como estaba. Respaldo en " + rutaRespaldo);
    process.exitCode = 1;
    return;
  } finally {
    cliente.release();
  }

  console.log("");
  console.log("  Actualizadas: " + actualizadas + " de " + plan.cambios.length + ".");
  console.log("  No se toco el publico objetivo, ni las fechas, ni los ids.");
}

if (require.main === module) {
  main()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[reclasificar-actividades] ERROR:", e.message);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { escribirRespaldo, campo };
