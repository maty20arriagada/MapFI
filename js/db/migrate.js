"use strict";
/**
 * Runner de migraciones de MapFI.
 *
 * - Aplica en orden numerico los archivos db/migrations/*.sql que falten.
 * - Lleva control en la tabla `schema_migrations` (idempotente).
 * - Cada migracion corre dentro de una transaccion (todo o nada).
 * - Al final, deja SIEMPRE un usuario ADMIN por defecto (admin@mapfi.cl /
 *   admin1234), sobreescribible con SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 *
 * Uso:
 *   node js/db/migrate.js        → aplica y termina
 *   require('./migrate').runMigrations()  → desde server.js / tests
 */
require("../load-env")();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool } = require("./index");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "db", "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function appliedVersions(client) {
  const { rows } = await client.query("SELECT version FROM schema_migrations");
  return new Set(rows.map((r) => r.version));
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedVersions(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // 001, 002, 003...

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] aplicando ${file}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`Migracion ${file} fallo: ${e.message}`);
      }
    }

    await seedAdmin(client);
    console.log("[migrate] OK - esquema al dia.");
  } finally {
    client.release();
  }
}

// Credenciales por defecto del admin (si no se definen en el entorno).
const ADMIN_EMAIL_DEFAULT = "admin@mapfi.cl";
const ADMIN_PASS_DEFAULT = "admin1234";

/**
 * Crea el ADMIN inicial (idempotente). SIEMPRE deja una cuenta para poder
 * ingresar de inmediato; se puede sobreescribir con SEED_ADMIN_EMAIL /
 * SEED_ADMIN_PASSWORD. No duplica ni pisa un admin ya existente.
 */
async function seedAdmin(client) {
  const email = process.env.SEED_ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT;
  const password = process.env.SEED_ADMIN_PASSWORD || ADMIN_PASS_DEFAULT;
  const usandoDefault = !process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD;

  const { rows } = await client.query(
    "SELECT 1 FROM usuario WHERE rol = 'ADMIN' LIMIT 1"
  );
  if (rows.length) return; // ya hay un admin

  const hash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO usuario (email, password_hash, nombre, rol)
     VALUES ($1, $2, $3, 'ADMIN')
     ON CONFLICT (email) DO NOTHING`,
    [email, hash, "Administrador"]
  );
  console.log(`[migrate] usuario ADMIN inicial creado: ${email}`);
  if (usandoDefault) {
    console.log("[migrate] AVISO: admin por defecto (admin@mapfi.cl / admin1234). Cambia la contrasena en produccion (.env o desde la app).");
  }
}

module.exports = { runMigrations };

// Ejecucion directa por CLI.
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[migrate] ERROR:", e.message);
      process.exit(1);
    });
}
