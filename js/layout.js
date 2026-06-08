/* MapFI · layout.js — header (logo UdeC FI) + footer (GIIA) compartidos.
 * Centraliza la navegación: app-boot.js se encarga de marcar el link activo y
 * mostrar/ocultar segun sesion (.auth-only / .guest-only / .admin-only). */
(function (global) {
  "use strict";

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  const NAV = [
    { href: "calendario.html", icon: "calendar", label: "Calendario" },
    { href: "mapa-calor.html", icon: "bar-chart-3", label: "Mapa de calor" },
    { href: "match.html", icon: "target", label: "Match", cls: "auth-only" },
    { href: "dashboard.html", icon: "layout-dashboard", label: "Mi panel", cls: "auth-only" },
    { href: "kpis.html", icon: "pie-chart", label: "KPIs", cls: "admin-only" },
    { href: "admin.html", icon: "settings", label: "Admin", cls: "admin-only" },
    { href: "login.html", icon: "key", label: "Ingresar", cls: "guest-only" },
  ];

  function header() {
    const links = NAV.map((n) =>
      `<a href="${n.href}"${n.cls ? ` class="${n.cls}" hidden` : ""}>` +
      `<span class="icon" data-icon="${n.icon}"></span> ${n.label}</a>`
    ).join("");
    return el(`
      <header class="topbar">
        <div class="inner">
          <a href="index.html" class="brand" aria-label="MapFI - Facultad de Ingeniería UdeC">
            <img src="img/udec_FI.svg" alt="Facultad de Ingeniería · Universidad de Concepción" class="brand-logo" />
            <span class="brand-name">MapFI</span>
          </a>
          <nav>
            ${links}
            <span id="user-slot" class="auth-only muted" hidden></span>
            <button class="btn secondary auth-only" id="logoutBtn" hidden>
              <span class="icon" data-icon="log-out"></span> Salir
            </button>
            <button class="btn-icon" id="themeBtn" aria-label="Cambiar tema" title="Cambiar tema">
              <span class="icon" data-icon="moon"></span>
            </button>
          </nav>
        </div>
      </header>`);
  }

  function footer() {
    return el(`
      <footer class="site-footer">
        <div class="inner">
          <div>MapFI · Facultad de Ingeniería · Universidad de Concepción</div>
          <div class="credits">Desarrollado por
            <img src="img/GIIA.png" alt="GIIA - Grupo de Investigación" class="giia-logo" /></div>
        </div>
      </footer>`);
  }

  function init() {
    if (document.querySelector(".topbar")) return; // evitar duplicado
    const head = header();
    document.body.insertBefore(head, document.body.firstChild);
    document.body.appendChild(footer());

    if (global.Icons && global.Icons.hydrate) global.Icons.hydrate(head);

    const tb = document.getElementById("themeBtn");
    if (tb) tb.addEventListener("click", function () { if (global.toggleTheme) global.toggleTheme(); });
    const lb = document.getElementById("logoutBtn");
    if (lb) lb.addEventListener("click", global.logout);
  }

  global.logout = async function () {
    try { await api.post("/api/auth/logout"); } catch (_) {}
    location.href = "index.html";
  };

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})(window);
