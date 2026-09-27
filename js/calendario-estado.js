/* MapFI · calendario-estado.js — posicion del calendario en la URL y permiso
 * de edicion. Logica pura: sin DOM, sin FullCalendar, sin red (Principio II).
 *
 * POR QUE LA URL
 * El calendario volvia al mes en curso al recargar y tambien al cambiar
 * cualquier filtro, porque se destruye y se recrea en cada render. Con la
 * posicion en la URL, cada render la vuelve a leer: un solo mecanismo arregla
 * los dos sintomas, y el enlace se puede compartir ("mira la semana del 9").
 * Mismo patron que mapa-calor.html, que ya conservaba ahi la carrera y el ano.
 *
 * Solo corre en el navegador, por eso vive en js/ y no en js/shared/, que la
 * Spec 004 reservo para lo que tambien corre en el servidor. La doble
 * exportacion es para probarlo desde Node (patron de js/horario-csv.js).
 */
(function (global) {
  "use strict";

  // Castellano en la URL (la ve y la comparte la gente); nombres de
  // FullCalendar solo hacia dentro.
  var VISTAS = { mes: "dayGridMonth", semana: "timeGridWeek", agenda: "listWeek" };
  var VISTA_DEFECTO = "mes";

  var TIPOS = ["EVENTO", "HITO_ACADEMICO", "EXAMEN", "EXTRAPROGRAMATICA", "CHARLA", "TALLER", "ENTREGA"];

  // Orden fijo de escritura: la misma posicion produce siempre la misma URL.
  var ORDEN_FILTROS = ["carreraId", "nivel", "entidadId", "tipo", "soloParticipacion"];

  var ROLES_ADMIN = ["ADMIN", "SUPERADMIN"];

  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function pad2(n) { return String(n).padStart(2, "0"); }

  /** AAAA-MM-DD que ademas sea un dia real (descarta 2026-02-30). */
  function fechaValida(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return false;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
  }

  function enteroPositivo(s) { return /^[1-9]\d*$/.test(String(s)); }

  // Cada filtro se valida por separado: uno invalido no tumba a los demas.
  var VALIDAR = {
    carreraId: enteroPositivo,
    nivel: function (s) { return /^[1-5]$/.test(String(s)); },
    entidadId: enteroPositivo,
    tipo: function (s) { return TIPOS.indexOf(String(s)) !== -1; },
    soloParticipacion: function (s) { return String(s) === "1"; },
  };

  /**
   * Lee la posicion desde `location.search`.
   * @returns {{vista: string, fecha: string|null, filtros: Object, tieneCarrera: boolean}}
   *   `tieneCarrera` distingue "Todas las carreras" elegido a proposito
   *   (`carreraId=` vacio) de que el parametro no exista: solo en el segundo
   *   caso se aplica la preseleccion de la carrera propia (research R-03).
   */
  function leerEstado(search) {
    var p = new URLSearchParams(String(search == null ? "" : search).replace(/^\?/, ""));
    var vista = p.get("vista");
    var fecha = p.get("fecha");
    var filtros = {};
    ORDEN_FILTROS.forEach(function (k) {
      var v = p.get(k);
      if (v !== null && v !== "" && VALIDAR[k](v)) filtros[k] = v;
    });
    var tieneCarrera = filtros.carreraId !== undefined;
    if (p.has("carreraId") && p.get("carreraId") === "") {
      filtros.carreraId = "";
      tieneCarrera = true;
    }
    return {
      vista: VISTAS[vista] ? vista : VISTA_DEFECTO,
      fecha: fechaValida(fecha) ? fecha : null,
      filtros: filtros,
      tieneCarrera: tieneCarrera,
    };
  }

  /** Query sin "?", lista para `history.replaceState`. Nunca escribe basura. */
  function escribirEstado(estado) {
    estado = estado || {};
    var filtros = estado.filtros || {};
    var p = new URLSearchParams();
    p.set("vista", VISTAS[estado.vista] ? estado.vista : VISTA_DEFECTO);
    if (fechaValida(estado.fecha)) p.set("fecha", estado.fecha);
    ORDEN_FILTROS.forEach(function (k) {
      var v = filtros[k];
      if (k === "carreraId" && v === "") { p.set(k, ""); return; } // "Todas", a proposito
      if (v !== undefined && v !== null && v !== "" && VALIDAR[k](v)) p.set(k, String(v));
    });
    return p.toString();
  }

  function aVistaFullCalendar(v) { return VISTAS[v] || VISTAS[VISTA_DEFECTO]; }

  function deVistaFullCalendar(fc) {
    for (var k in VISTAS) if (VISTAS[k] === fc) return k;
    return VISTA_DEFECTO;
  }

  /** AAAA-MM-DD en hora LOCAL. toISOString pasaria a UTC y en Chile las
   *  23:30 del 9 serian el 10: el calendario reabriria un dia corrido. */
  function aFechaIso(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  /**
   * Primer dia habil a partir de `d`, SIN salir de su mes. Al avanzar de mes
   * FullCalendar ancla el dia 1; si cae en fin de semana (ocultos en este
   * calendario), pasar a la vista Semana mostraba la semana anterior: estando
   * en noviembre de 2026 (el 1 es domingo) aparecia la del 26 de octubre.
   * Si avanzar al lunes cambiaria de mes, retrocede al viernes.
   */
  function anclaDiaHabil(d) {
    var r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = r.getDay();
    if (dow !== 0 && dow !== 6) return r;
    var adelante = new Date(r);
    adelante.setDate(r.getDate() + (dow === 6 ? 2 : 1));
    if (adelante.getMonth() === r.getMonth()) return adelante;
    var atras = new Date(r);
    atras.setDate(r.getDate() - (dow === 6 ? 1 : 2));
    return atras;
  }

  /** Carrera con la que arranca el filtro: la URL manda; si no la trae, la
   *  del centro con sesion; si no hay, todas (""). */
  function carreraInicial(estado, usuario) {
    if (estado && estado.tieneCarrera) return estado.filtros.carreraId || "";
    if (usuario && usuario.carreraId != null && usuario.carreraId !== "") return String(usuario.carreraId);
    return "";
  }

  /**
   * Espejo de `puedeEditarActividad` (server.js). SOLO decide que panel
   * mostrar: la autorizacion real la sigue haciendo el servidor, y ocultar un
   * boton nunca reemplaza esa comprobacion (Principio III).
   */
  function puedeEditar(actividad, usuario) {
    if (!actividad || !usuario) return false;
    if (ROLES_ADMIN.indexOf(usuario.rol) !== -1) return true;
    if (usuario.entidadId == null || usuario.entidadId === "") return false;
    if (actividad.entidad_id == null) return false;
    return Number(actividad.entidad_id) === Number(usuario.entidadId);
  }

  // ── Edicion desde el calendario (Spec 006, US4) ─────────────────────────

  function texto(v) { return v == null ? "" : String(v).trim(); }

  /** "AAAA-MM-DDTHH:MM" de un <input type="datetime-local">, en hora local. */
  function leerLocal(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(s || ""));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Cuerpo del PUT a partir del formulario. Ramo y lugar vacios viajan como
   * "" y no como null: el DAO hace `COALESCE($n, campo)`, y null CONSERVARIA
   * el valor viejo — vaciar el campo no tendria efecto. Las fechas van tal
   * como las da el input; el servidor las interpreta en hora de Chile.
   * `actualizadoEn` es la version que se vio, para el control de concurrencia.
   */
  function cuerpoEdicion(form, actividad) {
    return {
      titulo: texto(form.titulo),
      ramo: texto(form.ramo),
      tipo: form.tipo,
      ubicacion: texto(form.ubicacion),
      fechaInicio: form.inicio,
      fechaFin: form.fin,
      actualizadoEn: actividad ? actividad.updated_at : undefined,
    };
  }

  /** Errores por campo, para mostrarlos JUNTO al campo (FR-020). */
  function validarEdicion(form) {
    var errores = {};
    if (!texto(form.titulo)) errores.titulo = "Escribe un título.";
    var ini = leerLocal(form.inicio);
    var fin = leerLocal(form.fin);
    if (!ini) errores.inicio = "Indica la fecha y la hora de inicio.";
    if (!fin) errores.fin = "Indica la fecha y la hora de término.";
    if (ini && fin && fin <= ini) errores.fin = "El término debe ser posterior al inicio.";
    return errores;
  }

  function parteFecha(d, conMes, conHora) {
    var t = DIAS[d.getDay()] + " " + d.getDate();
    if (conMes) t += " de " + MESES[d.getMonth()];
    if (conHora) t += " a las " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    return t;
  }

  /**
   * "del martes 10 al jueves 12 de noviembre": lo que se confirma al soltar
   * una actividad arrastrada. En palabras y no en fechas ISO, porque se lee de
   * un vistazo antes de mover algo que ven cientos de estudiantes. La hora
   * solo aparece si cambio.
   */
  function textoMovimiento(antes, despues) {
    var mismoMes = antes.getFullYear() === despues.getFullYear() && antes.getMonth() === despues.getMonth();
    var cambiaHora = antes.getHours() !== despues.getHours() || antes.getMinutes() !== despues.getMinutes();
    return "del " + parteFecha(antes, !mismoMes, cambiaHora) +
      " al " + parteFecha(despues, true, cambiaHora);
  }

  var api = {
    leerEstado: leerEstado,
    escribirEstado: escribirEstado,
    aVistaFullCalendar: aVistaFullCalendar,
    deVistaFullCalendar: deVistaFullCalendar,
    aFechaIso: aFechaIso,
    anclaDiaHabil: anclaDiaHabil,
    carreraInicial: carreraInicial,
    puedeEditar: puedeEditar,
    cuerpoEdicion: cuerpoEdicion,
    validarEdicion: validarEdicion,
    textoMovimiento: textoMovimiento,
  };

  global.CalendarioEstado = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
