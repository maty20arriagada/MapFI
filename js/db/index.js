"use strict";
/**
 * Pool de conexiones a PostgreSQL (unico punto de acceso a la BD).
 * Todos los DAO importan { query, pool } desde aqui.
 */
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

// Fail-fast en runtime real; en tests (pg-mem) no exigimos DATABASE_URL.
if (!connectionString && process.env.NODE_ENV !== "test") {
  console.error("[db] FATAL: la variable DATABASE_URL no esta seteada.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: parseInt(process.env.PG_POOL_MAX || "10", 10),
});

pool.on("error", (err) => {
  console.error("[db] Error inesperado en cliente idle:", err);
});

module.exports = {
  pool,
  /** Atajo para consultas parametrizadas: query('SELECT ... $1', [v]) */
  query: (text, params) => pool.query(text, params),
};
