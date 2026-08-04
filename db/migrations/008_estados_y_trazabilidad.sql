-- ============================================================================
-- MapFI · Migración 008 · Estado ARCHIVADA + trazabilidad de moderación
-- ----------------------------------------------------------------------------
-- Spec 002 (auditoría de robustez) — Historia US2 / dilema D-2 resuelto:
-- moderación REACTIVA (no hay revisor diario, así que todo se publica al
-- crearse y el administrador retira/archiva después). El "eliminar" de una
-- actividad deja de ser un DELETE físico: pasa a ser un archivado reversible.
--
-- (a) Amplía el CHECK del campo `estado` (NO el de `tipo`, que ya se amplió
--     en 006 y no debe tocarse aquí) para admitir 'ARCHIVADA'.
-- (b) Agrega columnas de trazabilidad: quién y cuándo retiró/archivó una
--     actividad, y el motivo.
-- (c) Índice sobre `estado`: el filtro de visibilidad (fuente única en
--     actividadDao.js) se ejecuta en cada carga del calendario público.
--
-- Aditiva e idempotente. NO inserta en schema_migrations (lo hace el runner).
-- ============================================================================

ALTER TABLE actividad DROP CONSTRAINT IF EXISTS actividad_estado_check;
ALTER TABLE actividad ADD CONSTRAINT actividad_estado_check
  CHECK (estado IN ('PROPUESTA','CONFIRMADA','REALIZADA','SUSPENDIDA','REPROGRAMADA','ARCHIVADA'));

ALTER TABLE actividad ADD COLUMN IF NOT EXISTS retirada_por INTEGER REFERENCES usuario(id);
ALTER TABLE actividad ADD COLUMN IF NOT EXISTS retirada_en TIMESTAMPTZ;
ALTER TABLE actividad ADD COLUMN IF NOT EXISTS motivo_retiro TEXT;

CREATE INDEX IF NOT EXISTS idx_actividad_estado ON actividad (estado);
