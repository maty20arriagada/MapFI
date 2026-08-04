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

    // ── Pendientes de revision (importaciones de los centros, §16.5) ──────────
    const pendientes = await api.get("/api/admin/pendientes");
    const accionesBar = $("pendAcciones");
    if (accionesBar) accionesBar.hidden = !pendientes.length;
    if (!pendientes.length) {
      $("tablaPendientes").innerHTML = '<p class="muted">No hay fechas pendientes de revisión.</p>';
    } else {
      const fmtF = (d) => new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      $("tablaPendientes").innerHTML =
        `<table><thead><tr>
           <th><input type="checkbox" id="pendTodos" title="Seleccionar todo" /></th>
           <th>Título</th><th>Ramo</th><th>Tipo</th><th>Fecha</th><th>Entidad</th>
         </tr></thead><tbody>` +
        pendientes.map((p) =>
          `<tr><td><input type="checkbox" class="pend-check" value="${p.id}" /></td>
             <td><strong>${esc(p.titulo)}</strong></td>
             <td class="muted">${esc(p.ramo || "—")}</td>
             <td>${esc(p.tipo)}</td>
             <td>${fmtF(p.fecha_inicio)}</td>
             <td>${esc(p.entidad_sigla || p.entidad_nombre)}</td></tr>`
        ).join("") + "</tbody></table>";
      const todos = $("pendTodos");
      if (todos) todos.onchange = () =>
        document.querySelectorAll(".pend-check").forEach((c) => (c.checked = todos.checked));
    }

    // ── Actividades retiradas/archivadas (T029, FR-004) ────────────────────────
    const retiradas = await api.get("/api/admin/actividades/retiradas");
    if (!retiradas.length) {
      $("tablaRetiradas").innerHTML = '<p class="muted">No hay actividades retiradas.</p>';
    } else {
      const fmtF = (d) => new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      $("tablaRetiradas").innerHTML =
        `<table><thead><tr>
           <th>Título</th><th>Entidad</th><th>Fecha</th><th>Motivo</th><th>Retirada</th><th></th>
         </tr></thead><tbody>` +
        retiradas.map((r) =>
          `<tr><td><strong>${esc(r.titulo)}</strong></td>
             <td>${esc(r.entidad_sigla || r.entidad_nombre)}</td>
             <td>${fmtF(r.fecha_inicio)}</td>
             <td class="muted">${esc(r.motivo_retiro || "—")}</td>
             <td class="muted">${r.retirada_en ? fmtF(r.retirada_en) : "—"}</td>
             <td><button class="btn secondary" data-act="restituir-actividad" data-id="${r.id}">${Icon("refresh-cw", { size: 16 })} Restituir</button></td></tr>`
        ).join("") + "</tbody></table>";
    }

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
    // Revision en bloque de pendientes (aprobar/rechazar seleccionadas).
    document.addEventListener("click", async (e) => {
      const rev = e.target.closest("[data-rev]");
      if (!rev) return;
      const ids = [...document.querySelectorAll(".pend-check:checked")].map((c) => +c.value);
      if (!ids.length) return toast("Selecciona al menos una fila", "error");
      const accion = rev.dataset.rev;
      if (accion === "RECHAZAR" && !confirm(`¿Retirar ${ids.length} fecha(s) del calendario público? Quedan suspendidas y ya no se muestran (puedes restituirlas después).`)) return;
      try {
        const r = await api.post("/api/admin/actividades/revisar", { ids, accion });
        toast(`${r.actualizadas} fecha(s) ${accion === "APROBAR" ? "ratificadas" : "retiradas"}`, "success");
        cargar();
      } catch (err) { toast(err.message, "error"); }
    });

    // Acciones delegadas (activar periodo / activar-desactivar cuenta).
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const id = +btn.dataset.id;
      try {
        if (btn.dataset.act === "activar-periodo") await api.post(`/api/admin/periodos/${id}/activar`);
        if (btn.dataset.act === "toggle-usuario") {
          const vaAActivar = btn.dataset.activo !== "true";
          // T060 (H-06): desactivar corta el acceso DE INMEDIATO (incluida
          // cualquier sesión ya abierta), no solo en el próximo login.
          if (!vaAActivar) {
            const ok = window.confirmDialog
              ? await window.confirmDialog({
                  titulo: "Desactivar cuenta",
                  mensaje: "El acceso se corta de inmediato: si esa cuenta tiene una sesión abierta, su próxima acción quedará rechazada.",
                  textoConfirmar: "Desactivar",
                })
              : confirm("¿Desactivar esta cuenta? El acceso se corta de inmediato, incluso si ya tiene una sesión abierta.");
            if (!ok) return;
          }
          await api.patch(`/api/admin/usuarios/${id}`, { activo: vaAActivar });
        }
        if (btn.dataset.act === "restituir-actividad") await api.post(`/api/admin/actividades/${id}/restituir`);
        toast("Listo", "success"); cargar();
      } catch (err) { toast(err.message, "error"); }
    });
  });
})();
