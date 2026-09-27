-- ============================================================================
-- MapFI · Migración 018 · Retirar las actividades de ejemplo de instalación
-- Spec 006, US1.
--
-- La migración 002 siembra dos actividades de EJEMPLO para que el calendario
-- no se vea vacío al instalarse, y la 007 les recalcula la fecha a
-- now() + N días. En producción una de ellas, "Certamen 1 - Cálculo I" de la
-- Dirección de Docencia, quedó el 12 de octubre de 2026 y la ven estudiantes
-- reales de primer año como si fuera una evaluación.
--
-- POR QUÉ SE BORRA Y NO SE ARCHIVA
-- Archivar es lo que hace el "retirar" del administrador, y toda actividad
-- archivada aparece en el aviso público de cancelaciones: publicaría que
-- Docencia "canceló" un certamen que nunca existió. Aquí se borra, dejando
-- constancia en borrado_definitivo (migración 015), que no es público. Mismo
-- criterio que la 016, que retiró los bloques de horario de ejemplo.
--
-- POR QUÉ POR HUELLA Y NO POR ID
-- En otra base (una restaurada, una sembrada en otro orden) el id 1 puede ser
-- una actividad real. Se exige que coincidan los CUATRO campos de fábrica:
-- título, descripción, ubicación y entidad. Un centro que cree un
-- "Certamen 1 - Cálculo I" real no se ve afectado.
--
-- Idempotente: una segunda pasada no encuentra nada. actividad_publico cae
-- por ON DELETE CASCADE. No escribe schema_migrations (lo hace el runner).
-- ============================================================================

WITH muestra (titulo, descripcion, ubicacion, sigla) AS (
    VALUES
        ('Certamen 1 - Cálculo I', 'Primera evaluación del semestre',      'Aula 301',         'DOCFI'),
        ('Semana del Novato',      'Actividad de bienvenida a primer año', 'Patio central FI', 'CEEIND')
),
objetivo AS (
    SELECT a.id, a.titulo, a.entidad_id, e.nombre AS entidad_nombre,
           a.fecha_inicio, a.estado
      FROM actividad a
      JOIN entidad e ON e.id = a.entidad_id
      JOIN muestra m
        ON  a.titulo      = m.titulo
        AND a.descripcion = m.descripcion
        AND a.ubicacion   = m.ubicacion
        AND e.sigla       = m.sigla
),
constancia AS (
    INSERT INTO borrado_definitivo
        (actividad_id, titulo, entidad_id, entidad_nombre, fecha_inicio,
         estado_previo, borrado_por, motivo)
    SELECT id, titulo, entidad_id, entidad_nombre, fecha_inicio,
           estado, NULL, 'Dato de ejemplo de instalacion (migracion 018)'
      FROM objetivo
    RETURNING actividad_id
)
DELETE FROM actividad
 WHERE id IN (SELECT actividad_id FROM constancia);
