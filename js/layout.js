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
    { href: "horarios.html", icon: "book-open", label: "Horarios" },
    { href: "mapa-calor.html", icon: "bar-chart-3", label: "Mapa de calor" },
    { href: "match.html", icon: "target", label: "Match", cls: "auth-only" },
    { href: "dashboard.html", icon: "layout-dashboard", label: "Mi panel", cls: "auth-only" },
    { href: "kpis.html", icon: "pie-chart", label: "KPIs", cls: "admin-only" },
    { href: "admin.html", icon: "settings", label: "Admin", cls: "admin-only" },
    { href: "ayuda.html", icon: "help-circle", label: "Ayuda" },
    { href: "login.html", icon: "key", label: "Ingresar", cls: "guest-only" },
  ];

  function header() {
    const links = NAV.map((n) => {
      // auth-only / admin-only parten ocultos; guest-only parte visible
      // (degrada bien si la API tarda o falla).
      const hide = n.cls && n.cls !== "guest-only" ? " hidden" : "";
      const cls = n.cls ? ` class="${n.cls}"` : "";
      return `<a href="${n.href}"${cls}${hide}><span class="icon" data-icon="${n.icon}"></span> ${n.label}</a>`;
    }).join("");
    return el(`
      <header class="topbar">
        <div class="inner">
          <a href="index.html" class="brand" aria-label="MapFI - Facultad de Ingeniería UdeC">
            <img src="img/udec_FI.svg" alt="Facultad de Ingeniería · Universidad de Concepción" class="brand-logo" />
            <span class="brand-name">MapFI</span>
          </a>
          <nav>
            ${links}
            <a href="cuenta.html" id="user-slot" class="auth-only" hidden title="Mi cuenta"></a>
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

  function skipLink() {
    return el(`<a href="#main-content" class="skip-link">Saltar al contenido</a>`);
  }

  function footer() {
    return el(`
      <footer class="site-footer">
        <div class="inner">
          <div class="foot-brand">
            <strong>MapFI</strong> · Plataforma de Mapeo de Actividades<br />
            <span class="muted">Facultad de Ingeniería · Universidad de Concepción</span>
          </div>
          <div class="credits">
            <span>Impulsado por CEEIND 2026 · Plan Estratégico 2030<br /><span class="muted">Desarrollado en colaboración con</span></span>
            <img src="img/GIIA.svg" alt="GIIA - Grupo de Interés en Inteligencia Artificial UdeC" class="giia-logo" />
          </div>
        </div>
        <div class="foot-bottom">© <span id="footYear"></span> CEEIND &amp; GIIA · Facultad de Ingeniería · Universidad de Concepción</div>
      </footer>`);
  }

  function init() {
    if (document.querySelector(".topbar")) return; // evitar duplicado
    const head = header();
    document.body.insertBefore(head, document.body.firstChild);
    // T072 (Backlog 2.2, WCAG): la clase .skip-link ya existía en el sistema
    // de diseño pero no se usaba en ninguna página — se inyecta aquí, una
    // sola vez, para todas las páginas que cargan layout.js.
    document.body.insertBefore(skipLink(), head);
    const main = document.querySelector("main");
    if (main && !main.id) main.id = "main-content";
    document.body.appendChild(footer());

    const fy = document.getElementById("footYear");
    if (fy) fy.textContent = new Date().getFullYear();

    if (global.Icons && global.Icons.hydrate) global.Icons.hydrate(head);

    const tb = document.getElementById("themeBtn");
    if (tb) tb.addEventListener("click", function () { if (global.toggleTheme) global.toggleTheme(); });
    const lb = document.getElementById("logoutBtn");
    if (lb) lb.addEventListener("click", global.logout);
  }

  global.logout = async function () {
    // T067 (H-12): limpiar las claves de localStorage asociadas a ESTA
    // cuenta antes de cerrar sesión — en un computador compartido de la
    // sede no deben quedar visibles ni reutilizarse por la siguiente
    // cuenta que inicie sesión en el mismo equipo (E-11).
    try {
      const { user } = await api.get("/api/auth/me");
      if (user && user.id) {
        localStorage.removeItem("mapfi-onboarding-done-" + user.id);
        localStorage.removeItem("mapfi-evento-ctx-" + user.id);
      }
    } catch (_) {}
    try { await api.post("/api/auth/logout"); } catch (_) {}
    location.href = "index.html";
  };

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})(window);
