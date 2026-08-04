"use strict";
/**
 * Importa la matrícula OFICIAL (Dirección de Docencia) por (carrera, nivel),
 * reemplazando los valores placeholder sembrados en 004_matricula.sql.
 * Marca cada fila importada con origen = 'OFICIAL' (migración 010): el
 * rótulo "estimación referencial" de los reportes desaparece automáticamente
 * para los segmentos que se importen aquí (T043, H-10, FR-007).
 *
 * Formato del CSV (ver docs/IMPORTACION_CSV.md): encabezado
 *   carrera,nivel,cantidad
 * donde `carrera` es el CÓDIGO de la carrera (ej. ICI, ICINF — ver
 * /api/catalogos), `nivel` el año de generación y `cantidad` el número de
 * estudiantes matriculados oficialmente en ese segmento.
 *
 * Uso (con el stack arriba):
 *   npm run seed:matricula -- ruta/al/archivo.csv
 *   docker compose exec server node js/db/importar-matricula.js /ruta.csv
 *
 * Idempotente: puede re-ejecutarse (UPSERT por carrera_id+nivel).
 */
require("../load-env")();

const fs = require("fs");
const { pool } = require("./index");
const { parseCSV } = require("../csv-utils");

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error("[importar-matricula] Uso: node js/db/importar-matricula.js <ruta-al-csv>");
    process.exit(1);
  }
  const texto = fs.readFileSync(ruta, "utf8");
  const { header, rows } = parseCSV(texto);
  const iCarr = header.indexOf("carrera");
  const iNiv = header.indexOf("nivel");
  const iCant = header.indexOf("cantidad");
  if (iCarr < 0 || iNiv < 0 || iCant < 0) {
    console.error('[importar-matricula] El CSV debe tener las columnas "carrera,nivel,cantidad"');
    process.exit(1);
  }

  const carreras = await pool.query("SELECT id, codigo FROM carrera");
  const codigoMap = {};
  carreras.rows.forEach((c) => { codigoMap[c.codigo.toUpperCase()] = c.id; });

  let actualizadas = 0;
  const errores = [];

  for (let i = 0; i < rows.length; i++) {
    const fila = rows[i];
    const codigo = (fila[iCarr] || "").toUpperCase();
    const nivel = parseInt(fila[iNiv], 10);
    const cantidad = parseInt(fila[iCant], 10);
    const carreraId = codigoMap[codigo];

    if (!carreraId) { errores.push({ fila: i + 2, error: `Carrera desconocida: "${fila[iCarr]}"` }); continue; }
    if (!Number.isFinite(nivel) || nivel < 1) { errores.push({ fila: i + 2, error: `Nivel inválido: "${fila[iNiv]}"` }); continue; }
    if (!Number.isFinite(cantidad) || cantidad < 0) { errores.push({ fila: i + 2, error: `Cantidad inválida: "${fila[iCant]}"` }); continue; }

    await pool.query(
      `INSERT INTO matricula (carrera_id, nivel, cantidad, origen)
       VALUES ($1, $2, $3, 'OFICIAL')
       ON CONFLICT (carrera_id, nivel) DO UPDATE SET cantidad = $3, origen = 'OFICIAL'`,
      [carreraId, nivel, cantidad]
    );
    actualizadas++;
  }

  console.log(`[importar-matricula] Listo. Segmentos actualizados: ${actualizadas} · Errores: ${errores.length}`);
  errores.forEach((e) => console.log(`[importar-matricula]   fila ${e.fila}: ${e.error}`));
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[importar-matricula] ERROR:", e.message);
    process.exit(1);
  });
