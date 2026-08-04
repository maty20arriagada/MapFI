/* MapFI · views/event-table.js — tabla "Mis Eventos" con edición inline (§16.3).
 * Gestión rápida de las actividades propias: editar fecha/estado, eliminar. */
(function (global) {
  "use strict";

  const esc = global.escapeHtml || ((s) => s);

  // Transiciones que el SERVIDOR acepta de un aportante sobre lo suyo
  // (ver ESTADOS_APORTANTE en server.js). Antes se ofrecian los cinco
  // estados: tres de ellos siempre terminaban en un 403 desconcertante
  // (revision QA, hallazgo M-3). El admin sigue pudiendo todos.
  const ESTADOS_APORTANTE = ["SUSPENDIDA", "REPROGRAMADA"];
  const ESTADOS_ADMIN = ["PROPUESTA", "CONFIRMADA", "REALIZADA", "SUSPENDIDA", "REPROGRAMADA"];
  // ARCHIVADA no es elegible a mano (se llega archivando y se sale
  // restituyendo, y eso es cosa del admin), pero el autor SI ve sus
  // actividades archivadas, asi que necesita insignia propia.
  const BADGE = {
    CONFIRMADA: "alto", REALIZADA: "alto", PROPUESTA: "medio",
    REPROGRAMADA: "medio", SUSPENDIDA: "bajo", ARCHIVADA: "bajo",
  };

  /** Opciones de estado que tiene sentido ofrecer, segun rol y estado actual. */
  function estadosElegibles(esAdmin, estadoActual) {
    const base = esAdmin ? ESTADOS_ADMIN : ESTADOS_APORTANTE;
    // El estado actual siempre debe aparecer, aunque no sea elegible: si no,
    // el <select> mostraria otro valor y "guardar" lo cambiaria sin querer.
    return base.includes(estadoActual) ? base : [estadoActual].concat(base);
  }

  function toLocalInput(d) {
    const x = new Date(d), p = (n) => String(n).padStart(2, "0");
    return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate()) + "T" + p(x.getHours()) + ":" + p(x.getMinutes());
  }
  const fmtFecha = (d) =>
    new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  /** @param {{esAdmin?:boolean}} [opts] */
  async function montar(el, entidadId, onChange, opts) {
    const esAdmin = !!(opts && opts.esAdmin);
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
        tr.outerHTML = filaEdicionHtml(act, esAdmin);
        if (global.Icons) Icons.hydrate(el);
      } else if (btn.dataset.act === "cancelar") {
        tr.outerHTML = filaHtml(act);
        if (global.Icons) Icons.hydrate(el);
      } else if (btn.dataset.act === "guardar") {
        const fi = tr.querySelector("[name=fi]").value;
        const ff = tr.querySelector("[name=ff]").value;
        const estado = tr.querySelector("[name=estado]").value;
        const btnGuardar = tr.querySelector('[data-act="guardar"]');
        if (btnGuardar) btnGuardar.disabled = true;
        try {
          await api.put("/api/actividades/" + id, { fechaInicio: fi, fechaFin: ff, estado });
          toast("Evento actualizado", "success");
          montar(el, entidadId, onChange, opts);
          if (onChange) onChange();
        } catch (e) {
          toast(e.message, "error");
          if (btnGuardar) btnGuardar.disabled = false;
        }
      } else if (btn.dataset.act === "eliminar") {
        // FR-011: el mensaje debe reflejar el comportamiento real — ya no es
        // un borrado definitivo, se archiva y un administrador puede
        // restituirlo (E-07).
        const confirmar = global.confirmDialog
          ? global.confirmDialog({
              titulo: "Archivar actividad",
              mensaje: `"${act.titulo}" se archivará y dejará de mostrarse en el calendario. No se borra: un administrador puede restituirla después.`,
              textoConfirmar: "Archivar",
            })
          : Promise.resolve(confirm(`¿Archivar "${act.titulo}"? Deja de mostrarse, pero puede restituirse después.`));
        if (!(await confirmar)) return;
        try {
          await api.del("/api/actividades/" + id);
          toast("Evento archivado", "success");
          montar(el, entidadId, onChange, opts);
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
        <button class="btn-icon" data-act="eliminar" title="Archivar" aria-label="Archivar"><span class="icon" data-icon="trash-2"></span></button>
      </td>
    </tr>`;
  }

  function filaEdicionHtml(a, esAdmin) {
    const opciones = estadosElegibles(esAdmin, a.estado);
    return `<tr data-id="${a.id}" class="editando">
      <td colspan="4">
        <strong>${esc(a.titulo)}</strong>
        <div class="row" style="margin-top:8px">
          <div><label>Inicio</label><input type="datetime-local" name="fi" value="${toLocalInput(a.fecha_inicio)}" /></div>
          <div><label>Fin</label><input type="datetime-local" name="ff" value="${toLocalInput(a.fecha_fin)}" /></div>
        </div>
      </td>
      <td><label>Estado</label>
        <select name="estado">${opciones.map((e) => `<option${e === a.estado ? " selected" : ""}>${esc(e)}</option>`).join("")}</select>
      </td>
      <td class="acciones">
        <button class="btn" data-act="guardar" title="Guardar"><span class="icon" data-icon="save"></span></button>
        <button class="btn secondary" data-act="cancelar" title="Cancelar"><span class="icon" data-icon="circle-x"></span></button>
      </td>
    </tr>`;
  }

  global.EventTable = { montar };
})(window);
