-- ============================================================================
-- MapFI · Migracion 003 · Vistas analiticas (backend desacoplado para KPIs)
-- ----------------------------------------------------------------------------
-- Vistas que alimentan el mapa de calor y los KPIs, y que sirven como punto
-- de integracion directa para Looker Studio / PowerBI / Python (requisito §7).
-- Usan CREATE OR REPLACE para ser idempotentes y evolucionables sin romper
-- el esquema base.
-- ============================================================================

-- ── Saturacion por segmento (alimenta el MAPA DE CALOR) ─────────────────────
-- Densidad de actividades por (carrera, nivel, dia).
CREATE OR REPLACE VIEW vw_saturacion_segmento AS
SELECT
    ap.carrera_id,
    ap.nivel,
    (a.fecha_inicio AT TIME ZONE 'America/Santiago')::date AS fecha,
    COUNT(*)                                              AS eventos,
    COUNT(*) FILTER (WHERE a.tipo = 'EXAMEN')             AS examenes
FROM actividad a
JOIN actividad_publico ap ON ap.actividad_id = a.id
WHERE a.estado IN ('PROPUESTA','CONFIRMADA','REALIZADA')
GROUP BY ap.carrera_id, ap.nivel,
         (a.fecha_inicio AT TIME ZONE 'America/Santiago')::date;

-- ── Tasa de ocupacion de bloques horarios por carrera/nivel (KPI) ───────────
CREATE OR REPLACE VIEW vw_ocupacion_bloques AS
SELECT
    b.carrera_id,
    b.nivel,
    COUNT(*)                                                                AS bloques_total,
    ROUND(SUM(EXTRACT(EPOCH FROM (b.hora_fin - b.hora_inicio)) / 60))::int  AS minutos_total,
    ROUND(SUM(CASE WHEN b.tipo IN ('CLASE','PROTEGIDO')
                   THEN EXTRACT(EPOCH FROM (b.hora_fin - b.hora_inicio)) / 60
                   ELSE 0 END))::int                                        AS minutos_ocupados,
    ROUND(
        100.0 * SUM(CASE WHEN b.tipo IN ('CLASE','PROTEGIDO')
                         THEN EXTRACT(EPOCH FROM (b.hora_fin - b.hora_inicio))
                         ELSE 0 END)
        / NULLIF(SUM(EXTRACT(EPOCH FROM (b.hora_fin - b.hora_inicio))), 0)
    , 1)                                                                    AS ocupacion_pct
FROM bloque_horario b
GROUP BY b.carrera_id, b.nivel;

-- ── Nivel de aporte por entidad (KPI + base de gamificacion) ────────────────
CREATE OR REPLACE VIEW vw_aporte_entidad AS
SELECT
    e.id                                                       AS entidad_id,
    e.nombre,
    e.tipo,
    COUNT(a.id)                                                AS actividades_total,
    COUNT(a.id) FILTER (WHERE a.estado = 'REALIZADA')          AS realizadas,
    COUNT(a.id) FILTER (WHERE a.estado IN ('SUSPENDIDA','REPROGRAMADA')) AS reprogramadas,
    COALESCE(SUM(a.alcance_estimado), 0)                       AS alcance_total
FROM entidad e
LEFT JOIN actividad a ON a.entidad_id = e.id
GROUP BY e.id, e.nombre, e.tipo;

-- ── Indice de eventos suspendidos / reprogramados por topes (KPI) ───────────
CREATE OR REPLACE VIEW vw_eventos_reprogramados AS
SELECT
    COALESCE(p.anio, EXTRACT(YEAR FROM a.fecha_inicio)::int)             AS anio,
    a.entidad_id,
    COUNT(*)                                                             AS total,
    COUNT(*) FILTER (WHERE a.estado IN ('SUSPENDIDA','REPROGRAMADA'))    AS reprogramados,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE a.estado IN ('SUSPENDIDA','REPROGRAMADA'))
        / NULLIF(COUNT(*), 0)
    , 1)                                                                 AS tasa_pct
FROM actividad a
LEFT JOIN periodo_academico p ON p.id = a.periodo_id
GROUP BY 1, a.entidad_id;
