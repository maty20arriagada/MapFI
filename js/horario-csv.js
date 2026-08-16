/* MapFI · horario-csv.js — interpretacion y exportacion de horarios como
 * CSV/TXT, 100% en el navegador (Spec 003, FR-018/019: ningun archivo llega
 * al servidor; solo JSON ya estructurado). Hermano de js/csv-utils.js, que
 * hace lo mismo para actividades. Formato documentado en
 * specs/003-gestion-horarios/research.md (R-6) y docs/IMPORTACION_HORARIOS.md. */
(function (global) {
  "use strict";

  const DIA_SIGLA = ["", "LUN", "MAR", "MIE", "JUE", "VIE"];

  /** Escapa un campo para CSV separado por ';': comillas si contiene el
   * separador, comillas o saltos de linea. Tambien neutraliza inyeccion de
   * formulas (CSV/Excel formula injection, revision de seguridad
   * 2026-08-15): un campo que llega de un archivo importado por otro centro
   * puede contener "=HYPERLINK(...)" o similar, y este mismo texto se
   * reexporta sin pasar por el servidor cuando alguien descarga el respaldo
   * antes de vaciar un segmento. Anteponer un apostrofo obliga a Excel/
   * LibreOffice a tratarlo como texto literal (no se ve en la celda). */
  function escaparCampo(v) {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // ── Deteccion de archivos binarios (R-5) ────────────────────────────────
  // El usuario puede arrastrar un .xlsx real por error: sin esto, readAsText
  // produce un chorro ilegible y el parser dice "encabezado invalido", que no
  // ayuda. Detectar la firma permite decir exactamente que hacer.
  function detectarBinario(texto) {
    if (typeof texto !== "string" || !texto.length) return null;
    const inicio = texto.slice(0, 8);
    if (inicio.indexOf("PK\x03\x04") === 0) return "xlsx"; // zip: .xlsx, .docx, .pptx
    if (inicio.indexOf("%PDF") === 0) return "pdf";
    if (inicio.indexOf("\xD0\xCF\x11\xE0") === 0) return "xls"; // OLE: .xls, .doc antiguos
    if (/\x00/.test(texto.slice(0, 2000))) return "binario";
    return null;
  }

  // ── Interpretacion (parsear) ─────────────────────────────────────────────
  function quitarAcentos(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /** Normaliza un encabezado de columna para comparar contra los alias: sin
   * acentos, minusculas, sin espacios/guiones bajos. "Hora_Inicio" y "hora
   * inicio" quedan iguales ("horainicio"). */
  function normalizarClave(s) {
    return quitarAcentos(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  const ALIAS_COLUMNA = {
    dia: ["dia"],
    inicio: ["inicio", "horainicio"],
    fin: ["fin", "horafin", "termino", "horatermino"],
    ramo: ["ramo", "asignatura", "materia", "descripcion"],
    tipo: ["tipo"],
    codigo: ["codigo", "codasignatura", "codigoasignatura"],
    seccion: ["seccion", "sec"],
    sala: ["sala", "aula", "laboratorio", "lab"],
    docente: ["docente", "profesor", "profe"],
  };

  function resolverColumnas(encabezado) {
    const normalizado = encabezado.map(normalizarClave);
    const idx = {};
    Object.keys(ALIAS_COLUMNA).forEach((campo) => {
      idx[campo] = -1;
      for (const alias of ALIAS_COLUMNA[campo]) {
        const i = normalizado.indexOf(alias);
        if (i >= 0) { idx[campo] = i; break; }
      }
    });
    return idx;
  }

  /** Autodetecta el separador de la linea de encabezado: ';', ',' o tabulacion
   * (lo que produce el portapapeles al copiar celdas desde una planilla). */
  function detectarDelimitador(lineaEncabezado) {
    const candidatos = { ";": ";", ",": ",", "\t": "\t" };
    let mejor = ";", max = -1;
    Object.keys(candidatos).forEach((d) => {
      const n = lineaEncabezado.split(d).length;
      if (n > max) { max = n; mejor = d; }
    });
    return mejor;
  }

  /** Tokeniza una linea respetando comillas (el campo puede contener el
   * separador o saltos de linea si va entre comillas dobles). */
  function parseLinea(linea, delim) {
    const out = [];
    let cur = "", enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (enComillas) {
        if (ch === '"') { if (linea[i + 1] === '"') { cur += '"'; i++; } else enComillas = false; }
        else cur += ch;
      } else if (ch === '"') { enComillas = true; }
      else if (ch === delim) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  const DIA_MAP = {
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
    "lun": 1, "lunes": 1,
    "mar": 2, "martes": 2,
    "mie": 3, "miercoles": 3,
    "jue": 4, "jueves": 4,
    "vie": 5, "viernes": 5,
  };

  function interpretarDia(valor) {
    const clave = quitarAcentos(String(valor || "").trim().toLowerCase());
    const dia = DIA_MAP[clave];
    if (!dia) throw new Error("día inválido: '" + valor + "' (usa LUN..VIE o 1..5)");
    return dia;
  }

  const RE_HORA = /^(\d{1,2}):(\d{2})(:\d{2})?$/;

  function validarHora(valor, etiqueta) {
    const v = String(valor || "").trim();
    if (!v) throw new Error("falta la hora de " + etiqueta);
    if (!RE_HORA.test(v)) throw new Error("hora de " + etiqueta + " inválida: '" + valor + "' (usa HH:MM)");
    return v;
  }

  function aMinutosLocal(hhmm) {
    const m = hhmm.match(RE_HORA);
    return (+m[1]) * 60 + (+m[2]);
  }

  function interpretarFila(celdas, idx) {
    const diaSemana = interpretarDia(celdas[idx.dia]);
    const horaInicio = validarHora(celdas[idx.inicio], "inicio");
    const horaFin = validarHora(celdas[idx.fin], "término");
    if (aMinutosLocal(horaFin) <= aMinutosLocal(horaInicio)) {
      throw new Error("la hora de término no puede ser anterior o igual a la de inicio");
    }
    const ramo = (idx.ramo >= 0 && celdas[idx.ramo] ? celdas[idx.ramo] : "").trim();
    if (!ramo) throw new Error("falta el ramo");
    const opcional = (i) => (i >= 0 && celdas[i] && celdas[i].trim()) ? celdas[i].trim() : null;
    return {
      diaSemana, horaInicio, horaFin, descripcion: ramo,
      tipo: (opcional(idx.tipo) || "CLASE").toUpperCase(),
      codigo: opcional(idx.codigo),
      seccion: opcional(idx.seccion),
      sala: opcional(idx.sala),
      docente: opcional(idx.docente),
    };
  }

  /**
   * Interpreta un archivo/texto de horario (CSV, TXT o celdas pegadas) segun
   * el formato de research.md (R-6). Nunca lanza: los problemas salen por
   * `errores`, con el numero de fila del archivo original (1 = encabezado).
   * @param {string} texto
   * @returns {{bloques: Array, errores: Array<{fila, error}>}}
   */
  function parsear(texto) {
    texto = String(texto || "").replace(/^﻿/, "");
    const lineas = texto.split(/\r\n|\r|\n/);
    while (lineas.length && lineas[lineas.length - 1].trim() === "") lineas.pop();

    if (!lineas.length) {
      return { bloques: [], errores: [{ fila: 1, error: "El archivo está vacío" }] };
    }

    const delim = detectarDelimitador(lineas[0]);
    const encabezado = parseLinea(lineas[0], delim);
    const idx = resolverColumnas(encabezado);

    if (idx.dia < 0 || idx.inicio < 0 || idx.fin < 0 || idx.ramo < 0) {
      return { bloques: [], errores: [{ fila: 1, error: "Encabezado inválido: se requieren columnas dia, inicio, fin y ramo" }] };
    }

    const bloques = [];
    const errores = [];
    for (let i = 1; i < lineas.length; i++) {
      const fila = i + 1;
      if (!lineas[i].trim()) continue; // fila en blanco: se ignora, no es error
      try {
        const bloque = interpretarFila(parseLinea(lineas[i], delim), idx);
        bloque.fila = fila; // para que un error del servidor senale la fila REAL del archivo
        bloques.push(bloque);
      } catch (e) {
        errores.push({ fila, error: e.message });
      }
    }

    return { bloques, errores };
  }

  /**
   * Convierte bloques (tal como los devuelve GET /api/bloques) al mismo
   * formato que acepta la importacion, para poder descargar el horario antes
   * de vaciarlo (FR-003) y reimportarlo tal cual.
   * @param {Array} bloques
   * @returns {string} texto CSV con BOM UTF-8, separado por ';'
   */
  function aCsv(bloques) {
    const filas = ["dia;inicio;fin;ramo;tipo;codigo;seccion;sala;docente"];
    (bloques || []).forEach((b) => {
      filas.push([
        DIA_SIGLA[+b.dia_semana] || "",
        (b.hora_inicio || "").slice(0, 5),
        (b.hora_fin || "").slice(0, 5),
        escaparCampo(b.descripcion),
        escaparCampo(b.tipo),
        escaparCampo(b.codigo),
        escaparCampo(b.seccion),
        escaparCampo(b.sala),
        escaparCampo(b.docente),
      ].join(";"));
    });
    return "﻿" + filas.join("\r\n") + "\r\n";
  }

  global.HorarioCsv = { aCsv, parsear, detectarBinario };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { aCsv, parsear, detectarBinario };
  }
})(typeof window !== "undefined" ? window : globalThis);
