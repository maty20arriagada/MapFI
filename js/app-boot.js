/* MapFI · app-boot.js — arranque comun de todas las paginas. */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", async function () {
    // 1) Hidratar iconos declarativos [data-icon] (js/icons.js).
    if (window.Icons && typeof Icons.hydrate === "function") Icons.hydrate(document);

    // 2) Marcar el enlace activo del nav.
    const here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".topbar nav a").forEach((a) => {
      if (a.getAttribute("href") === here) a.classList.add("active");
    });

    // 3) Estado de sesion → mostrar/ocultar zonas .auth-only / .guest-only.
    try {
      const { user } = await api.get("/api/auth/me");
      const esAdmin = !!user && user.rol === "ADMIN";
      document.body.dataset.auth = user ? "si" : "no";
      document.body.dataset.rol = user ? user.rol : "";
      document.querySelectorAll(".auth-only").forEach((e) => (e.hidden = !user));
      document.querySelectorAll(".guest-only").forEach((e) => (e.hidden = !!user));
      document.querySelectorAll(".admin-only").forEach((e) => (e.hidden = !esAdmin));
      const slot = document.getElementById("user-slot");
      if (slot && user) slot.textContent = user.nombre;
    } catch (_) {
      /* sin backend disponible: la pagina queda en modo invitado */
    }
  });
})();
