-- ============================================================================
-- MapFI · Migración 012 · Feriados móviles 2026 — verificados (T069, H-13)
-- ----------------------------------------------------------------------------
-- Spec 002 (auditoría de robustez) — la migración 002 sembró 3 feriados
-- móviles marcados "-- VERIFICAR" (dependían del decreto oficial del año).
-- Se verificaron contra fuentes independientes:
--
--   Día de los Pueblos Indígenas: sembrado como 2026-06-20 — INCORRECTO.
--     La fecha oficial observada es 2026-06-21 (domingo). El solsticio de
--     invierno 2026 ocurre el 20-jun a las 22:41 hora de Chile (muy cerca
--     de medianoche); el feriado se conmemora el día siguiente. Fuente:
--     gob.cl, "21 de junio: Hoy se conmemora el Día Nacional de los
--     Pueblos Indígenas" (artículo publicado el propio 21-jun-2026).
--     https://www.gob.cl/noticias/21-de-junio-hoy-se-conmemora-el-dia-nacional-de-los-pueblos-indigenas/
--
--   San Pedro y San Pablo (2026-06-29) y Encuentro de Dos Mundos
--   (2026-10-12): verificados contra 2 fuentes independientes cada uno
--     (feriadoschilenos.cl, feriadoslegales.cl) — coinciden con lo ya
--     sembrado en la migración 002. NO requieren cambio; se dejan tal cual.
--
-- No fue posible verificar de forma concluyente contra el Diario Oficial
-- (decreto formal) por falta de acceso a esa fuente primaria en esta
-- sesión — la corrección de Pueblos Indígenas se basa en la fuente oficial
-- gob.cl citada arriba, considerada suficientemente confiable, pero
-- CONVIENE que un administrador la recontraste contra el decreto exacto
-- antes del despliegue en producción.
--
-- Aditiva e idempotente (DELETE por match exacto + INSERT...ON CONFLICT DO
-- NOTHING). NO inserta en schema_migrations (lo hace el runner).
-- ============================================================================

DELETE FROM feriado WHERE fecha = '2026-06-20' AND nombre = 'Día de los Pueblos Indígenas';

INSERT INTO feriado (fecha, nombre, tipo, es_nacional)
VALUES ('2026-06-21', 'Día de los Pueblos Indígenas', 'LEGAL', TRUE)
ON CONFLICT (fecha) DO NOTHING;
