/* MapFI · filters.js — carga de catalogos y poblado de selects de filtros. */
(function (global) {
  "use strict";

  async function cargar() {
    try {
      return await api.get("/api/catalogos");
    } catch (e) {
      return { carreras: [], generaciones: [], entidades: [], periodoActivo: null };
    }
  }

  function poblarSelect(sel, items, valueKey, labelKey, placeholder) {
    if (!sel) return;
    if (placeholder) {
      const o = document.createElement("option");
      o.value = ""; o.textContent = placeholder;
      sel.appendChild(o);
    }
    for (const it of items) {
      const o = document.createElement("option");
      o.value = it[valueKey];
      o.textContent = it[labelKey];
      sel.appendChild(o);
    }
  }

  global.Filters = { cargar, poblarSelect };
  // TODO(F2): sincronizar los filtros activos con la URL (querystring) y
  //           re-renderizar calendario/heatmap al cambiar.
})(window);
