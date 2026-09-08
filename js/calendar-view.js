/* MapFI · calendar-view.js — render del calendario centralizado.
 * Usa FullCalendar si esta disponible (CDN); si no, degrada a una lista. */
(function (global) {
  "use strict";

  // Senales de choque: APAGADAS a la espera de la proxima iteracion (decision
  // del usuario, 2026-09-07: "saca las senales de alerta y dejalas
  // desactivadas hasta una proxima iteracion").
  //
  // Poner en `true` reactiva TODO de una vez: la marca naranja sobre el
  // evento, el "!" del CSS, el tooltip, la entrada de la leyenda y la propia
  // consulta al servidor. No se borro nada — el camino completo sigue aqui,
  // igual que la ruta /api/actividades/conflictos y sus pruebas.
  //
  // Esta constante es la UNICA fuente de verdad del interruptor: la leyenda
  // de calendario.html tambien se oculta leyendola, para que reactivar no
  // exija acordarse de un segundo sitio.
  const ALERTAS_CHOQUE = false;

  // Paleta por tipo de actividad. Criterios, en este orden:
  //   1. Que se distingan ENTRE SI. Antes habia dos violetas casi identicos
  //      (HITO #7C3AED vs ENTREGA #8B5CF6) y dos verdes casi identicos
  //      (EXTRAPROGRAMATICA #16A34A vs TALLER #10B981).
  //   2. Contraste AA (>= 4.5:1) con el texto blanco que va encima.
  //   3. Convivir con el navy institucional, sin competir con el.
  // El color NUNCA es la unica senal: el tipo va tambien en el tooltip y en
  // el popover, que es lo que exige WCAG 1.4.1 para quien no distingue
  // rojo de verde.
  const COLOR_TIPO = {
    EVENTO: "#1D4ED8",             // azul
    HITO_ACADEMICO: "#6D28D9",     // violeta profundo
    EXAMEN: "#DC2626",             // rojo — se queda: es lo mas importante
    EXTRAPROGRAMATICA: "#A21CAF",  // magenta
    CHARLA: "#0E7490",             // cian oscuro
    TALLER: "#047857",             // verde profundo
    ENTREGA: "#B45309",            // ambar oscuro
  };
  const COLOR_OTRO = "#64748B"; // tipo desconocido

  // Etiquetas legibles, usadas por la leyenda para no duplicar los hex en el
  // HTML (antes estaban escritos a mano en calendario.html y se
  // desincronizaban al tocar la paleta).
  const NOMBRE_TIPO = {
    EXAMEN: "Certamen / evaluación",
    HITO_ACADEMICO: "Hito académico",
    EVENTO: "Evento",
    CHARLA: "Charla",
    TALLER: "Taller",
    ENTREGA: "Entrega",
    EXTRAPROGRAMATICA: "Extraprogramática",
  };

  /**
   * Separa el ramo del titulo para poder pintarlos con distinto peso.
   *
   * El ramo manda porque es lo que IDENTIFICA la evaluacion: tras cargar el
   * semestre de Industrial habia 23 actividades tituladas "Certamen 1" y una
   * sola era de Calculo II. El dato ya viajaba en el JSON (actividadDao.js
   * lo incluye en el SELECT); simplemente no lo pintaba nadie.
   *
   * `plano` es la version de una linea, para el .ics y los tooltips.
   */
  function etiquetaEvento(a) {
    const ramo = a && a.ramo ? String(a.ramo).trim() : "";
    const titulo = a && a.titulo ? String(a.titulo).trim() : "";
    return {
      ramo: ramo || null,
      titulo: titulo,
      plano: ramo && titulo ? ramo + " · " + titulo : (titulo || ramo),
    };
  }

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

    // Choques entre actividades vigentes (mismo publico + solapamiento
    // temporal, §16.4). Mapa id → { titulo, carrera, nivel }.
    //
    // Con ALERTAS_CHOQUE apagado NI SIQUIERA SE PIDE: es una peticion menos
    // por cada render y por cada cambio de filtro. Apagar solo la marca
    // visual habria dejado el servidor trabajando para nada.
    let conflictos = new Map();
    if (ALERTAS_CHOQUE) {
      // Se acota a la ventana visible (T025 / H-14) y tambien a la carrera y
      // el año que se miran: una actividad puede apuntar a varias carreras,
      // asi que sin acotar se marcaba un evento de Industrial cuyo unico
      // choque real era con Informatica.
      const rango = rangoConsulta(filtros);
      if (filtros && filtros.carreraId) rango.carreraId = filtros.carreraId;
      if (filtros && filtros.nivel) rango.nivel = filtros.nivel;
      try {
        const qsConf = new URLSearchParams(rango).toString();
        (await api.get("/api/actividades/conflictos?" + qsConf)).forEach((c) => {
          if (!conflictos.has(c.id)) {
            conflictos.set(c.id, {
              titulo: c.conflicta_titulo,
              carrera: c.conflicta_carrera || null,
              nivel: c.conflicta_nivel || null,
            });
          }
        });
      } catch (_) { /* sin señalizacion si falla; el calendario sigue */ }
    }

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
      // Con el interruptor apagado el mapa viene vacio, asi que `choque` es
      // siempre undefined y ni el borde ni la clase se aplican.
      const choque = conflictos.get(a.id);
      const color = COLOR_TIPO[a.tipo] || COLOR_OTRO;
      return {
        id: String(a.id),
        // `title` se conserva como texto plano (lo usan el tooltip, la vista
        // de agenda y la busqueda interna de FullCalendar). Lo que se PINTA
        // en el mes lo decide eventContent, mas abajo.
        title: etiquetaEvento(a).plano,
        start: a.fecha_inicio,
        end: a.fecha_fin,
        backgroundColor: color,
        borderColor: choque ? "#F59E0B" : color,
        classNames: choque ? ["evento-conflicto"] : [],
        extendedProps: {
          entidad: a.entidad_nombre, tipo: a.tipo, estado: a.estado,
          ubicacion: a.ubicacion, choque: choque || null,
          actividad: a, // fila completa: la necesita el panel de detalle
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

      // Un dia con diez evaluaciones estiraba su celda sin limite y deformaba
      // la altura de TODA la fila del mes (reportado con el lunes 7 de
      // septiembre). Con esto las filas quedan parejas y el resto se agrupa
      // en un "+N mas" que abre un panel sin salir de la vista.
      dayMaxEvents: 3,
      moreLinkClick: "popover",
      moreLinkText: (n) => "+" + n + " más",

      // Un evento CON hora se pinta por defecto en el mes como
      // "punto + hora + titulo" (.fc-daygrid-dot-event) y con el fondo
      // TRANSPARENTE: el color del tipo se reduce a un punto diminuto y, al
      // sustituir el contenido con eventContent, ese punto desaparece — el
      // mes se queda literalmente sin color. Con "block" el evento vuelve a
      // ser una barra que si usa backgroundColor.
      //
      // Va al nivel superior y no dentro de `views`: ahi FullCalendar no la
      // aplica (comprobado en el navegador, seguia saliendo dot-event). En
      // Semana los eventos ya son bloques y en Agenda la opcion no interviene,
      // asi que ponerla global no cambia esas dos vistas.
      eventDisplay: "block",

      // La hora solo se muestra donde aporta. En el mes todas las
      // evaluaciones caian a la misma hora y el "19:10" repetido se comia un
      // tercio del ancho de cada evento — justo el espacio que necesita el
      // nombre del ramo. En Semana la posicion vertical YA es la hora, y en
      // Agenda la hora es la columna principal.
      views: {
        dayGridMonth: { displayEventTime: false },
        timeGridWeek: { displayEventTime: true },
        listWeek: { displayEventTime: true },
      },

      // Chip de dos lineas: el ramo manda, el titulo lo matiza.
      // Se construye con createElement + textContent, NO con innerHTML: ramo
      // y titulo son dato de usuario y el Principio III exige escaparlos.
      // textContent lo hace por construccion, sin pasar por escapeHtml.
      eventContent: (arg) => {
        const et = etiquetaEvento(arg.event.extendedProps.actividad || {});
        const cont = document.createElement("div");
        cont.className = "ev-chip";
        if (et.ramo) {
          const r = document.createElement("span");
          r.className = "ev-ramo";
          r.textContent = et.ramo;
          cont.appendChild(r);
        }
        if (et.titulo) {
          const t = document.createElement("span");
          t.className = et.ramo ? "ev-titulo" : "ev-ramo"; // sin ramo, el titulo manda
          t.textContent = et.titulo;
          cont.appendChild(t);
        }
        return { domNodes: [cont] };
      },

      events,
      eventDidMount: (info) => {
        // Tooltip nativo con el detalle. `info.event.title` ya trae
        // "Ramo · Titulo". El tipo va en palabras y no como enum: ademas de
        // leerse mejor, es la senal NO cromatica del tipo de actividad
        // (WCAG 1.4.1 — el color no puede ser el unico indicador).
        const p = info.event.extendedProps;
        let t = `${info.event.title} · ${p.entidad} · ${NOMBRE_TIPO[p.tipo] || p.tipo}`;
        if (p.choque) t += "\n" + textoChoque(p.choque);
        info.el.title = t;
      },
      eventClick: (info) => {
        const p = info.event.extendedProps;
        // Panel de detalle con la opcion de llevarse la actividad al
        // calendario propio. Si el modulo no cargo, se degrada al aviso
        // efimero de antes en vez de dejar el clic sin respuesta.
        if (global.CalendarSync && p.actividad) {
          global.CalendarSync.mostrarActividad(p.actividad);
          return;
        }
        let det = `${info.event.title} · ${p.entidad} · ${p.tipo} · ${p.estado}` +
          (p.ubicacion ? ` · ${p.ubicacion}` : "");
        if (p.choque) det += " — " + textoChoque(p.choque);
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

    // Los botones de anterior/siguiente de FullCalendar solo llevan un icono,
    // sin texto ni nombre accesible: un lector de pantalla los anuncia como
    // "botón" a secas (auditoria 2026-08-04). Se etiquetan tras el render.
    [[".fc-prev-button", "Mes anterior"], [".fc-next-button", "Mes siguiente"]]
      .forEach(function (par) {
        var b = el.querySelector(par[0]);
        if (b && !b.getAttribute("aria-label")) {
          b.setAttribute("aria-label", par[1]);
          b.setAttribute("title", par[1]);
        }
      });

    el._fc = cal;
  }

  /**
   * Redacta el aviso de choque diciendo CON QUE choca y, sobre todo, PARA
   * QUIEN. "Choque detectado" a secas obliga a adivinar a quien afecta;
   * nombrando la carrera y el año se lee y se entiende de una.
   */
  function textoChoque(choque) {
    if (!choque) return "";
    if (typeof choque === "string") return "Choque con: " + choque; // forma antigua
    var quien = [choque.carrera, choque.nivel ? choque.nivel + "° año" : null]
      .filter(Boolean).join(" · ");
    return "Choque con «" + choque.titulo + "»" + (quien ? " en " + quien : "");
  }

  /** Rango a usar para acotar la consulta de choques (T025 / H-14). */
  function rangoConsulta(filtros) {
    if (filtros && filtros.desde && filtros.hasta) {
      return { desde: filtros.desde, hasta: filtros.hasta };
    }
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 4, 1);
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 5, 0);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { desde: iso(desde), hasta: iso(hasta) };
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

  global.CalendarView = {
    montar,
    // Se exponen para que la leyenda de calendario.html se genere desde la
    // MISMA paleta en vez de repetir los hex a mano, y para que la pagina
    // sepa si debe mostrar la entrada del choque.
    COLOR_TIPO,
    NOMBRE_TIPO,
    ALERTAS_CHOQUE,
    etiquetaEvento,
  };

  // Doble exportacion (patron de js/horario-csv.js y js/horarios-view.js):
  // permite probar `etiquetaEvento` desde Node sin montar un DOM.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { etiquetaEvento, COLOR_TIPO, NOMBRE_TIPO, ALERTAS_CHOQUE };
  }
})(typeof window !== "undefined" ? window : globalThis);
