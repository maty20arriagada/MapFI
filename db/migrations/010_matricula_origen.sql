-- ============================================================================
-- MapFI · Migración 010 · Origen de la matrícula (oficial vs referencial)
-- ----------------------------------------------------------------------------
-- Spec 002 (auditoría de robustez) — Historia US3 / H-10, decisión D-3: hoy
-- la matrícula sembrada es un PLACEHOLDER (100 por segmento, migración 004)
-- y los reportes de alcance la usan sin advertirlo. Se agrega el origen del
-- dato para poder rotular la cifra como estimación mientras no se cargue la
-- matrícula oficial de la Dirección de Docencia (T043).
--
-- Todo lo ya sembrado queda marcado REFERENCIAL (el valor por defecto): es
-- exactamente lo que es hoy. Cuando se importe la matrícula oficial
-- (js/db/importar-matricula.js) esas filas quedan en OFICIAL.
--
-- Aditiva e idempotente. NO inserta en schema_migrations (lo hace el runner).
-- ============================================================================

ALTER TABLE matricula ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'REFERENCIAL';

ALTER TABLE matricula DROP CONSTRAINT IF EXISTS matricula_origen_check;
ALTER TABLE matricula ADD CONSTRAINT matricula_origen_check
  CHECK (origen IN ('OFICIAL','REFERENCIAL'));
