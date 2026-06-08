"use strict";
/**
 * holidayService — Logica cronologica (requisito §4).
 * SERVICIO PURO (sin I/O): recibe la lista de feriados ya consultada.
 *
 * Reglas:
 *   · Los fines de semana (sab/dom) se excluyen por defecto del calculo.
 *   · Los feriados se reciben como lista de fechas (las entrega feriadoDao).
 */

/** Normaliza cualquier fecha a 'YYYY-MM-DD' en la zona del proceso (TZ). */
function toISODate(fecha) {
  const d = new Date(fecha);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function esFinDeSemana(fecha) {
  const dia = new Date(fecha).getDay(); // 0=Domingo .. 6=Sabado
  return dia === 0 || dia === 6;
}

function esFeriado(fecha, feriados = []) {
  const iso = toISODate(fecha);
  return feriados.some((f) => toISODate(f) === iso);
}

/** Dia habil = Lun-Vie y no feriado. */
function esDiaHabil(fecha, feriados = []) {
  return !esFinDeSemana(fecha) && !esFeriado(fecha, feriados);
}

/** Cuenta dias habiles en [inicio, fin] (ambos inclusive). */
function diasHabilesEntre(inicio, fin, feriados = []) {
  let count = 0;
  const cur = new Date(inicio); cur.setHours(0, 0, 0, 0);
  const end = new Date(fin);    end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    if (esDiaHabil(cur, feriados)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

module.exports = {
  toISODate,
  esFinDeSemana,
  esFeriado,
  esDiaHabil,
  diasHabilesEntre,
};

// TODO(F2): sincronizacion automatica de feriados nacionales + dias sandwich.
