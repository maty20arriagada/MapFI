/* MapFI · heatmap-view.js — render del mapa de calor de saturacion. */
(function (global) {
  "use strict";

  // T071 (Backlog 2.3, WCAG 1.4.1): el color NUNCA es la unica forma de
  // transmitir el nivel — cada celda lleva ademas una etiqueta de texto
  // siempre visible y una descripcion accesible (aria-label), para quien no
  // distingue el color o usa lector de pantalla.
  const NIVEL_TEXTO = { VERDE: "Baja", AMARILLO: "Media", ROJO: "Alta" };

  // La API devuelve la fecha como ISO ("2026-04-17T04:00:00.000Z"); mostrarla
  // cruda era ilegible (revision QA, hallazgo M-7). Se formatea en la zona de
  // la facultad para que el dia coincida con el del calendario.
  const fmtFecha = (f) =>
    new Date(f).toLocaleDateString("es-CL", {
      timeZone: "America/Santiago", weekday: "short", day: "2-digit", month: "2-digit",
    });

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
        .map((c) => {
          const nivelTxto = NIVEL_TEXTO[c.color] || c.color;
          const desc = `Saturación ${nivelTxto.toLowerCase()}: ${c.eventos} evento(s)` +
            (c.examenes ? `, ${c.examenes} examen(es)` : "");
          return `<div class="row" style="margin-bottom:6px">
               <span style="width:120px">${fmtFecha(c.fecha)}</span>
               <span class="heat ${c.color}" role="img" aria-label="${desc}" title="${desc}"></span>
               <span class="muted" style="font-size:.8rem;margin-left:8px">${nivelTxto} (${c.eventos})</span>
             </div>`;
        })
        .join("");
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el mapa de calor.</div>';
    }
  }

  global.HeatmapView = { montar };
})(window);
