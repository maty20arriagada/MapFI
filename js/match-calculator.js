/* MapFI · match-calculator.js — UI del calculador de compatibilidad. */
(function (global) {
  "use strict";

  const fmt = (d) =>
    new Date(d).toLocaleString("es-CL", {
      weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

  // TODO(F3+): soportar multi-segmento (varias carreras/niveles) en la UI.
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

  // T070 (Backlog 1.5): las sugerencias ya no son solo informativas — si el
  // llamador pasa `opts.onPick`, cada una se vuelve un botón que, al
  // pulsarlo, entrega la sugerencia completa (inicio/fin/compatibilidad)
  // para que el formulario se rellene con esa fecha.
  function render(el, r, opts) {
    opts = opts || {};
    const nivel = (r.nivel || "").toLowerCase();
    const conflictos =
      r.conflictos && r.conflictos.length
        ? "<h3>Conflictos</h3><ul>" + r.conflictos.map((c) => `<li>${c.detalle}</li>`).join("") + "</ul>"
        : '<p class="muted">Sin conflictos detectados.</p>';
    const puedeElegir = typeof opts.onPick === "function";
    const sugerencias =
      r.sugerencias && r.sugerencias.length
        ? "<h3>Mejores alternativas de la semana</h3><ul>" +
          r.sugerencias
            .map((s, i) =>
              puedeElegir
                ? `<li><button type="button" class="link-btn" data-sug="${i}">${fmt(s.inicio)} — <strong>${s.compatibilidad_pct}%</strong> · alcance ${s.alcance_estimado}</button></li>`
                : `<li>${fmt(s.inicio)} — <strong>${s.compatibilidad_pct}%</strong> · alcance ${s.alcance_estimado}</li>`
            )
            .join("") +
          "</ul>"
        : "";

    el.innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <h2 style="margin:0">Compatibilidad</h2>
          <span class="badge ${nivel}">${r.compatibilidad_pct}% · ${r.nivel}</span>
        </div>
        <p class="muted">Alcance estimado: <strong>${r.alcance_estimado}</strong> estudiantes</p>
        ${conflictos}
        ${sugerencias}
      </div>`;

    if (puedeElegir && r.sugerencias && r.sugerencias.length) {
      el.querySelectorAll("[data-sug]").forEach((btn) => {
        btn.addEventListener("click", () => opts.onPick(r.sugerencias[+btn.dataset.sug]));
      });
    }
  }

  global.MatchCalculator = { evaluar, render };
})(window);
