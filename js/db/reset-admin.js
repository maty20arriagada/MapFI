"use strict";
/**
 * Crea o restablece la cuenta de administrador con una contraseña conocida,
 * SIN borrar el resto de los datos. Útil si olvidaste/no coincide la clave.
 *
 * Uso (en el host, con .env apuntando a tu BD):
 *   npm run admin:reset                       → admin@mapfi.cl / admin1234
 *   npm run admin:reset -- correo@fi.cl clave → email y clave personalizados
 *
 * Dentro de Docker:
 *   docker compose exec server node js/db/reset-admin.js [email] [clave]
 */
require("../load-env")();

const bcrypt = require("bcryptjs");
const { pool } = require("./index");

async function main() {
  const email = process.argv[2] || process.env.SEED_ADMIN_EMAIL || "admin@mapfi.cl";
  const password = process.argv[3] || process.env.SEED_ADMIN_PASSWORD || "admin1234";
  const hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query("SELECT id FROM usuario WHERE email = $1", [email]);
  if (rows.length) {
    await pool.query(
      "UPDATE usuario SET password_hash = $2, rol = 'ADMIN', activo = TRUE WHERE email = $1",
      [email, hash]
    );
    console.log(`[reset-admin] Contraseña actualizada para ${email} (rol ADMIN, activo).`);
  } else {
    await pool.query(
      "INSERT INTO usuario (email, password_hash, nombre, rol) VALUES ($1, $2, 'Administrador', 'ADMIN')",
      [email, hash]
    );
    console.log(`[reset-admin] Cuenta de administrador creada: ${email}`);
  }
  console.log(`[reset-admin] Ya puedes ingresar con:  ${email}  /  ${password}`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[reset-admin] ERROR:", e.message);
    process.exit(1);
  });
