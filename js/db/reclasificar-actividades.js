"use strict";
/**
 * MapFI · reclasificar-actividades.js — pone al dia el campo `tipo` de las
 * actividades ya cargadas, sin tocar nada mas.
 *
 * POR QUE UN UPDATE Y NO "DESCARGAR, BORRAR Y RESUBIR"
 * ---------------------------------------------------
 * Porque resubir PIERDE DATOS. GET /api/actividades no devuelve el publico
 * objetivo: el SELECT de actividadDao.listar() trae titulo, ramo, fechas y
 * entidad, pero las carreras y los años viven en `actividad_publico` y no
 * salen por ahi. Un ciclo descargar/borrar/resubir dejaria cada actividad
 * sin saber a quien va dirigida, que es justo lo que hace funcionar el
 * calendario, el mapa de calor y la deteccion de choques.
 *
 * Ademas el .ics usa el id de la actividad como UID: recrearlas cambia todos
 * los ids y descoloca los calendarios ya suscritos.
 *
 * Este script solo ejecuta `UPDATE actividad SET tipo = $1 WHERE id = $2`.
 * Ids, publico objetivo, fechas, ramo, entidad y estado quedan intactos, y
 * no se genera aviso publico de cancelacion.
 *
 * SEGURIDAD DE OPERACION
 * ----------------------
 *   - SIMULACION POR DEFECTO: sin `--confirmar` no se escribe nada.
 *   - Antes de escribir se guarda un RESPALDO CSV con el tipo anterior de
 *     cada fila, para poder revertir con una sola consulta.
 *   - El informe separa los cambios ESPERADOS de los que conviene mirar dos
 *     veces (una CHARLA que pasa a ser tarea, por ejemplo).
 *
 * USO
 *   # 1. Ver que cambiaria (no toca la base)
 *   node js/db/reclasificar-actividades.js
 *
 *   # 2. Aplicar
 *   node js/db/reclasificar-actividades.js --confirmar
 *
 * OPCIONES
 *   --entidad <SIGLA>   limita a un centro (CEEMET, CEEIND...). Sin esto,
 *                       todas las entidades.
 *   --salida <dir>      donde dejar respaldo e informe (por defecto, el
 *                       directorio actual).
 *   --confirmar         ejecuta. Sin esto es simulacion.
 *
 * REVERTIR
 *   El respaldo es un CSV `id,tipo`. Para deshacer:
 *     \copy tmp_tipos(id,tipo) FROM 'respaldo-tipos-....csv' CSV HEADER
 *     UPDATE actividad a SET tipo = t.tipo FROM tmp_tipos t WHERE a.id = t.id;
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

/**
 * Guarda el tipo anterior de cada fila que va a cambiar. Se escribe ANTES de
 * tocar la base: si el respaldo falla, no se aplica nada.
 */
function escribirRespaldo(dir, cambios) {
  const nombre = "respaldo-tipos-" + new Date().toISOString().replace(/[:.]/g, "-") + ".csv";
  const ruta = path.join(dir, nombre);
  const lineas = ["id,tipo"].concat(cambios.map((c) => c.id + "," + campo(c.tipoPrevio)));
  fs.writeFileSync(ruta, lineas.join("\n") + "\n", "utf8");
  return ruta;
}

function escribirInforme(dir, plan, sospechosos) {
  const ruta = path.join(dir, "RECLASIFICACION.md");
  const l = [];
  l.push("# Reclasificacion de actividades");
  l.push("");
  l.push("Fecha: " + new Date().toISOString());
  l.push("");
  l.push("## Resumen");
  l.push("");
  l.push("| Cambio | Filas |");
  l.push("|---|---|");
  Object.keys(plan.resumen).sort().forEach((k) => l.push("| " + k + " | " + plan.resumen[k] + " |"));
  l.push("");
  l.push("Sin cambio: " + plan.sinCambio + " · Con cambio: " + plan.cambios.length);
  l.push("");
  if (sospechosos.length) {
    l.push("## Revisar: no eran academicas y pasan a serlo");
    l.push("");
    l.push("Estaban clasificadas como charla, taller o extraprogramatica y la regla");
    l.push("acordada las convierte igualmente en certamen o tarea.");
    l.push("");
    l.push("| id | entidad | antes | despues | titulo |");
    l.push("|---|---|---|---|---|");
    sospechosos.forEach((c) =>
      l.push("| " + c.id + " | " + c.entidadSigla + " | " + c.tipoPrevio + " | " + c.tipoNuevo + " | " + c.titulo + " |"));
    l.push("");
  }
  if (plan.ambiguas.length) {
    l.push("## Ambiguas: el titulo no decia nada");
    l.push("");
    l.push("Cayeron en el fallback (tarea). Conviene mirarlas a mano.");
    l.push("");
    l.push("| id | antes | despues | titulo |");
    l.push("|---|---|---|---|");
    plan.ambiguas.forEach((a) =>
      l.push("| " + a.id + " | " + a.tipoPrevio + " | " + a.tipoNuevo + " | " + a.titulo + " |"));
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
    `SELECT a.id, a.titulo, a.ramo, a.tipo, e.sigla AS "entidadSigla", e.nombre AS entidad_nombre
       FROM actividad a
       JOIN entidad e ON e.id = a.entidad_id
      WHERE ${cond.join(" AND ")}
      ORDER BY e.sigla, a.fecha_inicio, a.id`,
    args
  );

  console.log("");
  console.log("  Actividades vigentes analizadas: " + rows.length + (sigla ? " (entidad " + sigla.toUpperCase() + ")" : ""));
  console.log("  Modo: " + (confirmar ? "APLICAR" : "SIMULACION — sin --confirmar no se escribe nada"));
  console.log("");

  if (!rows.length) {
    console.log("  No hay nada que analizar.");
    return;
  }

  const plan = planificar(rows);

  console.log("  Reparto:");
  Object.keys(plan.resumen).sort().forEach((k) => {
    console.log("    " + k.padEnd(34) + plan.resumen[k]);
  });
  console.log("");
  console.log("  Sin cambio: " + plan.sinCambio + "   ·   Cambian: " + plan.cambios.length);

  // Lo que estaba clasificado como NO academico y pasa a serlo: es el efecto
  // de la regla acordada, pero merece verse aparte antes de confirmar.
  const NO_ACADEMICAS = ["CHARLA", "TALLER", "EXTRAPROGRAMATICA"];
  const sospechosos = plan.cambios.filter((c) => NO_ACADEMICAS.indexOf(c.tipoPrevio) !== -1);
  if (sospechosos.length) {
    console.log("");
    console.log("  ATENCION: " + sospechosos.length + " actividad(es) NO academicas pasan a certamen o tarea:");
    sospechosos.slice(0, 15).forEach((c) => {
      console.log("    " + String(c.id).padEnd(6) + (c.entidadSigla || "").padEnd(8) +
        c.tipoPrevio.padEnd(19) + "-> " + c.tipoNuevo.padEnd(9) + String(c.titulo).slice(0, 40));
    });
    if (sospechosos.length > 15) console.log("    … y " + (sospechosos.length - 15) + " mas (ver el informe).");
  }

  if (plan.ambiguas.length) {
    console.log("");
    console.log("  " + plan.ambiguas.length + " con titulo que no dice nada: quedan como TAREA (ver el informe).");
  }

  let rutaInforme = null;
  try {
    rutaInforme = escribirInforme(dir, plan, sospechosos);
    console.log("");
    console.log("  Informe: " + rutaInforme);
  } catch (e) {
    console.warn("  AVISO: no se pudo escribir el informe (" + e.message + "). Se continua igual.");
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

  // El respaldo va ANTES del primer UPDATE: si no se puede escribir, no se
  // aplica nada. Perder la vuelta atras no es un riesgo aceptable.
  let rutaRespaldo;
  try {
    rutaRespaldo = escribirRespaldo(dir, plan.cambios);
  } catch (e) {
    console.error("  ERROR: no se pudo escribir el respaldo (" + e.message + ").");
    console.error("  NO se aplico ningun cambio. Usa --salida <dir> con permiso de escritura.");
    process.exitCode = 1;
    return;
  }
  console.log("  Respaldo del tipo anterior: " + rutaRespaldo);

  // Una sola sentencia para todo: o cambian las N o no cambia ninguna.
  const ids = plan.cambios.map((c) => c.id);
  const tipos = plan.cambios.map((c) => c.tipoNuevo);
  const res = await query(
    `UPDATE actividad a
        SET tipo = v.tipo, updated_at = now()
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS tipo) v
      WHERE a.id = v.id AND a.tipo IS DISTINCT FROM v.tipo`,
    [ids, tipos]
  );

  console.log("");
  console.log("  Actualizadas: " + res.rowCount + " de " + plan.cambios.length + ".");
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
