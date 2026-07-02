/* MapFI · js/views/onboarding.js — Banner de bienvenida (primer login).
 * Se muestra una sola vez por navegador (localStorage: mapfi-onboarding-done).
 * Ofrece iniciar el tour guiado o saltar. Sin emojis: iconos de icons.js. */
(function (global) {
  "use strict";

  var STORAGE_KEY = "mapfi-onboarding-done";
  var esc = global.escapeHtml || function (s) { return s == null ? "" : String(s); };
  // API real de icons.js: Icon(nombre, opts) → string SVG (devuelve "" si no existe).
  var icon = function (nombre, size) {
    return typeof global.Icon === "function" ? global.Icon(nombre, { size: size || 18 }) : "";
  };

  function mostrar(user, onTour) {
    if (!user || !user.nombre) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    var banner = document.createElement("div");
    banner.className = "onboarding-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Bienvenida a MapFI");
    banner.innerHTML =
      '<div class="ob-icon" aria-hidden="true">' + icon("sparkles", 28) + "</div>" +
      '<div class="ob-body">' +
        "<h3>¡Bienvenido a MapFI, " + esc(user.nombre.split(" ")[0]) + "!</h3>" +
        '<p class="muted">Esta plataforma centraliza todas las actividades de la Facultad de Ingeniería. Como entidad aportante puedes:</p>' +
        '<ul class="ob-list">' +
          "<li>" + icon("calendar") + " Publicar certámenes, charlas y talleres</li>" +
          "<li>" + icon("file-text") + " Importar tu calendario desde Excel</li>" +
          "<li>" + icon("target") + " Evaluar si una fecha choca con otros eventos</li>" +
        "</ul>" +
      "</div>" +
      '<div class="ob-actions">' +
        '<button class="btn gold" id="ob-tour">Comenzar recorrido guiado</button>' +
        '<button class="btn secondary" id="ob-skip">Entendido</button>' +
      "</div>";

    var main = document.querySelector("main .section.auth-only") ||
               document.querySelector("main .container > .section") ||
               document.querySelector("main");
    if (main) main.insertBefore(banner, main.firstChild);
    else document.body.insertBefore(banner, document.body.firstChild);

    document.getElementById("ob-skip").onclick = function () {
      localStorage.setItem(STORAGE_KEY, "1");
      banner.remove();
    };
    document.getElementById("ob-tour").onclick = function () {
      localStorage.setItem(STORAGE_KEY, "1");
      banner.remove();
      if (typeof onTour === "function") onTour();
      else if (global.Tour && global.Tour.iniciar) global.Tour.iniciar();
    };
  }

  global.Onboarding = { mostrar: mostrar };
})(window);
