"use strict";
/**
 * MapFI · actividadTipo.js — reordena las actividades ya cargadas: decide su
 * tipo, separa el ramo del titulo y numera las repeticiones.
 *
 * Servicio PURO (Principio II): sin I/O, sin red, sin base de datos.
 *
 * DE DONDE SALE LA REGLA
 * ----------------------
 * No de adivinar palabras clave. Al mirar los 58 titulos reales aparecio una
 * convencion de SUFIJOS que el centro de Metalurgia usa de forma consistente:
 *
 *     Topografia            -> el certamen del ramo (se repite: C1, C2, C3...)
 *     Topografia TEST       -> un test
 *     Fisica II EX          -> el examen
 *     Dibujo ... TAREA      -> una tarea
 *
 * Un clasificador por palabras ("certamen", "prueba", "control") acertaba
 * solo en TEST y fallaba en las 40 filas sin sufijo y en las 2 de EX. Por eso
 * la regla es posicional: se mira el final del titulo, no su vocabulario.
 *
 * DECISIONES DEL USUARIO (2026-09-07), todas deliberadas:
 *   · Sin sufijo  -> CERTAMEN. Es la evaluacion principal del ramo.
 *   · TEST        -> TAREA.    Control menor, no debe pesar como un certamen.
 *   · EX          -> CERTAMEN. Es evaluacion formal.
 *   · TAREA       -> TAREA.
 *   · Vinculacion con el Medio (VcM) y Gearbox (GBX) -> EVENTO, sin mirar el
 *     titulo: su trabajo es acompañar al estudiante, no evaluarlo.
 *   · Lo que YA fue clasificado a mano (cualquier tipo distinto de EVENTO) se
 *     RESPETA. Quien lo marco sabia algo que el titulo no dice.
 *
 * Los tipos que se guardan son los del CHECK de la migracion 006: EXAMEN es
 * el certamen y ENTREGA la tarea. No se inventan tipos nuevos.
 */

/** Entidades cuyo trabajo NO es academico: lo suyo queda como evento. */
const SIGLAS_ACOMPANAMIENTO = Object.freeze(["VCM", "GBX"]);

const TIPO_CERTAMEN = "EXAMEN";
const TIPO_TAREA = "ENTREGA";
const TIPO_EVENTO = "EVENTO";

/**
 * Sufijos, en orden de comprobacion. Anclados al FINAL del titulo: sin el
 * ancla, "Metalurgia extractiva" acabaria pescando el sufijo EX.
 */
const SUFIJOS = Object.freeze([
  { re: /\s+TAREA\s*$/i, tipo: TIPO_TAREA, etiqueta: "Tarea" },
  { re: /\s+TESTS?\s*$/i, tipo: TIPO_TAREA, etiqueta: "Test" },
  { re: /\s+EX\s*$/i, tipo: TIPO_CERTAMEN, etiqueta: "Examen" },
]);

/** Sin ningun sufijo, el titulo entero es el ramo y la actividad es el certamen. */
const SIN_SUFIJO = Object.freeze({ tipo: TIPO_CERTAMEN, etiqueta: "Certamen" });

/** Quita tildes y unifica espacios, para agrupar "Topografía" con "Topografia". */
function normalizar(s) {
  return String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // combinantes, escapados
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decide que hacer con UNA actividad, sin conocer las demas (por eso todavia
 * no numera: eso necesita el conjunto y lo hace `planificar`).
 *
 * @param {{titulo?, ramo?, tipo?, entidadSigla?}} act
 * @returns {{accion: "respetar"|"reclasificar", tipo, ramo, etiqueta, motivo}}
 */
function analizar(act) {
  act = act || {};
  const sigla = String(act.entidadSigla || "").trim().toUpperCase();
  const tituloOriginal = String(act.titulo || "").trim();

  if (SIGLAS_ACOMPANAMIENTO.indexOf(sigla) !== -1) {
    return {
      accion: "respetar",
      tipo: TIPO_EVENTO,
      ramo: act.ramo || null,
      etiqueta: null,
      motivo: "entidad de acompañamiento (" + sigla + ")",
    };
  }

  // Ya clasificada a mano: no se pisa. Solo se reordena lo que quedo como
  // EVENTO, que es el valor con el que entraron sin revisar.
  if (act.tipo && act.tipo !== TIPO_EVENTO) {
    return {
      accion: "respetar",
      tipo: act.tipo,
      ramo: act.ramo || null,
      etiqueta: null,
      motivo: "ya clasificada a mano como " + act.tipo,
    };
  }

  for (const s of SUFIJOS) {
    if (s.re.test(tituloOriginal)) {
      return {
        accion: "reclasificar",
        tipo: s.tipo,
        ramo: tituloOriginal.replace(s.re, "").trim() || tituloOriginal,
        etiqueta: s.etiqueta,
        motivo: "sufijo " + s.etiqueta.toUpperCase(),
      };
    }
  }

  return {
    accion: "reclasificar",
    tipo: SIN_SUFIJO.tipo,
    ramo: tituloOriginal,
    etiqueta: SIN_SUFIJO.etiqueta,
    motivo: "sin sufijo: el titulo es el ramo",
  };
}

/**
 * Aplica `analizar` a la lista y numera las repeticiones.
 *
 * La numeracion no es cosmetica: "Topografia" aparece cuatro veces y
 * "Topografia TEST" dos. Sin numerar, el calendario mostraria cuatro chips
 * identicos — exactamente el problema por el que empezo todo esto. Se ordena
 * por fecha, que es el orden en que el estudiante los vive.
 *
 * Cuando de un (ramo, etiqueta) solo hay uno, no se numera: "Test" se lee
 * mejor que "Test 1" si no hay un Test 2.
 *
 * @param {Array} actividades  { id, titulo, ramo, tipo, entidadSigla, fechaInicio }
 * @returns {{cambios, respetadas, sinCambio, resumen}}
 */
function planificar(actividades) {
  const filas = (actividades || []).map((a) => ({ original: a, plan: analizar(a) }));

  // Agrupar por (ramo normalizado + etiqueta) para numerar dentro del grupo.
  const grupos = new Map();
  filas.forEach((f) => {
    if (f.plan.accion !== "reclasificar") return;
    const clave = normalizar(f.plan.ramo) + "|" + f.plan.etiqueta;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(f);
  });

  grupos.forEach((miembros) => {
    miembros.sort((a, b) => {
      const fa = a.original.fechaInicio ? new Date(a.original.fechaInicio).getTime() : 0;
      const fb = b.original.fechaInicio ? new Date(b.original.fechaInicio).getTime() : 0;
      if (fa !== fb) return fa - fb;
      return (a.original.id || 0) - (b.original.id || 0); // desempate estable
    });
    miembros.forEach((f, i) => {
      f.plan.tituloNuevo = miembros.length > 1
        ? f.plan.etiqueta + " " + (i + 1)
        : f.plan.etiqueta;
    });
  });

  const cambios = [];
  const respetadas = [];
  const resumen = {};
  let sinCambio = 0;

  filas.forEach((f) => {
    const a = f.original;
    const p = f.plan;

    if (p.accion === "respetar") {
      respetadas.push({ id: a.id, titulo: a.titulo, tipo: a.tipo, motivo: p.motivo });
      return;
    }

    const clave = (a.tipo || "?") + " -> " + p.tipo;
    resumen[clave] = (resumen[clave] || 0) + 1;

    const cambiaTipo = p.tipo !== a.tipo;
    const cambiaRamo = (p.ramo || null) !== (a.ramo || null);
    const cambiaTitulo = p.tituloNuevo !== a.titulo;
    if (!cambiaTipo && !cambiaRamo && !cambiaTitulo) { sinCambio++; return; }

    cambios.push({
      id: a.id,
      entidadSigla: a.entidadSigla,
      tipoPrevio: a.tipo, tipoNuevo: p.tipo,
      ramoPrevio: a.ramo || null, ramoNuevo: p.ramo,
      tituloPrevio: a.titulo, tituloNuevo: p.tituloNuevo,
      motivo: p.motivo,
    });
  });

  return { cambios, respetadas, sinCambio, resumen };
}

module.exports = {
  analizar,
  planificar,
  normalizar,
  SIGLAS_ACOMPANAMIENTO,
  SUFIJOS,
  TIPO_CERTAMEN,
  TIPO_TAREA,
  TIPO_EVENTO,
};
