-- ============================================================================
-- MapFI · Migración 015 · Rol SUPERADMIN y borrado definitivo
-- ----------------------------------------------------------------------------
-- Hasta ahora "eliminar" nunca destruía nada: la actividad pasaba a ARCHIVADA
-- y quedaba un aviso público de cancelación durante 30 días. Ese diseño es el
-- correcto para el uso diario de los centros — le avisa al estudiante que ya
-- tenía la fecha anotada.
--
-- Pero hace falta además un borrado REAL, de operación, para casos que el
-- flujo normal no cubre: limpiar datos de prueba antes de abrir la
-- plataforma, o retirar contenido publicado por error que no corresponde
-- dejar visible 30 días.
--
-- (a) Rol `SUPERADMIN`. Se añade al CHECK sin tocar los existentes.
--     OJO: el servidor debe tratarlo como superconjunto de ADMIN; sus
--     comprobaciones de rol usan igualdad estricta y, sin jerarquía, este rol
--     quedaría fuera de TODAS las rutas de administración.
--
-- (b) Tabla `borrado_definitivo`: registro INTERNO de lo que se destruye.
--     Es deliberado que el borrado no aparezca en el aviso público, pero no
--     que sea invisible: si algo desaparece, alguien tiene que poder
--     averiguar qué pasó. Esta tabla no se expone en ninguna ruta pública.
--
--     `actividad_id` NO lleva clave foránea a propósito: la fila a la que
--     apunta ya no existirá, y con FK el registro se borraría junto con ella,
--     que es justo lo contrario de lo que se busca.
--
-- Aditiva e idempotente. NO inserta en schema_migrations (lo hace el runner).
-- ============================================================================

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_rol_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_rol_check
  CHECK (rol IN ('ADMIN','APORTANTE','SUPERADMIN'));

CREATE TABLE IF NOT EXISTS borrado_definitivo (
    id             SERIAL      PRIMARY KEY,
    actividad_id   INTEGER     NOT NULL,
    titulo         TEXT        NOT NULL,
    entidad_id     INTEGER,
    entidad_nombre TEXT,
    fecha_inicio   TIMESTAMPTZ,
    estado_previo  TEXT,
    borrado_por    INTEGER     REFERENCES usuario(id),
    borrado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    motivo         TEXT
);

CREATE INDEX IF NOT EXISTS idx_borrado_definitivo_fecha
  ON borrado_definitivo (borrado_en DESC);
