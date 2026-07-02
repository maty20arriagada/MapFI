/* MapFI · calendar-view.js — render del calendario centralizado.
 * Usa FullCalendar si esta disponible (CDN); si no, degrada a una lista. */
(function (global) {
  "use strict";

  const COLOR_TIPO = {
    EVENTO: "#2563EB",
    HITO_ACADEMICO: "#7C3AED",
    EXAMEN: "#DC2626",
    EXTRAPROGRAMATICA: "#16A34A",
    CHARLA: "#F59E0B",
    TALLER: "#10B981",
    ENTREGA: "#8B5CF6",
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

    // Choques confirmados (mismo publico + solapamiento temporal, §16.4).
    // Mapa id → titulo del evento con el que choca, para señalizarlo.
    let conflictos = new Map();
    try {
      (await api.get("/api/actividades/conflictos")).forEach((c) => {
        if (!conflictos.has(c.id)) conflictos.set(c.id, c.conflicta_titulo);
      });
    } catch (_) { /* sin señalizacion si falla; el calendario sigue */ }

    if (global.FullCalendar && global.FullCalendar.Calendar) {
      renderCalendario(el, acts, opts, conflictos);
    } else {
      renderLista(el, acts);
    }
  }

  function renderCalendario(el, acts, opts, conflictos) {
    conflictos = conflictos || new Map();
    // Destruir instancia previa (al cambiar filtros) para no duplicar.
    if (el._fc) { try { el._fc.destroy(); } catch (_) {} el._fc = null; }
    el.innerHTML = "";

    const events = acts.map((a) => {
      const choque = conflictos.get(a.id);
      return {
        id: String(a.id),
        title: a.titulo,
        start: a.fecha_inicio,
        end: a.fecha_fin,
        backgroundColor: COLOR_TIPO[a.tipo] || "#64748B",
        borderColor: choque ? "#F59E0B" : (COLOR_TIPO[a.tipo] || "#64748B"),
        classNames: choque ? ["evento-conflicto"] : [],
        extendedProps: {
          entidad: a.entidad_nombre, tipo: a.tipo, estado: a.estado,
          ubicacion: a.ubicacion, choque: choque || null,
        },
      };
    });

    const cal = new global.FullCalendar.Calendar(el, {
      initialView: "dayGridMonth",
      locale: "es",
      height: "auto",
      firstDay: 1, // lunes
      weekends: false, // jornada universitaria Lun-Vie (§4)
      headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" },
      events,
      eventDidMount: (info) => {
        // Tooltip nativo con el detalle; incluye el choque si existe.
        const p = info.event.extendedProps;
        let t = `${info.event.title} · ${p.entidad} · ${p.tipo}`;
        if (p.choque) t += `\nCHOQUE detectado con: ${p.choque}`;
        info.el.title = t;
      },
      eventClick: (info) => {
        const p = info.event.extendedProps;
        let det = `${info.event.title} · ${p.entidad} · ${p.tipo} · ${p.estado}` +
          (p.ubicacion ? ` · ${p.ubicacion}` : "");
        if (p.choque) det += ` — CHOQUE con: ${p.choque}`;
        // toast() escribe con textContent (seguro). Sin alert(): si el modulo
        // de toasts no cargo, lo registramos en consola y seguimos.
        if (global.toast) toast(det, p.choque ? "error" : undefined); else console.warn("[calendar]", det);
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
