/* MapFI · calendar-view.js — render del calendario centralizado.
 * Usa FullCalendar si esta disponible (CDN); si no, degrada a una lista. */
(function (global) {
  "use strict";

  const COLOR_TIPO = {
    EVENTO: "#2563EB",
    HITO_ACADEMICO: "#7C3AED",
    EXAMEN: "#DC2626",
    EXTRAPROGRAMATICA: "#16A34A",
  };

  async function montar(el, filtros) {
    const qs = new URLSearchParams(filtros || {}).toString();
    let acts = [];
    try {
      acts = await api.get("/api/actividades" + (qs ? "?" + qs : ""));
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el calendario.</div>';
      return;
    }

    if (global.FullCalendar && global.FullCalendar.Calendar) {
      renderCalendario(el, acts);
    } else {
      renderLista(el, acts);
    }
  }

  function renderCalendario(el, acts) {
    // Destruir instancia previa (al cambiar filtros) para no duplicar.
    if (el._fc) { try { el._fc.destroy(); } catch (_) {} el._fc = null; }
    el.innerHTML = "";

    const events = acts.map((a) => ({
      id: String(a.id),
      title: a.titulo,
      start: a.fecha_inicio,
      end: a.fecha_fin,
      backgroundColor: COLOR_TIPO[a.tipo] || "#64748B",
      borderColor: COLOR_TIPO[a.tipo] || "#64748B",
      extendedProps: {
        entidad: a.entidad_nombre, tipo: a.tipo, estado: a.estado, ubicacion: a.ubicacion,
      },
    }));

    const cal = new global.FullCalendar.Calendar(el, {
      initialView: "dayGridMonth",
      locale: "es",
      height: "auto",
      firstDay: 1, // lunes
      weekends: false, // jornada universitaria Lun-Vie (§4)
      headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" },
      events,
      eventClick: (info) => {
        const p = info.event.extendedProps;
        const det = `${info.event.title} · ${p.entidad} · ${p.tipo} · ${p.estado}` +
          (p.ubicacion ? ` · ${p.ubicacion}` : "");
        if (global.toast) toast(det); else alert(det);
      },
    });
    cal.render();
    el._fc = cal;
  }

  function renderLista(el, acts) {
    el.innerHTML = acts.length
      ? acts.map((a) =>
          `<div class="card" style="margin-bottom:10px"><strong>${a.titulo}</strong>
             <div class="muted">${a.entidad_nombre} · ${new Date(a.fecha_inicio).toLocaleString("es-CL")} · ${a.tipo}</div></div>`
        ).join("")
      : '<div class="placeholder">Aún no hay actividades.</div>';
  }

  global.CalendarView = { montar };
})(window);
