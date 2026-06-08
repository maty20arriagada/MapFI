"use strict";
/**
 * heatmapService — Mapa de calor de saturacion (§3.B).
 * SERVICIO PURO: recibe filas de vw_saturacion_segmento (via kpiDao) y las
 * convierte en celdas con escala de color.
 *
 * ESTADO (scaffold Fase 0):
 *   ✔ Escala de color basica (verde/amarillo/rojo) por conteo de eventos.
 *   ☐ Umbrales dinamicos segun poblacion del segmento → Fase 3.
 *   ☐ Agregacion semanal / por bloque → Fase 3.
 */

/** Umbrales por cantidad de eventos en el dia (placeholder ajustable). */
const UMBRAL = { BAJO: 1, MEDIO: 3 }; // <=1 verde · 2-3 amarillo · >3 rojo

function color(eventos) {
  if (eventos <= UMBRAL.BAJO) return "VERDE";
  if (eventos <= UMBRAL.MEDIO) return "AMARILLO";
  return "ROJO";
}

/**
 * Construye las celdas del mapa de calor a partir de filas de saturacion.
 * @param {Array<{carrera_id,nivel,fecha,eventos,examenes}>} filas
 * @returns {Array<{carreraId,nivel,fecha,eventos,examenes,color}>}
 */
function construir(filas = []) {
  return filas.map((r) => ({
    carreraId: r.carrera_id,
    nivel: r.nivel,
    fecha: r.fecha,
    eventos: Number(r.eventos),
    examenes: Number(r.examenes),
    color: color(Number(r.eventos)),
  }));
}

module.exports = { construir, color, UMBRAL };

// TODO(F3): umbrales relativos al tamano del segmento; ponderar examenes.
