/* MapFI · ui-toast.js — notificaciones efimeras. */
(function (global) {
  "use strict";

  function root() {
    let r = document.getElementById("toast-root");
    if (!r) {
      r = document.createElement("div");
      r.id = "toast-root";
      document.body.appendChild(r);
    }
    return r;
  }

  /** toast('Guardado', 'success' | 'error') */
  global.toast = function toast(msg, type) {
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.setAttribute("role", "status");
    // Los errores interrumpen al lector de pantalla (assertive); el resto
    // se anuncia sin interrumpir la tarea en curso (polite).
    el.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    el.textContent = msg;
    root().appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };
})(window);
