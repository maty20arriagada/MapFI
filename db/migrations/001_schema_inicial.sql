-- ============================================================================
-- MapFI · Migracion 001 · Esquema inicial
-- ----------------------------------------------------------------------------
-- Crea las tablas nucleo de la plataforma. Aditiva e idempotente:
-- usa CREATE TABLE IF NOT EXISTS para poder re-correr sin error.
-- Ver docs/MODELO_DATOS.md para el detalle de cada tabla.
-- ============================================================================

-- ── Catalogos base ─────────────────────────────────────────────────────────

-- Las 13 carreras de la Facultad de Ingenieria.
CREATE TABLE IF NOT EXISTS carrera (
    id      SMALLINT      PRIMARY KEY,
    codigo  TEXT          NOT NULL UNIQUE,
    nombre  TEXT          NOT NULL,
    color   TEXT          NOT NULL DEFAULT '#4169E1',  -- hex para UI (calendario/heatmap)
    activa  BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Nivel academico / generacion (1.er a 5.o anio o mas). Parametrico.
CREATE TABLE IF NOT EXISTS generacion (
    nivel    SMALLINT     PRIMARY KEY,
    etiqueta TEXT         NOT NULL
);

-- Entidades organizadoras (aportantes).
CREATE TABLE IF NOT EXISTS entidad (
    id                  SERIAL      PRIMARY KEY,
    tipo                TEXT        NOT NULL CHECK (tipo IN ('CENTRO_ALUMNOS','VINCULACION','GEARBOX')),
    sigla               TEXT,                                 -- iniciales, ej. 'CEEIND'
    nombre              TEXT        NOT NULL,
    carrera_id          SMALLINT    REFERENCES carrera(id),   -- NULL salvo centros de alumnos
    -- Campos de gamificacion (Fase 4) — ya presentes para no migrar despues:
    reputacion          NUMERIC(6,2) NOT NULL DEFAULT 0,
    eventos_exitosos    INTEGER     NOT NULL DEFAULT 0,
    sello_coordinacion  BOOLEAN     NOT NULL DEFAULT FALSE,
    activa              BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Periodo academico parametrico (habilita la adaptacion dinamica de anios).
CREATE TABLE IF NOT EXISTS periodo_academico (
    id           SERIAL    PRIMARY KEY,
    anio         SMALLINT  NOT NULL,
    semestre     SMALLINT  NOT NULL CHECK (semestre IN (1,2)),
    fecha_inicio DATE      NOT NULL,
    fecha_fin    DATE      NOT NULL,
    activo       BOOLEAN   NOT NULL DEFAULT FALSE,
    UNIQUE (anio, semestre),
    CHECK (fecha_fin > fecha_inicio)
);

-- ── Usuarios y seguridad ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usuario (
    id            SERIAL      PRIMARY KEY,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    nombre        TEXT        NOT NULL,
    rol           TEXT        NOT NULL CHECK (rol IN ('ADMIN','APORTANTE')),
    entidad_id    INTEGER     REFERENCES entidad(id),   -- NULL para ADMIN
    activo        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de sesiones para connect-pg-simple (versionada aqui).
CREATE TABLE IF NOT EXISTS "session" (
    sid    VARCHAR      NOT NULL COLLATE "default",
    sess   JSON         NOT NULL,
    expire TIMESTAMP(6) NOT NULL,
    CONSTRAINT session_pkey PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON "session" (expire);

-- ── Actividades (nucleo) ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS actividad (
    id                 SERIAL      PRIMARY KEY,
    titulo             TEXT        NOT NULL,
    descripcion        TEXT,
    entidad_id         INTEGER     NOT NULL REFERENCES entidad(id),
    periodo_id         INTEGER     REFERENCES periodo_academico(id),
    fecha_inicio       TIMESTAMPTZ NOT NULL,
    fecha_fin          TIMESTAMPTZ NOT NULL,
    -- Rango generado para consultas de solapamiento (topes) eficientes con GiST.
    periodo            TSTZRANGE   GENERATED ALWAYS AS (tstzrange(fecha_inicio, fecha_fin, '[)')) STORED,
    tipo               TEXT        NOT NULL CHECK (tipo IN ('EVENTO','HITO_ACADEMICO','EXAMEN','EXTRAPROGRAMATICA')),
    estado             TEXT        NOT NULL DEFAULT 'PROPUESTA'
                                   CHECK (estado IN ('PROPUESTA','CONFIRMADA','REALIZADA','SUSPENDIDA','REPROGRAMADA')),
    ubicacion          TEXT,
    alcance_estimado   INTEGER,                 -- cacheado del ultimo match
    compatibilidad_pct NUMERIC(5,2),            -- cacheado del ultimo match
    created_by         INTEGER     REFERENCES usuario(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (fecha_fin > fecha_inicio)
);

-- Indice GiST sobre el rango: habilita `WHERE periodo && tstzrange($1,$2)`.
CREATE INDEX IF NOT EXISTS idx_actividad_periodo ON actividad USING gist (periodo);
CREATE INDEX IF NOT EXISTS idx_actividad_entidad ON actividad (entidad_id);
CREATE INDEX IF NOT EXISTS idx_actividad_tipo    ON actividad (tipo);

-- Publico objetivo: pares (carrera, nivel).
CREATE TABLE IF NOT EXISTS actividad_publico (
    actividad_id INTEGER  NOT NULL REFERENCES actividad(id) ON DELETE CASCADE,
    carrera_id   SMALLINT NOT NULL REFERENCES carrera(id),
    nivel        SMALLINT NOT NULL REFERENCES generacion(nivel),
    PRIMARY KEY (actividad_id, carrera_id, nivel)
);
CREATE INDEX IF NOT EXISTS idx_actpub_segmento ON actividad_publico (carrera_id, nivel);

-- ── Horarios academicos base ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bloque_horario (
    id          SERIAL   PRIMARY KEY,
    carrera_id  SMALLINT NOT NULL REFERENCES carrera(id),
    nivel       SMALLINT NOT NULL REFERENCES generacion(nivel),
    dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),  -- Lun=1 .. Vie=5
    hora_inicio TIME     NOT NULL,
    hora_fin    TIME     NOT NULL,
    tipo        TEXT     NOT NULL CHECK (tipo IN ('CLASE','PROTEGIDO','LIBRE')),
    descripcion TEXT,
    CHECK (hora_fin > hora_inicio)
);
CREATE INDEX IF NOT EXISTS idx_bloque_segmento ON bloque_horario (carrera_id, nivel, dia_semana);

-- ── Cronologia ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feriado (
    id          SERIAL  PRIMARY KEY,
    fecha       DATE    NOT NULL UNIQUE,
    nombre      TEXT    NOT NULL,
    tipo        TEXT    NOT NULL CHECK (tipo IN ('IRRENUNCIABLE','LEGAL','SANDWICH','ACADEMICO')),
    es_nacional BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_feriado_fecha ON feriado (fecha);
