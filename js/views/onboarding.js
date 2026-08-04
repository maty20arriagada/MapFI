/* MapFI · js/views/onboarding.js — Banner de bienvenida (primer login).
 * Se muestra una sola vez por CUENTA (T067, H-12): en un computador
 * compartido de la sede, si la clave fuera solo por navegador, la primera
 * persona que la descarta se la ocultaría a todas las demás cuentas que
 * inicien sesión despues en ese mismo equipo (E-11).
 * Ofrece iniciar el tour guiado o saltar. Sin emojis: iconos de icons.js. */
(function (global) {
  "use strict";

  function claveOnboarding(user) { return "mapfi-onboarding-done-" + user.id; }
  var esc = global.escapeHtml || function (s) { return s == null ? "" : String(s); };
  // API real de icons.js: Icon(nombre, opts) → string SVG (devuelve "" si no existe).
  var icon = function (nombre, size) {
    return typeof global.Icon === "function" ? global.Icon(nombre, { size: size || 18 }) : "";
  };

  function mostrar(user, onTour) {
    if (!user || !user.nombre || !user.id) return;
    var storageKey = claveOnboarding(user);
    if (localStorage.getItem(storageKey)) return;

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
      localStorage.setItem(storageKey, "1");
      banner.remove();
    };
    document.getElementById("ob-tour").onclick = function () {
      localStorage.setItem(storageKey, "1");
      banner.remove();
      if (typeof onTour === "function") onTour();
      else if (global.Tour && global.Tour.iniciar) global.Tour.iniciar();
    };
  }

  global.Onboarding = { mostrar: mostrar };
})(window);
