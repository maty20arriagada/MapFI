/* MapFI · views/event-table.js — tabla "Mis Eventos" con edición inline (§16.3).
 * Gestión rápida de las actividades propias: editar fecha/estado, eliminar. */
(function (global) {
  "use strict";

  const esc = global.escapeHtml || ((s) => s);
  const ESTADOS = ["PROPUESTA", "CONFIRMADA", "REALIZADA", "SUSPENDIDA", "REPROGRAMADA"];
  const BADGE = { CONFIRMADA: "alto", REALIZADA: "alto", PROPUESTA: "medio", REPROGRAMADA: "medio", SUSPENDIDA: "bajo" };

  function toLocalInput(d) {
    const x = new Date(d), p = (n) => String(n).padStart(2, "0");
    return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate()) + "T" + p(x.getHours()) + ":" + p(x.getMinutes());
  }
  const fmtFecha = (d) =>
    new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  async function montar(el, entidadId, onChange) {
    let acts = [];
    try {
      acts = await api.get("/api/actividades?entidadId=" + entidadId);
    } catch (e) {
      el.innerHTML = '<div class="placeholder">No se pudieron cargar tus eventos.</div>';
      return;
    }
    if (!acts.length) {
      el.innerHTML = '<div class="placeholder">Aún no tienes eventos. Crea el primero con "Nuevo evento".</div>';
      return;
    }

    el.innerHTML =
      `<table class="event-table"><thead><tr>
         <th>Título</th><th>Ramo</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th></th>
       </tr></thead><tbody>` +
      acts.map((a) => filaHtml(a)).join("") +
      "</tbody></table>";

    // Delegación de eventos (editar / guardar / cancelar / eliminar).
    el.onclick = async (ev) => {
      const btn = ev.target.closest("[data-act]");
      if (!btn) return;
      const tr = btn.closest("tr");
      const id = +tr.dataset.id;
      const act = acts.find((a) => a.id === id);

      if (btn.dataset.act === "editar") {
        tr.outerHTML = filaEdicionHtml(act);
        if (global.Icons) Icons.hydrate(el);
      } else if (btn.dataset.act === "cancelar") {
        tr.outerHTML = filaHtml(act);
        if (global.Icons) Icons.hydrate(el);
      } else if (btn.dataset.act === "guardar") {
        const fi = tr.querySelector("[name=fi]").value;
        const ff = tr.querySelector("[name=ff]").value;
        const estado = tr.querySelector("[name=estado]").value;
        try {
          await api.put("/api/actividades/" + id, { fechaInicio: fi, fechaFin: ff, estado });
          toast("Evento actualizado", "success");
          montar(el, entidadId, onChange);
          if (onChange) onChange();
        } catch (e) { toast(e.message, "error"); }
      } else if (btn.dataset.act === "eliminar") {
        if (!confirm(`¿Eliminar "${act.titulo}"? Esta acción no se puede deshacer.`)) return;
        try {
          await api.del("/api/actividades/" + id);
          toast("Evento eliminado", "success");
          montar(el, entidadId, onChange);
          if (onChange) onChange();
        } catch (e) { toast(e.message, "error"); }
      }
    };

    if (global.Icons) Icons.hydrate(el);
  }

  function filaHtml(a) {
    return `<tr data-id="${a.id}">
      <td><strong>${esc(a.titulo)}</strong></td>
      <td class="muted">${esc(a.ramo || "—")}</td>
      <td>${esc(a.tipo)}</td>
      <td>${fmtFecha(a.fecha_inicio)}</td>
      <td><span class="badge ${BADGE[a.estado] || "medio"}">${esc(a.estado)}</span></td>
      <td class="acciones">
        <button class="btn-icon" data-act="editar" title="Editar" aria-label="Editar"><span class="icon" data-icon="pencil"></span></button>
        <button class="btn-icon" data-act="eliminar" title="Eliminar" aria-label="Eliminar"><span class="icon" data-icon="trash-2"></span></button>
      </td>
    </tr>`;
  }

  function filaEdicionHtml(a) {
    return `<tr data-id="${a.id}" class="editando">
      <td colspan="4">
        <strong>${esc(a.titulo)}</strong>
        <div class="row" style="margin-top:8px">
          <div><label>Inicio</label><input type="datetime-local" name="fi" value="${toLocalInput(a.fecha_inicio)}" /></div>
          <div><label>Fin</label><input type="datetime-local" name="ff" value="${toLocalInput(a.fecha_fin)}" /></div>
        </div>
      </td>
      <td><label>Estado</label>
        <select name="estado">${ESTADOS.map((e) => `<option${e === a.estado ? " selected" : ""}>${e}</option>`).join("")}</select>
      </td>
      <td class="acciones">
        <button class="btn" data-act="guardar" title="Guardar"><span class="icon" data-icon="save"></span></button>
        <button class="btn secondary" data-act="cancelar" title="Cancelar"><span class="icon" data-icon="circle-x"></span></button>
      </td>
    </tr>`;
  }

  global.EventTable = { montar };
})(window);
