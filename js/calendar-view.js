/* MapFI · calendar-view.js — render del calendario centralizado. */
(function (global) {
  "use strict";

  // TODO(F2): integrar FullCalendar (vendoreado o CDN) con vistas mes/semana,
  //           colores por carrera y click → detalle de actividad.
  // Por ahora, lista las actividades como tarjetas para validar la API.
  async function montar(el, filtros) {
    const qs = new URLSearchParams(filtros || {}).toString();
    try {
      const acts = await api.get("/api/actividades" + (qs ? "?" + qs : ""));
      if (!acts.length) {
        el.innerHTML =
          '<div class="placeholder">Aun no hay actividades.<br>' +
          "TODO(F2): vista de calendario con FullCalendar.</div>";
        return;
      }
      el.innerHTML = acts
        .map(
          (a) =>
            `<div class="card" style="margin-bottom:10px">
               <strong>${a.titulo}</strong>
               <div class="muted">${a.entidad_nombre} · ${new Date(
              a.fecha_inicio
            ).toLocaleString("es-CL")} · ${a.tipo}</div>
             </div>`
        )
        .join("");
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el calendario.</div>';
    }
  }

  global.CalendarView = { montar };
})(window);
