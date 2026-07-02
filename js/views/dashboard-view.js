/* MapFI · js/views/dashboard-view.js — Lógica del panel de aportante.
 * Extraído de dashboard.html (F8.1). IIFE que expone DashboardView.init(). */
(function (global) {
  "use strict";

  var LS_CTX = "mapfi-evento-ctx";
  var user, cat, actForm, formCard, csvCard;

  function toLocalInput(d) {
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function leerPublico() {
    var carreras = Array.from(document.querySelectorAll("#aCarreras input:checked")).map(function (i) { return +i.value; });
    var niveles = Array.from(document.querySelectorAll("#aNiveles input:checked")).map(function (i) { return +i.value; });
    return carreras.flatMap(function (carreraId) { return niveles.map(function (nivel) { return { carreraId: carreraId, nivel: nivel }; }); });
  }

  function marcarPublico(carreraIds, niveles) {
    (carreraIds || []).forEach(function (id) {
      var cb = document.querySelector("#aCarreras input[value=\"" + id + "\"]");
      if (cb) cb.checked = true;
    });
    (niveles || []).forEach(function (nv) {
      var cb = document.querySelector("#aNiveles input[value=\"" + nv + "\"]");
      if (cb) cb.checked = true;
    });
  }

  function toggleAll(sel) {
    var boxes = Array.from(document.querySelectorAll(sel + " input"));
    var all = boxes.every(function (b) { return b.checked; });
    boxes.forEach(function (b) { b.checked = !all; });
  }

  function abrirForm(fecha) {
    if (!user.entidadId) return;
    csvCard.hidden = true;
    formCard.hidden = false;
    if (fecha) {
      actForm.fechaInicio.value = toLocalInput(fecha);
      var d = new Date(fecha); d.setHours(d.getHours() + 2);
      actForm.fechaFin.value = toLocalInput(d);
    }
    formCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    actForm.titulo.focus();
  }

  function renderErrores(errs) {
    if (!errs || !errs.length) return "";
    return '<div class="help-box"><strong>Filas con error:</strong><ul style="margin:6px 0 0 18px">' +
      errs.map(function (e) { return "<li>Fila " + e.fila + ": " + (window.escapeHtml || function (s) { return s; })(e.error) + "</li>"; }).join("") + "</ul></div>";
  }

  async function cargarLista() {
    if (user.entidadId) {
      if (global.EventTable) global.EventTable.montar(document.getElementById("tablaEventos"), user.entidadId, actualizarKpis);
      if (global.CalendarView) global.CalendarView.montar(document.getElementById("misActividades"), { entidadId: user.entidadId }, { onPick: abrirForm });
      actualizarKpis();
    } else {
      document.getElementById("tablaEventos").innerHTML = '<div class="placeholder">Eres ADMIN. Gestiona desde <a href="admin.html">Admin</a> y revisa <a href="kpis.html">KPIs</a>.</div>';
      document.getElementById("misActividades").innerHTML = '<div class="placeholder">Las fechas académicas se cargan desde el <a href="calendario.html">Calendario</a>.</div>';
    }
  }

  async function actualizarKpis() {
    try {
      var acts = await api.get("/api/actividades?entidadId=" + user.entidadId);
      document.getElementById("kpiTotal").textContent = acts.length + " actividad(es)";
    } catch (_) { document.getElementById("kpiTotal").textContent = "—"; }
    try {
      var resumen = await api.get("/api/entidades/" + user.entidadId + "/resumen");
      document.getElementById("kpiConf").textContent = resumen.confiabilidad_pct + "%";
      document.getElementById("kpiRep").textContent = resumen.reputacion + " pts";
      document.getElementById("kpiSello").innerHTML = resumen.sello_coordinacion
        ? '<span class="badge alto">' + (global.Icon ? global.Icon("trophy", { size: 14 }) : "") + " Sello</span>" : "";
    } catch (_) {
      document.getElementById("kpiConf").textContent = "—";
      document.getElementById("kpiRep").textContent = "—";
      document.getElementById("kpiSello").innerHTML = "";
    }
  }

  function init() {
    document.addEventListener("DOMContentLoaded", async function () {
      try {
        var r = await api.get("/api/auth/me");
        user = r.user;
      } catch (_) {
        var authSection = document.querySelector(".section.auth-only");
        if (authSection) authSection.innerHTML = '<div class="placeholder">No se pudo conectar con el servidor.<br><a href="javascript:location.reload()">Reintentar</a></div>';
        return;
      }
      if (!user) return;

      if (!user.entidadId) {
        document.getElementById("btnNueva").hidden = true;
        document.getElementById("btnImportarCsv").hidden = true;
        document.getElementById("btnReporte").hidden = true;
        document.getElementById("formCard").hidden = true;
      }

      cat = await Filters.cargar();
      actForm = document.getElementById("actForm");
      formCard = document.getElementById("formCard");
      csvCard = document.getElementById("csvCard");

      document.getElementById("aCarreras").innerHTML = cat.carreras.map(function (c) {
        return '<label title="' + (window.escapeHtml ? window.escapeHtml(c.nombre) : c.nombre) + '"><input type="checkbox" value="' + c.id + '" />' + (window.escapeHtml ? window.escapeHtml(c.codigo) : c.codigo) + '</label>';
      }).join("");
      document.getElementById("aNiveles").innerHTML = cat.generaciones.map(function (g) {
        return '<label><input type="checkbox" value="' + g.nivel + '" />' + g.nivel + '°</label>';
      }).join("");

      document.getElementById("carrTodas").onclick = function () { toggleAll("#aCarreras"); };
      document.getElementById("nivTodos").onclick = function () { toggleAll("#aNiveles"); };

      var ctx = JSON.parse(localStorage.getItem(LS_CTX) || "{}");
      var miEntidad = (cat.entidades || []).find(function (e) { return e.id === user.entidadId; });
      if (ctx.carreras && ctx.carreras.length) marcarPublico(ctx.carreras, ctx.niveles);
      else if (miEntidad && miEntidad.carrera_id) marcarPublico([miEntidad.carrera_id], []);
      if (ctx.ubicacion) actForm.ubicacion.value = ctx.ubicacion;

      actForm.fechaInicio.addEventListener("change", function () {
        var fi = actForm.fechaInicio.value, ff = actForm.fechaFin;
        if (fi && (!ff.value || ff.value <= fi)) {
          var d = new Date(fi); d.setHours(d.getHours() + 2);
          ff.value = toLocalInput(d);
        }
      });

      document.getElementById("toggleDetalles").onclick = function () {
        var m = document.getElementById("masDetalles"); m.hidden = !m.hidden;
      };

      document.getElementById("btnNueva").onclick = function () { formCard.hidden ? abrirForm() : (formCard.hidden = true); };
      document.getElementById("btnCancelar").onclick = function () { formCard.hidden = true; };
      document.getElementById("btnImportarCsv").onclick = function () { formCard.hidden = true; csvCard.hidden = !csvCard.hidden; };

      document.getElementById("btnPreview").onclick = async function () {
        var d = Object.fromEntries(new FormData(actForm).entries());
        var publico = leerPublico();
        if (!d.fechaInicio) return toast("Completa la fecha de inicio", "error");
        if (!publico.length) return toast("Selecciona al menos una carrera y un año", "error");
        try {
          var result = await api.post("/api/match/evaluar", { inicio: d.fechaInicio, fin: d.fechaFin || d.fechaInicio, publico: publico });
          MatchCalculator.render(document.getElementById("preview"), result);
        } catch (err) { toast(err.message, "error"); }
      };

      actForm.onsubmit = async function (e) {
        e.preventDefault();
        var d = Object.fromEntries(new FormData(actForm).entries());
        var publico = leerPublico();
        if (!publico.length) return toast("Selecciona al menos una carrera y un año", "error");
        try {
          await api.post("/api/actividades", {
            titulo: d.titulo, descripcion: d.descripcion, tipo: d.tipo, ramo: d.ramo,
            ubicacion: d.ubicacion, fechaInicio: d.fechaInicio, fechaFin: d.fechaFin, publico: publico,
          });
          localStorage.setItem(LS_CTX, JSON.stringify({
            carreras: Array.from(new Set(publico.map(function (p) { return p.carreraId; }))),
            niveles: Array.from(new Set(publico.map(function (p) { return p.nivel; }))),
            ubicacion: d.ubicacion,
          }));
          toast("Evento creado correctamente", "success");
          actForm.titulo.value = ""; actForm.fechaInicio.value = ""; actForm.fechaFin.value = "";
          actForm.descripcion.value = ""; actForm.ramo.value = "";
          document.getElementById("preview").innerHTML = "";
          actForm.titulo.focus();
          cargarLista();
        } catch (err) { toast(err.message, "error"); }
      };

      document.getElementById("csvFile").onchange = function (e) {
        var f = e.target.files[0]; if (!f) return;
        var reader = new FileReader();
        reader.onload = function () { document.getElementById("csvText").value = reader.result; };
        reader.readAsText(f, "utf-8");
      };

      document.getElementById("btnImportar").onclick = async function () {
        var text = document.getElementById("csvText").value.trim();
        if (!text) return toast("Pega el CSV o sube un archivo", "error");
        var parsed = CsvUtils.construirActividades(text, cat, { defaultEntidadId: user.entidadId });
        var box = document.getElementById("importResult");
        if (!parsed.actividades.length) {
          box.innerHTML = '<div class="placeholder">No hay filas válidas para importar.</div>' + renderErrores(parsed.errores);
          return;
        }
        try {
          var res = await api.post("/api/actividades/bulk", { actividades: parsed.actividades });
          var allErr = parsed.errores.concat(res.errores || []);
          toast(res.creadas + " fecha(s) enviadas a revisión", allErr.length ? "error" : "success");
          box.innerHTML = '<p><strong>' + res.creadas + '</strong> fecha(s) importadas como <span class="badge medio">PROPUESTA</span>. El administrador las revisará.</p>' + renderErrores(allErr);
          document.getElementById("csvText").value = ""; document.getElementById("csvFile").value = "";
          cargarLista();
        } catch (err) { toast(err.message, "error"); }
      };

      document.getElementById("btnReporte").onclick = function () {
        if (user.entidadId) window.open("/api/reports/" + user.entidadId + "/pdf", "_blank");
      };

      cargarLista();
      if (global.Onboarding) global.Onboarding.mostrar(user, function () { if (global.Tour) global.Tour.iniciar(); });
      if (global.Tooltips) global.Tooltips.init();
    });
  }

  global.DashboardView = { init: init };
})(window);
