"use strict";
/**
 * matchService — Calculador inteligente de Compatibilidad y Alcance (§3.C).
 * SERVICIO PURO (sin I/O). Especificacion completa en docs/ALGORITMO_MATCH.md.
 *
 * Implementacion completa (Fase 3):
 *   Paso 0 · Descartes duros (fin de semana / feriado).
 *   Paso 1 · Choque con malla academica (CLASE / PROTEGIDO).
 *   Paso 2 · Choque con examenes del publico.
 *   Paso 3 · Saturacion (eventos confirmados al mismo publico esa semana).
 *   Paso 4 · compatibilidad_pct = clamp(100 - Σ penalizaciones, 0, 100).
 *   Paso 5 · alcance_estimado segun bloqueo y saturacion por segmento.
 *   Paso 6 · sugerencias: top-3 bloques de la semana si compat < umbral.
 *
 * El contexto (feriados, bloques, actividades, poblacion) lo arma
 * actividadDao.cargarContextoMatch() y se pasa por parametro.
 */
const holiday = require("./holidayService");

/** Pesos configurables del algoritmo (a futuro, movibles a BD). */
const PARAMS = {
  P_CLASE: 12,
  P_PROTEGIDO: 30,
  P_EXAMEN: 45,
  P_SATURACION: 10,
  UMBRAL_SUGERENCIA: 70,
  DURACION_BLOQUE_MIN: 90,
  DIA_INICIO_MIN: 8 * 60,  // 08:00 — inicio de jornada para sugerencias
  DIA_FIN_MIN: 20 * 60,    // 20:00 — fin de jornada para sugerencias
};

// ── Helpers puros ────────────────────────────────────────────────────────────
function semaforo(pct) { return pct >= 75 ? "ALTO" : pct >= 45 ? "MEDIO" : "BAJO"; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function segKey(s) { return `${s.carreraId}-${s.nivel}`; }
function minutosDelDia(d) { const x = new Date(d); return x.getHours() * 60 + x.getMinutes(); }
function diaSemana(d) { const g = new Date(d).getDay(); return g === 0 ? 7 : g; } // 1=Lun..7=Dom
function overlap(a0, a1, b0, b1) { return a0 < b1 && b0 < a1; }
function poblacionDe(seg, poblacion) { return (poblacion && poblacion[segKey(seg)]) || 0; }
function poblacionTotal(publico, poblacion = {}) {
  return publico.reduce((acc, s) => acc + poblacionDe(s, poblacion), 0);
}

/** 'HH:MM[:SS]' o Date → minutos desde medianoche. */
function horaAMin(h) {
  if (h == null) return 0;
  if (h instanceof Date) return minutosDelDia(h);
  const [hh, mm] = String(h).split(":");
  return (parseInt(hh, 10) || 0) * 60 + (parseInt(mm, 10) || 0);
}

function compartenSegmento(pubA, pubB) {
  return pubA.some((a) => pubB.some((b) => a.carreraId === b.carreraId && a.nivel === b.nivel));
}

function lunesDe(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - (diaSemana(x) - 1));
  return x;
}
function mismaSemana(d1, d2) { return lunesDe(d1).getTime() === lunesDe(d2).getTime(); }

function dedup(arr) {
  const seen = new Set(); const out = [];
  for (const c of arr) { const k = c.tipo + "|" + c.detalle; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  return out;
}

function resultado(pct, alcance, conflictos = [], sugerencias = []) {
  return {
    compatibilidad_pct: pct,
    alcance_estimado: alcance,
    nivel: semaforo(pct),
    conflictos,
    sugerencias,
  };
}

function validar(p) {
  if (!p || !p.inicio || !Array.isArray(p.publico) || p.publico.length === 0) {
    throw new Error("Propuesta invalida: se requiere 'inicio' y 'publico' objetivo.");
  }
}

// ── Motor principal ──────────────────────────────────────────────────────────
/**
 * @param {{inicio:Date|string, fin?:Date|string, publico:Array<{carreraId,nivel}>}} propuesta
 * @param {{feriados?:Array, bloques?:Array, actividades?:Array, poblacion?:Object}} contexto
 * @param {object} [params]
 * @param {boolean} [generarSugerencias=true] interno: evita recursion infinita
 */
function evaluar(propuesta, contexto = {}, params = PARAMS, generarSugerencias = true) {
  validar(propuesta);

  const feriados = contexto.feriados || [];
  const bloques = contexto.bloques || [];
  const actividades = contexto.actividades || [];
  const poblacion = contexto.poblacion || {};

  const inicio = new Date(propuesta.inicio);
  const fin = new Date(propuesta.fin || propuesta.inicio);

  // ── Paso 0 · Descartes duros ───────────────────────────────────────────────
  if (holiday.esFinDeSemana(inicio)) {
    return resultado(0, 0, [{ tipo: "FIN_DE_SEMANA", detalle: "La fecha cae en fin de semana", peso: 100 }]);
  }
  if (holiday.esFeriado(inicio, feriados)) {
    return resultado(10, 0, [{ tipo: "FERIADO", detalle: "La fecha es feriado", peso: 90 }]);
  }

  const dia = diaSemana(inicio);
  const pStart = minutosDelDia(inicio);
  let pEnd = minutosDelDia(fin);
  if (pEnd <= pStart) pEnd = Math.min(pStart + params.DURACION_BLOQUE_MIN, 24 * 60);

  let penal = 0;
  const conflictos = [];
  const segInfo = {};
  for (const s of propuesta.publico) {
    segInfo[segKey(s)] = { examen: false, clase: false, protegido: false, saturacion: 0 };
  }

  // ── Paso 1 · Choque con malla academica ────────────────────────────────────
  for (const s of propuesta.publico) {
    for (const b of bloques) {
      if (b.carreraId !== s.carreraId || b.nivel !== s.nivel) continue;
      if (Number(b.diaSemana) !== dia) continue;
      if (!overlap(pStart, pEnd, horaAMin(b.horaInicio), horaAMin(b.horaFin))) continue;
      if (b.tipo === "CLASE") {
        penal += params.P_CLASE; segInfo[segKey(s)].clase = true;
        conflictos.push({ tipo: "CLASE", detalle: `Choque con clase de ${segKey(s)}`, peso: params.P_CLASE });
      } else if (b.tipo === "PROTEGIDO") {
        penal += params.P_PROTEGIDO; segInfo[segKey(s)].protegido = true;
        conflictos.push({ tipo: "PROTEGIDO", detalle: `Choque con bloque protegido de ${segKey(s)}`, peso: params.P_PROTEGIDO });
      }
    }
  }

  // ── Pasos 2 y 3 · Examenes y saturacion ────────────────────────────────────
  for (const act of actividades) {
    const actPub = act.publico || [];
    if (!compartenSegmento(propuesta.publico, actPub)) continue;
    const aIni = new Date(act.inicio), aFin = new Date(act.fin || act.inicio);

    if (act.tipo === "EXAMEN" && overlap(inicio.getTime(), fin.getTime(), aIni.getTime(), aFin.getTime())) {
      penal += params.P_EXAMEN;
      conflictos.push({ tipo: "EXAMEN", detalle: "Choque con un examen del publico objetivo", peso: params.P_EXAMEN });
      for (const s of propuesta.publico) {
        if (actPub.some((p) => p.carreraId === s.carreraId && p.nivel === s.nivel)) segInfo[segKey(s)].examen = true;
      }
    }

    if (act.tipo !== "EXAMEN" &&
        (act.estado === "CONFIRMADA" || act.estado === "REALIZADA") &&
        mismaSemana(inicio, aIni)) {
      penal += params.P_SATURACION;
      for (const s of propuesta.publico) {
        if (actPub.some((p) => p.carreraId === s.carreraId && p.nivel === s.nivel)) segInfo[segKey(s)].saturacion += 1;
      }
      conflictos.push({ tipo: "SATURACION", detalle: "Otro evento al mismo publico esa semana", peso: params.P_SATURACION });
    }
  }

  // ── Paso 4 · Compatibilidad ─────────────────────────────────────────────────
  const compat = clamp(Math.round(100 - penal), 0, 100);

  // ── Paso 5 · Alcance estimado ───────────────────────────────────────────────
  let alcance = 0;
  for (const s of propuesta.publico) {
    const info = segInfo[segKey(s)];
    let factor = 1;
    if (info.examen) factor = 0;
    else if (info.clase) factor = 0.15;
    else if (info.protegido) factor = 0.4;
    const satFactor = 1 - Math.min(info.saturacion * 0.1, 0.6);
    alcance += Math.round(poblacionDe(s, poblacion) * factor * satFactor);
  }

  // ── Paso 6 · Sugerencias ────────────────────────────────────────────────────
  let sugerencias = [];
  if (generarSugerencias && compat < params.UMBRAL_SUGERENCIA) {
    sugerencias = generarTop3(propuesta, contexto, params, inicio, pEnd - pStart);
  }

  return resultado(compat, alcance, dedup(conflictos), sugerencias);
}

/** Evalua los bloques candidatos de la semana y devuelve los 3 mejores. */
function generarTop3(propuesta, contexto, params, baseInicio, duracionMin) {
  const dur = duracionMin > 0 ? duracionMin : params.DURACION_BLOQUE_MIN;
  const lunes = lunesDe(baseInicio);
  const baseTs = new Date(propuesta.inicio).getTime();
  const candidatos = [];

  for (let d = 0; d < 5; d++) { // Lun..Vie
    const dia = new Date(lunes); dia.setDate(lunes.getDate() + d);
    if (holiday.esFeriado(dia, contexto.feriados || [])) continue;

    for (let t = params.DIA_INICIO_MIN; t + dur <= params.DIA_FIN_MIN; t += params.DURACION_BLOQUE_MIN) {
      const ini = new Date(dia); ini.setHours(Math.floor(t / 60), t % 60, 0, 0);
      if (ini.getTime() === baseTs) continue; // saltar la propuesta original
      const finC = new Date(ini.getTime() + dur * 60000);
      const r = evaluar({ inicio: ini, fin: finC, publico: propuesta.publico }, contexto, params, false);
      candidatos.push({
        inicio: ini,
        fin: finC,
        compatibilidad_pct: r.compatibilidad_pct,
        alcance_estimado: r.alcance_estimado,
      });
    }
  }

  candidatos.sort((a, b) =>
    b.compatibilidad_pct - a.compatibilidad_pct || b.alcance_estimado - a.alcance_estimado
  );
  return candidatos.slice(0, 3);
}

module.exports = { evaluar, semaforo, poblacionTotal, PARAMS };
