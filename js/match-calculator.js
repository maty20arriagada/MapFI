/* MapFI · match-calculator.js — UI del calculador de compatibilidad. */
(function (global) {
  "use strict";

  // TODO(F3): soportar multi-segmento (varias carreras/niveles) y render de
  //           conflictos + las 3 sugerencias devueltas por el backend.
  async function evaluar(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const publico = [
      { carreraId: parseInt(data.carreraId, 10), nivel: parseInt(data.nivel, 10) },
    ];
    return api.post("/api/match/evaluar", {
      inicio: data.inicio,
      fin: data.fin || data.inicio,
      publico,
    });
  }

  function render(el, r) {
    const nivel = (r.nivel || "").toLowerCase();
    el.innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <h2 style="margin:0">Compatibilidad</h2>
          <span class="badge ${nivel}">${r.compatibilidad_pct}% · ${r.nivel}</span>
        </div>
        <p class="muted">Alcance estimado: <strong>${r.alcance_estimado}</strong> estudiantes</p>
        ${
          r.conflictos && r.conflictos.length
            ? "<ul>" + r.conflictos.map((c) => `<li>${c.detalle}</li>`).join("") + "</ul>"
            : '<p class="muted">Sin conflictos detectados (scoring completo: TODO F3).</p>'
        }
      </div>`;
  }

  global.MatchCalculator = { evaluar, render };
})(window);
