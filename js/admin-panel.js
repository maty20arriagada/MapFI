/* MapFI · admin-panel.js — CRUD de catálogos para administradores. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const opt = (value, label) => `<option value="${value}">${label}</option>`;

  function tabla(cont, rows, cols) {
    if (!rows || !rows.length) { cont.innerHTML = '<p class="muted">Sin registros.</p>'; return; }
    cont.innerHTML =
      `<table><thead><tr>${cols.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows.map((r) =>
        `<tr>${cols.map((c) => `<td>${c.get ? c.get(r) : (r[c.key] ?? "")}</td>`).join("")}</tr>`
      ).join("")}</tbody></table>`;
  }

  async function cargar() {
    const cat = await api.get("/api/catalogos");

    // ── Selects ───────────────────────────────────────────────────────────────
    $("uEntidad").innerHTML = '<option value="">— sin entidad —</option>' + cat.entidades.map((e) => opt(e.id, e.nombre)).join("");
    $("eCarrera").innerHTML = '<option value="">— ninguna —</option>' + cat.carreras.map((c) => opt(c.id, c.nombre)).join("");
    $("bCarrera").innerHTML = cat.carreras.map((c) => opt(c.id, c.nombre)).join("");
    $("bNivel").innerHTML = cat.generaciones.map((g) => opt(g.nivel, g.etiqueta)).join("");

    // ── Tablas ────────────────────────────────────────────────────────────────
    tabla($("tablaEntidades"), cat.entidades, [
      { label: "ID", key: "id" }, { label: "Tipo", key: "tipo" }, { label: "Nombre", key: "nombre" },
    ]);
    tabla($("tablaCarreras"), cat.carreras, [
      { label: "ID", key: "id" }, { label: "Código", key: "codigo" }, { label: "Nombre", key: "nombre" },
      { label: "Color", get: (r) => `<span style="background:${r.color};width:24px;height:16px;border-radius:4px;display:inline-block"></span>` },
    ]);

    const usuarios = await api.get("/api/admin/usuarios");
    tabla($("tablaUsuarios"), usuarios, [
      { label: "ID", key: "id" }, { label: "Correo", key: "email" }, { label: "Nombre", key: "nombre" },
      { label: "Rol", key: "rol" }, { label: "Entidad", key: "entidad_id" },
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

    const bloques = await api.get("/api/bloques");
    const dias = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie" };
    tabla($("tablaBloques"), bloques, [
      { label: "Carrera", key: "carrera_id" }, { label: "Año", key: "nivel" },
      { label: "Día", get: (r) => dias[r.dia_semana] || r.dia_semana },
      { label: "Inicio", get: (r) => String(r.hora_inicio).slice(0, 5) },
      { label: "Fin", get: (r) => String(r.hora_fin).slice(0, 5) },
      { label: "Tipo", key: "tipo" },
      { label: "", get: (r) => `<button class="btn secondary" data-act="del-bloque" data-id="${r.id}">Eliminar</button>` },
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
      tipo: d.tipo, nombre: d.nombre, carreraId: d.carreraId ? +d.carreraId : null,
    }));
    form("formCarrera", (d) => api.post("/api/admin/carreras", {
      id: +d.id, codigo: d.codigo, nombre: d.nombre, color: d.color,
    }));
    form("formPeriodo", (d) => api.post("/api/admin/periodos", {
      anio: +d.anio, semestre: +d.semestre, fechaInicio: d.fechaInicio, fechaFin: d.fechaFin,
    }));
    form("formBloque", (d) => api.post("/api/bloques", {
      carreraId: +d.carreraId, nivel: +d.nivel, diaSemana: +d.diaSemana,
      horaInicio: d.horaInicio, horaFin: d.horaFin, tipo: d.tipo,
    }));

    // Acciones delegadas (activar periodo / eliminar bloque).
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const id = +btn.dataset.id;
      try {
        if (btn.dataset.act === "activar-periodo") await api.post(`/api/admin/periodos/${id}/activar`);
        if (btn.dataset.act === "del-bloque") await api.del(`/api/bloques/${id}`);
        toast("Listo", "success"); cargar();
      } catch (err) { toast(err.message, "error"); }
    });
  });
})();
