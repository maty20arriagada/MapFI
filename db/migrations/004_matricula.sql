-- ============================================================================
-- MapFI · Migracion 004 · Matricula por segmento
-- ----------------------------------------------------------------------------
-- Cantidad de estudiantes por (carrera, nivel). La usa el algoritmo de match
-- para estimar el ALCANCE de beneficiarios. Valores placeholder editables.
-- ============================================================================

CREATE TABLE IF NOT EXISTS matricula (
    carrera_id SMALLINT NOT NULL REFERENCES carrera(id),
    nivel      SMALLINT NOT NULL REFERENCES generacion(nivel),
    cantidad   INTEGER  NOT NULL DEFAULT 0,
    PRIMARY KEY (carrera_id, nivel)
);

-- Seed: 100 estudiantes por segmento (placeholder — ajustar a la matricula real).
INSERT INTO matricula (carrera_id, nivel, cantidad)
SELECT c.id, g.nivel, 100
FROM carrera c CROSS JOIN generacion g
ON CONFLICT (carrera_id, nivel) DO NOTHING;
