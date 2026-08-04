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

  var esc = function (s) {
    return (global.escapeHtml || function (x) { return x == null ? "" : String(x); })(s);
  };

  /**
   * Aviso publico de cancelaciones (ultimos 30 dias). La tarjeta permanece
   * oculta si no hay nada que avisar, para no ensuciar la pagina el resto
   * del tiempo. Muestra el CENTRO responsable, no la persona.
   */
  async function renderCanceladas() {
    var card = document.getElementById("canceladasCard");
    var cont = document.getElementById("tablaCanceladas");
    if (!card || !cont) return;
    var lista = [];
    try {
      lista = await api.get("/api/actividades/eliminadas");
    } catch (_) {
      return; // si falla, la tarjeta simplemente no aparece
    }
    if (!lista.length) { card.hidden = true; return; }

    var fmt = function (d) {
      return new Date(d).toLocaleString("es-CL", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      });
    };
    var fmtDia = function (d) {
      return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
    };
    cont.innerHTML =
      '<table><thead><tr>' +
        '<th>Actividad</th><th>Fecha que tenía</th><th>Eliminada por</th><th>Cuándo</th><th>Motivo</th>' +
      '</tr></thead><tbody>' +
      lista.map(function (a) {
        return '<tr>' +
          '<td><strong>' + esc(a.titulo) + '</strong><div class="muted" style="font-size:.78rem">' + esc(a.entidad_sigla || a.entidad_nombre) + '</div></td>' +
          '<td>' + fmt(a.fecha_inicio) + '</td>' +
          '<td>' + esc(a.eliminada_por) + '</td>' +
          '<td class="muted">' + fmtDia(a.retirada_en) + '</td>' +
          '<td class="muted">' + esc(a.motivo_retiro || "—") + '</td>' +
        '</tr>';
      }).join("") +
      '</tbody></table>';
    card.hidden = false;
    if (global.Icons) global.Icons.hydrate(card);
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
      renderCanceladas();

      if (!isAdmin) return;

      var aEnt = document.getElementById("aEntidad");
      // Nombres, siglas y codigos vienen de la base y los escribe un admin.
      // Van escapados igual: sin esto, una comilla en el nombre de una carrera
      // se sale del atributo `title="..."` y permite inyectar atributos
      // (revision de seguridad 2026-08-04, SEG-3). dashboard-view.js ya lo
      // hacia bien; aqui se habia quedado sin escapar.
      aEnt.innerHTML = cat.entidades.map(function (e) {
        return '<option value="' + e.id + '"' + (e.sigla === "DOCFI" ? " selected" : "") + '>' + esc((e.sigla ? e.sigla + " — " : "") + e.nombre) + '</option>';
      }).join("");

      document.getElementById("aCarreras").innerHTML = cat.carreras.map(function (c) {
        return '<label title="' + esc(c.nombre) + '"><input type="checkbox" value="' + c.id + '" />' + esc(c.codigo) + '</label>';
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
      // T064 (H-08, FR-014, Principio VI): el error se muestra junto al
      // propio campo (validación nativa del navegador) al perder el foco.
      formFecha.fechaFin.addEventListener("blur", function () {
        var fi = formFecha.fechaInicio.value, ff = formFecha.fechaFin;
        ff.setCustomValidity(fi && ff.value && ff.value <= fi ? "La fecha de término debe ser posterior a la de inicio" : "");
        ff.reportValidity();
      });

      formFecha.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var d = Object.fromEntries(new FormData(ev.target).entries());
        var publico = leerPublico();
        if (!publico.length) return toast("Selecciona al menos una carrera y un año", "error");
        // T062 (H-07, FR-013): deshabilitar ANTES de cualquier ida a la red.
        // Estaba despues del chequeo de saturacion, dejando una ventana en la
        // que un doble clic creaba la fecha dos veces (revision QA, M-4).
        var btnGuardarFecha = formFecha.querySelector('[type=submit]');
        if (btnGuardarFecha) btnGuardarFecha.disabled = true;
        try {
          // T073 (dilema D-4): fricción mínima — advertir, no arbitrar, si ya
          // hay eventos saturando el mismo público en esa semana.
          try {
            var chequeo = await api.post("/api/match/evaluar", { inicio: d.fechaInicio, fin: d.fechaFin || d.fechaInicio, publico: publico });
            var satur = (chequeo.conflictos || []).find(function (c) { return c.tipo === "SATURACION"; });
            if (satur) {
              var seguir = global.confirmDialog
                ? await global.confirmDialog({
                    titulo: "Fecha con alta demanda",
                    mensaje: satur.detalle + ". Puedes seguir de todas formas: MapFI no arbitra choques entre centros, solo los muestra.",
                    textoConfirmar: "Agendar de todas formas",
                  })
                : confirm(satur.detalle + ". ¿Agendar de todas formas?");
              if (!seguir) return;
            }
          } catch (_) { /* si la verificacion falla, no bloquea la creacion */ }

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
        finally { if (btnGuardarFecha) btnGuardarFecha.disabled = false; }
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
        // T052/T053 (H-05): una planilla de un semestre completo supera el
        // límite de tamaño de un solo envío (100 kB) — se divide en lotes y
        // se envían secuencialmente, acumulando el resultado de todos.
        var lotes = CsvUtils.dividirEnLotes(parsed.actividades);
        var btnImportar = document.getElementById("btnImportar");
        btnImportar.disabled = true;
        var creadas = 0, procesadas = 0, erroresServidor = [];
        try {
          for (var i = 0; i < lotes.length; i++) {
            procesadas += lotes[i].length;
            box.innerHTML = '<div class="placeholder">Procesando ' + procesadas + ' de ' + parsed.actividades.length + '…</div>';
            var res = await api.post("/api/actividades/bulk", { actividades: lotes[i] });
            creadas += res.creadas;
            erroresServidor = erroresServidor.concat(res.errores || []);
          }
          var allErr = parsed.errores.concat(erroresServidor);
          toast(creadas + " importada(s)" + (allErr.length ? " · " + allErr.length + " con error" : ""), allErr.length ? "error" : "success");
          box.innerHTML = '<p><strong>' + creadas + '</strong> fecha(s) importada(s)' + (lotes.length > 1 ? ' (en ' + lotes.length + ' lotes)' : '') + '.</p>' + renderErrores(allErr);
          document.getElementById("csvText").value = ""; document.getElementById("csvFile").value = "";
          render();
        } catch (err) { toast(err.message, "error"); }
        finally { btnImportar.disabled = false; }
      };

      if (global.Tooltips) global.Tooltips.init();
    })();
  }

  global.CalendarioView = { init: init };
})(window);
