-- ============================================================================
-- MapFI · Migración 016 · Limpiar bloques de muestra del horario
-- ----------------------------------------------------------------------------
-- La migración 002 sembró 7 bloques de EJEMPLO en Ing. Civil Industrial, 1.er
-- año, rotulados explícitamente como "Datos de muestra para validar la vista
-- de Horarios. Edítalos o elimínalos" (002_seed_catalogos.sql). En todo
-- despliegue nuevo esos bloques quedan visibles como si fueran el horario
-- real de un curso (Spec 003, defecto D-1).
--
-- No se puede editar la migración 002 (Principio V: aditivo, nunca se toca
-- una migración ya aplicada) y borrar por segmento (carrera+nivel) sería
-- destructivo si alguien ya cargó ahí su horario real. Por eso el DELETE
-- compara las SIETE TUPLAS COMPLETAS: solo desaparece lo que sigue siendo
-- literalmente el dato de muestra. Cualquier fila editada, o cualquier
-- horario real cargado después, no coincide y sobrevive.
--
-- Aditiva e idempotente: en un segundo pase no queda nada que coincida. NO
-- inserta en schema_migrations (lo hace el runner).
-- ============================================================================

DELETE FROM bloque_horario
WHERE (carrera_id, nivel, dia_semana, hora_inicio, hora_fin, tipo, descripcion) IN (
    (6, 1, 1, '08:30', '10:00', 'CLASE',     'Cálculo I'),
    (6, 1, 1, '10:15', '11:45', 'CLASE',     'Álgebra y Geometría'),
    (6, 1, 2, '08:30', '10:00', 'CLASE',     'Física I'),
    (6, 1, 2, '11:50', '13:20', 'CLASE',     'Química General'),
    (6, 1, 3, '11:50', '13:20', 'PROTEGIDO', 'Bloque protegido FI'),
    (6, 1, 4, '14:30', '16:00', 'CLASE',     'Introducción a la Programación'),
    (6, 1, 5, '10:15', '11:45', 'LIBRE',     'Ventana libre')
);
