"use strict";
const CsvUtils = require("../../js/csv-utils");

const cat = {
  carreras: [
    { id: 6, codigo: "ICI" }, { id: 7, codigo: "ICINF" }, { id: 9, codigo: "ICM" },
  ],
  entidades: [{ id: 17, sigla: "DOCFI" }, { id: 6, sigla: "CEEIND" }],
  generaciones: [{ nivel: 1 }, { nivel: 2 }, { nivel: 3 }],
};

describe("CsvUtils.construirActividades", () => {
  test("fila multi-carrera → producto cartesiano del público", () => {
    const csv = "titulo,ramo,tipo,inicio,fin,carreras,niveles,ubicacion\n" +
      "Certamen 1,Cálculo I,EXAMEN,2026-04-15 18:30,2026-04-15 20:00,ICI|ICINF|ICM,1|2,Aula Magna\n";
    const { actividades, errores } = CsvUtils.construirActividades(csv, cat, { defaultEntidadId: 17 });
    expect(errores).toHaveLength(0);
    expect(actividades).toHaveLength(1);
    const a = actividades[0];
    expect(a.publico).toHaveLength(6); // 3 carreras × 2 niveles
    expect(a.ramo).toBe("Cálculo I");
    expect(a.tipo).toBe("EXAMEN");
    expect(a.entidadId).toBe(17);
  });

  test("'*' expande a todas las carreras/niveles; fin vacío = +2h", () => {
    const csv = "titulo,tipo,inicio,fin,carreras,niveles\nCharla,CHARLA,2026-05-06 12:00,,*,*\n";
    const { actividades } = CsvUtils.construirActividades(csv, cat, { defaultEntidadId: 17 });
    expect(actividades[0].publico).toHaveLength(9); // 3 × 3
    expect(actividades[0].tipo).toBe("CHARLA");
    const dur = new Date(actividades[0].fechaFin) - new Date(actividades[0].fechaInicio);
    expect(dur).toBe(2 * 3600 * 1000);
  });

  test("separador ';' (Excel es-CL) y comillas con coma interna", () => {
    const csv = 'titulo;tipo;inicio;fin;carreras;niveles\n"Taller, parte 1";TALLER;2026-05-06 12:00;;ICI;1\n';
    const { actividades, errores } = CsvUtils.construirActividades(csv, cat, { defaultEntidadId: 17 });
    expect(errores).toHaveLength(0);
    expect(actividades[0].titulo).toBe("Taller, parte 1");
    expect(actividades[0].tipo).toBe("TALLER");
  });

  test("código de carrera desconocido → error con número de fila", () => {
    const csv = "titulo,tipo,inicio,fin,carreras,niveles\nX,EXAMEN,2026-04-15 18:30,,ZZZ,1\n";
    const { actividades, errores } = CsvUtils.construirActividades(csv, cat, { defaultEntidadId: 17 });
    expect(actividades).toHaveLength(0);
    expect(errores[0].fila).toBe(2);
    expect(errores[0].error).toMatch(/ZZZ/);
  });

  test("encabezado inválido → error claro", () => {
    const { actividades, errores } = CsvUtils.construirActividades("a,b,c\n1,2,3\n", cat, {});
    expect(actividades).toHaveLength(0);
    expect(errores[0].error).toMatch(/Encabezado/);
  });

  test("T051 (H-05) — 120 filas con público completo se dividen en lotes que no superan el límite del servidor", () => {
    const catCompleto = {
      carreras: Array.from({ length: 14 }, (_, i) => ({ id: i + 1, codigo: "C" + i })),
      entidades: [{ id: 17, sigla: "DOCFI" }],
      generaciones: Array.from({ length: 6 }, (_, i) => ({ nivel: i + 1 })),
    };
    const filas = Array.from({ length: 120 }, (_, i) =>
      `Evaluación ${i},EXAMEN,2026-04-15 18:30,,*,*,`
    );
    const csv = "titulo,tipo,inicio,fin,carreras,niveles,ubicacion\n" + filas.join("\n") + "\n";
    const { actividades, errores } = CsvUtils.construirActividades(csv, catCompleto, { defaultEntidadId: 17 });
    expect(errores).toHaveLength(0);
    expect(actividades).toHaveLength(120);
    expect(actividades[0].publico).toHaveLength(14 * 6); // publico completo, ~2 kB por fila

    const LIMITE_SERVIDOR = 100 * 1024; // express.json({ limit: "100kb" }) en server.js
    const lotes = CsvUtils.dividirEnLotes(actividades, 80000);

    expect(lotes.length).toBeGreaterThan(1); // 120 filas de ~2kB no caben en un solo envio
    for (const lote of lotes) {
      expect(JSON.stringify(lote).length).toBeLessThan(LIMITE_SERVIDOR);
    }
    // ningun dato se pierde ni se reordena al dividir
    expect(lotes.flat()).toEqual(actividades);
  });

  test("normTipo mapea sinónimos y tags nuevos", () => {
    expect(CsvUtils.normTipo("certamen")).toBe("EXAMEN");
    expect(CsvUtils.normTipo("Charla")).toBe("CHARLA");
    expect(CsvUtils.normTipo("ENTREGA")).toBe("ENTREGA");
    expect(CsvUtils.normTipo("extraprogramática")).toBe("EXTRAPROGRAMATICA");
  });
});
