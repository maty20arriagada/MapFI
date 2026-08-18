"use strict";
/**
 * heatmapService — Mapa de calor de saturacion (§3.B).
 * SERVICIO PURO: recibe datos y devuelve celdas con su nivel de color. Sin
 * I/O, sin red, sin base de datos (Principio II).
 *
 * Dos vistas, dos preguntas distintas:
 *
 *   semestrePorDia()  "¿que dias del semestre estan cargados?"
 *                     Matriz dias x semanas. La conduce el numero de
 *                     actividades del calendario academico.
 *
 *   semanaPorHora()   "¿a que HORA de esta semana meto mi actividad?"
 *                     Matriz dia x bloque de 15 min. La conduce el porcentaje
 *                     de estudiantes que NO puede asistir, combinando el
 *                     horario de clases con las actividades ya agendadas.
 *
 * Ambas usan la MISMA rampa de 5 colores para que no haya que reaprender el
 * codigo de color al cambiar de vista; lo que cambia es que la alimenta, y
 * cada vista lo explica en su leyenda.
 */

// Rampa unica, de menos a mas saturado. `clase` es el nombre CSS.
const NIVELES = [
  { id: "LIBRE", clase: "heat-libre", etiqueta: "Libre" },
  { id: "BAJA", clase: "heat-baja", etiqueta: "Baja" },
  { id: "MEDIA", clase: "heat-media", etiqueta: "Media" },
  { id: "ALTA", clase: "heat-alta", etiqueta: "Alta" },
  { id: "SATURADO", clase: "heat-saturado", etiqueta: "Saturado" },
];

/** Umbrales de la vista de SEMESTRE, por numero de actividades en el dia. */
const UMBRAL = { BAJO: 1, MEDIO: 3, ALTO: 5 };

/** Umbrales de la vista SEMANAL, por % de estudiantes ocupados. */
const UMBRAL_PCT = { BAJO: 1, MEDIO: 34, ALTO: 67, TOTAL: 100 };

const HORA_INICIO = 480; // 08:00, misma rejilla que js/services/horarioService.js
const HORA_FIN = 1260;   // 21:00
const PASO = 15;
const FILAS = (HORA_FIN - HORA_INICIO) / PASO; // 52

/** Nivel por numero de actividades (vista de semestre). */
function nivelPorEventos(eventos) {
  const n = Number(eventos) || 0;
  if (n === 0) return NIVELES[0];
  if (n <= UMBRAL.BAJO) return NIVELES[1];
  if (n <= UMBRAL.MEDIO) return NIVELES[2];
  if (n <= UMBRAL.ALTO) return NIVELES[3];
  return NIVELES[4];
}

/** Nivel por porcentaje de estudiantes ocupados (vista semanal). */
function nivelPorPct(pct) {
  const p = Number(pct) || 0;
  if (p < UMBRAL_PCT.BAJO) return NIVELES[0];
  if (p < UMBRAL_PCT.MEDIO) return NIVELES[1];
  if (p < UMBRAL_PCT.ALTO) return NIVELES[2];
  if (p < UMBRAL_PCT.TOTAL) return NIVELES[3];
  return NIVELES[4];
}

/** "08:30" | "08:30:00" -> 510 minutos. null si no se puede interpretar. */
function aMinutos(t) {
  if (t === null || t === undefined) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

function aHHMM(min) {
  return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
}

/**
 * Convierte a Date LOCAL. Es imprescindible tratar aparte las cadenas
 * "AAAA-MM-DD": `new Date("2026-09-07")` las interpreta como UTC, y al oeste
 * de Greenwich eso cae el DIA ANTERIOR — el lunes de la semana se corria
 * entera. Es el mismo tipo de error que la Spec 002 documento como H-01.
 */
function aFechaLocal(fecha) {
  if (fecha instanceof Date) return new Date(fecha.getTime());
  const s = String(fecha);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date(s);
}

/** Fecha (Date o ISO) -> "AAAA-MM-DD" en hora local. */
function iso(fecha) {
  const d = aFechaLocal(fecha);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Lunes de la semana que contiene `fecha`. Coincide con actividadDao.semanaDe(). */
function lunesDe(fecha) {
  const base = aFechaLocal(fecha);
  base.setHours(0, 0, 0, 0);
  const dow = base.getDay() === 0 ? 7 : base.getDay();
  base.setDate(base.getDate() - (dow - 1));
  return base;
}

const clave = (s) => `${s.carreraId}-${s.nivel}`;

/**
 * COMPATIBILIDAD: sigue existiendo con la firma de siempre, porque
 * `/api/heatmap` la usa. Ahora ademas devuelve el nivel de la rampa nueva.
 * @param {Array<{carrera_id,nivel,fecha,eventos,examenes}>} filas
 */
function construir(filas = []) {
  return filas.map((r) => {
    const nivel = nivelPorEventos(r.eventos);
    return {
      carreraId: r.carrera_id,
      nivel: r.nivel,
      fecha: r.fecha,
      eventos: Number(r.eventos),
      examenes: Number(r.examenes),
      // `color` se mantiene por compatibilidad con la vista antigua.
      color: nivel.id === "LIBRE" || nivel.id === "BAJA" ? "VERDE"
        : nivel.id === "MEDIA" ? "AMARILLO" : "ROJO",
      nivelId: nivel.id,
      nivelClase: nivel.clase,
    };
  });
}

/**
 * Vista de SEMESTRE: matriz dia de la semana x semana.
 *
 * @param {Array} filas      de vw_saturacion_segmento (carrera_id, nivel, fecha, eventos, examenes)
 * @param {object} [opts]
 * @param {string[]} [opts.feriados]  fechas "AAAA-MM-DD" sin clases
 * @param {string} [opts.desde]       primera fecha del rango (por defecto, la menor de `filas`)
 * @param {string} [opts.hasta]
 * @returns {{semanas: Array, celdas: object, total: number}}
 *          `semanas` son los lunes de cada columna; `celdas` va indexada por
 *          "AAAA-MM-DD".
 */
function semestrePorDia(filas = [], opts = {}) {
  const feriados = new Set((opts.feriados || []).map((f) => iso(f)));

  // Se suman las actividades de todos los segmentos que hayan pasado el
  // filtro: la vista de semestre mira el calendario, no un publico concreto.
  const porFecha = new Map();
  filas.forEach((r) => {
    const f = iso(r.fecha);
    if (!porFecha.has(f)) porFecha.set(f, { eventos: 0, examenes: 0 });
    const acc = porFecha.get(f);
    acc.eventos += Number(r.eventos) || 0;
    acc.examenes += Number(r.examenes) || 0;
  });

  const fechas = [...porFecha.keys()].sort();
  const desde = opts.desde ? iso(opts.desde) : fechas[0];
  const hasta = opts.hasta ? iso(opts.hasta) : fechas[fechas.length - 1];
  if (!desde || !hasta) return { semanas: [], celdas: {}, total: 0 };

  const semanas = [];
  const celdas = {};
  let total = 0;

  const cursor = lunesDe(desde);
  // aFechaLocal y no `new Date(hasta)`: con una cadena "AAAA-MM-DD" esta
  // ultima da medianoche UTC, que al oeste de Greenwich cae el dia anterior
  // y recortaba la ultima semana del semestre.
  const fin = aFechaLocal(hasta);
  while (cursor <= fin) {
    const lunesIso = iso(cursor);
    semanas.push(lunesIso);
    for (let d = 0; d < 5; d++) {
      const dia = new Date(cursor);
      dia.setDate(cursor.getDate() + d);
      const f = iso(dia);
      const datos = porFecha.get(f) || { eventos: 0, examenes: 0 };
      const nivel = nivelPorEventos(datos.eventos);
      celdas[f] = {
        fecha: f,
        diaSemana: d + 1,
        semana: lunesIso,
        eventos: datos.eventos,
        examenes: datos.examenes,
        esFeriado: feriados.has(f),
        nivelId: nivel.id,
        nivelClase: nivel.clase,
        etiqueta: nivel.etiqueta,
      };
      total += datos.eventos;
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  return { semanas, celdas, total };
}

/**
 * Vista SEMANAL por hora: matriz dia (1..5) x bloque de 15 min.
 *
 * Una celda esta ocupada para un segmento si sus estudiantes estan EN CLASE o
 * si ya tienen una actividad agendada a esa hora — para quien programa da
 * igual el motivo: no van a venir. Los bloques PROTEGIDO no ocupan: son
 * justamente los que la Facultad reserva para actividades.
 *
 * @param {object} contexto  el que devuelve actividadDao.cargarContextoMatch():
 *        { bloques:[{carreraId,nivel,diaSemana,horaInicio,horaFin,tipo}],
 *          actividades:[{inicio,fin,tipo,estado,publico:[{carreraId,nivel}]}],
 *          feriados:[fecha], poblacion:{"7-1":120} }
 * @param {Array<{carreraId,nivel}>} segmentos  el publico que interesa
 * @param {object} [opts]
 * @param {string|Date} [opts.fecha]  cualquier dia de la semana a mostrar
 * @returns {{dias, celdas, totalPoblacion, sinMatricula}}
 */
function semanaPorHora(contexto, segmentos, opts = {}) {
  const ctx = contexto || {};
  const segs = (segmentos || []).map((s) => ({ carreraId: +s.carreraId, nivel: +s.nivel }));
  const poblacion = ctx.poblacion || {};

  // Sin matricula cargada, cada segmento pesa igual. Se declara en la salida
  // para que la interfaz pueda advertirlo en vez de fingir precision.
  const sinMatricula = segs.some((s) => !(clave(s) > "" && poblacion[clave(s)] > 0));
  const pesoDe = {};
  segs.forEach((s) => { pesoDe[clave(s)] = Number(poblacion[clave(s)]) > 0 ? Number(poblacion[clave(s)]) : 1; });
  const totalPoblacion = segs.reduce((a, s) => a + pesoDe[clave(s)], 0) || 1;

  const lunes = lunesDe(opts.fecha || new Date());
  const feriados = new Set((ctx.feriados || []).map((f) => iso(f)));

  const dias = [];
  for (let d = 0; d < 5; d++) {
    const fecha = new Date(lunes);
    fecha.setDate(lunes.getDate() + d);
    dias.push({ diaSemana: d + 1, fecha: iso(fecha), esFeriado: feriados.has(iso(fecha)) });
  }

  // Set de segmentos ocupados por celda, separando el motivo. Se usa Set para
  // que dos secciones del mismo segmento (o dos actividades a la vez) no
  // cuenten dos veces: el estudiante es uno solo.
  const porClase = [];
  const porActividad = [];
  for (let d = 0; d <= 5; d++) {
    porClase[d] = [];
    porActividad[d] = [];
    for (let f = 0; f < FILAS; f++) { porClase[d][f] = new Set(); porActividad[d][f] = new Set(); }
  }

  const marcar = (destino, dia, desdeMin, hastaMin, k) => {
    const ini = Math.max(HORA_INICIO, Math.floor(desdeMin / PASO) * PASO);
    const fin = Math.min(HORA_FIN, Math.ceil(hastaMin / PASO) * PASO);
    for (let m = ini; m < fin; m += PASO) {
      const fila = (m - HORA_INICIO) / PASO;
      if (fila >= 0 && fila < FILAS) destino[dia][fila].add(k);
    }
  };

  // Clases (recurrentes). Un feriado no tiene clases.
  (ctx.bloques || []).forEach((b) => {
    if (b.tipo !== "CLASE") return;
    const d = +b.diaSemana;
    if (!(d >= 1 && d <= 5)) return;
    if (dias[d - 1] && dias[d - 1].esFeriado) return;
    const k = `${b.carreraId}-${b.nivel}`;
    if (!(k in pesoDe)) return;
    const ini = aMinutos(b.horaInicio);
    const fin = aMinutos(b.horaFin);
    if (ini === null || fin === null) return;
    marcar(porClase, d, ini, fin, k);
  });

  // Actividades ya agendadas de ESTA semana, en su fecha y hora reales.
  (ctx.actividades || []).forEach((a) => {
    const ini = new Date(a.inicio);
    const fin = new Date(a.fin || a.inicio);
    const f = iso(ini);
    const dia = dias.find((x) => x.fecha === f);
    if (!dia) return;
    const desdeMin = ini.getHours() * 60 + ini.getMinutes();
    let hastaMin = fin.getHours() * 60 + fin.getMinutes();
    if (iso(fin) !== f || hastaMin <= desdeMin) hastaMin = HORA_FIN; // cruza medianoche o mal dato
    (a.publico || []).forEach((p) => {
      const k = `${p.carreraId}-${p.nivel}`;
      if (!(k in pesoDe)) return;
      marcar(porActividad, dia.diaSemana, desdeMin, hastaMin, k);
    });
  });

  const celdas = [];
  for (let d = 0; d <= 5; d++) {
    celdas[d] = [];
    for (let f = 0; f < FILAS; f++) {
      const ocupados = new Set([...porClase[d][f], ...porActividad[d][f]]);
      let peso = 0;
      ocupados.forEach((k) => { peso += pesoDe[k] || 0; });
      const pctOcupado = Math.round((peso / totalPoblacion) * 100);
      const nivel = nivelPorPct(pctOcupado);
      celdas[d][f] = {
        pctOcupado,
        pctLibre: 100 - pctOcupado,
        enClase: porClase[d][f].size,
        conActividad: porActividad[d][f].size,
        nivelId: nivel.id,
        nivelClase: nivel.clase,
        etiqueta: nivel.etiqueta,
        hora: aHHMM(HORA_INICIO + f * PASO),
      };
    }
  }

  return { dias, celdas, totalPoblacion, sinMatricula, lunes: iso(lunes) };
}

/**
 * Mejores franjas de la semana para programar, de menos a mas ocupadas.
 * Agrupa filas contiguas con la misma ocupacion para no devolver 52 tramos.
 * @param {object} rejilla  lo que devuelve semanaPorHora()
 * @param {number} [duracionMin=90]
 */
function mejoresFranjas(rejilla, duracionMin) {
  const necesarias = Math.ceil(Math.max(PASO, duracionMin || 90) / PASO);
  const franjas = [];

  for (let d = 1; d <= 5; d++) {
    const dia = rejilla.dias[d - 1];
    if (!dia || dia.esFeriado) continue;
    let ini = 0;
    for (let f = 1; f <= FILAS; f++) {
      const actual = f < FILAS ? rejilla.celdas[d][f].pctOcupado : null;
      const previo = rejilla.celdas[d][ini].pctOcupado;
      if (actual === previo) continue;
      if (f - ini >= necesarias) {
        franjas.push({
          diaSemana: d,
          fecha: dia.fecha,
          horaInicio: aHHMM(HORA_INICIO + ini * PASO),
          horaFin: aHHMM(HORA_INICIO + f * PASO),
          pctOcupado: previo,
          pctLibre: 100 - previo,
        });
      }
      ini = f;
    }
  }

  return franjas.sort((a, b) => a.pctOcupado - b.pctOcupado || a.diaSemana - b.diaSemana);
}

module.exports = {
  construir,
  semestrePorDia,
  semanaPorHora,
  mejoresFranjas,
  nivelPorEventos,
  nivelPorPct,
  lunesDe,
  aFechaLocal,
  iso,
  NIVELES,
  UMBRAL,
  UMBRAL_PCT,
  HORA_INICIO,
  HORA_FIN,
  PASO,
  FILAS,
};
