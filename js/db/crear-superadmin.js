"use strict";
/**
 * Crea (o asciende) una cuenta SUPERADMIN.
 *
 * El SUPERADMIN puede todo lo que un ADMIN y ademas **borrar actividades de
 * forma definitiva**: la fila se destruye y el borrado NO aparece en el aviso
 * publico de cancelaciones. Esta pensado para operacion —limpiar datos de
 * prueba, retirar algo publicado por error— no para el uso diario.
 *
 * El borrado no es publico, pero tampoco invisible: cada uno queda en la
 * tabla `borrado_definitivo`, consultable en /api/superadmin/borrados.
 *
 * Uso:
 *   npm run crear:superadmin -- correo@dominio.cl "contraseña-larga"
 *   docker compose exec server node js/db/crear-superadmin.js correo@x.cl "clave"
 *
 * Si el correo ya existe, lo asciende a SUPERADMIN y le fija la contrasena.
 */
require("../load-env")();

const bcrypt = require("bcryptjs");
const { pool } = require("./index");

const MIN_PASSWORD = 8;

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error("[superadmin] Uso: node js/db/crear-superadmin.js <correo> <contraseña>");
    process.exit(1);
  }
  if (!email.includes("@")) {
    console.error("[superadmin] El correo no parece valido:", email);
    process.exit(1);
  }
  // Misma politica que la API: esta cuenta puede destruir datos, no tiene
  // sentido que admita una clave mas debil que las demas.
  if (password.length < MIN_PASSWORD) {
    console.error(`[superadmin] La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const existe = await pool.query("SELECT id, rol FROM usuario WHERE lower(email) = $1", [email]);

  if (existe.rows.length) {
    await pool.query(
      `UPDATE usuario SET password_hash = $2, rol = 'SUPERADMIN', activo = TRUE
        WHERE lower(email) = $1`,
      [email, hash]
    );
    console.log(`[superadmin] Cuenta existente ascendida a SUPERADMIN: ${email}`);
    console.log(`[superadmin]   (rol anterior: ${existe.rows[0].rol})`);
  } else {
    await pool.query(
      `INSERT INTO usuario (email, password_hash, nombre, rol, activo)
       VALUES ($1, $2, $3, 'SUPERADMIN', TRUE)`,
      [email, hash, "Superadministrador"]
    );
    console.log(`[superadmin] Cuenta creada: ${email}`);
  }

  console.log("");
  console.log("[superadmin] Esta cuenta puede BORRAR ACTIVIDADES DE FORMA DEFINITIVA.");
  console.log("[superadmin] Los borrados no se anuncian en publico, pero quedan");
  console.log("[superadmin] registrados en la tabla `borrado_definitivo`.");
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[superadmin] ERROR:", e.message);
    process.exit(1);
  });
