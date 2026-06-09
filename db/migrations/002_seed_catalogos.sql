-- ============================================================================
-- MapFI · Migración 002 · Seeds de catálogos
-- ----------------------------------------------------------------------------
-- Carga inicial idempotente (ON CONFLICT DO NOTHING) de:
--   · 14 carreras de la Facultad de Ingeniería (UdeC)
--   · niveles académicos (generaciones)
--   · entidades base (14 centros + Vinculación + Gearbox)
--   · periodo académico vigente
--   · feriados nacionales (los móviles marcados con VERIFICAR)
-- El usuario ADMIN inicial NO se crea aquí: lo crea js/db/migrate.js con
-- bcrypt a partir de SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
-- ============================================================================

-- ── Carreras (Facultad de Ingeniería UdeC) ──────────────────────────────────
INSERT INTO carrera (id, codigo, nombre, color) VALUES
    (1,  'IC',    'Ingeniería Civil',                        '#12395E'),
    (2,  'ICAE',  'Ingeniería Civil Aeroespacial',           '#0EA5E9'),
    (3,  'ICB',   'Ingeniería Civil Biomédica',              '#DB2777'),
    (4,  'ICEL',  'Ingeniería Civil Electrónica',            '#7C3AED'),
    (5,  'ICE',   'Ingeniería Civil Eléctrica',              '#CA8A04'),
    (6,  'ICI',   'Ingeniería Civil Industrial',             '#2563EB'),
    (7,  'ICINF', 'Ingeniería Civil Informática',            '#0891B2'),
    (8,  'ICMAT', 'Ingeniería Civil de Materiales',          '#65A30D'),
    (9,  'ICM',   'Ingeniería Civil Mecánica',               '#DC2626'),
    (10, 'ICMET', 'Ingeniería Civil Metalúrgica',            '#64748B'),
    (11, 'ICMIN', 'Ingeniería Civil de Minas',               '#92400E'),
    (12, 'ICQ',   'Ingeniería Civil Química',                '#16A34A'),
    (13, 'ICT',   'Ingeniería Civil en Telecomunicaciones',  '#14B8A6'),
    (14, 'ICPC',  'Ingeniería Civil – Plan Común',           '#475569')
ON CONFLICT (id) DO NOTHING;

-- ── Niveles académicos / generaciones ───────────────────────────────────────
INSERT INTO generacion (nivel, etiqueta) VALUES
    (1, 'Primer año'),
    (2, 'Segundo año'),
    (3, 'Tercer año'),
    (4, 'Cuarto año'),
    (5, 'Quinto año')
ON CONFLICT (nivel) DO NOTHING;

-- ── Entidades aportantes ────────────────────────────────────────────────────
-- Un centro de estudiantes por carrera + Vinculación + Gearbox.
-- 'sigla' = iniciales mostradas en la UI (ej. CEEIND); 'nombre' = razón completa.
INSERT INTO entidad (tipo, sigla, nombre, carrera_id) VALUES
    ('CENTRO_ALUMNOS', 'CEEIC',  'Centro de Estudiantes de Ingeniería Civil',                          1),
    ('CENTRO_ALUMNOS', 'CEEAE',  'Centro de Estudiantes de Ingeniería Civil Aeroespacial',             2),
    ('CENTRO_ALUMNOS', 'CEEBIO', 'Centro de Estudiantes de Ingeniería Civil Biomédica',                3),
    ('CENTRO_ALUMNOS', 'CEEELN', 'Centro de Estudiantes de Ingeniería Civil Electrónica',              4),
    ('CENTRO_ALUMNOS', 'CEEELE', 'Centro de Estudiantes de Ingeniería Civil Eléctrica',                5),
    ('CENTRO_ALUMNOS', 'CEEIND', 'Centro de Estudiantes de Ingeniería Civil Industrial',               6),
    ('CENTRO_ALUMNOS', 'CEEINF', 'Centro de Estudiantes de Ingeniería Civil Informática',              7),
    ('CENTRO_ALUMNOS', 'CEEMAT', 'Centro de Estudiantes de Ingeniería Civil de Materiales',            8),
    ('CENTRO_ALUMNOS', 'CEEMEC', 'Centro de Estudiantes de Ingeniería Civil Mecánica',                 9),
    ('CENTRO_ALUMNOS', 'CEEMET', 'Centro de Estudiantes de Ingeniería Civil Metalúrgica',             10),
    ('CENTRO_ALUMNOS', 'CEEMIN', 'Centro de Estudiantes de Ingeniería Civil de Minas',                11),
    ('CENTRO_ALUMNOS', 'CEEQUI', 'Centro de Estudiantes de Ingeniería Civil Química',                 12),
    ('CENTRO_ALUMNOS', 'CEETEL', 'Centro de Estudiantes de Ingeniería Civil en Telecomunicaciones',   13),
    ('CENTRO_ALUMNOS', 'CEEPC',  'Centro de Estudiantes de Ingeniería Civil – Plan Común',            14),
    ('VINCULACION',    'VcM',    'Dirección de Vinculación con el Medio',                            NULL),
    ('GEARBOX',        'GBX',    'Gearbox - Hub de Innovación y Emprendimiento',                     NULL),
    ('FACULTAD',       'DOCFI',  'Dirección de Docencia - Facultad de Ingeniería',                   NULL)
ON CONFLICT DO NOTHING;

-- ── Periodo académico vigente (ajustar fechas reales) ───────────────────────
INSERT INTO periodo_academico (anio, semestre, fecha_inicio, fecha_fin, activo) VALUES
    (2026, 1, '2026-03-09', '2026-07-10', TRUE),
    (2026, 2, '2026-08-03', '2026-12-11', FALSE)
ON CONFLICT (anio, semestre) DO NOTHING;

-- ── Feriados nacionales de Chile 2026 ───────────────────────────────────────
-- Fechas fijas (confiables). Los feriados MÓVILES (Semana Santa, San Pedro y
-- San Pablo, Pueblos Indígenas, Encuentro de Dos Mundos) deben VERIFICARSE
-- contra el decreto oficial del año.
INSERT INTO feriado (fecha, nombre, tipo, es_nacional) VALUES
    ('2026-01-01', 'Año Nuevo',                         'IRRENUNCIABLE', TRUE),
    ('2026-04-03', 'Viernes Santo',                     'LEGAL',         TRUE),
    ('2026-04-04', 'Sábado Santo',                      'LEGAL',         TRUE),
    ('2026-05-01', 'Día del Trabajo',                   'IRRENUNCIABLE', TRUE),
    ('2026-05-21', 'Día de las Glorias Navales',        'LEGAL',         TRUE),
    ('2026-06-20', 'Día de los Pueblos Indígenas',      'LEGAL',         TRUE),  -- VERIFICAR
    ('2026-06-29', 'San Pedro y San Pablo',             'LEGAL',         TRUE),  -- VERIFICAR
    ('2026-07-16', 'Día de la Virgen del Carmen',       'LEGAL',         TRUE),
    ('2026-08-15', 'Asunción de la Virgen',             'LEGAL',         TRUE),
    ('2026-09-18', 'Independencia Nacional',            'IRRENUNCIABLE', TRUE),
    ('2026-09-19', 'Día de las Glorias del Ejército',   'IRRENUNCIABLE', TRUE),
    ('2026-10-12', 'Encuentro de Dos Mundos',           'LEGAL',         TRUE),  -- VERIFICAR
    ('2026-10-31', 'Día de las Iglesias Evangélicas',   'LEGAL',         TRUE),
    ('2026-11-01', 'Día de Todos los Santos',           'LEGAL',         TRUE),
    ('2026-12-08', 'Inmaculada Concepción',             'LEGAL',         TRUE),
    ('2026-12-25', 'Navidad',                           'IRRENUNCIABLE', TRUE)
ON CONFLICT (fecha) DO NOTHING;

-- ── Ejemplo de MALLA HORARIA (Ing. Civil Industrial, primer año) ────────────
-- Datos de muestra para validar la vista de Horarios. Edítalos o elimínalos.
INSERT INTO bloque_horario (carrera_id, nivel, dia_semana, hora_inicio, hora_fin, tipo, descripcion) VALUES
    (6, 1, 1, '08:30', '10:00', 'CLASE',     'Cálculo I'),
    (6, 1, 1, '10:15', '11:45', 'CLASE',     'Álgebra y Geometría'),
    (6, 1, 2, '08:30', '10:00', 'CLASE',     'Física I'),
    (6, 1, 2, '11:50', '13:20', 'CLASE',     'Química General'),
    (6, 1, 3, '11:50', '13:20', 'PROTEGIDO', 'Bloque protegido FI'),
    (6, 1, 4, '14:30', '16:00', 'CLASE',     'Introducción a la Programación'),
    (6, 1, 5, '10:15', '11:45', 'LIBRE',     'Ventana libre')
ON CONFLICT DO NOTHING;

-- ── Ejemplo de CALENDARIO ACADÉMICO (muestra) ───────────────────────────────
-- Una evaluación (Dirección de Docencia) y un evento (CEE Industrial).
INSERT INTO actividad (titulo, descripcion, entidad_id, periodo_id, fecha_inicio, fecha_fin, tipo, estado, ubicacion)
SELECT 'Certamen 1 - Cálculo I', 'Primera evaluación del semestre', e.id, p.id,
       '2026-06-23 18:30:00-04', '2026-06-23 20:00:00-04', 'EXAMEN', 'CONFIRMADA', 'Aula 301'
FROM entidad e CROSS JOIN periodo_academico p
WHERE e.sigla = 'DOCFI' AND p.anio = 2026 AND p.semestre = 1
ON CONFLICT DO NOTHING;

INSERT INTO actividad (titulo, descripcion, entidad_id, periodo_id, fecha_inicio, fecha_fin, tipo, estado, ubicacion)
SELECT 'Semana del Novato', 'Actividad de bienvenida a primer año', e.id, p.id,
       '2026-06-16 12:00:00-04', '2026-06-16 16:00:00-04', 'EVENTO', 'CONFIRMADA', 'Patio central FI'
FROM entidad e CROSS JOIN periodo_academico p
WHERE e.sigla = 'CEEIND' AND p.anio = 2026 AND p.semestre = 1
ON CONFLICT DO NOTHING;

-- Público objetivo de las actividades de muestra (Ing. Civil Industrial, 1er año).
INSERT INTO actividad_publico (actividad_id, carrera_id, nivel)
SELECT a.id, 6, 1 FROM actividad a
WHERE a.titulo IN ('Certamen 1 - Cálculo I', 'Semana del Novato')
ON CONFLICT DO NOTHING;
