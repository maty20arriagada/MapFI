/* MapFI · heatmap-view.js — render del mapa de calor de saturacion. */
(function (global) {
  "use strict";

  async function montar(el, filtros) {
    const qs = new URLSearchParams(filtros || {}).toString();
    try {
      const celdas = await api.get("/api/heatmap" + (qs ? "?" + qs : ""));
      if (!celdas.length) {
        el.innerHTML =
          '<div class="placeholder">Sin datos de saturación para este filtro.</div>';
        return;
      }
      el.innerHTML = celdas
        .map(
          (c) =>
            `<div class="row" style="margin-bottom:6px">
               <span style="width:120px">${c.fecha}</span>
               <span class="heat ${c.color}" title="${c.eventos} eventos"></span>
             </div>`
        )
        .join("");
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el mapa de calor.</div>';
    }
  }

  global.HeatmapView = { montar };
})(window);
