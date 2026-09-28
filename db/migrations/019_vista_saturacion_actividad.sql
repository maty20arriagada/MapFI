-- ============================================================================
-- MapFI · Migración 019 · Vista de saturación por actividad
-- Spec 006, US5 ("Todas las generaciones" en el mapa de calor).
--
-- vw_saturacion_segmento (011) agrupa por (carrera, nivel, día). Al pedir el
-- semestre de VARIOS segmentos, el servicio suma sus filas, y una charla
-- dirigida a los cinco años de una carrera contaba CINCO actividades ese día.
-- Con la agrupación ya hecha no hay forma de deduplicar: el id de la actividad
-- se perdió.
--
-- Esta vista es la misma expansión multi-día y el mismo filtro de estados,
-- pero SIN agrupar y conservando actividad_id y tipo: una fila por actividad,
-- por grupo de su público y por día que ocupa. Quien la lee cuenta
-- COUNT(DISTINCT actividad_id).
--
-- Es aditiva: vw_saturacion_segmento no se toca (la usan otros indicadores).
-- La constitución exige que los KPIs vivan detrás de vistas vw_*.
-- ============================================================================

CREATE OR REPLACE VIEW vw_saturacion_actividad AS
SELECT
    a.id                    AS actividad_id,
    a.tipo,
    ap.carrera_id,
    ap.nivel,
    dia::date               AS fecha
FROM actividad a
JOIN actividad_publico ap ON ap.actividad_id = a.id
CROSS JOIN LATERAL generate_series(
    (a.fecha_inicio AT TIME ZONE 'America/Santiago')::date,
    (a.fecha_fin    AT TIME ZONE 'America/Santiago')::date,
    interval '1 day'
) AS dia
-- Mantener sincronizado con ESTADOS_VIGENTES en js/dao/actividadDao.js
-- (igual que las vistas de las migraciones 009 y 011).
WHERE a.estado IN ('PROPUESTA','CONFIRMADA','REALIZADA');
