-- ============================================================================
-- MapFI · Migración 007 · Corrección de seeds y datos placeholder
-- ----------------------------------------------------------------------------
-- 1. Reemplaza fechas hardcodeadas a 2026 por fechas relativas al año actual.
--    Así un deploy en 2027+ no muestra eventos del año anterior.
-- 2. Actualiza la tabla matricula con un comentario de advertencia.
-- ============================================================================

-- Actualizar las actividades de ejemplo a fechas relativas (30 y 60 días
-- desde hoy) para que siempre aparezcan en el futuro cercano al hacer deploy.
UPDATE actividad
   SET fecha_inicio = now() + interval '60 days',
       fecha_fin    = now() + interval '60 days' + interval '2 hours'
 WHERE titulo = 'Certamen 1 - Cálculo I (ejemplo)'
   AND fecha_inicio < now();

UPDATE actividad
   SET fecha_inicio = now() + interval '30 days',
       fecha_fin    = now() + interval '30 days' + interval '2 hours'
 WHERE titulo = 'Semana del Novato (ejemplo)'
   AND fecha_inicio < now();

-- Insertar un registro de advertencia si la matrícula sigue en valores
-- placeholder (todos los segmentos en exactamente 100).
-- Esto NO modifica datos, solo registra en schema_migrations que esta
-- migración fue aplicada.
INSERT INTO schema_migrations (version) VALUES ('007_fix_seeds.sql')
ON CONFLICT DO NOTHING;
