-- ============================================================================
-- MapFI · Migración 011 · Saturación cuenta cada día que abarca la actividad
-- ----------------------------------------------------------------------------
-- Spec 002 (auditoría de robustez) — T068, edge case fijado en spec.md: una
-- actividad que cruza la medianoche (ej. viernes 22:00 a sábado 02:00) debe
-- contar para saturación en CADA día de calendario que abarca, no solo en el
-- día de `fecha_inicio`. La versión anterior (migración 009) agrupaba
-- únicamente por la fecha de inicio, subcontando el segundo día.
--
-- `generate_series` expande cada actividad en una fila por día calendario
-- (zona America/Santiago) entre el día de inicio y el día de término,
-- ambos inclusive. Para una actividad de un solo día (el caso normal) esto
-- sigue produciendo exactamente una fila, igual que antes.
--
-- Nota: el criterio de FIN DE SEMANA (matchService, Paso 0) es distinto y
-- deliberadamente NO cambia aquí — se evalúa solo sobre la hora de INICIO
-- (ver js/services/matchService.js y el test en matchService.test.js).
--
-- Idempotente (CREATE OR REPLACE VIEW). NO inserta en schema_migrations.
-- ============================================================================

CREATE OR REPLACE VIEW vw_saturacion_segmento AS
SELECT
    ap.carrera_id,
    ap.nivel,
    dia::date                                             AS fecha,
    COUNT(*)                                              AS eventos,
    COUNT(*) FILTER (WHERE a.tipo = 'EXAMEN')             AS examenes
FROM actividad a
JOIN actividad_publico ap ON ap.actividad_id = a.id
CROSS JOIN LATERAL generate_series(
    (a.fecha_inicio AT TIME ZONE 'America/Santiago')::date,
    (a.fecha_fin    AT TIME ZONE 'America/Santiago')::date,
    interval '1 day'
) AS dia
-- Mantener sincronizado con ESTADOS_VIGENTES en js/dao/actividadDao.js.
WHERE a.estado IN ('PROPUESTA','CONFIRMADA','REALIZADA')
GROUP BY ap.carrera_id, ap.nivel, dia::date;
