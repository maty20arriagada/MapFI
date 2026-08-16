/* MapFI · horarios-view.js — grilla semanal de la malla por carrera/generación.
 * Es distinto del calendario académico: aquí van los bloques RECURRENTES de
 * clase. La grilla es FIJA (08:00-21:00, resolución de 15 min); la geometría
 * de cada bloque (fila, ajuste al cuarto de hora, sub-columna si se solapa
 * con otro) la calcula el servicio puro js/services/horarioService.js —
 * ver Spec 003, US2. */
(function (global) {
  "use strict";

  const DIAS = ["", "Lun", "Mar", "Mié", "Jue", "Vie"];
  const DIAS_LARGO = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

  function hhmm(t) { return (t || "").slice(0, 5); }

  function HS() { return global.HorarioService; }

  /** Etiquetas de hora en punto (08:00 a 20:00), cada una en su fila. */
  function horasCabecera() {
    const hs = HS();
    const out = [];
    for (let h = 8; h <= 20; h++) {
      out.push({ fila: 2 + (h * 60 - hs.HORA_INICIO) / hs.PASO, texto: String(h).padStart(2, "0") + ":00" });
    }
    return out;
  }

  function grillaVacia() {
    let html = '<div class="timetable"><div class="tt-corner"></div>';
    for (let d = 1; d <= 5; d++) {
      html += '<div class="tt-day" style="grid-column:' + (d + 1) + ';grid-row:1">' + DIAS[d] + "</div>";
    }
    horasCabecera().forEach((h) => {
      html += '<div class="tt-hour" style="grid-column:1;grid-row:' + h.fila + '">' + h.texto + "</div>";
    });
    return html;
  }

  function bloqueHtml(b, opts) {
    const esc = global.escapeHtml || ((x) => x);
    const col = (+b.dia_semana) + 1;
    const ramo = b.descripcion || b.tipo;
    const rango = hhmm(b.hora_inicio) + "–" + hhmm(b.hora_fin);
    const horario = DIAS_LARGO[+b.dia_semana] + " " + rango;
    const ancho = "calc(100% / " + b.subColumnas + ")";
    const offset = b.subColumna ? "calc(100% / " + b.subColumnas + " * " + b.subColumna + ")" : "0";
    // Texto sobre el que busca el filtro libre (US5, FR-026): ramo, sala,
    // docente y codigo. No se muestra: solo alimenta data-buscar.
    const buscar = [ramo, b.sala, b.docente, b.codigo].filter(Boolean).join(" ").toLowerCase();
    return '<div class="tt-block ' + b.tipo + '" data-dia="' + b.dia_semana + '" data-tipo="' + b.tipo +
      '" data-buscar="' + esc(buscar) + '" style="grid-column:' + col + ";grid-row:" + b.filaInicio + " / " + b.filaFin +
      ";width:" + ancho + ";margin-left:" + offset + '">' +
      "<strong>" + esc(ramo) + "</strong><span>" + rango + "</span>" +
      (opts.isAdmin
        ? '<button class="tt-del" data-act="del-bloque" data-id="' + b.id + '" data-ramo="' + esc(ramo) + '" data-horario="' + esc(horario) + '" title="Eliminar bloque" aria-label="Eliminar bloque">×</button>'
        : "") +
      "</div>";
  }

  /**
   * Muestra/oculta bloques ya dibujados segun un filtro, SIN recalcular la
   * grilla ni recolocar nada: cada bloque conserva su grid-row/grid-column
   * inline, asi que ocultar uno no mueve a los demas (FR-027).
   * @param {HTMLElement} el  el mismo contenedor pasado a montar()
   * @param {{dia?, tipo?, texto?}} filtro
   */
  function aplicarFiltro(el, filtro) {
    filtro = filtro || {};
    const dia = filtro.dia ? String(filtro.dia) : "";
    const tipo = filtro.tipo ? String(filtro.tipo) : "";
    const texto = (filtro.texto || "").trim().toLowerCase();
    el.querySelectorAll(".tt-block").forEach((nodo) => {
      const okDia = !dia || nodo.dataset.dia === dia;
      const okTipo = !tipo || nodo.dataset.tipo === tipo;
      const okTexto = !texto || (nodo.dataset.buscar || "").indexOf(texto) >= 0;
      nodo.classList.toggle("tt-filtrado", !(okDia && okTipo && okTexto));
    });
  }

  function avisoFueraDeRango(bloques) {
    if (!bloques.length) return "";
    const esc = global.escapeHtml || ((x) => x);
    const items = bloques.map((b) =>
      "<li>" + esc(DIAS_LARGO[+b.dia_semana]) + " " + esc(hhmm(b.hora_inicio)) + "–" + esc(hhmm(b.hora_fin)) +
      " — " + esc(b.descripcion || b.tipo) + "</li>"
    ).join("");
    return '<div class="tt-aviso"><strong>' + bloques.length +
      (bloques.length === 1 ? " bloque no cabe" : " bloques no caben") +
      ' en el horario 08:00–21:00 y no se muestran en la grilla:</strong><ul>' + items + "</ul></div>";
  }

  async function montar(el, filtros, opts) {
    opts = opts || {};
    if (!filtros || !filtros.carreraId || !filtros.nivel) {
      el.innerHTML = '<div class="placeholder">Selecciona una <strong>carrera</strong> y una <strong>generación</strong> para ver su horario semanal.</div>';
      return;
    }

    let bloquesCrudos;
    try {
      bloquesCrudos = await api.get("/api/bloques?carreraId=" + filtros.carreraId + "&nivel=" + filtros.nivel);
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el horario.</div>';
      return;
    }

    const bloques = HS().geometria(bloquesCrudos);
    const visibles = bloques.filter((b) => !b.fueraDeRango);
    const fueraDeRango = bloques.filter((b) => b.fueraDeRango);

    let html = grillaVacia();
    visibles.forEach((b) => { html += bloqueHtml(b, opts); });
    html += "</div>";
    html += avisoFueraDeRango(fueraDeRango);

    if (!bloquesCrudos.length) {
      html += '<div class="placeholder">Este segmento aún no tiene horario cargado.' +
        (opts.isAdmin ? " Usa el formulario de arriba para agregar bloques." : "") + "</div>";
    }

    el.innerHTML = html;
  }

  global.HorariosView = { montar, aplicarFiltro };
})(window);
