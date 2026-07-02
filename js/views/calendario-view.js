/* MapFI · js/views/calendario-view.js — Lógica del calendario académico.
 * Extraído de calendario.html (F8.2). IIFE que expone CalendarioView.init(). */
(function (global) {
  "use strict";

  var isAdmin = false;
  var cat = null;

  function toLocalInput(d) {
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function leerPublico() {
    var carreras = Array.from(document.querySelectorAll("#aCarreras input:checked")).map(function (i) { return +i.value; });
    var niveles = Array.from(document.querySelectorAll("#aNiveles input:checked")).map(function (i) { return +i.value; });
    var pub = [];
    carreras.forEach(function (c) { niveles.forEach(function (nv) { pub.push({ carreraId: c, nivel: nv }); }); });
    return pub;
  }

  function renderErrores(errs) {
    if (!errs || !errs.length) return "";
    return '<div class="help-box"><strong>Filas con error:</strong><ul style="margin:6px 0 0 18px">' +
      errs.map(function (e) { return "<li>Fila " + e.fila + ": " + (window.escapeHtml || function (s) { return s; })(e.error) + "</li>"; }).join("") + "</ul></div>";
  }

  function init() {
    var cal = document.getElementById("calendar");

    (async function () {
      try {
        var r = await api.get("/api/auth/me");
        isAdmin = !!(r.user && r.user.rol === "ADMIN");
      } catch (_) {}

      cat = await Filters.cargar();
      Filters.poblarSelect(document.getElementById("fCarrera"), cat.carreras, "id", "nombre", "Todas las carreras");
      Filters.poblarSelect(document.getElementById("fNivel"), cat.generaciones, "nivel", "etiqueta", "Todos los años");
      Filters.poblarSelect(document.getElementById("fEntidad"), cat.entidades, "id", "nombre", "Todas las entidades");

      function abrirFechaForm(fecha) {
        var card = document.getElementById("adminFecha");
        if (card.hidden) return;
        if (fecha) {
          var formFecha = document.getElementById("formFecha");
          formFecha.fechaInicio.value = toLocalInput(fecha);
          var d = new Date(fecha); d.setHours(d.getHours() + 2);
          formFecha.fechaFin.value = toLocalInput(d);
        }
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        if (document.getElementById("formFecha")) document.getElementById("formFecha").titulo.focus();
      }

      function render() {
        var filtros = {};
        var c = document.getElementById("fCarrera").value; if (c) filtros.carreraId = c;
        var n = document.getElementById("fNivel").value; if (n) filtros.nivel = n;
        var e = document.getElementById("fEntidad").value; if (e) filtros.entidadId = e;
        var t = document.getElementById("fTipo").value; if (t) filtros.tipo = t;
        if (global.CalendarView) global.CalendarView.montar(cal, filtros, isAdmin ? { onPick: abrirFechaForm } : {});
      }

      document.querySelectorAll(".filtro").forEach(function (s) { s.addEventListener("change", render); });
      render();

      if (!isAdmin) return;

      var aEnt = document.getElementById("aEntidad");
      aEnt.innerHTML = cat.entidades.map(function (e) {
        return '<option value="' + e.id + '"' + (e.sigla === "DOCFI" ? " selected" : "") + '>' + ((e.sigla ? e.sigla + " — " : "") + e.nombre) + '</option>';
      }).join("");

      document.getElementById("aCarreras").innerHTML = cat.carreras.map(function (c) {
        return '<label title="' + c.nombre + '"><input type="checkbox" value="' + c.id + '" />' + c.codigo + '</label>';
      }).join("");

      document.getElementById("aNiveles").innerHTML = cat.generaciones.map(function (g) {
        return '<label><input type="checkbox" value="' + g.nivel + '" />' + g.nivel + '°</label>';
      }).join("");

      function toggleAll(sel) {
        var boxes = Array.from(document.querySelectorAll(sel + " input"));
        var all = boxes.every(function (b) { return b.checked; });
        boxes.forEach(function (b) { b.checked = !all; });
      }
      document.getElementById("carrTodas").onclick = function () { toggleAll("#aCarreras"); };
      document.getElementById("nivTodos").onclick = function () { toggleAll("#aNiveles"); };

      var formFecha = document.getElementById("formFecha");
      formFecha.fechaInicio.addEventListener("change", function () {
        var fi = formFecha.fechaInicio.value, ff = formFecha.fechaFin;
        if (fi && (!ff.value || ff.value <= fi)) {
          var d = new Date(fi); d.setHours(d.getHours() + 2); ff.value = toLocalInput(d);
        }
      });

      formFecha.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var d = Object.fromEntries(new FormData(ev.target).entries());
        var publico = leerPublico();
        if (!publico.length) return toast("Selecciona al menos una carrera y un año", "error");
        try {
          await api.post("/api/actividades", {
            titulo: d.titulo, tipo: d.tipo, ramo: d.ramo, ubicacion: d.ubicacion,
            fechaInicio: d.fechaInicio, fechaFin: d.fechaFin, entidadId: +d.entidadId, estado: "CONFIRMADA", publico: publico,
          });
          toast("Fecha agregada a " + publico.length + " segmento(s)", "success");
          formFecha.titulo.value = ""; formFecha.ramo.value = ""; formFecha.fechaInicio.value = "";
          formFecha.fechaFin.value = ""; formFecha.ubicacion.value = "";
          formFecha.titulo.focus();
          render();
        } catch (err) { toast(err.message, "error"); }
      });

      document.getElementById("verFormato").onclick = function () {
        var h = document.getElementById("formatoHelp"); h.hidden = !h.hidden;
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
        var docfi = (cat.entidades.find(function (e) { return e.sigla === "DOCFI"; }) || {}).id;
        var parsed = CsvUtils.construirActividades(text, cat, { defaultEntidadId: docfi });
        var box = document.getElementById("importResult");
        if (!parsed.actividades.length) {
          box.innerHTML = '<div class="placeholder">No hay filas válidas para importar.</div>' + renderErrores(parsed.errores);
          return;
        }
        try {
          var res = await api.post("/api/actividades/bulk", { actividades: parsed.actividades });
          var allErr = parsed.errores.concat(res.errores || []);
          toast(res.creadas + " importada(s)" + (allErr.length ? " · " + allErr.length + " con error" : ""), allErr.length ? "error" : "success");
          box.innerHTML = '<p><strong>' + res.creadas + '</strong> fecha(s) importada(s).</p>' + renderErrores(allErr);
          document.getElementById("csvText").value = ""; document.getElementById("csvFile").value = "";
          render();
        } catch (err) { toast(err.message, "error"); }
      };

      if (global.Tooltips) global.Tooltips.init();
    })();
  }

  global.CalendarioView = { init: init };
})(window);
