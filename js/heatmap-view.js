/* MapFI · heatmap-view.js — render del mapa de calor de saturacion.
 *
 * Dos vistas sobre los mismos datos, cada una para una pregunta distinta:
 *
 *   SEMESTRE  matriz dias x semanas — "¿que semanas del semestre estan
 *             cargadas?". La conduce el numero de actividades del calendario.
 *
 *   SEMANA    matriz dia x hora — "¿a que hora de esta semana meto mi
 *             actividad?". La conduce el % de estudiantes que NO puede
 *             asistir, combinando horario de clases y actividades agendadas.
 *
 * T071 (WCAG 1.4.1): el color NUNCA es la unica forma de transmitir el nivel.
 * Cada celda lleva `title` y `aria-label` con el dato en palabras, y las
 * celdas grandes muestran el numero escrito.
 */
(function (global) {
  "use strict";

  const DIAS = ["", "Lun", "Mar", "Mié", "Jue", "Vie"];
  const DIAS_LARGO = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  const esc = (x) => (global.escapeHtml || ((v) => v))(x);

  // Rejilla horaria, la misma que usan horarioService y heatmapService.
  const HORA_INICIO = 480;
  const PASO = 15;
  const FILAS = 52;

  const NIVELES = [
    { clase: "heat-libre", etiqueta: "Libre" },
    { clase: "heat-baja", etiqueta: "Baja" },
    { clase: "heat-media", etiqueta: "Media" },
    { clase: "heat-alta", etiqueta: "Alta" },
    { clase: "heat-saturado", etiqueta: "Saturado" },
  ];

  /** "2026-09-07" -> "lun 07 sep". Se parte la cadena a mano para no pasar
   *  por `new Date`, que interpretaria la fecha como UTC y restaria un dia. */
  function fmtFecha(iso) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(iso);
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return DIAS[d.getDay() === 0 ? 5 : Math.min(d.getDay(), 5)].toLowerCase() +
      " " + m[3] + " " + MESES[+m[2] - 1];
  }

  function fmtDiaMes(iso) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + "/" + m[2] : String(iso);
  }

  function leyenda(titulo) {
    return '<div class="heat-legend"><strong>' + esc(titulo) + "</strong>" +
      NIVELES.map((n) => '<span><i class="' + n.clase + '"></i>' + esc(n.etiqueta) + "</span>").join("") +
      "</div>";
  }

  // ── Vista de SEMESTRE ────────────────────────────────────────────────────
  async function montarSemestre(el, filtros) {
    const qs = new URLSearchParams(filtros || {}).toString();
    let datos;
    try {
      datos = await api.get("/api/heatmap/semestre" + (qs ? "?" + qs : ""));
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el mapa de calor.</div>';
      return null;
    }
    if (!datos.semanas || !datos.semanas.length) {
      el.innerHTML = '<div class="placeholder">Sin actividades en el calendario para este filtro. ' +
        'Cuando los centros publiquen sus fechas, aparecerán aquí.</div>';
      return datos;
    }

    let html = leyenda("Actividades ese día:");
    html += '<div class="heat-semestre" style="grid-template-columns:52px repeat(' + datos.semanas.length + ', 1fr)">';
    html += '<div class="heat-corner"></div>';
    datos.semanas.forEach((lunes, i) => {
      html += '<div class="heat-col" style="grid-column:' + (i + 2) + ';grid-row:1">' + esc(fmtDiaMes(lunes)) + "</div>";
    });

    for (let d = 1; d <= 5; d++) {
      html += '<div class="heat-row" style="grid-column:1;grid-row:' + (d + 1) + '">' + DIAS[d] + "</div>";
      datos.semanas.forEach((lunes, i) => {
        const fecha = sumarDias(lunes, d - 1);
        const c = datos.celdas[fecha];
        if (!c) return;
        const desc = DIAS_LARGO[d] + " " + fmtFecha(fecha) + ": " +
          (c.esFeriado ? "feriado" : c.eventos + " actividad(es)" + (c.examenes ? ", " + c.examenes + " examen(es)" : ""));
        html += '<div class="heat-celda ' + c.nivelClase + (c.esFeriado ? " heat-feriado" : "") + '"' +
          ' data-fecha="' + esc(fecha) + '"' +
          ' style="grid-column:' + (i + 2) + ";grid-row:" + (d + 1) + '"' +
          ' role="img" aria-label="' + esc(desc) + '" title="' + esc(desc) + '">' +
          (c.eventos ? c.eventos : "") + "</div>";
      });
    }
    html += "</div>";
    html += '<p class="muted" style="font-size:.8rem;margin-top:8px">' +
      'Cada columna es una semana; cada fila, un día. Pincha una semana para ver el detalle por hora.</p>';

    el.innerHTML = html;
    return datos;
  }

  /** "2026-09-07" + n días, sin pasar por UTC. */
  function sumarDias(iso, n) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const d = new Date(+m[1], +m[2] - 1, +m[3] + n);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  // ── Vista SEMANAL por hora ───────────────────────────────────────────────
  function horasCabecera() {
    const out = [];
    for (let h = 8; h <= 20; h++) {
      out.push({ fila: 2 + (h * 60 - HORA_INICIO) / PASO, texto: String(h).padStart(2, "0") + ":00" });
    }
    return out;
  }

  async function montarSemana(el, filtros) {
    const params = new URLSearchParams();
    (filtros.carreraId || []).forEach((c) => params.append("carreraId", c));
    if (filtros.nivel) params.set("nivel", filtros.nivel);
    if (filtros.fecha) params.set("fecha", filtros.fecha);
    if (filtros.duracion) params.set("duracion", filtros.duracion);

    let datos;
    try {
      datos = await api.get("/api/heatmap/semana?" + params.toString());
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar la semana.</div>';
      return null;
    }

    let html = leyenda("Estudiantes ocupados a esa hora:");
    if (datos.sinMatricula) {
      html += '<div class="tt-aviso">La matrícula real aún no está cargada, así que cada carrera y año ' +
        'pesa lo mismo en el cálculo. Los porcentajes son orientativos.</div>';
    }

    html += '<div class="timetable"><div class="tt-corner"></div>';
    datos.dias.forEach((dia, i) => {
      html += '<div class="tt-day' + (dia.esFeriado ? " heat-feriado" : "") + '"' +
        ' style="grid-column:' + (i + 2) + ';grid-row:1">' +
        DIAS[dia.diaSemana] + "<br><small>" + esc(fmtDiaMes(dia.fecha)) + "</small>" +
        (dia.esFeriado ? "<br><small>feriado</small>" : "") + "</div>";
    });
    horasCabecera().forEach((h) => {
      html += '<div class="tt-hour" style="grid-column:1;grid-row:' + h.fila + '">' + h.texto + "</div>";
    });

    // Se agrupan filas contiguas con el mismo porcentaje: sin esto serían 260
    // nodos, casi todos del mismo color.
    for (let d = 1; d <= 5; d++) {
      const dia = datos.dias[d - 1];
      let ini = 0;
      for (let f = 1; f <= FILAS; f++) {
        const actual = f < FILAS ? datos.celdas[d][f].pctOcupado : null;
        const c = datos.celdas[d][ini];
        if (actual === c.pctOcupado) continue;
        const desde = c.hora;
        const hasta = datos.celdas[d][f] ? datos.celdas[d][f].hora : "21:00";
        const motivo = [];
        if (c.enClase) motivo.push("en clase");
        if (c.conActividad) motivo.push("con otra actividad");
        const desc = DIAS_LARGO[d] + " " + desde + "–" + hasta + ": " +
          c.pctLibre + "% de estudiantes libres" +
          (motivo.length ? " (" + motivo.join(" y ") + ")" : "");
        html += '<div class="heat-hora ' + c.nivelClase + '"' +
          ' style="grid-column:' + (d + 1) + ";grid-row:" + (2 + ini) + " / " + (2 + f) + '"' +
          ' role="img" aria-label="' + esc(desc) + '" title="' + esc(desc) + '">' +
          (f - ini >= 4 ? "<span>" + c.pctLibre + "% libre</span>" : "") +
          "</div>";
        ini = f;
      }
      if (dia && dia.esFeriado) { /* el día ya va marcado en la cabecera */ }
    }
    html += "</div>";

    const buenas = (datos.franjas || []).filter((f) => f.pctLibre >= 50).slice(0, 6);
    if (buenas.length) {
      html += '<div class="tt-aviso tt-sugerencias"><strong>Mejores franjas de esta semana</strong><ul>' +
        buenas.map((f) =>
          "<li>" + esc(DIAS_LARGO[f.diaSemana]) + " " + esc(fmtDiaMes(f.fecha)) + " · " +
          esc(f.horaInicio) + "–" + esc(f.horaFin) +
          " — <strong>" + f.pctLibre + "%</strong> de los estudiantes libres</li>"
        ).join("") + "</ul></div>";
    } else {
      html += '<div class="tt-aviso">No hay ninguna franja donde esté libre al menos la mitad de tu ' +
        'público. Prueba con menos carreras, otro año u otra semana.</div>';
    }

    el.innerHTML = html;
    return datos;
  }

  /** Compatibilidad: la firma antigua sigue existiendo y muestra el semestre. */
  async function montar(el, filtros) {
    return montarSemestre(el, filtros);
  }

  global.HeatmapView = { montar, montarSemestre, montarSemana, sumarDias, fmtFecha, fmtDiaMes };
})(window);
