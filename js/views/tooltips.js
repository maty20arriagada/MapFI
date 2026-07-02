/* MapFI · js/views/tooltips.js — Tooltips contextuales (icono ?).
 * Agrega burbujas de ayuda junto a campos del formulario para guiar al usuario
 * en el momento preciso. Se activan con hover (desktop) o click (movil). */
(function (global) {
  "use strict";

  var TOOLTIPS = {
    "aCarreras": "Selecciona todas las carreras a las que aplica este evento. Ejemplo: Cálculo I lo cursan Industrial, Civil e Informática.",
    "aNiveles": "Elige los años académicos afectados. Un ramo de primer año solo impacta a la generación 1.",
    "aCarrera": "Selecciona la carrera a la que aplica este evento. Si afecta a varias, márcalas todas.",
    "fTipo": "Certamen: evaluación calificada. Charla: evento de difusión. Taller: actividad práctica. Entrega: fecha límite.",
    "btnPreview": "MapFI revisa si tu fecha choca con exámenes, clases o feriados del público seleccionado y te sugiere alternativas.",
  };

  var bubbleActual = null;

  function crearTrigger(id, texto) {
    var el = document.getElementById(id);
    if (!el || el.dataset.tooltipSetup) return;

    var parent = el.closest("label") || el.parentElement;
    if (!parent) return;

    var trigger = document.createElement("span");
    trigger.className = "tooltip-trigger";
    trigger.tabIndex = 0;
    trigger.setAttribute("role", "button");
    trigger.setAttribute("aria-label", "Ayuda: " + texto);
    trigger.textContent = "?";

    trigger.addEventListener("mouseenter", function () { mostrar(trigger, texto); });
    trigger.addEventListener("focus", function () { mostrar(trigger, texto); });
    trigger.addEventListener("mouseleave", ocultar);
    trigger.addEventListener("blur", function () { setTimeout(ocultar, 150); });
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      if (bubbleActual && bubbleActual.parentElement === trigger) ocultar();
      else mostrar(trigger, texto);
    });

    parent.appendChild(trigger);
    el.dataset.tooltipSetup = "1";
  }

  function mostrar(trigger, texto) {
    ocultar();
    var bubble = document.createElement("span");
    bubble.className = "tooltip-bubble";
    bubble.textContent = texto;
    trigger.appendChild(bubble);
    bubbleActual = bubble;

    var rect = bubble.getBoundingClientRect();
    if (rect.right > window.innerWidth - 16) bubble.style.left = "auto";
    if (rect.left < 8) bubble.style.left = "8px";
  }

  function ocultar() {
    if (bubbleActual) { bubbleActual.remove(); bubbleActual = null; }
  }

  function init() {
    Object.keys(TOOLTIPS).forEach(function (id) {
      crearTrigger(id, TOOLTIPS[id]);
    });
  }

  document.addEventListener("click", function (e) {
    if (bubbleActual && !e.target.closest(".tooltip-trigger")) ocultar();
  });

  global.Tooltips = { init: init, registrar: crearTrigger };
})(window);
