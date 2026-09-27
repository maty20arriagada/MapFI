/* MapFI · editor-actividad.js — editar una actividad desde el calendario.
 *
 * Spec 006, US4. Antes, un centro que veia su certamen en el dia equivocado
 * tenia que ir a «Mi panel», buscarlo en una tabla y editarlo alli. Ahora el
 * clic sobre una actividad PROPIA abre este panel en el mismo calendario.
 *
 * Solo cubre los campos de uso diario (fecha, hora, titulo, ramo, tipo,
 * lugar). El publico objetivo y el estado siguen en «Mi panel», con acceso
 * directo desde aqui.
 *
 * Seguridad: este panel solo se ofrece a quien puede editar, pero eso es
 * conveniencia de interfaz. Quien autoriza es el servidor (PUT
 * /api/actividades/:id). Todo dato de la actividad entra al DOM por .value o
 * textContent, nunca como HTML (Principio III).
 */
(function (global) {
  "use strict";

  var CAMPOS = [
    { id: "inicio", etiqueta: "Inicio", tipo: "datetime-local" },
    { id: "fin", etiqueta: "Término", tipo: "datetime-local" },
    { id: "titulo", etiqueta: "Título", tipo: "text", max: 200 },
    { id: "ramo", etiqueta: "Ramo", tipo: "text", max: 120, ayuda: "Opcional. Déjalo vacío si no corresponde." },
    { id: "tipo", etiqueta: "Tipo", tipo: "select" },
    { id: "ubicacion", etiqueta: "Lugar", tipo: "text", max: 200 },
  ];

  var dlg = null;
  var estado = { actividad: null, alGuardar: null, guardando: false };

  function pad(n) { return String(n).padStart(2, "0"); }
  /** Instante ISO -> valor de <input type="datetime-local"> en hora local. */
  function aLocalInput(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function el(tag, attrs, texto) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (texto != null) n.textContent = texto;
    return n;
  }

  function construir() {
    if (dlg) return dlg;
    dlg = el("dialog", { class: "confirm-dialog editor-dialog", "aria-labelledby": "edTitulo" });
    var form = el("form", { class: "stack", novalidate: "" });

    form.appendChild(el("h3", { id: "edTitulo" }, "Editar actividad"));
    form.appendChild(el("p", { class: "muted", "data-role": "entidad" }));

    var rejilla = el("div", { class: "editor-campos" });
    CAMPOS.forEach(function (c) {
      var caja = el("div", { class: "editor-campo" + (c.id === "titulo" ? " editor-ancho" : "") });
      var idInput = "ed-" + c.id;
      caja.appendChild(el("label", { for: idInput }, c.etiqueta));
      var input;
      if (c.tipo === "select") {
        input = el("select", { id: idInput, name: c.id });
        var nombres = (global.CalendarView && global.CalendarView.NOMBRE_TIPO) || {};
        Object.keys(nombres).forEach(function (valor) {
          input.appendChild(el("option", { value: valor }, nombres[valor]));
        });
      } else {
        input = el("input", { id: idInput, name: c.id, type: c.tipo });
        if (c.max) input.setAttribute("maxlength", String(c.max));
      }
      var idError = "err-" + c.id;
      input.setAttribute("aria-describedby", idError + (c.ayuda ? " ayuda-" + c.id : ""));
      caja.appendChild(input);
      if (c.ayuda) caja.appendChild(el("small", { id: "ayuda-" + c.id, class: "muted" }, c.ayuda));
      var err = el("p", { id: idError, class: "campo-error" });
      err.hidden = true;
      caja.appendChild(err);
      rejilla.appendChild(caja);
    });
    form.appendChild(rejilla);

    // Error general (servidor, sesion, conflicto). role=alert: el usuario
    // pulso Guardar y espera respuesta, aqui SI conviene interrumpir.
    var general = el("div", { class: "editor-error", role: "alert", "data-role": "general" });
    general.hidden = true;
    form.appendChild(general);

    var acciones = el("div", { class: "row editor-acciones" });
    var secundarias = el("div", { class: "row editor-secundarias" });
    var btnSync = el("button", { type: "button", class: "btn secondary", "data-role": "sync" });
    btnSync.innerHTML = '<span class="icon" data-icon="calendar" aria-hidden="true"></span>';
    btnSync.appendChild(document.createTextNode(" Añadir a mi calendario"));
    var enlacePanel = el("a", { href: "dashboard.html", class: "editor-enlace" }, "Editar público y estado en Mi panel");
    secundarias.appendChild(btnSync);
    secundarias.appendChild(enlacePanel);

    var principales = el("div", { class: "row" });
    principales.appendChild(el("button", { type: "button", class: "btn secondary", "data-role": "cancelar" }, "Cancelar"));
    var btnGuardar = el("button", { type: "submit", class: "btn", "data-role": "guardar" });
    btnGuardar.innerHTML = '<span class="icon" data-icon="save" aria-hidden="true"></span>';
    btnGuardar.appendChild(document.createTextNode(" Guardar cambios"));
    principales.appendChild(btnGuardar);

    acciones.appendChild(secundarias);
    acciones.appendChild(principales);
    form.appendChild(acciones);
    dlg.appendChild(form);
    document.body.appendChild(dlg);

    form.addEventListener("submit", function (e) { e.preventDefault(); guardar(); });
    dlg.querySelector('[data-role="cancelar"]').addEventListener("click", function () { dlg.close(); });
    btnSync.addEventListener("click", function () {
      var a = estado.actividad;
      dlg.close();
      if (a && global.CalendarSync) global.CalendarSync.mostrarActividad(a);
    });
    if (global.Icons) global.Icons.hydrate(dlg);
    return dlg;
  }

  function campo(id) { return dlg.querySelector("#ed-" + id); }

  function limpiarErrores() {
    CAMPOS.forEach(function (c) {
      var e = dlg.querySelector("#err-" + c.id);
      e.hidden = true; e.textContent = "";
      campo(c.id).removeAttribute("aria-invalid");
    });
    var g = dlg.querySelector('[data-role="general"]');
    g.hidden = true; g.textContent = "";
  }

  function mostrarErrores(errores) {
    var primero = null;
    Object.keys(errores).forEach(function (id) {
      var e = dlg.querySelector("#err-" + id);
      if (!e) return;
      e.textContent = errores[id];
      e.hidden = false;
      campo(id).setAttribute("aria-invalid", "true");
      if (!primero) primero = campo(id);
    });
    if (primero) primero.focus();
  }

  /** Error general; `conRecarga` añade el boton para traer la version vigente. */
  function errorGeneral(mensaje, conRecarga) {
    var g = dlg.querySelector('[data-role="general"]');
    g.textContent = "";
    g.appendChild(el("p", null, mensaje));
    if (conRecarga) {
      var b = el("button", { type: "button", class: "btn secondary" }, "Recargar");
      b.addEventListener("click", function () { location.reload(); });
      g.appendChild(b);
    }
    g.hidden = false;
  }

  function leerFormulario() {
    var f = {};
    CAMPOS.forEach(function (c) { f[c.id] = campo(c.id).value; });
    return f;
  }

  async function guardar() {
    if (estado.guardando) return;
    var CE = global.CalendarioEstado;
    limpiarErrores();
    var form = leerFormulario();
    var errores = CE.validarEdicion(form);
    if (Object.keys(errores).length) { mostrarErrores(errores); return; }

    var btn = dlg.querySelector('[data-role="guardar"]');
    estado.guardando = true;
    btn.disabled = true;
    try {
      var nueva = await global.api.put("/api/actividades/" + encodeURIComponent(estado.actividad.id),
        CE.cuerpoEdicion(form, estado.actividad));
      dlg.close();
      if (global.toast) global.toast("Cambios guardados", "success");
      if (typeof estado.alGuardar === "function") estado.alGuardar(nueva);
    } catch (e) {
      // El panel NO se cierra ante un error: quien escribio no pierde nada.
      if (e.status === 409) errorGeneral(e.message, true);
      else if (e.status === 401) errorGeneral("Tu sesión expiró. Vuelve a ingresar en otra pestaña y pulsa Guardar de nuevo: lo que escribiste sigue aquí.");
      else if (e.status === 403 || e.status === 404) errorGeneral("Esta actividad ya no está disponible para editar. Recarga el calendario.", true);
      else errorGeneral(e.message || "No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      estado.guardando = false;
      btn.disabled = false;
    }
  }

  /**
   * Abre el panel con los datos actuales de la actividad.
   * @param {Object} actividad  fila de GET /api/actividades
   * @param {{alGuardar?: Function}} opts
   */
  function abrir(actividad, opts) {
    construir();
    estado.actividad = actividad;
    estado.alGuardar = opts && opts.alGuardar;
    limpiarErrores();
    dlg.querySelector('[data-role="entidad"]').textContent =
      "Publicada por " + (actividad.entidad_nombre || "tu centro");
    campo("inicio").value = aLocalInput(actividad.fecha_inicio);
    campo("fin").value = aLocalInput(actividad.fecha_fin);
    campo("titulo").value = actividad.titulo || "";
    campo("ramo").value = actividad.ramo || "";
    campo("tipo").value = actividad.tipo || "EXAMEN";
    campo("ubicacion").value = actividad.ubicacion || "";
    dlg.showModal();
    campo("inicio").focus();
  }

  global.EditorActividad = { abrir: abrir };
})(window);
