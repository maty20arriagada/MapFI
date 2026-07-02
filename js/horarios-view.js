/* MapFI · horarios-view.js — grilla semanal de la malla por carrera/generación.
 * Es distinto del calendario académico: aquí van los bloques RECURRENTES de clase. */
(function (global) {
  "use strict";

  const DIAS = ["", "Lun", "Mar", "Mié", "Jue", "Vie"];

  function toMin(t) { const p = String(t).split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function fmt(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }

  async function montar(el, filtros, opts) {
    opts = opts || {};
    if (!filtros || !filtros.carreraId || !filtros.nivel) {
      el.innerHTML = '<div class="placeholder">Selecciona una <strong>carrera</strong> y una <strong>generación</strong> para ver su horario semanal.</div>';
      return;
    }

    let bloques = [];
    try {
      bloques = await api.get("/api/bloques?carreraId=" + filtros.carreraId + "&nivel=" + filtros.nivel);
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el horario.</div>';
      return;
    }
    if (!bloques.length) {
      el.innerHTML = '<div class="placeholder">Este segmento aún no tiene horario cargado.' +
        (opts.isAdmin ? " Usa el formulario de arriba para agregar bloques." : "") + "</div>";
      return;
    }

    // Rango horario dinámico (redondeado a 30 min).
    let minS = 24 * 60, maxE = 0;
    bloques.forEach((b) => { minS = Math.min(minS, toMin(b.hora_inicio)); maxE = Math.max(maxE, toMin(b.hora_fin)); });
    const start = Math.floor(minS / 30) * 30;
    const end = Math.ceil(maxE / 30) * 30;
    const slots = Math.max(1, (end - start) / 30);

    let html = '<div class="timetable" style="grid-template-rows: 34px repeat(' + slots + ', 24px)">';
    html += '<div class="tt-corner"></div>';
    for (let d = 1; d <= 5; d++) {
      html += '<div class="tt-day" style="grid-column:' + (d + 1) + ';grid-row:1">' + DIAS[d] + "</div>";
    }
    for (let m = start; m < end; m += 60) {
      const row = 2 + (m - start) / 30;
      html += '<div class="tt-hour" style="grid-column:1;grid-row:' + row + " / " + Math.min(row + 2, slots + 2) + '">' + fmt(m) + "</div>";
    }
    bloques.forEach((b) => {
      const s = toMin(b.hora_inicio), e = toMin(b.hora_fin);
      const col = (+b.dia_semana) + 1;
      const r1 = 2 + (s - start) / 30, r2 = 2 + (e - start) / 30;
      const esc = global.escapeHtml || ((x) => x);
      html += '<div class="tt-block ' + b.tipo + '" style="grid-column:' + col + ";grid-row:" + r1 + " / " + r2 + '">' +
        "<strong>" + esc(b.descripcion || b.tipo) + "</strong><span>" + fmt(s) + "–" + fmt(e) + "</span>" +
        (opts.isAdmin ? '<button class="tt-del" data-act="del-bloque" data-id="' + b.id + '" title="Eliminar bloque" aria-label="Eliminar bloque">×</button>' : "") +
        "</div>";
    });
    html += "</div>";
    el.innerHTML = html;
  }

  global.HorariosView = { montar };
})(window);
