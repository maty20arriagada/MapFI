-- ============================================================================
-- MapFI · Migración 007 · Corrección de seeds y datos placeholder
-- ----------------------------------------------------------------------------
-- Reemplaza las fechas hardcodeadas de las actividades de MUESTRA por fechas
-- relativas al momento del deploy: así una instalación en 2027+ no muestra
-- eventos vencidos del año anterior.
--
-- NOTA: el registro en schema_migrations lo hace SIEMPRE el runner
-- (js/db/migrate.js); esta migración NO debe insertarlo manualmente
-- (hacerlo provocaba un conflicto de clave primaria y abortaba el arranque).
-- ============================================================================

-- Títulos EXACTOS de las actividades sembradas en 002_seed_catalogos.sql.
UPDATE actividad
   SET fecha_inicio = now() + interval '60 days',
       fecha_fin    = now() + interval '60 days' + interval '2 hours'
 WHERE titulo = 'Certamen 1 - Cálculo I'
   AND fecha_inicio < now();

UPDATE actividad
   SET fecha_inicio = now() + interval '30 days',
       fecha_fin    = now() + interval '30 days' + interval '4 hours'
 WHERE titulo = 'Semana del Novato'
   AND fecha_inicio < now();
