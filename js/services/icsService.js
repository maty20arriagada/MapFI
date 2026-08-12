"use strict";
/**
 * icsService — genera un calendario iCalendar (RFC 5545) a partir de las
 * actividades. SERVICIO PURO: no toca la base ni el sistema de archivos, solo
 * transforma datos en texto (Principio II).
 *
 * Se escribe a mano en vez de traer una dependencia: el subconjunto que hace
 * falta (VEVENT publicado) son unas pocas propiedades, y el formato es
 * estable desde 2009.
 *
 * Los tres detalles que hacen que un .ics "se vea bien" y aun asi falle en
 * Google/Outlook:
 *   1. Las lineas van con CRLF, no con \n.
 *   2. Ninguna linea puede pasar de 75 OCTETOS: hay que plegarla.
 *   3. El texto va escapado; ademas de correccion, es la defensa contra
 *      inyeccion (ver escaparTexto).
 */

const CRLF = "\r\n";
const MAX_OCTETOS = 75;

/**
 * Escapa un valor TEXT segun RFC 5545 §3.3.11.
 *
 * Ademas de correccion, esto es una defensa de seguridad: el titulo y la
 * descripcion los escribe un usuario. Sin escapar el salto de linea, un
 * titulo como "Charla\nSUMMARY:otra cosa" inyectaria propiedades propias en
 * el evento que aparece en el calendario de quien se suscribio (inyeccion
 * ICS, misma familia que la inyeccion CSV).
 */
function escaparTexto(valor) {
  if (valor === undefined || valor === null) return "";
  return String(valor)
    .replace(/\\/g, "\\\\")   // la barra primero, o se re-escaparian las demas
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Pliega una linea a 75 octetos (no caracteres): las continuaciones empiezan
 * con un espacio. Se mide en UTF-8 porque las tildes y la "ñ" ocupan dos
 * octetos, y cortar a la mitad de un caracter produce un archivo corrupto.
 */
function plegar(linea) {
  const bytes = Buffer.from(linea, "utf8");
  if (bytes.length <= MAX_OCTETOS) return linea;

  const partes = [];
  let inicio = 0;
  let limite = MAX_OCTETOS;
  while (inicio < bytes.length) {
    let fin = Math.min(inicio + limite, bytes.length);
    // Retroceder hasta no partir un caracter multibyte (0b10xxxxxx = cola).
    while (fin > inicio && fin < bytes.length && (bytes[fin] & 0xc0) === 0x80) fin--;
    partes.push(bytes.slice(inicio, fin).toString("utf8"));
    inicio = fin;
    limite = MAX_OCTETOS - 1; // las continuaciones gastan un octeto en el espacio
  }
  return partes.join(CRLF + " ");
}

/** Fecha a formato UTC basico: 20260417T210000Z. */
function aUtc(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * `SEQUENCE` debe crecer con cada edicion para que el cliente reemplace el
 * evento en vez de ignorar la actualizacion. Se deriva de `updated_at`:
 * minutos desde 2026, que cabe de sobra en un entero y siempre aumenta.
 */
function secuencia(updatedAt) {
  if (!updatedAt) return 0;
  const d = new Date(updatedAt);
  if (isNaN(d.getTime())) return 0;
  const base = Date.UTC(2026, 0, 1);
  return Math.max(0, Math.floor((d.getTime() - base) / 60000));
}

const ETIQUETA_TIPO = {
  EXAMEN: "Evaluación",
  HITO_ACADEMICO: "Hito académico",
  EVENTO: "Evento",
  CHARLA: "Charla",
  TALLER: "Taller",
  ENTREGA: "Entrega",
  EXTRAPROGRAMATICA: "Extraprogramática",
};

/** Descripcion legible del evento: quien lo organiza, de que tipo y el enlace. */
function descripcion(a) {
  const partes = [];
  if (a.descripcion) partes.push(a.descripcion);
  if (a.entidad_nombre) partes.push("Organiza: " + a.entidad_nombre);
  if (a.tipo) partes.push("Tipo: " + (ETIQUETA_TIPO[a.tipo] || a.tipo));
  if (a.ramo) partes.push("Ramo: " + a.ramo);
  if (a.url_inscripcion) partes.push("Inscripción: " + a.url_inscripcion);
  return partes.join("\n");
}

/**
 * @param {object} a  fila de actividadDao.listar()
 * @param {string} dominio  host de MapFI, para el UID
 * @returns {string[]|null} lineas del VEVENT, o null si la fecha es ilegible
 */
function evento(a, dominio, ahora) {
  const inicio = aUtc(a.fecha_inicio);
  const fin = aUtc(a.fecha_fin || a.fecha_inicio);
  if (!inicio || !fin) return null; // una fila corrupta no invalida el feed entero

  // Una actividad eliminada se emite como CANCELLED en vez de omitirse: asi
  // el calendario de quien ya la tenia la marca como cancelada, en vez de
  // dejarle un evento fantasma al que llegaria igual.
  const cancelada = a.estado === "ARCHIVADA";

  const lineas = [
    "BEGIN:VEVENT",
    `UID:mapfi-actividad-${a.id}@${dominio}`,
    `DTSTAMP:${ahora}`,
    `DTSTART:${inicio}`,
    `DTEND:${fin}`,
    `SEQUENCE:${secuencia(a.updated_at)}`,
    `SUMMARY:${escaparTexto(cancelada ? "CANCELADA: " + a.titulo : a.titulo)}`,
    `STATUS:${cancelada ? "CANCELLED" : "CONFIRMED"}`,
    `TRANSP:${a.tipo === "EXAMEN" ? "OPAQUE" : "TRANSPARENT"}`,
  ];
  const desc = descripcion(a);
  if (desc) lineas.push(`DESCRIPTION:${escaparTexto(desc)}`);
  if (a.ubicacion) lineas.push(`LOCATION:${escaparTexto(a.ubicacion)}`);
  if (a.url_inscripcion) lineas.push(`URL:${a.url_inscripcion}`);
  // Sin ORGANIZER: esa propiedad exige una direccion CAL-ADDRESS real
  // (mailto:) y no tenemos una por entidad. Inventarla hace que los parsers
  // estrictos descarten el evento entero. El organizador va en DESCRIPTION.
  lineas.push("END:VEVENT");
  return lineas;
}

/**
 * Construye el calendario completo.
 * @param {Array} actividades
 * @param {{nombre?:string, dominio?:string, ahora?:Date}} [opts]
 * @returns {string} texto iCalendar listo para servir como text/calendar
 */
function generar(actividades = [], opts = {}) {
  const dominio = opts.dominio || "mapfi.udec.cl";
  const nombre = opts.nombre || "MapFI · Facultad de Ingeniería";
  const ahora = aUtc(opts.ahora || new Date());

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MapFI//Calendario Facultad de Ingenieria UdeC//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escaparTexto(nombre)}`,
    "X-WR-TIMEZONE:America/Santiago",
    // Sugerencia de refresco. Google la ignora (refresca cada 12-24 h a su
    // criterio); Apple y Outlook si la respetan en cierta medida.
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  for (const a of actividades) {
    const ev = evento(a, dominio, ahora);
    if (ev) lineas.push(...ev);
  }
  lineas.push("END:VCALENDAR");

  // El archivo debe terminar tambien en CRLF.
  return lineas.map(plegar).join(CRLF) + CRLF;
}

module.exports = { generar, escaparTexto, plegar, aUtc, secuencia };
