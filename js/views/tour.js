/* MapFI · js/views/tour.js — Recorrido guiado de 5 pasos.
 * Modal paso a paso que explica las funcionalidades principales de la plataforma.
 * Navegacion: clicks, flechas del teclado, Escape para cerrar. */
(function (global) {
  "use strict";

  var PASOS = [
    {
      titulo: "Tu panel",
      icono: "layout-dashboard",
      texto: "Aquí gestionas todas tus actividades. Haz clic en <strong>Nuevo evento</strong> para empezar. Las tarjetas superiores muestran tus KPIs: total de eventos, confiabilidad y reputación. También puedes descargar tu reporte de impacto en PDF.",
    },
    {
      titulo: "Crear un evento",
      icono: "clipboard-list",
      texto: "Completa título, tipo y fecha. Luego selecciona las <strong>carreras</strong> y <strong>años</strong> a los que afecta. Un certamen de Cálculo I puede marcar Industrial, Civil e Informática a la vez — así se crea una sola vez y aparece en los tres calendarios.",
    },
    {
      titulo: "Evaluar compatibilidad",
      icono: "target",
      texto: "Antes de confirmar, haz clic en <strong>Evaluar compatibilidad</strong>. MapFI revisa si tu fecha choca con exámenes, clases o feriados y te muestra un porcentaje. Si es bajo, te sugiere 3 horarios alternativos para esa misma semana.",
    },
    {
      titulo: "Importar desde Excel",
      icono: "file-text",
      texto: "¿Ya tienes todas las fechas del semestre? Descarga nuestra <strong>plantilla CSV</strong>, completa las columnas con tus datos y súbela. Tus fechas quedarán como propuestas para que el administrador las revise y confirme.",
    },
    {
      titulo: "El calendario público",
      icono: "calendar",
      texto: "Todo lo que publiques aparecerá en el <strong>calendario público</strong>. Los estudiantes pueden filtrar por su carrera y año. También está disponible el mapa de calor para visualizar qué días y semanas están más cargados de actividades.",
    },
  ];

  var pasoActual = 0;
  var overlay = null;

  function renderIcon(nombre) {
    // API real de icons.js: Icon(nombre, opts) → SVG con currentColor;
    // el color lo da el wrapper .tour-icon vía CSS.
    if (typeof global.Icon === "function") {
      return global.Icon(nombre, { size: 40 });
    }
    return "";
  }

  function construirOverlay() {
    overlay = document.createElement("div");
    overlay.className = "tour-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Recorrido guiado de MapFI");
    overlay.innerHTML =
      '<div class="tour-modal">' +
        '<div class="tour-steps">' +
          PASOS.map(function (_, i) {
            return '<span class="dot' + (i === 0 ? " active" : "") + '" aria-hidden="true"></span>';
          }).join("") +
        "</div>" +
        '<div class="tour-image">' +
          '<span class="tour-icon">' + renderIcon(PASOS[0].icono) + "</span>" +
        "</div>" +
        '<div class="tour-body">' +
          '<h2>' + PASOS[0].titulo + "</h2>" +
          '<p>' + PASOS[0].texto + "</p>" +
        "</div>" +
        '<div class="tour-footer">' +
          '<button class="btn secondary" id="tour-prev" disabled>Anterior</button>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn secondary" id="tour-skip">Saltar recorrido</button>' +
            '<button class="btn" id="tour-next">Siguiente</button>' +
          "</div>" +
        "</div>" +
      "</div>";

    document.body.appendChild(overlay);
    bindEventos();
  }

  function actualizarPaso() {
    var dots = overlay.querySelectorAll(".tour-steps .dot");
    dots.forEach(function (d, i) {
      d.className = "dot" + (i === pasoActual ? " active" : "");
    });
    overlay.querySelector(".tour-icon").innerHTML = renderIcon(PASOS[pasoActual].icono);
    overlay.querySelector(".tour-body h2").textContent = PASOS[pasoActual].titulo;
    overlay.querySelector(".tour-body p").innerHTML = PASOS[pasoActual].texto;

    var prev = document.getElementById("tour-prev");
    var next = document.getElementById("tour-next");
    prev.disabled = pasoActual === 0;
    next.textContent = pasoActual === PASOS.length - 1 ? "Finalizar" : "Siguiente";
  }

  function cerrar() {
    if (overlay) {
      overlay.remove();
      overlay = null;
      pasoActual = 0;
    }
    // Sin esto, cada apertura sumaba un listener y las flechas avanzaban doble.
    document.removeEventListener("keydown", manejarTeclado);
  }

  function bindEventos() {
    document.getElementById("tour-prev").onclick = function () {
      if (pasoActual > 0) { pasoActual--; actualizarPaso(); }
    };
    document.getElementById("tour-next").onclick = function () {
      if (pasoActual < PASOS.length - 1) { pasoActual++; actualizarPaso(); }
      else cerrar();
    };
    document.getElementById("tour-skip").onclick = cerrar;
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) cerrar();
    });
  }

  function manejarTeclado(e) {
    if (!overlay) return;
    if (e.key === "Escape") { cerrar(); return; }
    if (e.key === "ArrowRight" && pasoActual < PASOS.length - 1) { pasoActual++; actualizarPaso(); }
    if (e.key === "ArrowLeft" && pasoActual > 0) { pasoActual--; actualizarPaso(); }
  }

  function iniciar() {
    if (overlay) return;
    pasoActual = 0;
    construirOverlay();
    document.addEventListener("keydown", manejarTeclado);
  }

  global.Tour = { iniciar: iniciar, PASOS: PASOS };
})(window);
