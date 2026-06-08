-- ============================================================================
-- MapFI · Migracion 005 · Historial de reputacion (gamificacion, §5)
-- ----------------------------------------------------------------------------
-- Registra cada ajuste de reputacion de una entidad para trazabilidad.
-- Los valores agregados viven en entidad.reputacion / eventos_exitosos /
-- sello_coordinacion (ya creados en 001).
-- ============================================================================

CREATE TABLE IF NOT EXISTS reputacion_log (
    id         SERIAL       PRIMARY KEY,
    entidad_id INTEGER      NOT NULL REFERENCES entidad(id) ON DELETE CASCADE,
    delta      NUMERIC(6,2) NOT NULL,
    motivo     TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_replog_entidad ON reputacion_log (entidad_id);
