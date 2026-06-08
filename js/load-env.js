"use strict";
/**
 * Carga .env para desarrollo local (npm start / npm run dev) SIN dependencias
 * externas (no usa dotenv). Es no-op si el archivo .env no existe — en
 * docker/cloud las variables vienen inyectadas por el entorno.
 *
 * No sobreescribe variables que ya esten en process.env (el entorno gana).
 */
const fs = require("fs");
const path = require("path");

module.exports = function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();

    // Quitar comillas envolventes o comentarios inline.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    } else {
      const hash = val.indexOf(" #");
      if (hash !== -1) val = val.slice(0, hash).trim();
    }

    if (!(key in process.env)) process.env[key] = val;
  }
};
