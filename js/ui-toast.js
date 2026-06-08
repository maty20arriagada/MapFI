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
    el.textContent = msg;
    root().appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };
})(window);
