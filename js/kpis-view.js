/* MapFI · kpis-view.js — panel de indicadores (Fase 4, solo ADMIN). */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  function bar(pct, color) {
    const w = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<div style="background:var(--border);border-radius:6px;overflow:hidden;min-width:90px;margin-top:4px">
      <div style="width:${w}%;background:${color || "var(--brand)"};height:12px"></div></div>`;
  }

  const esc = window.escapeHtml || ((s) => s);

  function tabla(cont, rows, cols) {
    cont.innerHTML = (!rows || !rows.length)
      ? '<p class="muted">Sin datos.</p>'
      : `<table><thead><tr>${cols.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${c.get ? c.get(r) : esc(r[c.key] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  async function cargar() {
    const [data, cat] = await Promise.all([api.get("/api/analytics/resumen"), api.get("/api/catalogos")]);
    const carreraNombre = {}; cat.carreras.forEach((c) => (carreraNombre[c.id] = c.nombre));
    const entidadNombre = {}; data.aporte.forEach((a) => (entidadNombre[a.entidad_id] = a.nombre));

    tabla($("tablaRanking"), data.ranking, [
      { label: "Entidad", key: "nombre" },
      { label: "Tipo", key: "tipo" },
      { label: "Reputación", get: (r) => `${r.reputacion}${bar(r.reputacion, "var(--brand)")}` },
      { label: "Éxitos", key: "eventos_exitosos" },
      { label: "Sello", get: (r) => (r.sello_coordinacion ? '<span class="badge alto">' + Icon("trophy", { size: 14 }) + "</span>" : "—") },
    ]);
    tabla($("tablaOcupacion"), data.ocupacion, [
      { label: "Carrera", get: (r) => carreraNombre[r.carrera_id] || r.carrera_id },
      { label: "Año", key: "nivel" },
      { label: "Ocupación", get: (r) => `${r.ocupacion_pct ?? 0}%${bar(r.ocupacion_pct, "var(--amarillo)")}` },
    ]);
    tabla($("tablaAporte"), data.aporte, [
      { label: "Entidad", key: "nombre" },
      { label: "Total", key: "actividades_total" },
      { label: "Realizadas", key: "realizadas" },
      { label: "Reprog.", key: "reprogramadas" },
      { label: "Alcance", key: "alcance_total" },
    ]);
    tabla($("tablaReprog"), data.reprogramados, [
      { label: "Entidad", get: (r) => esc(entidadNombre[r.entidad_id] || ("#" + r.entidad_id)) },
      { label: "Año", key: "anio" },
      { label: "Total", key: "total" },
      { label: "Reprog.", key: "reprogramados" },
      { label: "Tasa", get: (r) => `${r.tasa_pct ?? 0}%${bar(r.tasa_pct, "var(--rojo)")}` },
    ]);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    let user = null;
    try { ({ user } = await api.get("/api/auth/me")); } catch (_) {}
    if (user && user.rol !== "ADMIN") { $("noAdmin").hidden = false; return; }
    if (!user) return;

    try { await cargar(); } catch (e) { toast("No se pudieron cargar los KPIs", "error"); }

    const btn = $("btnRecalcular");
    if (btn) btn.onclick = async () => {
      try {
        const r = await api.post("/api/admin/recalcular-reputacion");
        toast(`Reputación recalculada (${r.actualizadas} entidades)`, "success");
        cargar();
      } catch (e) { toast(e.message, "error"); }
    };
  });
})();
