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

  // opts.onPick(fechaInicio: Date) — se llama al hacer clic en un día/hora,
  // para crear una actividad con la fecha ya prerrellenada.
  async function montar(el, filtros, opts) {
    opts = opts || {};
    const qs = new URLSearchParams(filtros || {}).toString();
    let acts = [];
    try {
      acts = await api.get("/api/actividades" + (qs ? "?" + qs : ""));
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el calendario.</div>';
      return;
    }

    if (global.FullCalendar && global.FullCalendar.Calendar) {
      renderCalendario(el, acts, opts);
    } else {
      renderLista(el, acts);
    }
  }

  function renderCalendario(el, acts, opts) {
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
        // toast() escribe con textContent (seguro). Sin alert(): si el modulo
        // de toasts no cargo, lo registramos en consola y seguimos.
        if (global.toast) toast(det); else console.warn("[calendar]", det);
      },
      dateClick: typeof opts.onPick === "function"
        ? (info) => {
            const s = new Date(info.date);
            if (info.allDay) s.setHours(12, 0, 0, 0); // mediodía por defecto en vista mes
            opts.onPick(s);
          }
        : undefined,
    });
    if (typeof opts.onPick === "function") el.classList.add("cal-pickable");
    cal.render();
    el._fc = cal;
  }

  function renderLista(el, acts) {
    const esc = global.escapeHtml || ((s) => s);
    el.innerHTML = acts.length
      ? acts.map((a) =>
          `<div class="card" style="margin-bottom:10px"><strong>${esc(a.titulo)}</strong>
             <div class="muted">${esc(a.entidad_nombre)} · ${new Date(a.fecha_inicio).toLocaleString("es-CL")} · ${esc(a.tipo)}</div></div>`
        ).join("")
      : '<div class="placeholder">Aún no hay actividades.</div>';
  }

  global.CalendarView = { montar };
})(window);
