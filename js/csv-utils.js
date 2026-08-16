/* MapFI · csv-utils.js — parser y armado de actividades desde CSV.
 * Compartido por calendario.html (admin) y dashboard.html (aportantes).
 * Formato documentado en docs/IMPORTACION_CSV.md y en /api/plantilla-csv. */
(function (global) {
  "use strict";

  function normTipo(t) {
    t = (t || "").toUpperCase().trim();
    if (["EVALUACION", "EVALUACIÓN", "EXAMEN", "CERTAMEN", "PRUEBA", "CONTROL"].includes(t)) return "EXAMEN";
    if (["HITO", "HITO_ACADEMICO"].includes(t)) return "HITO_ACADEMICO";
    if (["EXTRAPROGRAMATICA", "EXTRAPROGRAMÁTICA"].includes(t)) return "EXTRAPROGRAMATICA";
    if (t === "CHARLA") return "CHARLA";
    if (t === "TALLER") return "TALLER";
    if (t === "ENTREGA") return "ENTREGA";
    if (t === "EVENTO") return "EVENTO";
    return "EXAMEN";
  }

  function parseFecha(s) {
    if (!s) return null;
    const d = new Date(String(s).trim().replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }

  /** CSV → {header, rows}. Autodetecta separador (; , o tabulación) y soporta comillas.
   * La tabulación es lo que produce el portapapeles al copiar celdas desde una
   * planilla: con esto, pegar una seleccion funciona igual que subir un archivo. */
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return { header: [], rows: [] };
    const conteos = { ";": lines[0].split(";").length, ",": lines[0].split(",").length, "\t": lines[0].split("\t").length };
    const delim = Object.keys(conteos).reduce((a, b) => (conteos[b] > conteos[a] ? b : a));
    function parseLine(line) {
      const out = [];
      let cur = "", q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
          else cur += ch;
        } else {
          if (ch === '"') q = true;
          else if (ch === delim) { out.push(cur); cur = ""; }
          else cur += ch;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    }
    return { header: parseLine(lines[0]).map((h) => h.toLowerCase()), rows: lines.slice(1).map(parseLine) };
  }

  /**
   * Convierte el texto CSV en actividades listas para POST /api/actividades/bulk.
   * @param {string} text        contenido del CSV
   * @param {object} cat         catalogos (de /api/catalogos)
   * @param {object} [opts]      { defaultEntidadId } — entidad si el CSV no trae columna
   * @returns {{actividades: Array, errores: Array<{fila, error}>}}
   */
  function construirActividades(text, cat, opts) {
    opts = opts || {};
    const codigoMap = {}; (cat.carreras || []).forEach((c) => (codigoMap[c.codigo.toUpperCase()] = c.id));
    const siglaMap = {}; (cat.entidades || []).forEach((e) => { if (e.sigla) siglaMap[e.sigla.toUpperCase()] = e.id; });
    const todasCarreras = (cat.carreras || []).map((c) => c.id);
    const todosNiveles = (cat.generaciones || []).map((g) => g.nivel);

    const { header, rows } = parseCSV(text);
    const idx = (n) => header.indexOf(n);
    const iT = idx("titulo"), iRamo = idx("ramo"), iTipo = idx("tipo"), iIni = idx("inicio"),
          iFin = idx("fin"), iCarr = idx("carreras"), iNiv = idx("niveles"),
          iUbi = idx("ubicacion"), iEnt = idx("entidad");

    if (iT < 0 || iIni < 0 || iCarr < 0 || iNiv < 0) {
      return { actividades: [], errores: [{ fila: 1, error: "Encabezado inválido: se requieren columnas titulo, inicio, carreras y niveles" }] };
    }

    const actividades = [], errores = [];
    rows.forEach((r, n) => {
      const fila = n + 2; // 1 = encabezado
      try {
        const titulo = (r[iT] || "").trim();
        if (!titulo) throw new Error("falta título");
        const ini = parseFecha(r[iIni]);
        if (!ini) throw new Error("inicio inválido (usa AAAA-MM-DD HH:MM)");
        let fin = iFin >= 0 ? parseFecha(r[iFin]) : null;
        if (!fin) { fin = new Date(ini); fin.setHours(fin.getHours() + 2); }

        const carrRaw = (r[iCarr] || "").trim();
        const carrIds = carrRaw === "*" || carrRaw.toUpperCase() === "TODAS"
          ? todasCarreras
          : carrRaw.split("|").map((s) => s.trim().toUpperCase()).filter(Boolean).map((code) => {
              const id = codigoMap[code];
              if (!id) throw new Error("código de carrera desconocido: " + code);
              return id;
            });
        const nivRaw = (r[iNiv] || "").trim();
        const nivs = nivRaw === "*" || nivRaw.toUpperCase() === "TODOS"
          ? todosNiveles
          : nivRaw.split("|").map((s) => +s.trim()).filter((x) => x);
        if (!carrIds.length || !nivs.length) throw new Error("faltan carreras o niveles");

        const publico = [];
        carrIds.forEach((c) => nivs.forEach((nv) => publico.push({ carreraId: c, nivel: nv })));

        const entId = iEnt >= 0 && r[iEnt]
          ? siglaMap[r[iEnt].trim().toUpperCase()] || opts.defaultEntidadId
          : opts.defaultEntidadId;

        actividades.push({
          fila,
          titulo,
          ramo: iRamo >= 0 ? (r[iRamo] || "").trim() || null : null,
          tipo: normTipo(iTipo >= 0 ? r[iTipo] : ""),
          ubicacion: iUbi >= 0 ? r[iUbi] : "",
          fechaInicio: ini.toISOString(),
          fechaFin: fin.toISOString(),
          entidadId: entId,
          publico,
        });
      } catch (e) {
        errores.push({ fila, error: e.message });
      }
    });

    return { actividades, errores };
  }

  /**
   * Divide `actividades` en lotes cuyo tamaño serializado (JSON, tal como se
   * envía en el body de POST /api/actividades/bulk) no supere `limiteBytes`
   * — un margen de seguridad bajo el límite real del servidor (100 kB, ver
   * `express.json({ limit: "100kb" })` en server.js). Una fila con público
   * completo pesa cerca de 2 kB; una planilla de un semestre para toda la
   * facultad (100+ filas) supera el límite de un solo envío y el servidor la
   * rechazaba con un error críptico (H-05, E-06, T052).
   * @param {Array} actividades
   * @param {number} [limiteBytes=80000]
   * @returns {Array<Array>} lotes (nunca vacíos, conservan el orden original)
   */
  function dividirEnLotes(actividades, limiteBytes) {
    limiteBytes = limiteBytes || 80000;
    const lotes = [];
    let loteActual = [];
    let bytesActual = 2; // "[" + "]"
    for (const a of actividades) {
      const bytesFila = JSON.stringify(a).length + 1; // +1 por la coma separadora
      if (loteActual.length && bytesActual + bytesFila > limiteBytes) {
        lotes.push(loteActual);
        loteActual = [];
        bytesActual = 2;
      }
      loteActual.push(a);
      bytesActual += bytesFila;
    }
    if (loteActual.length) lotes.push(loteActual);
    return lotes;
  }

  global.CsvUtils = { parseCSV, normTipo, parseFecha, construirActividades, dividirEnLotes };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseCSV, normTipo, parseFecha, construirActividades, dividirEnLotes };
  }
})(typeof window !== "undefined" ? window : globalThis);
