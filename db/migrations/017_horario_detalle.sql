-- ============================================================================
-- MapFI · Migración 017 · Detalle de bloque horario
-- ----------------------------------------------------------------------------
-- Spec 003: la carga masiva de horarios necesita columnas opcionales además
-- de día/hora/tipo/descripción. Todas NULL-ables, sin valor por defecto: un
-- bloque cargado antes de esta migración simplemente no las tiene.
--
--   codigo    — código de asignatura (ej. '525101')
--   seccion   — sección, cuando la carrera dicta secciones paralelas
--   sala      — sala o laboratorio
--   docente   — nombre del profesor
--
-- Se añade también un índice (carrera_id, nivel) para el borrado y la
-- consulta por segmento completo (DELETE /api/bloques, importación masiva).
--
-- Aditiva e idempotente (IF NOT EXISTS en todo). NO inserta en
-- schema_migrations (lo hace el runner).
-- ============================================================================

ALTER TABLE bloque_horario ADD COLUMN IF NOT EXISTS codigo  TEXT;
ALTER TABLE bloque_horario ADD COLUMN IF NOT EXISTS seccion TEXT;
ALTER TABLE bloque_horario ADD COLUMN IF NOT EXISTS sala    TEXT;
ALTER TABLE bloque_horario ADD COLUMN IF NOT EXISTS docente TEXT;

CREATE INDEX IF NOT EXISTS idx_bloque_carrera_nivel
    ON bloque_horario (carrera_id, nivel);
