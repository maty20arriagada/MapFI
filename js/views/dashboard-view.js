/* MapFI · js/views/dashboard-view.js — Lógica del panel de aportante.
 * Extraído de dashboard.html (F8.1). IIFE que expone DashboardView.init(). */
(function (global) {
  "use strict";

  // T067 (H-12): la clave se arma por CUENTA (no un valor fijo compartido
  // por navegador) — en un computador de sede compartido, el contexto del
  // formulario de una entidad no debe autocompletarse para otra (E-11).
  function claveCtx() { return "mapfi-evento-ctx-" + user.id; }
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
      if (global.EventTable) global.EventTable.montar(document.getElementById("tablaEventos"), user.entidadId, actualizarKpis, { esAdmin: esAdminOSuper(user) });
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
      // T042 (H-10, FR-007): el rotulo solo aparece mientras algun segmento
      // de las actividades de esta entidad use matricula referencial; al
      // cargar la matricula oficial desaparece sin intervencion manual.
      var alcanceTxt = resumen.totales.alcanceTotal + " estudiante(s)";
      if (resumen.matriculaReferencial) alcanceTxt += " · estimación basada en datos referenciales de matrícula";
      document.getElementById("kpiAlcance").textContent = alcanceTxt;
    } catch (_) {
      document.getElementById("kpiConf").textContent = "—";
      document.getElementById("kpiRep").textContent = "—";
      document.getElementById("kpiSello").innerHTML = "";
      document.getElementById("kpiAlcance").textContent = "—";
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

      var ctx = JSON.parse(localStorage.getItem(claveCtx()) || "{}");
      var miEntidad = (cat.entidades || []).find(function (e) { return e.id === user.entidadId; });
      if (ctx.carreras && ctx.carreras.length) marcarPublico(ctx.carreras, ctx.niveles);
      else if (miEntidad && miEntidad.carrera_id) marcarPublico([miEntidad.carrera_id], []);
      if (ctx.ubicacion) actForm.ubicacion.value = ctx.ubicacion;

      // T074 (dilema D-5): advertir — sin impedirlo — cuando se selecciona
      // una carrera distinta a la propia. La libertad se mantiene (los
      // eventos interdisciplinarios son un objetivo del proyecto); basta
      // con avisar y dejar registro de quién lo creó (ya se guarda en
      // created_by). Es un problema social, no técnico.
      document.getElementById("aCarreras").addEventListener("change", function () {
        var aviso = document.getElementById("avisoOtrasCarreras");
        if (!miEntidad || !miEntidad.carrera_id) { aviso.hidden = true; return; }
        var marcadas = Array.from(document.querySelectorAll("#aCarreras input:checked")).map(function (i) { return +i.value; });
        var otras = marcadas.filter(function (id) { return id !== miEntidad.carrera_id; });
        if (otras.length) {
          aviso.hidden = false;
          aviso.textContent = "Estás seleccionando carreras distintas a la tuya. Está permitido (actividades interdisciplinarias), pero quedará registrado que la creaste tú.";
        } else {
          aviso.hidden = true;
        }
      });

      actForm.fechaInicio.addEventListener("change", function () {
        var fi = actForm.fechaInicio.value, ff = actForm.fechaFin;
        if (fi && (!ff.value || ff.value <= fi)) {
          var d = new Date(fi); d.setHours(d.getHours() + 2);
          ff.value = toLocalInput(d);
        }
      });
      // T064 (H-08, FR-014, Principio VI): si el usuario edita el término a
      // mano y queda antes del inicio, el error se muestra junto al propio
      // campo (validación nativa del navegador) al perder el foco.
      actForm.fechaFin.addEventListener("blur", function () {
        var fi = actForm.fechaInicio.value, ff = actForm.fechaFin;
        ff.setCustomValidity(fi && ff.value && ff.value <= fi ? "La fecha de término debe ser posterior a la de inicio" : "");
        ff.reportValidity();
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
          MatchCalculator.render(document.getElementById("preview"), result, {
            onPick: function (s) {
              actForm.fechaInicio.value = toLocalInput(new Date(s.inicio));
              actForm.fechaFin.value = toLocalInput(new Date(s.fin));
              toast("Fecha actualizada con la sugerencia", "success");
            },
          });
        } catch (err) { toast(err.message, "error"); }
      };

      actForm.onsubmit = async function (e) {
        e.preventDefault();
        var d = Object.fromEntries(new FormData(actForm).entries());
        var publico = leerPublico();
        if (!publico.length) return toast("Selecciona al menos una carrera y un año", "error");
        // T062 (H-07, FR-013): deshabilitar ANTES de cualquier ida a la red.
        // Estaba despues del chequeo de saturacion, dejando una ventana en la
        // que un doble clic creaba el evento dos veces (revision QA, M-4).
        var btnGuardar = actForm.querySelector('[type=submit]');
        if (btnGuardar) btnGuardar.disabled = true;
        try {
          // T073 (dilema D-4): la plataforma no arbitra choques entre
          // centros, pero exige ver la advertencia antes de agendar sobre una
          // fecha ya saturada para ese público — fricción mínima, no bloqueo.
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
            titulo: d.titulo, descripcion: d.descripcion, tipo: d.tipo, ramo: d.ramo,
            ubicacion: d.ubicacion, urlInscripcion: d.urlInscripcion || null,
            fechaInicio: d.fechaInicio, fechaFin: d.fechaFin, publico: publico,
          });
          localStorage.setItem(claveCtx(), JSON.stringify({
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
        finally { if (btnGuardar) btnGuardar.disabled = false; }
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
          toast(creadas + " fecha(s) publicadas en el calendario", allErr.length ? "error" : "success");
          box.innerHTML = '<p><strong>' + creadas + '</strong> fecha(s) publicadas como <span class="badge medio">PROPUESTA</span>' +
            (lotes.length > 1 ? ' (en ' + lotes.length + ' lotes)' : '') +
            '. Ya son visibles en el calendario; puedes eliminar cualquiera desde "Mis eventos".</p>' + renderErrores(allErr);
          document.getElementById("csvText").value = ""; document.getElementById("csvFile").value = "";
          cargarLista();
        } catch (err) { toast(err.message, "error"); }
        finally { btnImportar.disabled = false; }
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
