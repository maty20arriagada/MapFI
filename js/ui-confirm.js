/* MapFI · ui-confirm.js — dialogo de confirmacion accesible (<dialog> nativo),
 * reemplaza confirm() nativo cuando el mensaje debe explicar una consecuencia
 * real (p.ej. que una accion es reversible), no solo un si/no generico. */
(function (global) {
  "use strict";

  let dlg = null;
  function elDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "confirm-dialog";
    dlg.innerHTML =
      '<form method="dialog" class="stack">' +
        '<h3 data-role="titulo"></h3>' +
        '<p data-role="mensaje" class="muted"></p>' +
        '<div class="row" style="justify-content:flex-end">' +
          '<button type="button" class="btn secondary" data-role="cancelar">Cancelar</button>' +
          '<button type="submit" class="btn" data-role="confirmar" value="ok"></button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(dlg);
    return dlg;
  }

  /**
   * confirmDialog({ titulo, mensaje, textoConfirmar }) → Promise<boolean>
   * `mensaje` se inserta con textContent, nunca HTML: los llamadores no
   * necesitan escapar manualmente el texto que interpolen (Principio III).
   */
  global.confirmDialog = function confirmDialog(opts) {
    opts = opts || {};
    const d = elDialog();
    d.querySelector('[data-role="titulo"]').textContent = opts.titulo || "Confirmar";
    d.querySelector('[data-role="mensaje"]').textContent = opts.mensaje || "";
    d.querySelector('[data-role="confirmar"]').textContent = opts.textoConfirmar || "Confirmar";

    return new Promise((resolve) => {
      const form = d.querySelector("form");
      const cancelar = d.querySelector('[data-role="cancelar"]');

      // La promesa DEBE resolverse siempre, por cualquiera de las tres vias
      // (confirmar / cancelar / Escape) y una sola vez. Antes se dependia
      // unicamente del evento `close`, y ademas `cleanup()` quitaba ese
      // listener ANTES de cerrar: al pulsar "Cancelar" la promesa quedaba
      // colgada para siempre y quien la esperaba se congelaba en silencio
      // (revision QA, hallazgo M-1). Tampoco es seguro asumir que `close`
      // se dispara: se comprobo un navegador donde no ocurre nunca.
      let terminado = false;
      function terminar(valor) {
        if (terminado) return;
        terminado = true;
        cancelar.removeEventListener("click", onCancel);
        form.removeEventListener("submit", onSubmit);
        d.removeEventListener("close", onClose);
        d.removeEventListener("cancel", onClose);
        if (d.open) d.close();
        resolve(valor);
      }
      function onCancel() { terminar(false); }
      function onSubmit() { terminar(true); }
      function onClose() { terminar(false); } // Escape / cierre nativo

      cancelar.addEventListener("click", onCancel);
      form.addEventListener("submit", onSubmit);
      // `cancel` (Escape) y `close` cubren la misma salida; se escuchan las
      // dos porque no todos los motores disparan ambas — `terminar` ignora
      // la segunda gracias al guardia `terminado`.
      d.addEventListener("close", onClose);
      d.addEventListener("cancel", onClose);
      d.showModal();
    });
  };
})(window);
