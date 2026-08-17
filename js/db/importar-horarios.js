"use strict";
/**
 * Importa el horario de clases de la Facultad de Ingeniería desde el volcado
 * `Extras/Horarios_FI_UDEC.txt`, repartiéndolo por carrera y año.
 *
 * Encadena los tres servicios puros que hacen el trabajo de verdad:
 *   js/services/horarioFiParser.js  — interpreta el .txt (formato y suciedad)
 *   js/services/horarioCarrera.js   — prefijo del código → carrera(s) de MapFI
 *   js/services/horarioMalla.js     — nombre + código → año (1..5)
 *
 * Uso:
 *   npm run seed:horarios -- Extras/Horarios_FI_UDEC.txt --dry-run
 *   npm run seed:horarios -- Extras/Horarios_FI_UDEC.txt
 *   docker compose exec server node js/db/importar-horarios.js /ruta.txt
 *
 * --dry-run genera los CSV por segmento y el informe de revisión SIN tocar la
 * base. Es el modo con el que se revisa antes de cargar de verdad.
 *
 * Idempotente: cada segmento (carrera, año) se carga en modo "reemplazar",
 * así que re-ejecutarlo deja el horario igual, no duplicado.
 *
 * OJO con el alcance: esto BORRA Y REEMPLAZA el horario de cada segmento que
 * aparezca en el archivo. Los segmentos que el archivo no mencione quedan
 * intactos.
 */
require("../load-env")();

const fs = require("fs");
const path = require("path");

const { parsearArchivoFI, aBloques } = require("../services/horarioFiParser");
const { carrerasDe, normalizar, CARRERA } = require("../services/horarioCarrera");
const { indexarMallas, resolverNivel, MALLAS_VALIDAS } = require("../services/horarioMalla");

const LOG = "[importar-horarios]";

// El pool solo se abre si de verdad se va a cargar: `require("./index")` mata
// el proceso cuando no hay DATABASE_URL, y --dry-run debe funcionar sin base.
let poolAbierto = null;
const DIR_SALIDA = path.join(__dirname, "..", "..", "Extras", "salida");
const DIR_MALLAS = path.join(__dirname, "..", "..", "Extras", "Mallas");

// codigo de carrera -> id, para nombrar los CSV de forma legible.
const CODIGO_POR_ID = Object.fromEntries(Object.entries(CARRERA).map(([cod, id]) => [id, cod]));

/** Carga las mallas del disco, si están. Sin mallas el script sigue: el año
 *  sale del código, con menos confianza, y el informe lo deja dicho. */
function cargarMallas() {
  if (!fs.existsSync(DIR_MALLAS)) return { indice: new Map(), descartadas: [], archivos: 0 };
  const archivos = fs.readdirSync(DIR_MALLAS).filter((f) => f.toLowerCase().endsWith(".html"));
  const mallas = archivos.map((archivo) => ({
    archivo,
    html: fs.readFileSync(path.join(DIR_MALLAS, archivo), "utf8"),
  }));
  const { indice, descartadas } = indexarMallas(mallas);
  return { indice, descartadas, archivos: archivos.length };
}

/** Nombres normalizados de la malla de Aeroespacial, para separarla de Mecánica. */
function ramosAeroespacial(indice) {
  const idx = indice.get(CARRERA.ICAE);
  return idx ? new Set(idx.keys()) : new Set();
}

/** Escapa un campo para el CSV `;` que acepta js/horario-csv.js, neutralizando
 *  además la inyección de fórmulas (mismo criterio que HorarioCsv.aCsv). */
function campoCsv(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const SIGLA_DIA = ["", "LUN", "MAR", "MIE", "JUE", "VIE"];

function aTextoCsv(bloques) {
  const filas = ["dia;inicio;fin;ramo;tipo;codigo;seccion;sala;docente"];
  bloques.forEach((b) => {
    filas.push([
      SIGLA_DIA[b.diaSemana], b.horaInicio, b.horaFin,
      campoCsv(b.descripcion), campoCsv(b.tipo), campoCsv(b.codigo),
      campoCsv(b.seccion), campoCsv(b.sala), campoCsv(b.docente),
    ].join(";"));
  });
  return "﻿" + filas.join("\r\n") + "\r\n";
}

/** Construye todos los bloques repartidos por (carrera, nivel). */
function construir(texto, indiceMallas) {
  const { registros, errores } = parsearArchivoFI(texto);
  const aero = ramosAeroespacial(indiceMallas);

  const segmentos = new Map(); // "carreraId|nivel" -> bloques[]
  const revision = { sinCarrera: [], sinSesiones: [], confianzaBaja: [], confianzaMedia: [], sinCodigo: [] };
  let totalBloques = 0;

  registros.forEach((reg) => {
    if (!reg.codigo) revision.sinCodigo.push(reg);

    if (!reg.sesiones.length) { revision.sinSesiones.push(reg); return; }

    const { carreras, esComun } = carrerasDe(reg.codigo, reg.ramo, {
      codigoHeredado: reg.codigoHeredado,
      ramosAeroespacial: aero,
    });

    if (!carreras.length) { revision.sinCarrera.push(reg); return; }

    const bloquesBase = aBloques(reg);

    carreras.forEach((carreraId) => {
      const { nivel, confianza, fuente } = resolverNivel({
        ramo: reg.ramo,
        codigo: reg.codigo || reg.codigoHeredado,
        carreraId,
        indice: indiceMallas,
      });

      if (confianza === "baja") revision.confianzaBaja.push({ reg, carreraId, nivel, fuente });
      else if (confianza === "media") revision.confianzaMedia.push({ reg, carreraId, nivel, fuente });

      const clave = `${carreraId}|${nivel}`;
      if (!segmentos.has(clave)) segmentos.set(clave, []);
      // Cada carrera recibe su propia copia: el mismo ramo comun se replica.
      bloquesBase.forEach((b) => segmentos.get(clave).push({ ...b, esComun }));
      totalBloques += bloquesBase.length;
    });
  });

  return { segmentos, revision, errores, registros, totalBloques };
}

/** Informe legible de lo que quedó dudoso, para corregir a mano en la plataforma. */
function escribirInforme({ segmentos, revision, errores, registros, totalBloques }, mallas, dryRun) {
  const lineas = [];
  const hoy = new Date().toISOString().slice(0, 10);

  lineas.push("# Informe de carga del horario de la Facultad", "");
  lineas.push(`**Generado**: ${hoy}${dryRun ? " · modo `--dry-run` (no se tocó la base)" : ""}`, "");
  lineas.push("Este informe existe porque el archivo de horarios de la Facultad **no dice a qué año**");
  lineas.push("pertenece cada ramo. El año se deduce (ver `js/services/horarioMalla.js`) y todo lo que");
  lineas.push("no se pudo determinar con certeza queda listado abajo para corregirlo a mano desde");
  lineas.push("la plataforma.", "");

  lineas.push("## Resumen", "");
  lineas.push(`- Registros leídos del archivo: **${registros.length}**`);
  lineas.push(`- Bloques generados: **${totalBloques}**`);
  lineas.push(`- Segmentos (carrera × año) con horario: **${segmentos.size}**`);
  lineas.push(`- Mallas indexadas: **${mallas.indice.size}** de ${mallas.archivos} archivos`);
  lineas.push(`- Líneas que el parser no supo interpretar: **${errores.length}**`);
  lineas.push("");

  if (mallas.descartadas.length) {
    lineas.push("### Mallas descartadas", "");
    lineas.push("Estos archivos están mal etiquetados: su nombre dice una carrera y su contenido es otra.", "");
    mallas.descartadas.forEach((d) => lineas.push(`- ${d}`));
    lineas.push("");
  }

  lineas.push("## Bloques por carrera y año", "");
  lineas.push("| Carrera | Año | Bloques |");
  lineas.push("|---|---|---|");
  [...segmentos.entries()]
    .map(([clave, bloques]) => {
      const [carreraId, nivel] = clave.split("|").map(Number);
      return { carrera: CODIGO_POR_ID[carreraId], nivel, n: bloques.length };
    })
    .sort((a, b) => a.carrera.localeCompare(b.carrera) || a.nivel - b.nivel)
    .forEach((s) => lineas.push(`| ${s.carrera} | ${s.nivel} | ${s.n} |`));
  lineas.push("");

  const seccionRevision = (titulo, items, formatear, explicacion) => {
    lineas.push(`## ${titulo} (${items.length})`, "");
    if (explicacion) lineas.push(explicacion, "");
    if (!items.length) { lineas.push("_Ninguno._", ""); return; }
    items.forEach((it) => lineas.push(`- ${formatear(it)}`));
    lineas.push("");
  };

  /**
   * Agrupa por ramo antes de listar. Sin esto, un ramo común aparece 14 veces
   * (una por carrera) y el informe reporta "110 dudosos" cuando en realidad
   * son 7 ramos — un número que asusta sin informar.
   */
  const seccionPorRamo = (titulo, items, explicacion) => {
    const porRamo = new Map();
    items.forEach(({ reg, carreraId, nivel, fuente }) => {
      const clave = `${reg.codigo || "sin código"}|${reg.ramo}`;
      if (!porRamo.has(clave)) {
        porRamo.set(clave, { reg, nivel, fuente, carreras: [] });
      }
      porRamo.get(clave).carreras.push(CODIGO_POR_ID[carreraId]);
    });

    lineas.push(`## ${titulo} (${porRamo.size} ramos · ${items.length} bloques de horario)`, "");
    if (explicacion) lineas.push(explicacion, "");
    if (!porRamo.size) { lineas.push("_Ninguno._", ""); return; }

    [...porRamo.values()]
      .sort((a, b) => a.reg.ramo.localeCompare(b.reg.ramo))
      .forEach(({ reg, nivel, fuente, carreras }) => {
        const donde = carreras.length >= 14 ? "todas las carreras" : carreras.join(", ");
        lineas.push(
          `- \`${reg.codigo || "sin código"}\` **${reg.ramo}** → asignado a ${nivel}.º año ` +
          `en ${donde} · línea ${reg.nroLinea}${fuente ? ` · ${fuente}` : ""}`
        );
      });
    lineas.push("");
  };

  seccionPorRamo(
    "Año de confianza BAJA — revisar",
    revision.confianzaBaja,
    "No hubo ninguna señal para deducir el año: se asumió **1.er año**. Son los que más urge corregir " +
    "a mano desde la plataforma."
  );

  seccionPorRamo(
    "Año de confianza MEDIA — deducido del código",
    revision.confianzaMedia,
    "El ramo no estaba en la malla de su carrera, así que el año sale del 4.º dígito del código. " +
    "Acierta la mayoría de las veces, pero conviene revisarlo por muestreo."
  );

  seccionRevision(
    "Registros sin código en el archivo",
    revision.sinCodigo,
    (reg) => `**${reg.ramo}** (línea ${reg.nroLinea}) — carrera heredada del código vecino \`${reg.codigoHeredado || "?"}\``,
    "El volcado perdió el código de estos ramos. La carrera se dedujo del registro contiguo del mismo bloque."
  );

  seccionRevision(
    "Registros sin carrera asignable",
    revision.sinCarrera,
    (reg) => `\`${reg.codigo || "sin código"}\` **${reg.ramo}** (línea ${reg.nroLinea})`,
    "Su prefijo de código no corresponde a ninguna carrera conocida. **No se cargaron.**"
  );

  seccionRevision(
    "Registros sin horario",
    revision.sinSesiones,
    (reg) => `\`${reg.codigo || "sin código"}\` **${reg.ramo}** (línea ${reg.nroLinea})`,
    "Ramos sin sesiones en el archivo (memorias, prácticas, actividades sin horario fijo). No generan bloques."
  );

  if (errores.length) {
    lineas.push(`## Líneas no interpretadas (${errores.length})`, "");
    errores.forEach((e) => lineas.push(`- ${e}`));
    lineas.push("");
  }

  return lineas.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const ruta = args.find((a) => !a.startsWith("--"));

  if (!ruta) {
    console.error(`${LOG} Uso: node js/db/importar-horarios.js <ruta-al-txt> [--dry-run]`);
    process.exit(1);
  }
  if (!fs.existsSync(ruta)) {
    console.error(`${LOG} No existe el archivo: ${ruta}`);
    process.exit(1);
  }

  const texto = fs.readFileSync(ruta, "utf8");
  const mallas = cargarMallas();
  console.log(`${LOG} Mallas indexadas: ${mallas.indice.size} (descartadas: ${mallas.descartadas.length})`);

  const resultado = construir(texto, mallas.indice);
  const { segmentos, revision, errores, registros, totalBloques } = resultado;

  console.log(`${LOG} Registros: ${registros.length} · Bloques: ${totalBloques} · Segmentos: ${segmentos.size}`);
  console.log(`${LOG} Confianza — baja: ${revision.confianzaBaja.length} · media: ${revision.confianzaMedia.length}`);
  if (errores.length) console.log(`${LOG} AVISO: ${errores.length} línea(s) no interpretadas`);

  // Salidas en disco: CSV por segmento + informe. Se generan siempre, tambien
  // en la carga real, para que quede respaldo de lo que se cargó.
  fs.mkdirSync(DIR_SALIDA, { recursive: true });
  segmentos.forEach((bloques, clave) => {
    const [carreraId, nivel] = clave.split("|").map(Number);
    const archivo = path.join(DIR_SALIDA, `horario-${CODIGO_POR_ID[carreraId]}-${nivel}.csv`);
    fs.writeFileSync(archivo, aTextoCsv(bloques), "utf8");
  });
  fs.writeFileSync(path.join(DIR_SALIDA, "REVISION.md"), escribirInforme(resultado, mallas, dryRun), "utf8");
  console.log(`${LOG} Escritos ${segmentos.size} CSV + REVISION.md en Extras/salida/`);

  if (dryRun) {
    console.log(`${LOG} --dry-run: no se tocó la base. Revisa Extras/salida/REVISION.md antes de cargar.`);
    return;
  }

  // Carga real. Se usa el DAO directo (no HTTP) para saltarse el límite de
  // 200 bloques por petición de POST /api/bloques/importar. El require va
  // aquí y no arriba porque arrastra el pool, que exige DATABASE_URL.
  const bloqueHorarioDao = require("../dao/bloqueHorarioDao");
  poolAbierto = require("./index").pool;
  let insertados = 0;
  let eliminados = 0;

  for (const [clave, bloques] of segmentos) {
    const [carreraId, nivel] = clave.split("|").map(Number);
    const limpios = bloques.map(({ esComun, ...b }) => b); // eslint-disable-line no-unused-vars
    const r = await bloqueHorarioDao.importar(carreraId, nivel, "reemplazar", limpios);
    insertados += r.insertados;
    eliminados += r.eliminados;
  }

  console.log(`${LOG} Listo. Insertados: ${insertados} · Reemplazados: ${eliminados}`);
  console.log(`${LOG} Revisa Extras/salida/REVISION.md: hay ${revision.confianzaBaja.length} ramo(s) con año dudoso.`);
}

// Solo se ejecuta como script; al importarlo desde una prueba no hace nada.
if (require.main === module) {
  main()
    .then(() => (poolAbierto ? poolAbierto.end() : null))
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(`${LOG} ERROR:`, e.message);
      process.exit(1);
    });
}

module.exports = { construir, aTextoCsv, campoCsv, escribirInforme, cargarMallas };
