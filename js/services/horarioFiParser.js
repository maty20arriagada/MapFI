"use strict";
/**
 * horarioFiParser — interpreta el volcado de horarios de la Facultad de
 * Ingenieria UdeC (`Extras/Horarios_FI_UDEC.txt`) y lo convierte en bloques
 * listos para `bloque_horario`.
 *
 * Servicio PURO (Principio II): sin I/O, sin red, sin base de datos. Recibe el
 * texto completo y devuelve datos. Solo corre en Node (lo usa el script CLI
 * js/db/importar-horarios.js), asi que usa CommonJS directo como matchService.
 *
 * EL FORMATO NO ES UN TSV. Es el copiado de una tabla HTML de 8 columnas
 * (codigo, seccion, ramo, creditos, horario, tipo, docente, fecha) donde la
 * celda de horario tenia saltos de linea internos. Al pegarlo, cada salto
 * partio la fila en varias lineas fisicas y se perdieron los campos vacios del
 * principio, asi que el numero de campos por linea varia entre 1 y 8.
 *
 * Un registro son 1..6 lineas fisicas:
 *
 *   500107<TAB>1<TAB>Cálculo I Aplicado a la Ingeniería<TAB>5<TAB>[T] Ma 1,2 (A-411) - Ju 1,2 (A-411)
 *   [P] Ma 8,9 (A-9)
 *   [T] Úrsula Moya Moya<TAB>23/06/26
 *
 * Ver specs/003-gestion-horarios (plan) para las 8 trampas verificadas del
 * archivo; cada una esta anotada abajo con su etiqueta T-n.
 */

// Bloque N de la Facultad -> hora (N+7):00. Bloque 1 = 08:00, bloque 13 =
// 20:00-21:00, que encaja exacto con la grilla 08:00-21:00 de horarioService.
const BLOQUE_BASE = 7;
const BLOQUE_MIN = 1;
const BLOQUE_MAX = 13;

const DIAS = { Lu: 1, Ma: 2, Mi: 3, Ju: 4, Vi: 5 };

// Una linea de HORARIO empieza con [T]/[P]/[L] (con grupo opcional) y sigue
// con dia + numero. Una linea de DOCENTE empieza igual pero sigue con un
// nombre. Sin el `\s\d` final, "[T] Luis Bello", "[T] Manuel Melo" y
// "[T] Víctor Aros" se confundirian con horarios (T-3).
const RE_LINEA_HORARIO = /^\[[TPL](?:\s+G\d)?\]\s+(?:Lu|Ma|Mi|Ju|Vi)\s+\d/;
const RE_CABECERA_HORARIO = /^\[([TPL])(?:\s+G(\d))?\]\s*(.+)$/;
const RE_SESION = /^(Lu|Ma|Mi|Ju|Vi)\s+([\d\s,]+?)\s*\(([^)]*)\)\s*$/;
const RE_FECHA = /^\d{2}\/\d{2}\/\d{2}$/;
const RE_SECCION_ARCHIVO = /^INGENIERIA\b/;
const RE_CODIGO = /^\d{6}$/;

const ETIQUETA_SESION = { T: "Teoría", P: "Práctica", L: "Laboratorio" };

/** Bloque N -> "HH:00" del INICIO de ese bloque. */
function bloqueAHora(n) {
  return String(n + BLOQUE_BASE).padStart(2, "0") + ":00";
}

/**
 * Repara la doble codificacion UTF-8 (T-5): los bytes `C3 A9` (é) quedaron
 * escritos como `C3 83 C2 A9`, que al leerse como UTF-8 da los caracteres
 * "Ã©". Se re-empaquetan como latin-1 y se releen como UTF-8.
 * Solo se tocan los pares afectados, nunca el texto bien codificado.
 */
function repararMojibake(texto) {
  return String(texto).replace(/\u00C3[\u0080-\u00BF]/g, (par) =>
    Buffer.from(par, "latin1").toString("utf8")
  );
}

/** Normaliza saltos de linea, repara mojibake y quita guiones blandos sueltos. */
function normalizarTexto(texto) {
  return repararMojibake(String(texto).replace(/\r\n?/g, "\n"))
    .replace(/\u00AD/g, "");
}

/** ¿Esta linea abre un registro nuevo? */
function esInicioRegistro(linea) {
  if (/^\d{6}\t/.test(linea)) return true;
  // Seis registros perdieron el codigo en el volcado, en dos formas distintas
  // (4 campos, o 5 con el primero vacio) — T-2. Lo que los delata es que
  // traen los campos de una fila nueva y terminan en un horario, cosa que
  // ninguna linea de continuacion ni de cola hace.
  const campos = linea.split("\t");
  if (campos.length < 4) return false;
  return RE_LINEA_HORARIO.test(campos[campos.length - 1]);
}

/** ¿Es una linea de cierre de bloque (encabezado de seccion o vacia)? */
function esSeparador(linea) {
  return linea.trim() === "" || RE_SECCION_ARCHIVO.test(linea);
}

/**
 * Parte el archivo en BLOQUES (delimitados por linea vacia o encabezado) y
 * cada bloque en registros. El bloque importa porque las lineas 1391-1447 son
 * Ing. de Materiales pero NO llevan encabezado (T-1): agrupar por "ultimo
 * encabezado visto" las daria por Quimica. Al conservar el bloque, un registro
 * sin codigo puede heredar el prefijo del registro con codigo que tenga al
 * lado, dentro de su mismo bloque.
 */
function partirEnBloques(lineas) {
  const bloques = [];
  let actual = null;
  let seccionArchivo = null;

  lineas.forEach((linea, i) => {
    const nroLinea = i + 1;
    if (esSeparador(linea)) {
      if (RE_SECCION_ARCHIVO.test(linea)) seccionArchivo = linea.trim();
      actual = null;
      return;
    }
    if (!actual) {
      actual = { seccionArchivo, registros: [] };
      bloques.push(actual);
    }
    if (esInicioRegistro(linea) || !actual.registros.length) {
      actual.registros.push({ nroLinea, lineas: [linea] });
    } else {
      actual.registros[actual.registros.length - 1].lineas.push(linea);
    }
  });

  return bloques;
}

/** Reparte los campos de la primera linea, tolerando los registros sin codigo. */
function camposCabecera(linea) {
  const campos = linea.split("\t");
  if (RE_CODIGO.test(campos[0])) {
    return {
      codigo: campos[0],
      seccion: (campos[1] || "").trim(),
      ramo: (campos[2] || "").trim(),
      horario: campos[4] || "",
      cola: campos.slice(5),
    };
  }
  // Sin codigo (T-2): se alinea por la derecha rellenando el frente, porque el
  // horario siempre es el ultimo campo de estas lineas rotas.
  const rell = campos.slice();
  while (rell.length < 5) rell.unshift("");
  return {
    codigo: "",
    seccion: (rell[1] || "").trim(),
    ramo: (rell[2] || "").trim(),
    horario: rell[4] || "",
    cola: [],
  };
}

/** Extrae docente y fecha de los campos de cola (pueden traer OBLIG/ELECT). */
function extraerCola(campos, acumulado) {
  campos.forEach((campo) => {
    const v = (campo || "").trim();
    if (!v) return;
    if (RE_FECHA.test(v)) { acumulado.fecha = v; return; }
    if (v.startsWith("[")) {
      // "[T] Ana Baeza - Manuel Gutiérrez": el guion separa co-docentes. En
      // L586 queda colgando al final ("María Hormazábal -"), sin espacio
      // detras, asi que se corta tambien ese caso antes de partir.
      const nombres = v.replace(RE_CABECERA_HORARIO, "$3")
        .replace(/\s+-\s*$/, "")
        .split(" - ")
        .map((s) => s.trim()).filter(Boolean);
      if (nombres.length) acumulado.docente = nombres.join(", ");
      return;
    }
    if (v === "OBLIG" || v === "ELECT") { acumulado.obligatoriedad = v; return; }
  });
}

/** Agrupa numeros de bloque en tramos contiguos: [1,2,5,6] -> [[1,2],[5,6]]. */
function rangosContiguos(bloques) {
  const orden = [...new Set(bloques)].sort((a, b) => a - b);
  if (!orden.length) return [];
  const rangos = [];
  let ini = orden[0];
  let prev = orden[0];
  for (let i = 1; i < orden.length; i++) {
    if (orden[i] === prev + 1) { prev = orden[i]; continue; }
    rangos.push([ini, prev]);
    ini = orden[i];
    prev = orden[i];
  }
  rangos.push([ini, prev]);
  return rangos;
}

/**
 * "[T G1] Lu 5,6 (TM 1-3) - Lu 7,8 (TM 3-17)" -> sesiones.
 * El separador es " - " CON espacios: el guion sin espacios pertenece al
 * nombre de la sala ("A-411", "TM 3-15") y nunca separa (T-7). Dos sesiones
 * pueden caer el mismo dia (T-8).
 */
function parsearLineaHorario(linea) {
  const m = String(linea).match(RE_CABECERA_HORARIO);
  if (!m) return { sesiones: [], errores: [] };
  const [, tipoSesion, grupo, resto] = m;

  const sesiones = [];
  const errores = [];
  resto.split(" - ").forEach((token) => {
    const s = token.trim();
    if (!s) return;
    const t = s.match(RE_SESION);
    if (!t) { errores.push(`sesión no interpretable: "${s}"`); return; }
    const dia = DIAS[t[1]];
    const nums = t[2].split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n));
    const fuera = nums.filter((n) => n < BLOQUE_MIN || n > BLOQUE_MAX);
    if (fuera.length) { errores.push(`bloque fuera de rango (${fuera.join(",")}) en "${s}"`); return; }
    const sala = t[3].trim();
    rangosContiguos(nums).forEach(([ini, fin]) => {
      sesiones.push({
        diaSemana: dia,
        horaInicio: bloqueAHora(ini),
        horaFin: bloqueAHora(fin + 1),
        sala: sala || null,
        tipoSesion,
        grupo: grupo || null,
      });
    });
  });
  return { sesiones, errores };
}

/** Interpreta un registro completo (sus 1..6 lineas) en un objeto de dominio. */
function interpretarRegistro(registro, seccionArchivo) {
  const errores = [];
  const cab = camposCabecera(registro.lineas[0]);
  const meta = { docente: null, fecha: null, obligatoriedad: null };
  const sesiones = [];

  function agregarHorario(linea) {
    const r = parsearLineaHorario(linea);
    sesiones.push(...r.sesiones);
    r.errores.forEach((e) => errores.push(`línea ${registro.nroLinea}: ${e}`));
  }

  // La primera linea puede traer horario, o venir vacia con la cola inline
  // (forma de 8 campos: "544499 1 Memoria de Título 20 <vacio> OBLIG [T] ... fecha").
  if (RE_LINEA_HORARIO.test(cab.horario)) agregarHorario(cab.horario);
  extraerCola(cab.cola, meta);

  // Lineas de continuacion: horario, o la cola final. Ojo: la primera linea de
  // un registro no siempre es [T] — 10 abren con [L] y 8 con [P] (T-4).
  registro.lineas.slice(1).forEach((linea) => {
    if (RE_LINEA_HORARIO.test(linea)) { agregarHorario(linea); return; }
    extraerCola(linea.split("\t"), meta);
  });

  if (!cab.ramo) errores.push(`línea ${registro.nroLinea}: registro sin nombre de ramo`);

  return {
    nroLinea: registro.nroLinea,
    seccionArchivo,
    codigo: cab.codigo || null,
    seccion: cab.seccion || null,
    ramo: cab.ramo,
    docente: meta.docente,
    obligatoriedad: meta.obligatoriedad,
    sesiones,
    errores,
  };
}

/**
 * Parsea el archivo completo.
 * @param {string} texto contenido de Horarios_FI_UDEC.txt
 * @returns {{registros: Array, errores: Array<string>}}
 */
function parsearArchivoFI(texto) {
  const lineas = normalizarTexto(texto).split("\n");
  const bloques = partirEnBloques(lineas);

  const registros = [];
  const errores = [];

  bloques.forEach((bloque) => {
    const delBloque = bloque.registros.map((r) => interpretarRegistro(r, bloque.seccionArchivo));

    // Un registro sin codigo hereda el prefijo del registro con codigo mas
    // cercano de SU MISMO bloque. Resuelve a la vez T-2 (6 registros sin
    // codigo) y T-1 (el bloque de Materiales sin encabezado): "Ciencia de
    // Materiales" hereda de 548256 y no queda como Quimica.
    delBloque.forEach((reg, i) => {
      if (reg.codigo) return;
      let vecino = null;
      for (let j = i + 1; j < delBloque.length && !vecino; j++) if (delBloque[j].codigo) vecino = delBloque[j];
      for (let j = i - 1; j >= 0 && !vecino; j--) if (delBloque[j].codigo) vecino = delBloque[j];
      reg.codigoHeredado = vecino ? vecino.codigo : null;
    });

    delBloque.forEach((reg) => {
      errores.push(...reg.errores);
      delete reg.errores;
      registros.push(reg);
    });
  });

  return { registros, errores };
}

/**
 * Aplana un registro en filas listas para `bloque_horario` — una por sesion.
 * El tipo de sesion (T/P/L) y el grupo van dentro del nombre visible, porque
 * `bloque_horario.tipo` solo admite CLASE|PROTEGIDO|LIBRE.
 */
function aBloques(registro) {
  return registro.sesiones.map((s) => {
    const sufijo = s.tipoSesion === "T" && !s.grupo
      ? ""
      : ` (${ETIQUETA_SESION[s.tipoSesion]}${s.grupo ? " G" + s.grupo : ""})`;
    return {
      diaSemana: s.diaSemana,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      tipo: "CLASE",
      descripcion: registro.ramo + sufijo,
      codigo: registro.codigo,
      seccion: registro.seccion,
      sala: s.sala,
      docente: registro.docente,
    };
  });
}

module.exports = {
  parsearArchivoFI,
  aBloques,
  bloqueAHora,
  parsearLineaHorario,
  rangosContiguos,
  repararMojibake,
  esInicioRegistro,
  BLOQUE_BASE,
  BLOQUE_MIN,
  BLOQUE_MAX,
  DIAS,
};
