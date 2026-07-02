/* MapFI · sanitize.js — helper anti-XSS para todo render con innerHTML.
 * Uso: escapeHtml(texto) antes de interpolar datos de usuario en templates. */
(function (global) {
  "use strict";

  var MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, function (ch) { return MAP[ch]; });
  }

  global.escapeHtml = escapeHtml;

  // Node/Jest (tests unitarios) — no existe window.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { escapeHtml: escapeHtml };
  }
})(typeof window !== "undefined" ? window : globalThis);
