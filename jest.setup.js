// Setup global de Jest para MapFI.
// Se ejecuta antes de cada suite (ver package.json > jest.setupFiles).

// Entorno de test: evita que el server intente conectar al Postgres real
// y silencia el fail-fast de DATABASE_URL durante los tests unitarios de
// servicios puros. Los tests de DAO usan pg-mem y setean lo que necesiten.
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// Secreto de sesion dummy para tests de API con supertest.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-no-usar-en-prod";

// Timezone fija para que los tests de fechas (feriados, findes) sean
// deterministas independientemente de la maquina que los corra — pero SOLO
// si nadie la fijo antes. Sobrescribirla siempre (como se hacia antes)
// anulaba `npm run test:tz` (que fija TZ=UTC antes de arrancar Jest para
// simular un contenedor Docker sin configurar, Spec 002 / H-01): los
// workers de Jest heredan el TZ del proceso que los lanza, y esta linea lo
// pisaba, dejando `test:tz` y `test` con resultados identicos siempre.
process.env.TZ = process.env.TZ || "America/Santiago";
