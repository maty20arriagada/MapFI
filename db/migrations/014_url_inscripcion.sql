-- ============================================================================
-- MapFI · Migración 014 · Enlace de inscripción de una actividad
-- ----------------------------------------------------------------------------
-- Permite que un centro adjunte a su actividad el enlace donde inscribirse
-- (un formulario, una entrada, una sala). Se muestra como botón en el detalle
-- del calendario y viaja en el feed iCalendar como propiedad `URL`, de modo
-- que el estudiante que sincronice su calendario lo tenga a mano en el evento.
--
-- El CHECK exige que sea `http://` o `https://`. Es defensa en profundidad:
-- la validación de verdad está en el servidor, pero este campo termina
-- renderizado como un `<a href>`, y sin esta restricción alguien podría
-- guardar un `javascript:...` que se ejecutaría al pulsarlo. Vale la pena
-- que la base tampoco lo acepte.
--
-- Se admite NULL (la mayoría de las actividades no tiene inscripción).
--
-- Aditiva e idempotente. NO inserta en schema_migrations (lo hace el runner).
-- ============================================================================

ALTER TABLE actividad ADD COLUMN IF NOT EXISTS url_inscripcion TEXT;

ALTER TABLE actividad DROP CONSTRAINT IF EXISTS actividad_url_inscripcion_check;
ALTER TABLE actividad ADD CONSTRAINT actividad_url_inscripcion_check
  CHECK (url_inscripcion IS NULL OR url_inscripcion ~* '^https?://.+');
