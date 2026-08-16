"use strict";

const { parsear, detectarBinario, aCsv } = require("../js/horario-csv");

describe("horario-csv — parsear: los tres separadores", () => {
  test("separado por ';'", () => {
    const texto = "dia;inicio;fin;ramo\nLUN;08:00;09:30;Cálculo I";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({ diaSemana: 1, horaInicio: "08:00", horaFin: "09:30", descripcion: "Cálculo I" });
  });

  test("separado por ','", () => {
    const texto = "dia,inicio,fin,ramo\nMAR,10:00,11:30,Física I";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques[0]).toMatchObject({ diaSemana: 2, descripcion: "Física I" });
  });

  test("separado por tabulación (pegado desde una planilla)", () => {
    const texto = "dia\tinicio\tfin\tramo\nMIE\t11:00\t12:30\tQuímica";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques[0]).toMatchObject({ diaSemana: 3, descripcion: "Química" });
  });
});

describe("horario-csv — parsear: encabezado", () => {
  test("acepta las columnas en cualquier orden", () => {
    const texto = "ramo;fin;dia;inicio\nÁlgebra;10:00;LUN;08:30";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques[0]).toMatchObject({ diaSemana: 1, horaInicio: "08:30", horaFin: "10:00", descripcion: "Álgebra" });
  });

  test("acepta alias de columnas (asignatura, hora_inicio, término)", () => {
    const texto = "dia;hora_inicio;termino;asignatura\nJUE;14:30;16:00;Programación";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques[0]).toMatchObject({ diaSemana: 4, horaInicio: "14:30", horaFin: "16:00", descripcion: "Programación" });
  });

  test("encabezado sin las columnas obligatorias produce un error claro, no una excepción", () => {
    const texto = "dia;inicio\nLUN;08:00";
    const { bloques, errores } = parsear(texto);
    expect(bloques).toHaveLength(0);
    expect(errores).toHaveLength(1);
    expect(errores[0].error).toMatch(/fin|ramo/i);
  });
});

describe("horario-csv — parsear: dia en tres notaciones", () => {
  test.each([
    ["1", 1], ["LUN", 1], ["Lunes", 1], ["lunes", 1],
    ["3", 3], ["MIE", 3], ["MIÉ", 3], ["Miércoles", 3], ["Miercoles", 3],
    ["5", 5], ["VIE", 5], ["Viernes", 5],
  ])("'%s' → día %i", (entrada, esperado) => {
    const texto = "dia;inicio;fin;ramo\n" + entrada + ";08:00;09:00;X";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques[0].diaSemana).toBe(esperado);
  });

  test("un día inválido produce un error con el número de fila", () => {
    const texto = "dia;inicio;fin;ramo\nXXX;08:00;09:00;Ramo";
    const { bloques, errores } = parsear(texto);
    expect(bloques).toHaveLength(0);
    expect(errores).toHaveLength(1);
    expect(errores[0].fila).toBe(2);
    expect(errores[0].error).toMatch(/día/i);
  });

  test("sábado (6) no es un día académico válido", () => {
    const texto = "dia;inicio;fin;ramo\n6;08:00;09:00;Ramo";
    const { errores } = parsear(texto);
    expect(errores).toHaveLength(1);
  });
});

describe("horario-csv — parsear: horas y validaciones por fila", () => {
  test("acepta 'H:MM' además de 'HH:MM'", () => {
    const texto = "dia;inicio;fin;ramo\nLUN;8:00;9:00;X";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques[0].horaInicio).toBe("8:00");
  });

  test("hora ausente produce un error por fila", () => {
    const texto = "dia;inicio;fin;ramo\nLUN;;09:00;X";
    const { errores } = parsear(texto);
    expect(errores).toHaveLength(1);
    expect(errores[0].error).toMatch(/hora/i);
  });

  test("hora de término anterior a la de inicio produce un error", () => {
    const texto = "dia;inicio;fin;ramo\nMAR;10:00;09:00;X";
    const { errores } = parsear(texto);
    expect(errores).toHaveLength(1);
    expect(errores[0].error).toMatch(/término|termino/i);
  });

  test("ramo vacío produce un error", () => {
    const texto = "dia;inicio;fin;ramo\nJUE;09:00;10:30;";
    const { errores } = parsear(texto);
    expect(errores).toHaveLength(1);
    expect(errores[0].error).toMatch(/ramo/i);
  });

  test("hora que no cae en un cuarto de hora NO es error, es una fila válida (se ajusta al dibujar)", () => {
    const texto = "dia;inicio;fin;ramo\nMIE;11:50;13:20;Bloque";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques).toHaveLength(1);
  });

  test("una fila inválida no bloquea las filas válidas del mismo archivo", () => {
    const texto = [
      "dia;inicio;fin;ramo;tipo",
      "LUN;08:00;09:30;Cálculo I;CLASE",
      "XXX;08:00;09:30;Ramo con día inválido;CLASE",
      "MAR;10:00;09:00;Ramo con fin antes del inicio;CLASE",
      "MIE;;;Ramo sin horas;CLASE",
      "JUE;09:00;10:30;;CLASE",
      "VIE;09:00;10:30;Ramo válido al final;CLASE",
    ].join("\n");
    const { bloques, errores } = parsear(texto);
    expect(bloques).toHaveLength(2);
    expect(bloques.map((b) => b.descripcion)).toEqual(["Cálculo I", "Ramo válido al final"]);
    expect(errores).toHaveLength(4);
    // Los numeros de fila identifican la fila real del archivo (1 = encabezado).
    expect(errores.map((e) => e.fila)).toEqual([3, 4, 5, 6]);
  });
});

describe("horario-csv — parsear: campos opcionales y tipo por defecto", () => {
  test("tipo por defecto es CLASE si no viene la columna", () => {
    const texto = "dia;inicio;fin;ramo\nLUN;08:00;09:00;X";
    const { bloques } = parsear(texto);
    expect(bloques[0].tipo).toBe("CLASE");
  });

  test("respeta un tipo explícito", () => {
    const texto = "dia;inicio;fin;ramo;tipo\nLUN;08:00;09:00;X;PROTEGIDO";
    const { bloques } = parsear(texto);
    expect(bloques[0].tipo).toBe("PROTEGIDO");
  });

  test("sala, docente, seccion y codigo son opcionales y se leen si vienen", () => {
    const texto = "dia;inicio;fin;ramo;codigo;seccion;sala;docente\nLUN;08:00;09:00;X;525101;1;Aula 201;J. Pérez";
    const { bloques } = parsear(texto);
    expect(bloques[0]).toMatchObject({ codigo: "525101", seccion: "1", sala: "Aula 201", docente: "J. Pérez" });
  });

  test("sin esas columnas, los campos opcionales quedan null (no undefined ni cadena vacía)", () => {
    const texto = "dia;inicio;fin;ramo\nLUN;08:00;09:00;X";
    const { bloques } = parsear(texto);
    expect(bloques[0].codigo).toBeNull();
    expect(bloques[0].sala).toBeNull();
  });
});

describe("horario-csv — parsear: BOM, acentos y comillas", () => {
  test("tolera BOM UTF-8 al inicio del archivo", () => {
    const texto = "﻿dia;inicio;fin;ramo\nLUN;08:00;09:00;Cálculo I";
    const { bloques, errores } = parsear(texto);
    expect(errores).toHaveLength(0);
    expect(bloques[0].descripcion).toBe("Cálculo I");
  });

  test("respeta comillas con el separador dentro del campo", () => {
    const texto = 'dia;inicio;fin;ramo\nLUN;08:00;09:00;"Cálculo, Álgebra y Geometría"';
    const { bloques } = parsear(texto);
    expect(bloques[0].descripcion).toBe("Cálculo, Álgebra y Geometría");
  });
});

describe("horario-csv — parsear nunca lanza", () => {
  test("un texto vacío devuelve un error de encabezado, no una excepción", () => {
    expect(() => parsear("")).not.toThrow();
    const { bloques, errores } = parsear("");
    expect(bloques).toHaveLength(0);
    expect(errores.length).toBeGreaterThan(0);
  });

  test("basura sin estructura no revienta el parser", () => {
    expect(() => parsear("esto;no;es;un\nhorario;valido;de;ningun;tipo;;;")).not.toThrow();
  });
});

describe("horario-csv — detectarBinario", () => {
  test("detecta un .xlsx/.docx/zip por su firma PK", () => {
    expect(detectarBinario("PK\x03\x04resto del archivo binario")).toBe("xlsx");
  });

  test("detecta un PDF", () => {
    expect(detectarBinario("%PDF-1.7\n%âãÏÓ")).toBe("pdf");
  });

  test("detecta un .xls antiguo (OLE)", () => {
    expect(detectarBinario("\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1")).toBe("xls");
  });

  test("texto CSV normal no se marca como binario", () => {
    expect(detectarBinario("dia;inicio;fin;ramo\nLUN;08:00;09:00;X")).toBeNull();
  });

  test("texto con bytes nulos se marca como binario genérico", () => {
    expect(detectarBinario("dia;inicio\x00fin;ramo")).not.toBeNull();
  });
});

describe("horario-csv — aCsv (ya cubierto en su propia suite de US1, se repite el caso básico)", () => {
  test("produce un encabezado y una fila por bloque", () => {
    const texto = aCsv([
      { dia_semana: 1, hora_inicio: "08:00:00", hora_fin: "09:30:00", tipo: "CLASE", descripcion: "Cálculo I" },
    ]);
    expect(texto).toContain("dia;inicio;fin;ramo;tipo;codigo;seccion;sala;docente");
    expect(texto).toContain("LUN;08:00;09:30;Cálculo I;CLASE");
  });

  // Revisión de seguridad 2026-08-15: un bloque importado por otro centro
  // puede tener un "ramo" que empiece con '=', y este mismo texto se
  // reexporta sin pasar por el servidor al descargar el respaldo antes de
  // vaciar un segmento. Sin neutralizar, Excel/LibreOffice lo evalúa como
  // fórmula al abrir el archivo (CSV/Excel formula injection).
  test.each(["=HYPERLINK(\"https://evil.tld\")", "+1+1", "-1+1", "@SUM(1,1)", "\tmalicioso"])(
    "neutraliza una celda que empieza con '%s' anteponiendo un apóstrofo",
    (payload) => {
      const texto = aCsv([
        { dia_semana: 1, hora_inicio: "08:00", hora_fin: "09:00", tipo: "CLASE", descripcion: payload },
      ]);
      const filaDatos = texto.split("\r\n")[1];
      const campoRamo = filaDatos.split(";")[3];
      // El campo, ya sin las comillas que agrega el propio CSV, debe empezar
      // con apostrofo — Excel lo trata como texto literal, no como formula.
      expect(campoRamo.replace(/^"|"$/g, "")).toMatch(/^'/);
    }
  );

  test("una celda inofensiva no se toca", () => {
    const texto = aCsv([
      { dia_semana: 1, hora_inicio: "08:00", hora_fin: "09:00", tipo: "CLASE", descripcion: "Cálculo I" },
    ]);
    expect(texto).toContain("Cálculo I");
    expect(texto).not.toContain("'Cálculo I");
  });
});
