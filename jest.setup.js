// Setup global de Jest para MapFI.
// Se ejecuta antes de cada suite (ver package.json > jest.setupFiles).

// Entorno de test: evita que el server intente conectar al Postgres real
// y silencia el fail-fast de DATABASE_URL durante los tests unitarios de
// servicios puros. Los tests de DAO usan pg-mem y setean lo que necesiten.
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// Secreto de sesion dummy para tests de API con supertest.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-no-usar-en-prod";

// Timezone fija para que los tests de fechas (feriados, findes) sean
// deterministas independientemente de la maquina que los corra.
process.env.TZ = "America/Santiago";
