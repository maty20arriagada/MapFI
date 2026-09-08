"use strict";
/**
 * MapFI · borrar-actividades.js — borrado en lote de actividades cargadas por
 * error, para reparar una importacion CSV equivocada.
 *
 * POR QUE EXISTE
 * --------------
 * El boton "Eliminar" del panel de un centro no sirve para esto por dos
 * razones. La primera es que ARCHIVA (actividadDao.archivar): la actividad
 * pasa a ARCHIVADA y entra al aviso publico de cancelaciones durante 30 dias
 * (actividadDao.listarEliminadasRecientes). Deshacer una importacion de 112
 * filas asi publicaria 112 avisos de "este centro cancelo esto" a los
 * estudiantes, que es exactamente lo contrario de la verdad: nadie cancelo
 * nada, la carga estaba mal. Hay un margen de correccion de una hora pensado
 * para esto (HORAS_MARGEN_CORRECCION), pero se agota rapido. La segunda es
 * que va de una en una y no existe borrado en lote en ninguna ruta ni UI.
 *
 * Por eso este script usa el BORRADO DEFINITIVO (actividadDao.borrarDefinitivo),
 * que es transaccional, deja constancia en la tabla `borrado_definitivo` y no
 * genera aviso publico. La trazabilidad se conserva; la mentira no se publica.
 *
 * SEGURIDAD DE OPERACION
 * ----------------------
 * El modo por defecto es SIMULACION. Sin `--confirmar` no se borra nada: se
 * imprime la lista completa de lo que se borraria y se sale. Es deliberado —
 * un script que borra por defecto es un accidente esperando a ocurrir.
 *
 * USO
 *   # 1. Ver que se borraria (no toca la base)
 *   node js/db/borrar-actividades.js --entidad CEEIND --desde 2026-08-01 --hasta 2026-12-31
 *
 *   # 2. Borrar de verdad
 *   node js/db/borrar-actividades.js --entidad CEEIND --desde 2026-08-01 --hasta 2026-12-31 --confirmar
 *
 * OPCIONES
 *   --entidad <SIGLA>      sigla del centro (CEEIND, CEEINF...). Obligatoria,
 *                          salvo que se use --entidad-id.
 *   --entidad-id <N>       id numerico, alternativa a --entidad.
 *   --desde <AAAA-MM-DD>   limite inferior de fecha_inicio. Obligatorio.
 *   --hasta <AAAA-MM-DD>   limite superior de fecha_inicio. Obligatorio.
 *   --creadas-desde <ISO>  solo las creadas a partir de ese instante. Sirve
 *                          para no arrastrar actividades legitimas anteriores
 *                          del mismo centro en el mismo rango de fechas.
 *   --ramo <texto>         solo las de ese ramo (coincidencia exacta).
 *   --por <email>          cuenta a la que se atribuye el borrado en la
 *                          constancia. Si no se indica, queda sin autor.
 *   --motivo <texto>       queda guardado en `borrado_definitivo.motivo`.
 *   --confirmar            ejecuta. Sin esto es simulacion.
 *
 * Los dos limites de fecha son obligatorios A PROPOSITO: es el mismo criterio
 * que DELETE /api/bloques, que exige carreraId y nivel para no vaciar la tabla
 * entera por un parametro olvidado.
 */
require("../load-env")();

const { pool, query } = require("./index");
const actividadDao = require("../dao/actividadDao");

const MOTIVO_DEFECTO = "Limpieza de importacion CSV erronea";

/** Lee `--clave valor` de argv. Devuelve null si no esta. */
function opcion(argv, nombre) {
  const i = argv.indexOf("--" + nombre);
  if (i === -1) return null;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : null;
}
function bandera(argv, nombre) {
  return argv.indexOf("--" + nombre) !== -1;
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida los argumentos y devuelve `{ ok, error, filtros, confirmar }`.
 * Separado del I/O para poder probarlo sin base de datos.
 */
function parsearArgs(argv) {
  const entidad = opcion(argv, "entidad");
  const entidadId = opcion(argv, "entidad-id");
  const desde = opcion(argv, "desde");
  const hasta = opcion(argv, "hasta");

  if (!entidad && !entidadId) {
    return { ok: false, error: "Falta --entidad <SIGLA> (o --entidad-id <N>)." };
  }
  if (!desde || !hasta) {
    return { ok: false, error: "Faltan --desde y --hasta (AAAA-MM-DD). Son obligatorios para no borrar de mas." };
  }
  if (!RE_FECHA.test(desde) || !RE_FECHA.test(hasta)) {
    return { ok: false, error: "Las fechas deben ir en formato AAAA-MM-DD." };
  }
  if (desde > hasta) {
    return { ok: false, error: "--desde no puede ser posterior a --hasta." };
  }

  return {
    ok: true,
    confirmar: bandera(argv, "confirmar"),
    filtros: {
      entidadSigla: entidad ? entidad.toUpperCase() : null,
      entidadId: entidadId ? Number(entidadId) : null,
      desde,
      hasta,
      creadasDesde: opcion(argv, "creadas-desde"),
      ramo: opcion(argv, "ramo"),
      porEmail: opcion(argv, "por"),
      motivo: opcion(argv, "motivo") || MOTIVO_DEFECTO,
    },
  };
}

/**
 * Arma el SELECT de candidatas. Devuelve `{ sql, args }` para poder
 * inspeccionarlo en las pruebas sin ejecutarlo.
 */
function consultaCandidatas(filtros) {
  const cond = ["a.entidad_id = $1", "a.fecha_inicio >= $2::date", "a.fecha_inicio < ($3::date + 1)"];
  const args = [filtros.entidadId, filtros.desde, filtros.hasta];
  if (filtros.creadasDesde) {
    args.push(filtros.creadasDesde);
    cond.push(`a.created_at >= $${args.length}`);
  }
  if (filtros.ramo) {
    args.push(filtros.ramo);
    cond.push(`a.ramo = $${args.length}`);
  }
  return {
    sql:
      `SELECT a.id, a.titulo, a.ramo, a.tipo, a.estado, a.fecha_inicio, a.created_at
         FROM actividad a
        WHERE ${cond.join(" AND ")}
        ORDER BY a.fecha_inicio, a.id`,
    args,
  };
}

async function resolverEntidad(filtros) {
  if (filtros.entidadId) {
    const { rows } = await query("SELECT id, sigla, nombre FROM entidad WHERE id = $1", [filtros.entidadId]);
    return rows[0] || null;
  }
  const { rows } = await query("SELECT id, sigla, nombre FROM entidad WHERE upper(sigla) = $1", [filtros.entidadSigla]);
  return rows[0] || null;
}

async function resolverUsuario(email) {
  if (!email) return null;
  const { rows } = await query("SELECT id, nombre FROM usuario WHERE lower(email) = $1", [email.trim().toLowerCase()]);
  return rows[0] || null;
}

function fmtFecha(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 16).replace("T", " ");
}

async function main() {
  const parsed = parsearArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error("[borrar-actividades] " + parsed.error);
    console.error("[borrar-actividades] Ejemplo:");
    console.error("  node js/db/borrar-actividades.js --entidad CEEIND --desde 2026-08-01 --hasta 2026-12-31");
    process.exit(1);
  }

  const { filtros, confirmar } = parsed;

  const entidad = await resolverEntidad(filtros);
  if (!entidad) {
    console.error(`[borrar-actividades] No existe la entidad ${filtros.entidadSigla || filtros.entidadId}.`);
    process.exit(1);
  }
  filtros.entidadId = entidad.id;

  let usuario = null;
  if (filtros.porEmail) {
    usuario = await resolverUsuario(filtros.porEmail);
    if (!usuario) {
      console.warn(`[borrar-actividades] AVISO: no existe la cuenta ${filtros.porEmail}; la constancia quedara sin autor.`);
    }
  }

  const { sql, args } = consultaCandidatas(filtros);
  const { rows } = await query(sql, args);

  console.log("");
  console.log(`  Entidad : ${entidad.sigla} — ${entidad.nombre}`);
  console.log(`  Rango   : ${filtros.desde} .. ${filtros.hasta}`);
  if (filtros.creadasDesde) console.log(`  Creadas : desde ${filtros.creadasDesde}`);
  if (filtros.ramo) console.log(`  Ramo    : ${filtros.ramo}`);
  console.log(`  Modo    : ${confirmar ? "BORRADO REAL" : "SIMULACION (sin --confirmar no se toca nada)"}`);
  console.log("");

  if (!rows.length) {
    console.log("  No hay actividades que coincidan. No se borra nada.");
    return;
  }

  console.log(`  ${rows.length} actividad(es):`);
  console.log("  " + "-".repeat(84));
  console.log("   id    fecha              ramo                      titulo");
  console.log("  " + "-".repeat(84));
  for (const r of rows) {
    console.log(
      "  " + String(r.id).padEnd(6) +
      fmtFecha(r.fecha_inicio).padEnd(19) +
      String(r.ramo || "—").slice(0, 24).padEnd(26) +
      String(r.titulo || "").slice(0, 34)
    );
  }
  console.log("  " + "-".repeat(84));
  console.log("");

  if (!confirmar) {
    console.log("  Simulacion: NO se borro nada.");
    console.log("  Repite el comando con --confirmar para borrarlas de verdad.");
    return;
  }

  let borradas = 0;
  const fallos = [];
  for (const r of rows) {
    try {
      const res = await actividadDao.borrarDefinitivo(r.id, usuario ? usuario.id : null, filtros.motivo);
      if (res) borradas++;
      else fallos.push({ id: r.id, error: "ya no existia" });
    } catch (e) {
      // Una fila que falla no debe abortar el resto: se acumula y se informa
      // al final (mismo criterio que importar-matricula.js).
      fallos.push({ id: r.id, error: e.message });
    }
  }

  console.log(`  Borradas: ${borradas} de ${rows.length}. Queda constancia en la tabla borrado_definitivo.`);
  if (fallos.length) {
    console.log(`  Con problemas: ${fallos.length}`);
    fallos.forEach((f) => console.log(`    id ${f.id}: ${f.error}`));
  }
  console.log("  El aviso publico de cancelaciones NO se toca: esto fue un error de carga, no una cancelacion.");
}

// Solo se ejecuta como CLI; al importarlo desde una prueba no hace nada.
if (require.main === module) {
  main()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[borrar-actividades] ERROR:", e.message);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { parsearArgs, consultaCandidatas };
