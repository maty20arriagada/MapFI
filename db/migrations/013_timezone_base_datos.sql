-- ============================================================================
-- MapFI · Migración 013 · Zona horaria de la BASE DE DATOS (corrige C-1 / H-01)
-- ----------------------------------------------------------------------------
-- Revisión QA 2026-08-04 (docs/REVISION_QA.md, hallazgo C-1): el fix de zona
-- horaria de la Spec 002 NO funcionaba en despliegues existentes.
--
-- Motivo: la variable de entorno `TZ` del contenedor **no** cambia el
-- parámetro `timezone` de PostgreSQL. Ese valor se fija en postgresql.conf
-- durante el `initdb`, así que en un volumen ya creado (cualquier servidor
-- real con datos) se quedaba en 'Etc/UTC' para siempre. Efecto medido:
--
--     SELECT '2026-04-17T21:00'::timestamptz   -->  2026-04-17 21:00:00+00
--                                                   ( = 17:00 en Chile )
--
-- Es decir: el usuario cargaba un evento a las 21:00 y el calendario lo
-- publicaba a las 17:00 — exactamente el defecto H-01 que la Spec 002 debía
-- corregir. Solo se comportaba bien en una instalación desde cero, lo que
-- hacía que pasara desapercibido en desarrollo.
--
-- `ALTER DATABASE ... SET` deja el valor fijado en el catálogo, así que
-- sobrevive a reinicios y NO depende de postgresql.conf ni del volumen.
-- Aplica a las conexiones nuevas (el pool se recrea al reiniciar el server).
--
-- Se usa `current_database()` porque el nombre viene de ${POSTGRES_DB} y no
-- se puede parametrizar un identificador en SQL plano.
--
-- Verificado: `ALTER DATABASE ... SET` SÍ es válido dentro de la transacción
-- que abre el runner de migraciones.
--
-- Idempotente. NO inserta en schema_migrations (lo hace el runner).
-- ============================================================================

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone = %L', current_database(), 'America/Santiago');
END
$$;
