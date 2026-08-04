-- ============================================================================
-- MapFI · Migración 009 · Vistas de visibilidad + trazabilidad de restitución
-- ----------------------------------------------------------------------------
-- Spec 002 (auditoría de robustez) — Historia US2 / H-02: el calendario
-- público, el mapa de calor y el detector de choques usaban 3 criterios de
-- "vigencia" distintos e inconsistentes. La fuente única de verdad ahora es
-- ESTADOS_VIGENTES en js/dao/actividadDao.js; esta migración alinea con ella
-- la vista SQL que alimenta el mapa de calor.
--
-- (a) Redefine vw_saturacion_segmento dejando explícito, en comentario, que
--     debe mantenerse sincronizada con ESTADOS_VIGENTES (funcionalmente ya
--     excluía ARCHIVADA al no estar en la lista, pero quedaba implícito).
-- (b) Agrega columnas de trazabilidad de RESTITUCIÓN (quién/cuándo), que
--     complementan a retirada_por/retirada_en/motivo_retiro de la migración
--     008 (esas registran el retiro; estas, el camino de vuelta — FR-009c).
--
-- Aditiva e idempotente (CREATE OR REPLACE VIEW, ADD COLUMN IF NOT EXISTS).
-- NO inserta en schema_migrations (lo hace el runner).
-- ============================================================================

CREATE OR REPLACE VIEW vw_saturacion_segmento AS
SELECT
    ap.carrera_id,
    ap.nivel,
    (a.fecha_inicio AT TIME ZONE 'America/Santiago')::date AS fecha,
    COUNT(*)                                              AS eventos,
    COUNT(*) FILTER (WHERE a.tipo = 'EXAMEN')             AS examenes
FROM actividad a
JOIN actividad_publico ap ON ap.actividad_id = a.id
-- Mantener sincronizado con ESTADOS_VIGENTES en js/dao/actividadDao.js.
-- Estados ocultos (nunca cuentan aquí): SUSPENDIDA, REPROGRAMADA, ARCHIVADA.
WHERE a.estado IN ('PROPUESTA','CONFIRMADA','REALIZADA')
GROUP BY ap.carrera_id, ap.nivel,
         (a.fecha_inicio AT TIME ZONE 'America/Santiago')::date;

ALTER TABLE actividad ADD COLUMN IF NOT EXISTS restituida_por INTEGER REFERENCES usuario(id);
ALTER TABLE actividad ADD COLUMN IF NOT EXISTS restituida_en TIMESTAMPTZ;
