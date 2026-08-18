/* MapFI · horarios-view.js — grilla semanal de la malla por carrera/generación.
 * Es distinto del calendario académico: aquí van los bloques RECURRENTES de
 * clase. La grilla es FIJA (08:00-21:00, resolución de 15 min); la geometría
 * de cada bloque (fila, ajuste al cuarto de hora, sub-columna si se solapa
 * con otro) la calcula el servicio puro js/services/horarioService.js —
 * ver Spec 003, US2.
 *
 * Admite VARIAS carreras a la vez: se piden por separado y se concatenan antes
 * de calcular la geometría, así el apilado en sub-columnas resuelve solo los
 * solapamientos entre carreras. Con más de una seleccionada, cada bloque se
 * pinta del color de SU carrera en vez del color por tipo. */
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

  /**
   * Clave que agrupa las secciones de un mismo ramo. El código es lo correcto
   * cuando existe (dos ramos pueden llamarse igual); si falta, el nombre.
   */
  function claveRamo(b) {
    return b.codigo || b.descripcion || "";
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

    // Con varias carreras el color deja de significar "tipo de bloque" y pasa
    // a significar "de qué carrera es" — sin eso la vista combinada es ilegible.
    const color = opts.multi && b.carreraColor ? ";background:" + b.carreraColor : "";

    const detalle = [b.sala, b.seccion ? "Sec. " + b.seccion : null, b.docente]
      .filter(Boolean).join(" · ");

    return '<div class="tt-block ' + b.tipo + '"' +
      ' data-dia="' + b.dia_semana + '"' +
      ' data-tipo="' + b.tipo + '"' +
      ' data-seccion="' + esc(b.seccion || "") + '"' +
      ' data-ramo-clave="' + esc(claveRamo(b)) + '"' +
      ' data-carrera="' + (b.carrera_id || "") + '"' +
      ' data-buscar="' + esc(buscar) + '"' +
      ' title="' + esc(ramo + (detalle ? " — " + detalle : "")) + '"' +
      ' style="grid-column:' + col + ";grid-row:" + b.filaInicio + " / " + b.filaFin +
      ";width:" + ancho + ";margin-left:" + offset + color + '">' +
      "<strong>" + esc(ramo) + "</strong><span>" + rango +
      (b.seccion ? " · S" + esc(b.seccion) : "") + "</span>" +
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
   * @param {{dia?, tipo?, texto?, seccion?, porRamo?}} filtro
   *        `porRamo` es { claveRamo: seccionElegida } — el "mi horario" del
   *        estudiante, que elige seccion ramo por ramo.
   */
  function aplicarFiltro(el, filtro) {
    filtro = filtro || {};
    const dia = filtro.dia ? String(filtro.dia) : "";
    const tipo = filtro.tipo ? String(filtro.tipo) : "";
    const seccion = filtro.seccion ? String(filtro.seccion) : "";
    const texto = (filtro.texto || "").trim().toLowerCase();
    const porRamo = filtro.porRamo || {};

    el.querySelectorAll(".tt-block").forEach((nodo) => {
      const d = nodo.dataset;
      const okDia = !dia || d.dia === dia;
      const okTipo = !tipo || d.tipo === tipo;
      const okSeccion = !seccion || d.seccion === seccion;
      const okTexto = !texto || (d.buscar || "").indexOf(texto) >= 0;
      // Si el estudiante eligió sección para ESTE ramo, se ocultan las demás;
      // los ramos sobre los que no eligió nada se muestran completos.
      const elegida = porRamo[d.ramoClave];
      const okPorRamo = !elegida || d.seccion === String(elegida);
      nodo.classList.toggle("tt-filtrado", !(okDia && okTipo && okSeccion && okTexto && okPorRamo));
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

  function leyendaCarreras(carreras) {
    if (carreras.length < 2) return "";
    const esc = global.escapeHtml || ((x) => x);
    return '<div class="tt-legend tt-legend-carreras">' +
      carreras.map((c) =>
        '<span><i style="background:' + esc(c.color || "#666") + '"></i> ' + esc(c.nombre) + "</span>"
      ).join("") + "</div>";
  }

  /** Normaliza `carreraId` a un array: acepta uno solo o varios. */
  function comoLista(v) {
    if (v === null || v === undefined || v === "") return [];
    return (Array.isArray(v) ? v : [v]).filter((x) => x !== null && x !== undefined && x !== "");
  }

  /**
   * Dibuja el horario.
   * @param {HTMLElement} el
   * @param {{carreraId: number|number[], nivel: number}} filtros
   * @param {{isAdmin?: boolean, carreras?: Array}} opts  `carreras` es el catálogo
   *        (de /api/catalogos), usado para color y nombre en la vista combinada.
   * @returns {Promise<{secciones: string[], ramos: Array, carreras: Array}>}
   *          metadatos para poblar los selectores de la página.
   */
  async function montar(el, filtros, opts) {
    opts = opts || {};
    const vacio = { secciones: [], ramos: [], carreras: [] };
    const ids = comoLista(filtros && filtros.carreraId);
    const nivel = filtros && filtros.nivel;

    // Mensaje segun lo que FALTA, no un generico. La lista de carreras admite
    // varias y por eso no es un desplegable con placeholder: si no se dice que
    // hay que pinchar una, la pagina parece rota (reportado en produccion).
    if (!ids.length || !nivel) {
      const falta = !ids.length && !nivel
        ? "Elige tu <strong>carrera</strong> en la lista de arriba y tu <strong>año</strong>"
        : !ids.length
          ? "Ahora elige tu <strong>carrera</strong>: pínchala en la lista de arriba"
          : "Elige tu <strong>año</strong> para ver el horario";
      el.innerHTML = '<div class="placeholder">' + falta +
        (!ids.length ? " — puedes marcar varias con Ctrl (o ⌘) para compararlas." : ".") +
        "</div>";
      return vacio;
    }

    const catalogo = opts.carreras || [];
    const porId = {};
    catalogo.forEach((c) => { porId[String(c.id)] = c; });

    // Una petición por carrera; la API ya filtra por segmento y el volumen es
    // pequeño, así que no hace falta tocar el DAO ni la ruta.
    let porCarrera;
    try {
      porCarrera = await Promise.all(ids.map(async (id) => {
        const bloques = await api.get("/api/bloques?carreraId=" + id + "&nivel=" + filtros.nivel);
        const meta = porId[String(id)] || {};
        return bloques.map((b) => ({
          ...b,
          carrera_id: id,
          carreraColor: meta.color || null,
          carreraNombre: meta.nombre || null,
        }));
      }));
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudo cargar el horario.</div>';
      return vacio;
    }

    const bloquesCrudos = porCarrera.flat();
    const multi = ids.length > 1;
    const bloques = HS().geometria(bloquesCrudos);
    const visibles = bloques.filter((b) => !b.fueraDeRango);
    const fueraDeRango = bloques.filter((b) => b.fueraDeRango);

    const carrerasUsadas = ids.map((id) => porId[String(id)]).filter(Boolean);

    let html = leyendaCarreras(carrerasUsadas) + grillaVacia();
    visibles.forEach((b) => { html += bloqueHtml(b, { ...opts, multi }); });
    html += "</div>";
    html += avisoFueraDeRango(fueraDeRango);

    if (!bloquesCrudos.length) {
      html += '<div class="placeholder">Este segmento aún no tiene horario cargado.' +
        (opts.isAdmin ? " Usa el formulario de arriba para agregar bloques." : "") + "</div>";
    }

    el.innerHTML = html;

    // Metadatos para los selectores: qué secciones existen y qué ramos tienen
    // más de una (los únicos donde tiene sentido elegir).
    const secciones = [...new Set(bloquesCrudos.map((b) => b.seccion).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));

    const ramos = [];
    const indice = new Map();
    bloquesCrudos.forEach((b) => {
      const clave = claveRamo(b);
      if (!clave) return;
      if (!indice.has(clave)) {
        const entrada = { clave, nombre: b.descripcion || clave, secciones: [] };
        indice.set(clave, entrada);
        ramos.push(entrada);
      }
      const entrada = indice.get(clave);
      if (b.seccion && entrada.secciones.indexOf(b.seccion) < 0) entrada.secciones.push(b.seccion);
    });
    ramos.forEach((r) => r.secciones.sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true })));

    // Se devuelven los bloques crudos para que la vista de disponibilidad los
    // reutilice sin repetir las peticiones.
    return {
      secciones, ramos, carreras: carrerasUsadas,
      bloques: bloquesCrudos,
      segmentos: ids.map((id) => ({ carreraId: +id, nivel: +nivel })),
    };
  }


  global.HorariosView = { montar, aplicarFiltro, claveRamo };
})(window);
