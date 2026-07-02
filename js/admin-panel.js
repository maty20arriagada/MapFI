/* MapFI · admin-panel.js — CRUD de catálogos para administradores. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = window.escapeHtml || ((s) => s);
  const opt = (value, label) => `<option value="${value}">${esc(label)}</option>`;

  function tabla(cont, rows, cols) {
    if (!rows || !rows.length) { cont.innerHTML = '<p class="muted">Sin registros.</p>'; return; }
    // Las celdas por `key` se escapan siempre; los `get` devuelven HTML propio
    // y deben escapar internamente los datos de usuario que interpolen.
    cont.innerHTML =
      `<table><thead><tr>${cols.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows.map((r) =>
        `<tr>${cols.map((c) => `<td>${c.get ? c.get(r) : esc(r[c.key] ?? "")}</td>`).join("")}</tr>`
      ).join("")}</tbody></table>`;
  }

  async function cargar() {
    const cat = await api.get("/api/catalogos");

    // ── Selects ───────────────────────────────────────────────────────────────
    $("uEntidad").innerHTML = '<option value="">— sin entidad (admin) —</option>' +
      cat.entidades.map((e) => opt(e.id, (e.sigla ? e.sigla + " — " : "") + e.nombre)).join("");
    $("eCarrera").innerHTML = '<option value="">— ninguna —</option>' + cat.carreras.map((c) => opt(c.id, c.nombre)).join("");

    // ── Tablas ────────────────────────────────────────────────────────────────
    tabla($("tablaEntidades"), cat.entidades, [
      { label: "Sigla", get: (r) => `<strong>${esc(r.sigla || "—")}</strong>` },
      { label: "Nombre", key: "nombre" },
      { label: "Tipo", key: "tipo" },
    ]);
    tabla($("tablaCarreras"), cat.carreras, [
      { label: "ID", key: "id" }, { label: "Código", key: "codigo" }, { label: "Nombre", key: "nombre" },
      { label: "Color", get: (r) => `<span style="background:${r.color};width:24px;height:16px;border-radius:4px;display:inline-block"></span>` },
    ]);

    const usuarios = await api.get("/api/admin/usuarios");
    tabla($("tablaUsuarios"), usuarios, [
      { label: "Cuenta", get: (r) => `<strong>${esc(r.entidad_sigla || "—")}</strong><div class="muted" style="font-size:.78rem">${esc(r.entidad_nombre || "Administración")}</div>` },
      { label: "Usuario", get: (r) => `${esc(r.nombre)}<div class="muted" style="font-size:.78rem">${esc(r.email)}</div>` },
      { label: "Rol", key: "rol" },
      { label: "Estado", get: (r) => (r.activo ? '<span class="badge alto">Activa</span>' : '<span class="badge bajo">Inactiva</span>') },
      { label: "Acción", get: (r) => `<button class="btn secondary" data-act="toggle-usuario" data-id="${r.id}" data-activo="${r.activo}">${r.activo ? "Desactivar" : "Activar"}</button>` },
    ]);

    const periodos = await api.get("/api/periodos");
    tabla($("tablaPeriodos"), periodos, [
      { label: "Año", key: "anio" }, { label: "Sem", key: "semestre" },
      { label: "Inicio", get: (r) => String(r.fecha_inicio).slice(0, 10) },
      { label: "Fin", get: (r) => String(r.fecha_fin).slice(0, 10) },
      { label: "Activo", get: (r) => r.activo
          ? '<span style="color:var(--verde)">' + Icon("circle-check", { size: 18 }) + "</span>"
          : `<button class="btn secondary" data-act="activar-periodo" data-id="${r.id}">Activar</button>` },
    ]);

  }

  function form(id, handler) {
    const f = $(id);
    if (!f) return;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f).entries());
      try { await handler(d); toast("Guardado", "success"); f.reset(); cargar(); }
      catch (err) { toast(err.message || "Error", "error"); }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    let user = null;
    try { ({ user } = await api.get("/api/auth/me")); } catch (_) {}
    if (user && user.rol !== "ADMIN") { $("noAdmin").hidden = false; return; }
    if (!user) return; // app-boot ya muestra el mensaje de invitado

    await cargar();

    form("formUsuario", (d) => api.post("/api/admin/usuarios", {
      email: d.email, password: d.password, nombre: d.nombre, rol: d.rol,
      entidadId: d.entidadId ? +d.entidadId : null,
    }));
    form("formEntidad", (d) => api.post("/api/admin/entidades", {
      tipo: d.tipo, sigla: d.sigla || null, nombre: d.nombre, carreraId: d.carreraId ? +d.carreraId : null,
    }));
    form("formCarrera", (d) => api.post("/api/admin/carreras", {
      id: +d.id, codigo: d.codigo, nombre: d.nombre, color: d.color,
    }));
    form("formPeriodo", (d) => api.post("/api/admin/periodos", {
      anio: +d.anio, semestre: +d.semestre, fechaInicio: d.fechaInicio, fechaFin: d.fechaFin,
    }));
    // Acciones delegadas (activar periodo / activar-desactivar cuenta).
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const id = +btn.dataset.id;
      try {
        if (btn.dataset.act === "activar-periodo") await api.post(`/api/admin/periodos/${id}/activar`);
        if (btn.dataset.act === "toggle-usuario") await api.patch(`/api/admin/usuarios/${id}`, { activo: btn.dataset.activo !== "true" });
        toast("Listo", "success"); cargar();
      } catch (err) { toast(err.message, "error"); }
    });
  });
})();
