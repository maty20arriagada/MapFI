/* MapFI · calendar-sync.js — llevar el calendario al de cada persona.
 *
 * Hay DOS mecanismos y resuelven cosas distintas; la interfaz lo dice sin
 * rodeos porque la diferencia importa:
 *
 *   Suscripcion (feed .ics): el calendario del estudiante se mantiene al dia
 *   solo, incluidas las cancelaciones. Pero Google refresca cada 12-24 h y no
 *   se puede acelerar, asi que NO sirve como aviso de ultima hora.
 *
 *   Boton por actividad: agrega una COPIA al instante. Nunca se actualiza: si
 *   la fecha cambia o se cancela, la copia se queda como estaba.
 */
(function (global) {
  "use strict";

  var esc = function (s) {
    return (global.escapeHtml || function (x) { return x == null ? "" : String(x); })(s);
  };

  /** Fecha al formato compacto UTC que piden Google y Outlook: 20260417T210000Z */
  function aUtcCompacto(d) {
    return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function urlBase() {
    return global.location.origin;
  }

  /** Direccion del feed con los filtros aplicados. */
  function urlFeed(filtros) {
    var qs = new URLSearchParams(filtros || {}).toString();
    return urlBase() + "/api/calendario.ics" + (qs ? "?" + qs : "");
  }

  // ── Enlaces para UNA actividad ────────────────────────────────────────────

  function detalleTexto(a) {
    var p = [];
    if (a.descripcion) p.push(a.descripcion);
    if (a.entidad_nombre) p.push("Organiza: " + a.entidad_nombre);
    if (a.url_inscripcion) p.push("Inscripción: " + a.url_inscripcion);
    p.push("Publicado en MapFI · " + urlBase() + "/calendario.html");
    return p.join("\n");
  }

  function enlaceGoogle(a) {
    var q = new URLSearchParams({
      action: "TEMPLATE",
      text: a.titulo || "Actividad",
      dates: aUtcCompacto(a.fecha_inicio) + "/" + aUtcCompacto(a.fecha_fin || a.fecha_inicio),
      details: detalleTexto(a),
      location: a.ubicacion || "",
    });
    return "https://calendar.google.com/calendar/render?" + q.toString();
  }

  /** @param {boolean} institucional true = cuenta @udec.cl (Microsoft 365) */
  function enlaceOutlook(a, institucional) {
    var host = institucional ? "https://outlook.office.com" : "https://outlook.live.com";
    var q = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: a.titulo || "Actividad",
      startdt: new Date(a.fecha_inicio).toISOString(),
      enddt: new Date(a.fecha_fin || a.fecha_inicio).toISOString(),
      body: detalleTexto(a),
      location: a.ubicacion || "",
    });
    return host + "/calendar/0/deeplink/compose?" + q.toString();
  }

  function enlaceIcsUnico(a) {
    return urlBase() + "/api/calendario.ics?ids=" + encodeURIComponent(a.id);
  }

  // ── Suscripcion al feed completo ──────────────────────────────────────────

  function enlaceSuscribirGoogle(feed) {
    // Google exige que el feed se sirva por HTTPS para este enlace directo.
    var webcal = feed.replace(/^https?:\/\//, "webcal://");
    return "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal);
  }

  function enlaceSuscribirOutlook(feed, institucional) {
    var host = institucional ? "https://outlook.office.com" : "https://outlook.live.com";
    return host + "/calendar/0/addfromweb?url=" + encodeURIComponent(feed) +
           "&name=" + encodeURIComponent("MapFI");
  }

  // ── Interfaz ──────────────────────────────────────────────────────────────

  var dlg = null;
  function dialogo() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "confirm-dialog sync-dialog";
    document.body.appendChild(dlg);
    return dlg;
  }

  function abrir(html) {
    var d = dialogo();
    d.innerHTML = html;
    var cerrar = d.querySelector("[data-cerrar]");
    if (cerrar) cerrar.onclick = function () { d.close(); };
    d.showModal();
    if (global.Icons) global.Icons.hydrate(d);
    return d;
  }

  /** Panel de detalle de una actividad, con los botones de calendario. */
  function mostrarActividad(a) {
    var fecha = new Date(a.fecha_inicio).toLocaleString("es-CL", {
      weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
    });
    var filas = "";
    if (a.entidad_nombre) filas += "<p class='muted'>Organiza " + esc(a.entidad_nombre) + "</p>";
    if (a.ubicacion) filas += "<p class='muted'>Lugar: " + esc(a.ubicacion) + "</p>";
    if (a.descripcion) filas += "<p>" + esc(a.descripcion) + "</p>";

    var inscripcion = a.url_inscripcion
      ? '<a class="btn gold" href="' + esc(a.url_inscripcion) + '" target="_blank" rel="noopener noreferrer">' +
        'Inscribirse</a>'
      : "";

    abrir(
      '<div class="stack">' +
        "<h3>" + esc(a.titulo) + "</h3>" +
        "<p><strong>" + esc(fecha) + "</strong></p>" +
        filas +
        (inscripcion ? '<div class="row">' + inscripcion + "</div>" : "") +
        '<hr style="border:none;border-top:1px solid var(--border);margin:6px 0" />' +
        "<p class='muted' style='font-size:.85rem'>Agregar a mi calendario. Se añade una " +
        "<strong>copia</strong>: si la fecha cambia después, tu copia no se entera.</p>" +
        '<div class="row" style="flex-wrap:wrap;gap:8px">' +
          '<a class="btn secondary" target="_blank" rel="noopener noreferrer" href="' + esc(enlaceGoogle(a)) + '">Google</a>' +
          '<a class="btn secondary" target="_blank" rel="noopener noreferrer" href="' + esc(enlaceOutlook(a, true)) + '">Outlook UdeC</a>' +
          '<a class="btn secondary" target="_blank" rel="noopener noreferrer" href="' + esc(enlaceOutlook(a, false)) + '">Outlook personal</a>' +
          '<a class="btn secondary" href="' + esc(enlaceIcsUnico(a)) + '">Descargar .ics</a>' +
        "</div>" +
        '<div class="row" style="justify-content:flex-end">' +
          '<button type="button" class="btn" data-cerrar>Cerrar</button>' +
        "</div>" +
      "</div>"
    );
  }

  /**
   * Dialogo de suscripcion. Exige carrera y año: suscribirse a las 14 carreras
   * y los 5 años produce un calendario inservible que se abandona enseguida.
   */
  function mostrarSuscripcion(filtros) {
    filtros = filtros || {};
    if (!filtros.carreraId || !filtros.nivel) {
      abrir(
        '<div class="stack">' +
          "<h3>Elige tu carrera y tu año</h3>" +
          "<p class='muted'>Para sincronizar hace falta que elijas <strong>carrera</strong> y " +
          "<strong>generación</strong> en los filtros de arriba. Sin eso te llegarían las " +
          "fechas de las 14 carreras y los 5 años, y tu calendario quedaría inservible.</p>" +
          '<div class="row" style="justify-content:flex-end">' +
            '<button type="button" class="btn" data-cerrar>Entendido</button>' +
          "</div>" +
        "</div>"
      );
      return;
    }

    var feed = urlFeed(filtros);
    var d = abrir(
      '<div class="stack">' +
        "<h3>Sincronizar con mi calendario</h3>" +
        "<p class='muted'>Tu calendario se mantendrá al día solo, incluidas las cancelaciones. " +
        "Se sincroniza <strong>lo que tienes filtrado ahora</strong>.</p>" +
        '<div class="row" style="flex-wrap:wrap;gap:8px">' +
          '<a class="btn" target="_blank" rel="noopener noreferrer" href="' + esc(enlaceSuscribirGoogle(feed)) + '">Añadir a Google</a>' +
          '<a class="btn" target="_blank" rel="noopener noreferrer" href="' + esc(enlaceSuscribirOutlook(feed, true)) + '">Añadir a Outlook UdeC</a>' +
          '<a class="btn secondary" target="_blank" rel="noopener noreferrer" href="' + esc(enlaceSuscribirOutlook(feed, false)) + '">Outlook personal</a>' +
        "</div>" +
        "<label>O copia esta dirección en tu aplicación de calendario" +
          '<input type="text" readonly value="' + esc(feed) + '" data-feed />' +
        "</label>" +
        '<div class="row" style="flex-wrap:wrap;gap:8px">' +
          '<button type="button" class="btn secondary" data-copiar>Copiar dirección</button>' +
          '<a class="btn secondary" href="' + esc(feed) + '">Descargar .ics</a>' +
        "</div>" +
        "<p class='muted' style='font-size:.85rem'><strong>Ten en cuenta:</strong> Google revisa " +
        "estos calendarios cada 12 a 24 horas y no se puede acelerar. Sirve para tener tu " +
        "semestre a la vista, no para enterarte de un cambio de última hora.</p>" +
        '<div class="row" style="justify-content:flex-end">' +
          '<button type="button" class="btn" data-cerrar>Cerrar</button>' +
        "</div>" +
      "</div>"
    );

    var btnCopiar = d.querySelector("[data-copiar]");
    if (btnCopiar) {
      btnCopiar.onclick = function () {
        var campo = d.querySelector("[data-feed]");
        campo.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (_) {}
        if (!ok && navigator.clipboard) navigator.clipboard.writeText(feed).then(function () {
          if (global.toast) toast("Dirección copiada", "success");
        });
        else if (global.toast) toast(ok ? "Dirección copiada" : "Copia la dirección a mano", ok ? "success" : "error");
      };
    }
  }

  global.CalendarSync = {
    mostrarActividad: mostrarActividad,
    mostrarSuscripcion: mostrarSuscripcion,
    urlFeed: urlFeed,
    enlaceGoogle: enlaceGoogle,
    enlaceOutlook: enlaceOutlook,
  };
})(window);
