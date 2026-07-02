/* MapFI · js/views/onboarding.js — Banner de bienvenida (primer login).
 * Muestra un mensaje de bienvenida personalizado la primera vez que el usuario
 * inicia sesion. Control por localStorage (mapfi-onboarding-done).
 * Ofrece iniciar el tour guiado o saltar. */
(function (global) {
  "use strict";

  var STORAGE_KEY = "mapfi-onboarding-done";

  function mostrar(user, onTour) {
    if (!user || !user.nombre) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    var banner = document.createElement("div");
    banner.className = "onboarding-banner";
    banner.setAttribute("role", "alert");
    banner.innerHTML =
      '<div class="ob-icon" aria-hidden="true">' +
        (global.Icons ? global.Icons.render("hand", { size: 28, color: "var(--gold)" }) : "👋") +
      "</div>" +
      '<div class="ob-body">' +
        '<h3>¡Bienvenido a MapFI, ' + escapeHtml(user.nombre.split(" ")[0]) + "!</h3>" +
        '<p class="muted">Esta plataforma centraliza todas las actividades de la Facultad de Ingeniería. Como Centro de Estudiantes puedes:</p>' +
        "<ul>" +
          "<li>📅 Publicar certámenes, charlas y talleres</li>" +
          "<li>📥 Importar tu calendario desde Excel</li>" +
          "<li>🎯 Evaluar si una fecha choca con otros eventos</li>" +
        "</ul>" +
      "</div>" +
      '<div class="ob-actions">' +
        '<button class="btn gold" id="ob-tour">Comenzar recorrido guiado</button>' +
        '<button class="btn secondary" id="ob-skip">Entendido</button>' +
      "</div>";

    var main = document.querySelector("main .section.auth-only, main .container > .section:first-of-type, main");
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

  function escapeHtml(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  global.Onboarding = { mostrar: mostrar };
})(window);
