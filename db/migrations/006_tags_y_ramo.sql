-- ============================================================================
-- MapFI · Migración 006 · Tags de actividad + campo ramo
-- ----------------------------------------------------------------------------
-- Los CEE necesitan clasificar actividades como CHARLA, TALLER o ENTREGA
-- (además de los tipos existentes), y asociar una evaluación a su ramo
-- ("Cálculo I"). Plan v2.0 §16.1.
-- ============================================================================

ALTER TABLE actividad DROP CONSTRAINT IF EXISTS actividad_tipo_check;
ALTER TABLE actividad ADD CONSTRAINT actividad_tipo_check
  CHECK (tipo IN ('EVENTO','HITO_ACADEMICO','EXAMEN','EXTRAPROGRAMATICA','CHARLA','TALLER','ENTREGA'));

ALTER TABLE actividad ADD COLUMN IF NOT EXISTS ramo TEXT;
