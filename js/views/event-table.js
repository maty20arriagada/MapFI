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
  // ARCHIVADA es el estado interno de lo ELIMINADO (no se renombro para no
  // arrastrar una migracion por un cambio de nombre). No es elegible a mano
  // desde el desplegable, pero el autor sigue viendo lo suyo eliminado, asi
  // que necesita insignia propia.
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
        // FR-011: el mensaje dice exactamente lo que va a pasar. Se pide el
        // motivo porque casi toda eliminacion es una CANCELACION, y quien ya
        // habia visto la fecha en el calendario necesita saber por que
        // desaparecio; ese texto es lo que se publica en el aviso.
        const respuesta = global.confirmDialog
          ? await global.confirmDialog({
              titulo: "Eliminar actividad",
              mensaje: `"${act.titulo}" dejará de aparecer en el calendario. Quedará registrado públicamente que tu centro la eliminó, para que quien ya la haya visto sepa que se canceló.`,
              textoConfirmar: "Eliminar",
              campoMotivo: {
                etiqueta: "Motivo (opcional, se muestra públicamente)",
                placeholder: "Ej.: se reprograma para el 20 de mayo",
              },
            })
          : (confirm(`¿Eliminar "${act.titulo}"? Quedará registrado públicamente que tu centro la eliminó.`) ? { motivo: "" } : false);
        if (!respuesta) return;
        try {
          await api.del("/api/actividades/" + id, { motivo: respuesta.motivo || null });
          toast("Actividad eliminada", "success");
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
        <button class="btn-icon" data-act="eliminar" title="Eliminar" aria-label="Eliminar"><span class="icon" data-icon="trash-2"></span></button>
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
