/* MapFI · horarioService.js — geometria de la grilla de horarios (Spec 003, US2).
 * Servicio PURO: sin I/O, sin red, sin base de datos (Principio II). Traduce
 * bloques (dia_semana, hora_inicio, hora_fin) a filas de una grilla CSS fija
 * de 08:00 a 21:00 con resolucion de 15 minutos, de modo que 45 y 90 minutos
 * queden en proporcion exacta (ver research.md, R-1). Corre tanto en el
 * navegador (js/horarios-view.js) como en Node (Jest), igual que csv-utils.js. */
(function (global) {
  "use strict";

  const HORA_INICIO = 480; // 08:00 en minutos desde medianoche
  const HORA_FIN = 1260;   // 21:00
  const PASO = 15;
  const FILAS = (HORA_FIN - HORA_INICIO) / PASO; // 52

  /** "8:30" | "08:30" | "08:30:00" → 510. null si no se puede interpretar. */
  function aMinutos(t) {
    if (t === null || t === undefined) return null;
    const m = String(t).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return (+m[1]) * 60 + (+m[2]);
  }

  /** 510 → "08:30". */
  function aHHMM(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  const filaDe = (min) => 2 + (min - HORA_INICIO) / PASO; // fila 1 = cabecera de dias

  /** Agrupa en racimos transitivos y asigna sub-columnas dentro de cada uno (R-3). */
  function apilarDia(bloquesDelDia) {
    bloquesDelDia.sort((a, b) => a.filaInicio - b.filaInicio || a.filaFin - b.filaFin);

    let cluster = [];
    let clusterFin = -Infinity;

    function cerrarCluster() {
      if (!cluster.length) return;
      const finesColumna = [];
      cluster.forEach((b) => {
        let col = finesColumna.findIndex((fin) => fin <= b.filaInicio);
        if (col === -1) { col = finesColumna.length; finesColumna.push(b.filaFin); }
        else { finesColumna[col] = b.filaFin; }
        b.subColumna = col;
      });
      cluster.forEach((b) => { b.subColumnas = finesColumna.length; });
      cluster = [];
    }

    bloquesDelDia.forEach((b) => {
      if (cluster.length && b.filaInicio >= clusterFin) cerrarCluster();
      cluster.push(b);
      clusterFin = Math.max(clusterFin, b.filaFin);
    });
    cerrarCluster();
  }

  /**
   * Calcula la geometria de cada bloque para dibujarlo en la grilla: fila de
   * inicio/fin (resolucion de 15 min, ajustada al cuarto de hora mas cercano
   * si el dato real no cae en uno — R-2), y sub-columna cuando se solapa con
   * otro bloque del mismo dia (R-3).
   *
   * Los bloques total o parcialmente fuera de 08:00-21:00 NO participan del
   * apilado ni llevan fila: se marcan `fueraDeRango` para que la vista los
   * liste en un aviso en vez de deformar la grilla (FR-010).
   *
   * @param {Array} bloques — con dia_semana, hora_inicio, hora_fin (y el resto de campos, que se conservan)
   * @returns {Array} los mismos bloques, con filaInicio/filaFin/subColumna/subColumnas/ajustado/fueraDeRango
   */
  function geometria(bloques) {
    const conFilas = (bloques || []).map((b) => {
      const inicioMin = aMinutos(b.hora_inicio);
      const finMin = aMinutos(b.hora_fin);
      const fueraDeRango = inicioMin === null || finMin === null || inicioMin < HORA_INICIO || finMin > HORA_FIN;
      const ajustado = !fueraDeRango && (inicioMin % PASO !== 0 || finMin % PASO !== 0);
      const inicioAjustado = Math.floor(inicioMin / PASO) * PASO;
      const finAjustado = Math.ceil(finMin / PASO) * PASO;

      return {
        ...b,
        fueraDeRango,
        ajustado,
        filaInicio: fueraDeRango ? null : filaDe(inicioAjustado),
        filaFin: fueraDeRango ? null : filaDe(finAjustado),
        subColumna: 0,
        subColumnas: 1,
      };
    });

    const porDia = {};
    conFilas.forEach((b) => {
      if (b.fueraDeRango) return;
      (porDia[b.dia_semana] = porDia[b.dia_semana] || []).push(b);
    });

    Object.values(porDia).forEach(apilarDia);

    return conFilas;
  }

  /**
   * Disponibilidad semanal: para cada dia y cada bloque de 15 min, cuantos de
   * los segmentos elegidos estan EN CLASE y cuantos estudiantes representan.
   *
   * Responde la pregunta que hace un centro al programar: "¿a que hora hay mas
   * gente libre?" y "¿puedo alcanzar a esta carrera?". Es el mismo dato que ya
   * usa matchService para penalizar choques (P_CLASE), pero visto al reves:
   * en vez de puntuar una fecha concreta, muestra la semana completa.
   *
   * @param {Array} bloques  bloques crudos (con carrera_id, nivel, dia_semana,
   *                         hora_inicio, hora_fin, tipo)
   * @param {Array<{carreraId, nivel, poblacion?}>} segmentos  los segmentos que
   *        interesan. `poblacion` es opcional: sin ella cada segmento pesa 1.
   * @returns {{celdas: Array, totalSegmentos: number, totalPoblacion: number}}
   *          `celdas` es una matriz [dia 1..5][fila 0..FILAS-1] con
   *          { ocupados, poblacionOcupada, libres, pctLibre }.
   */
  function disponibilidad(bloques, segmentos) {
    const segs = (segmentos || []).map((s) => ({
      clave: s.carreraId + "-" + s.nivel,
      poblacion: Number(s.poblacion) > 0 ? Number(s.poblacion) : 1,
    }));
    const totalSegmentos = segs.length;
    const totalPoblacion = segs.reduce((a, s) => a + s.poblacion, 0) || 1;
    const pesoDe = {};
    segs.forEach((s) => { pesoDe[s.clave] = s.poblacion; });

    // Por dia y fila, el conjunto de segmentos ocupados. Se usa Set para que
    // dos ramos distintos del MISMO segmento a la misma hora (secciones
    // paralelas) no cuenten dos veces: el estudiante solo esta en uno.
    const ocupadosPorCelda = [];
    for (let d = 0; d <= 5; d++) {
      ocupadosPorCelda[d] = [];
      for (let f = 0; f < FILAS; f++) ocupadosPorCelda[d][f] = new Set();
    }

    (bloques || []).forEach((b) => {
      // Solo las clases ocupan al estudiante. Un bloque LIBRE no lo ocupa, y
      // uno PROTEGIDO es justamente el que la Facultad reserva para actividades.
      if (b.tipo !== "CLASE") return;
      const dia = +b.dia_semana;
      if (!(dia >= 1 && dia <= 5)) return;
      const clave = b.carrera_id + "-" + b.nivel;
      if (!(clave in pesoDe)) return;

      const ini = aMinutos(b.hora_inicio);
      const fin = aMinutos(b.hora_fin);
      if (ini === null || fin === null) return;
      const desde = Math.max(HORA_INICIO, Math.floor(ini / PASO) * PASO);
      const hasta = Math.min(HORA_FIN, Math.ceil(fin / PASO) * PASO);
      for (let m = desde; m < hasta; m += PASO) {
        const fila = (m - HORA_INICIO) / PASO;
        if (fila >= 0 && fila < FILAS) ocupadosPorCelda[dia][fila].add(clave);
      }
    });

    const celdas = [];
    for (let d = 0; d <= 5; d++) {
      celdas[d] = [];
      for (let f = 0; f < FILAS; f++) {
        const set = ocupadosPorCelda[d][f];
        let poblacionOcupada = 0;
        set.forEach((clave) => { poblacionOcupada += pesoDe[clave]; });
        celdas[d][f] = {
          ocupados: set.size,
          poblacionOcupada,
          libres: totalSegmentos - set.size,
          pctLibre: Math.round(((totalPoblacion - poblacionOcupada) / totalPoblacion) * 100),
        };
      }
    }

    return { celdas, totalSegmentos, totalPoblacion };
  }

  /**
   * Las mejores franjas para programar una actividad, de mayor a menor
   * porcentaje de estudiantes libres. Agrupa filas contiguas con la misma
   * ocupacion para no devolver 52 tramos de 15 minutos.
   * @param {object} disp  lo que devuelve disponibilidad()
   * @param {number} [duracionMin=90]  duracion minima de la franja
   * @returns {Array<{diaSemana, horaInicio, horaFin, pctLibre}>}
   */
  function mejoresFranjas(disp, duracionMin) {
    const minimo = Math.max(PASO, duracionMin || 90);
    const necesarias = Math.ceil(minimo / PASO);
    const franjas = [];

    for (let d = 1; d <= 5; d++) {
      let ini = null;
      let pct = null;
      for (let f = 0; f <= FILAS; f++) {
        const actual = f < FILAS ? disp.celdas[d][f].pctLibre : null;
        if (actual !== pct) {
          if (ini !== null && f - ini >= necesarias) {
            franjas.push({
              diaSemana: d,
              horaInicio: aHHMM(HORA_INICIO + ini * PASO),
              horaFin: aHHMM(HORA_INICIO + f * PASO),
              pctLibre: pct,
            });
          }
          ini = f;
          pct = actual;
        }
      }
    }

    return franjas.sort((a, b) => b.pctLibre - a.pctLibre || a.diaSemana - b.diaSemana);
  }

  const horarioService = {
    geometria, aMinutos, aHHMM, disponibilidad, mejoresFranjas,
    HORA_INICIO, HORA_FIN, PASO, FILAS,
  };

  global.HorarioService = horarioService;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = horarioService;
  }
})(typeof window !== "undefined" ? window : globalThis);
