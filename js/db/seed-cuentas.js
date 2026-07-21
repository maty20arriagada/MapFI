"use strict";
/**
 * Crea (o restablece) las cuentas de acceso de las 16 entidades aportantes:
 * 14 Centros de Estudiantes + Vinculación + Gearbox. Rol APORTANTE, cada una
 * ligada a su entidad por la sigla.
 *
 * Idempotente: si el correo ya existe, actualiza la contraseña/nombre/entidad
 * (permite re-correrlo para restablecer claves); si no, lo crea.
 *
 * Uso (con el stack arriba):
 *   npm run seed:cuentas
 *   docker compose exec server node js/db/seed-cuentas.js
 *
 * NOTA de seguridad: estas son contraseñas iniciales conocidas (convención
 * "<carrera>2030") para el arranque. Cada centro DEBERÍA cambiarla en su primer
 * ingreso desde "Mi cuenta". No es un seed automático del despliegue.
 */
require("../load-env")();

const bcrypt = require("bcryptjs");
const { pool } = require("./index");

// sigla de la entidad (ver db/migrations/002_seed_catalogos.sql) → correo + clave
const CUENTAS = [
  { sigla: "CEEIC",  email: "civil@mapfi.cl",              pass: "civil2030" },
  { sigla: "CEEAE",  email: "aeroespacial@mapfi.cl",       pass: "aeroespacial2030" },
  { sigla: "CEEBIO", email: "biomedica@mapfi.cl",          pass: "biomedica2030" },
  { sigla: "CEEELN", email: "electronica@mapfi.cl",        pass: "electronica2030" },
  { sigla: "CEEELE", email: "electrica@mapfi.cl",          pass: "electrica2030" },
  { sigla: "CEEIND", email: "industrial@mapfi.cl",         pass: "industrial2030" },
  { sigla: "CEEINF", email: "informatica@mapfi.cl",        pass: "informatica2030" },
  { sigla: "CEEMAT", email: "materiales@mapfi.cl",         pass: "materiales2030" },
  { sigla: "CEEMEC", email: "mecanica@mapfi.cl",           pass: "mecanica2030" },
  { sigla: "CEEMET", email: "metalurgica@mapfi.cl",        pass: "metalurgica2030" },
  { sigla: "CEEMIN", email: "minas@mapfi.cl",              pass: "minas2030" },
  { sigla: "CEEQUI", email: "quimica@mapfi.cl",            pass: "quimica2030" },
  { sigla: "CEETEL", email: "telecomunicaciones@mapfi.cl", pass: "telecomunicaciones2030" },
  { sigla: "CEEPC",  email: "plancomun@mapfi.cl",          pass: "plancomun2030" },
  { sigla: "VcM",    email: "vinculacion@mapfi.cl",        pass: "vinculacion2030" },
  { sigla: "GBX",    email: "gearbox@mapfi.cl",            pass: "gearbox2030" },
];

async function main() {
  let creadas = 0, actualizadas = 0;
  const faltantes = [];

  for (const c of CUENTAS) {
    const ent = await pool.query("SELECT id, nombre FROM entidad WHERE sigla = $1", [c.sigla]);
    if (!ent.rows.length) { faltantes.push(c.sigla); continue; }

    const entidadId = ent.rows[0].id;
    const nombre = ent.rows[0].nombre;
    const email = c.email.trim().toLowerCase();
    const hash = await bcrypt.hash(c.pass, 10);

    const existe = await pool.query("SELECT id FROM usuario WHERE lower(email) = $1", [email]);
    if (existe.rows.length) {
      await pool.query(
        `UPDATE usuario SET password_hash = $2, nombre = $3, rol = 'APORTANTE',
                            entidad_id = $4, activo = TRUE
         WHERE lower(email) = $1`,
        [email, hash, nombre, entidadId]
      );
      actualizadas++;
      console.log(`[seed-cuentas] actualizada  ${email}  →  ${c.sigla}`);
    } else {
      await pool.query(
        `INSERT INTO usuario (email, password_hash, nombre, rol, entidad_id)
         VALUES ($1, $2, $3, 'APORTANTE', $4)`,
        [email, hash, nombre, entidadId]
      );
      creadas++;
      console.log(`[seed-cuentas] creada       ${email}  →  ${c.sigla}`);
    }
  }

  console.log(`[seed-cuentas] Listo. Creadas: ${creadas} · Actualizadas: ${actualizadas} · Total objetivo: ${CUENTAS.length}`);
  if (faltantes.length) {
    console.log(`[seed-cuentas] AVISO: no se encontraron estas entidades (¿aplicaste 002_seed_catalogos.sql?): ${faltantes.join(", ")}`);
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[seed-cuentas] ERROR:", e.message);
    process.exit(1);
  });
