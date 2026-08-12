"use strict";
/**
 * Pruebas del generador iCalendar. Se centran en los detalles del formato que
 * hacen que un archivo "se vea bien" en un editor de texto y aun asi lo
 * rechacen Google u Outlook, y en la defensa de inyeccion.
 */
const ics = require("../../js/services/icsService");

/**
 * Deshace el plegado de líneas. Hace falta para comprobar contenido: una
 * descripción larga se parte en varias líneas y buscar la subcadena entera
 * sobre el texto crudo daría un falso negativo.
 */
const desplegar = (txt) => txt.replace(/\r\n /g, "");

/** Líneas que declaran la propiedad indicada (al inicio de línea). */
const propiedades = (txt, nombre) =>
  txt.split("\r\n").filter((l) => l.startsWith(nombre + ":") || l.startsWith(nombre + ";"));

const BASE = {
  id: 42,
  titulo: "Charla de titulación",
  descripcion: "Trae tu currículum",
  entidad_nombre: "CEE Industrial",
  tipo: "CHARLA",
  fecha_inicio: "2026-04-17T21:00:00.000Z",
  fecha_fin: "2026-04-17T23:00:00.000Z",
  ubicacion: "Aula Magna",
  estado: "CONFIRMADA",
  updated_at: "2026-04-01T10:00:00.000Z",
};

describe("icsService — formato exigido por RFC 5545", () => {
  test("las líneas terminan en CRLF, no en salto simple", () => {
    const txt = ics.generar([BASE]);
    expect(txt).toContain("\r\n");
    // Ningún \n suelto: todos deben ir precedidos de \r.
    expect(txt.replace(/\r\n/g, "")).not.toContain("\n");
  });

  test("empieza y termina como un calendario válido", () => {
    const txt = ics.generar([BASE]);
    expect(txt.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(txt.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(txt).toContain("VERSION:2.0");
    expect(txt).toContain("METHOD:PUBLISH");
  });

  test("ninguna línea supera los 75 octetos", () => {
    const largo = {
      ...BASE,
      titulo: "Taller de preparación para la práctica profesional " +
              "con inscripción previa y cupos limitados por carrera",
    };
    const txt = ics.generar([largo]);
    for (const linea of txt.split("\r\n")) {
      expect(Buffer.from(linea, "utf8").length).toBeLessThanOrEqual(75);
    }
  });

  test("el plegado no parte un carácter multibyte por la mitad", () => {
    // Solo tildes y eñes: si se cortara por octetos sin cuidado, el texto
    // resultante traería caracteres corruptos.
    const txt = ics.generar([{ ...BASE, titulo: "ñ".repeat(80) }]);
    expect(txt).not.toContain("�"); // carácter de reemplazo
    const desplegado = txt.replace(/\r\n /g, "");
    expect(desplegado).toContain("ñ".repeat(80));
  });

  test("las fechas van en UTC con sufijo Z", () => {
    const txt = ics.generar([BASE]);
    expect(txt).toContain("DTSTART:20260417T210000Z");
    expect(txt).toContain("DTEND:20260417T230000Z");
  });
});

describe("icsService — escapado (defensa de inyección ICS)", () => {
  test("escapa los caracteres reservados", () => {
    expect(ics.escaparTexto("a;b,c\\d")).toBe("a\\;b\\,c\\\\d");
  });

  test("un salto de línea en el título NO puede inyectar propiedades", () => {
    // Sin escapar, esto crearía una línea "SUMMARY:Inyectado" propia dentro
    // del evento que le aparece a quien se suscribió.
    const malicioso = { ...BASE, titulo: "Charla\r\nSUMMARY:Inyectado\r\nDESCRIPTION:x" };
    const txt = ics.generar([malicioso]);
    // La propiedad de seguridad real es que el evento declare UNA sola
    // SUMMARY: el texto inyectado queda como valor literal dentro de ella,
    // no como una propiedad nueva. (Buscar la subcadena suelta daría un
    // falso positivo: aparece escapada dentro del propio valor.)
    expect(propiedades(txt, "SUMMARY")).toHaveLength(1);
    expect(propiedades(txt, "DESCRIPTION")).toHaveLength(1);
    expect(txt).toContain("\\n"); // el salto quedó escapado como texto
  });

  test("la barra invertida se escapa primero, sin doble procesado", () => {
    expect(ics.escaparTexto("\\;")).toBe("\\\\\\;");
  });
});

describe("icsService — identidad y actualizaciones", () => {
  test("el UID es estable entre generaciones: editar actualiza, no duplica", () => {
    const a = ics.generar([BASE]);
    const b = ics.generar([{ ...BASE, titulo: "Otro título" }]);
    const uid = (t) => t.split("\r\n").find((l) => l.startsWith("UID:"));
    expect(uid(a)).toBe(uid(b));
    expect(uid(a)).toContain("mapfi-actividad-42@");
  });

  test("SEQUENCE crece cuando la actividad se edita más tarde", () => {
    const antes = ics.secuencia("2026-04-01T10:00:00Z");
    const despues = ics.secuencia("2026-04-02T10:00:00Z");
    expect(despues).toBeGreaterThan(antes);
  });

  test("una actividad eliminada se emite como CANCELLED", () => {
    // Así el calendario de quien ya la tenía la marca como cancelada, en vez
    // de dejarle un evento fantasma al que llegaría igual.
    const txt = ics.generar([{ ...BASE, estado: "ARCHIVADA" }]);
    expect(txt).toContain("STATUS:CANCELLED");
    expect(txt).toContain("CANCELADA: Charla de titulación");
  });

  test("una actividad vigente se emite como CONFIRMED", () => {
    expect(ics.generar([BASE])).toContain("STATUS:CONFIRMED");
  });
});

describe("icsService — contenido útil", () => {
  test("incluye el enlace de inscripción como URL y en la descripción", () => {
    const txt = ics.generar([{ ...BASE, url_inscripcion: "https://forms.gle/abc" }]);
    expect(txt).toContain("URL:https://forms.gle/abc");
    // La descripción se pliega en varias líneas: hay que desplegar antes.
    expect(desplegar(txt)).toContain("Inscripción: https://forms.gle/abc");
  });

  test("solo las evaluaciones marcan el tiempo como ocupado", () => {
    expect(ics.generar([{ ...BASE, tipo: "EXAMEN" }])).toContain("TRANSP:OPAQUE");
    expect(ics.generar([BASE])).toContain("TRANSP:TRANSPARENT");
  });

  test("una fila con fecha ilegible se omite sin romper el resto del feed", () => {
    const txt = ics.generar([{ ...BASE, id: 1, fecha_inicio: "no-es-fecha" }, { ...BASE, id: 2 }]);
    expect(txt).toContain("mapfi-actividad-2@");
    expect(txt).not.toContain("mapfi-actividad-1@");
    expect(txt.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  test("sin actividades devuelve un calendario válido y vacío", () => {
    const txt = ics.generar([]);
    expect(txt).toContain("BEGIN:VCALENDAR");
    expect(txt).not.toContain("BEGIN:VEVENT");
  });
});
