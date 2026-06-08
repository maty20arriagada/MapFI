/* MapFI · theme-toggle.js — modo claro/oscuro persistido. */
(function () {
  "use strict";
  const KEY = "mapfi-theme";
  const apply = (t) => document.documentElement.setAttribute("data-theme", t);

  const saved =
    localStorage.getItem(KEY) ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  apply(saved);

  window.toggleTheme = function () {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    apply(next);
  };
})();
