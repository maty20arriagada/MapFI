-- ============================================================================
-- MapFI · Migracion 002 · Seeds de catalogos
-- ----------------------------------------------------------------------------
-- Carga inicial idempotente (ON CONFLICT DO NOTHING) de:
--   · 13 carreras de la Facultad de Ingenieria  (EDITAR a la realidad local)
--   · niveles academicos (generaciones)
--   · entidades base (13 centros + Vinculacion + Gearbox)
--   · periodo academico vigente
--   · feriados nacionales (los moviles marcados con VERIFICAR)
-- El usuario ADMIN inicial NO se crea aqui: lo crea js/db/migrate.js con
-- bcrypt a partir de SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
-- ============================================================================

-- ── Carreras (placeholders editables — ajustar a las 13 reales) ─────────────
INSERT INTO carrera (id, codigo, nombre, color) VALUES
    (1,  'ICI',   'Ingenieria Civil Industrial',          '#2563EB'),
    (2,  'ICINF', 'Ingenieria Civil en Informatica',      '#0891B2'),
    (3,  'ICE',   'Ingenieria Civil Electrica',           '#CA8A04'),
    (4,  'ICM',   'Ingenieria Civil Mecanica',            '#DC2626'),
    (5,  'ICOC',  'Ingenieria Civil en Obras Civiles',    '#7C3AED'),
    (6,  'ICQ',   'Ingenieria Civil Quimica',             '#16A34A'),
    (7,  'ICMIN', 'Ingenieria Civil en Minas',            '#92400E'),
    (8,  'ICMET', 'Ingenieria Civil Metalurgica',         '#64748B'),
    (9,  'ICAMB', 'Ingenieria Civil Ambiental',           '#059669'),
    (10, 'ICBIO', 'Ingenieria Civil Biomedica',           '#DB2777'),
    (11, 'ICTEL', 'Ingenieria Civil en Telecomunicaciones','#0EA5E9'),
    (12, 'ICGEO', 'Ingenieria Civil Geografica',          '#65A30D'),
    (13, 'ICDAT', 'Ingenieria Civil en Ciencia de Datos', '#E11D48')
ON CONFLICT (id) DO NOTHING;

-- ── Niveles academicos / generaciones ──────────────────────────────────────
INSERT INTO generacion (nivel, etiqueta) VALUES
    (1, 'Primer anio'),
    (2, 'Segundo anio'),
    (3, 'Tercer anio'),
    (4, 'Cuarto anio'),
    (5, 'Quinto anio')
ON CONFLICT (nivel) DO NOTHING;

-- ── Entidades aportantes ────────────────────────────────────────────────────
-- Un centro de alumnos por carrera + Vinculacion + Gearbox.
INSERT INTO entidad (tipo, nombre, carrera_id) VALUES
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil Industrial',          1),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil en Informatica',      2),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil Electrica',           3),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil Mecanica',            4),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil en Obras Civiles',    5),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil Quimica',             6),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil en Minas',            7),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil Metalurgica',         8),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil Ambiental',           9),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil Biomedica',          10),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil en Telecomunicaciones',11),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil Geografica',         12),
    ('CENTRO_ALUMNOS', 'CEE Ingenieria Civil en Ciencia de Datos',13),
    ('VINCULACION',    'Direccion de Vinculacion con el Medio',  NULL),
    ('GEARBOX',        'Gearbox - Hub de Innovacion y Emprendimiento', NULL)
ON CONFLICT DO NOTHING;

-- ── Periodo academico vigente (ajustar fechas reales) ───────────────────────
INSERT INTO periodo_academico (anio, semestre, fecha_inicio, fecha_fin, activo) VALUES
    (2026, 1, '2026-03-09', '2026-07-10', TRUE),
    (2026, 2, '2026-08-03', '2026-12-11', FALSE)
ON CONFLICT (anio, semestre) DO NOTHING;

-- ── Feriados nacionales de Chile 2026 ───────────────────────────────────────
-- Fechas fijas (confiables). Los feriados MOVILES (Semana Santa, San Pedro y
-- San Pablo, Pueblos Indigenas, Encuentro de Dos Mundos) deben VERIFICARSE
-- contra el decreto oficial del ano; aqui van con la mejor estimacion.
INSERT INTO feriado (fecha, nombre, tipo, es_nacional) VALUES
    ('2026-01-01', 'Ano Nuevo',                         'IRRENUNCIABLE', TRUE),
    ('2026-04-03', 'Viernes Santo',                     'LEGAL',         TRUE),  -- Semana Santa 2026
    ('2026-04-04', 'Sabado Santo',                      'LEGAL',         TRUE),
    ('2026-05-01', 'Dia del Trabajo',                   'IRRENUNCIABLE', TRUE),
    ('2026-05-21', 'Dia de las Glorias Navales',        'LEGAL',         TRUE),
    ('2026-06-20', 'Dia de los Pueblos Indigenas',      'LEGAL',         TRUE),  -- VERIFICAR (solsticio)
    ('2026-06-29', 'San Pedro y San Pablo',             'LEGAL',         TRUE),  -- VERIFICAR (movil)
    ('2026-07-16', 'Dia de la Virgen del Carmen',       'LEGAL',         TRUE),
    ('2026-08-15', 'Asuncion de la Virgen',             'LEGAL',         TRUE),
    ('2026-09-18', 'Independencia Nacional',            'IRRENUNCIABLE', TRUE),
    ('2026-09-19', 'Dia de las Glorias del Ejercito',   'IRRENUNCIABLE', TRUE),
    ('2026-10-12', 'Encuentro de Dos Mundos',           'LEGAL',         TRUE),  -- VERIFICAR (movil)
    ('2026-10-31', 'Dia de las Iglesias Evangelicas',   'LEGAL',         TRUE),
    ('2026-11-01', 'Dia de Todos los Santos',           'LEGAL',         TRUE),
    ('2026-12-08', 'Inmaculada Concepcion',             'LEGAL',         TRUE),
    ('2026-12-25', 'Navidad',                           'IRRENUNCIABLE', TRUE)
ON CONFLICT (fecha) DO NOTHING;
