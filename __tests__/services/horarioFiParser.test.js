"use strict";

const fs = require("fs");
const path = require("path");
const {
  parsearArchivoFI,
  aBloques,
  bloqueAHora,
  parsearLineaHorario,
  rangosContiguos,
  repararMojibake,
  esInicioRegistro,
} = require("../../js/services/horarioFiParser");

const T = "\t";

describe("horarioFiParser — bloques a horas", () => {
  test.each([
    [1, "08:00"],
    [2, "09:00"],
    [8, "15:00"],
    [13, "20:00"],
  ])("bloque %i empieza a las %s", (n, esperado) => {
    expect(bloqueAHora(n)).toBe(esperado);
  });

  test("un bloque suelto dura una hora: el 13 termina a las 21:00", () => {
    // El fin de un bloque es el inicio del siguiente.
    expect(bloqueAHora(13 + 1)).toBe("21:00");
  });
});

describe("horarioFiParser — rangosContiguos", () => {
  test("bloques contiguos se fusionan en un tramo", () => {
    expect(rangosContiguos([1, 2])).toEqual([[1, 2]]);
    expect(rangosContiguos([1, 2, 3])).toEqual([[1, 3]]);
    expect(rangosContiguos([5])).toEqual([[5, 5]]);
  });

  test("bloques no contiguos producen tramos separados", () => {
    expect(rangosContiguos([1, 2, 5, 6])).toEqual([[1, 2], [5, 6]]);
  });

  test("desordenados y repetidos se normalizan", () => {
    expect(rangosContiguos([2, 1, 2])).toEqual([[1, 2]]);
  });

  test("lista vacía no revienta", () => {
    expect(rangosContiguos([])).toEqual([]);
  });
});

describe("horarioFiParser — línea de horario", () => {
  test("una sesión simple", () => {
    const { sesiones } = parsearLineaHorario("[T] Ma 1,2 (A-411)");
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0]).toMatchObject({
      diaSemana: 2, horaInicio: "08:00", horaFin: "10:00", sala: "A-411", tipoSesion: "T",
    });
  });

  test("el guion con espacios separa dos sesiones en días distintos", () => {
    const { sesiones } = parsearLineaHorario("[T] Ma 1,2 (A-411) - Ju 1,2 (A-411)");
    expect(sesiones).toHaveLength(2);
    expect(sesiones.map((s) => s.diaSemana)).toEqual([2, 4]);
  });

  test("T-8: dos sesiones el MISMO día no se colapsan (L81)", () => {
    const { sesiones } = parsearLineaHorario("[T G1] Lu 5,6 (TM 1-3) - Lu 7,8 (TM 3-17)");
    expect(sesiones).toHaveLength(2);
    expect(sesiones.map((s) => s.diaSemana)).toEqual([1, 1]);
    expect(sesiones.map((s) => s.horaInicio)).toEqual(["12:00", "14:00"]);
    expect(sesiones.map((s) => s.sala)).toEqual(["TM 1-3", "TM 3-17"]);
  });

  test("T-7: el guion SIN espacios es parte de la sala, no separa", () => {
    const { sesiones } = parsearLineaHorario("[P] Vi 5 (TM 3-15)");
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].sala).toBe("TM 3-15");
  });

  test("cuatro sesiones en una línea (L81 completa)", () => {
    const { sesiones } = parsearLineaHorario(
      "[T G1] Lu 5,6 (TM 1-3) - Lu 7,8 (TM 3-17) - Mi 5,6 (TM 1-3) - Vi 6,7 (TM 3-3)"
    );
    expect(sesiones).toHaveLength(4);
    expect(sesiones.every((s) => s.grupo === "1")).toBe(true);
  });

  test("tres bloques seguidos dan un solo tramo largo", () => {
    const { sesiones } = parsearLineaHorario("[T] Vi 1,2,3 (DII 4)");
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0]).toMatchObject({ horaInicio: "08:00", horaFin: "11:00" });
  });

  test("conserva el tipo de sesión y el grupo", () => {
    const { sesiones } = parsearLineaHorario("[L G2] Vi 8,9 (LabSoftwar)");
    expect(sesiones[0]).toMatchObject({ tipoSesion: "L", grupo: "2" });
  });

  test("salas anómalas se aceptan tal cual", () => {
    expect(parsearLineaHorario("[T] Ma 8,9 (Pend)").sesiones[0].sala).toBe("Pend");
    expect(parsearLineaHorario("[T] Mi 2,3,4 (Fija Prof)").sesiones[0].sala).toBe("Fija Prof");
  });

  test("un bloque fuera de 1..13 se reporta como error y no se emite", () => {
    const r = parsearLineaHorario("[T] Lu 99 (A-1)");
    expect(r.sesiones).toHaveLength(0);
    expect(r.errores).toHaveLength(1);
  });
});

describe("horarioFiParser — T-3: docente vs horario", () => {
  test.each([
    "[T] Luis Bello",
    "[T] Manuel Melo",
    "[T] Miguel Ángel",
    "[T] Juan Carrasco",
    "[T] Víctor Aros Q",
    "[T] Lucy Pérez",
    "[T] Mario Soto",
  ])("'%s' NO es una línea de horario", (linea) => {
    expect(parsearLineaHorario(linea).sesiones).toHaveLength(0);
  });

  test.each([
    "[T] Lu 5,6 (A-1)",
    "[T] Ma 1,2 (A-411)",
    "[P] Mi 8,9 (TM 3-7)",
    "[L] Ju 3,4 (LabRedes)",
    "[T] Vi 1 (A-9)",
  ])("'%s' SÍ es una línea de horario", (linea) => {
    expect(parsearLineaHorario(linea).sesiones.length).toBeGreaterThan(0);
  });
});

describe("horarioFiParser — T-5: mojibake", () => {
  test("repara la doble codificación de é", () => {
    expect(repararMojibake("EspaÃ±ol")).toBe("Español");
    expect(repararMojibake("InglÃ©s")).toBe("Inglés");
  });

  test("repara í escrito con guion blando invisible", () => {
    expect(repararMojibake("IngenierÃ­a")).toBe("Ingeniería");
  });

  test("no toca texto correctamente codificado", () => {
    expect(repararMojibake("Cálculo I Aplicado a la Ingeniería")).toBe("Cálculo I Aplicado a la Ingeniería");
    expect(repararMojibake("Álgebra y Geometría")).toBe("Álgebra y Geometría");
  });
});

describe("horarioFiParser — detección de inicio de registro", () => {
  test("una línea con código de 6 dígitos abre registro", () => {
    expect(esInicioRegistro(`500107${T}1${T}Cálculo I${T}5${T}[T] Ma 1,2 (A-411)`)).toBe(true);
  });

  test("T-2: una línea sin código pero con horario al final también abre registro", () => {
    expect(esInicioRegistro(`${T}Comportamiento Organizacional${T}3${T}[T] Vi 1,2,3 (DII 4)`)).toBe(true);
    expect(esInicioRegistro(`1${T}Lógica${T}5${T}[T] Ma 3,4 (IS 2-1) - Mi 10,11 (IS 2-1)`)).toBe(true);
  });

  test("una línea de continuación NO abre registro", () => {
    expect(esInicioRegistro("[P] Ma 8,9 (A-9)")).toBe(false);
  });

  test("una línea de cola NO abre registro", () => {
    expect(esInicioRegistro(`OBLIG${T}[T] Rodrigo Silva${T}02/06/26`)).toBe(false);
    expect(esInicioRegistro(`[T] Úrsula Moya Moya${T}23/06/26`)).toBe(false);
  });
});

describe("horarioFiParser — registro completo", () => {
  const REGISTRO = [
    `500107${T}1${T}Cálculo I Aplicado a la Ingeniería${T}5${T}[T] Ma 1,2 (A-411) - Ju 1,2 (A-411)`,
    "[P] Ma 8,9 (A-9)",
    `[T] Úrsula Moya Moya${T}23/06/26`,
  ].join("\n");

  test("agrupa las 3 líneas en un solo registro con 3 sesiones", () => {
    const { registros, errores } = parsearArchivoFI(REGISTRO);
    expect(errores).toHaveLength(0);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      codigo: "500107", seccion: "1", ramo: "Cálculo I Aplicado a la Ingeniería",
      docente: "Úrsula Moya Moya",
    });
    expect(registros[0].sesiones).toHaveLength(3);
  });

  test("la fecha de examen no llega a los bloques", () => {
    const { registros } = parsearArchivoFI(REGISTRO);
    const bloques = aBloques(registros[0]);
    bloques.forEach((b) => {
      expect(Object.keys(b)).not.toContain("fecha");
      expect(JSON.stringify(b)).not.toContain("23/06/26");
    });
  });

  test("la práctica queda etiquetada en el nombre visible del ramo", () => {
    const { registros } = parsearArchivoFI(REGISTRO);
    const bloques = aBloques(registros[0]);
    const practica = bloques.find((b) => b.descripcion.includes("Práctica"));
    expect(practica).toBeDefined();
    expect(practica.descripcion).toBe("Cálculo I Aplicado a la Ingeniería (Práctica)");
    // La teoría sin grupo se queda con el nombre limpio.
    expect(bloques.some((b) => b.descripcion === "Cálculo I Aplicado a la Ingeniería")).toBe(true);
  });

  test("todos los bloques salen como CLASE (es lo único que admite la tabla)", () => {
    const { registros } = parsearArchivoFI(REGISTRO);
    aBloques(registros[0]).forEach((b) => expect(b.tipo).toBe("CLASE"));
  });

  test("forma de 8 campos con horario vacío y cola en línea (L134)", () => {
    const txt = `544499${T}1${T}Memoria de Título${T}20${T}${T}OBLIG${T}[T] Rodrigo Silva${T}02/06/26`;
    const { registros } = parsearArchivoFI(txt);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      codigo: "544499", ramo: "Memoria de Título",
      docente: "Rodrigo Silva", obligatoriedad: "OBLIG",
    });
    expect(registros[0].sesiones).toHaveLength(0);
  });

  test("co-docentes separados por guion, con guion colgante (L586)", () => {
    const txt = [
      `546101${T}1${T}Gestión de Empresas${T}4${T}[T] Ma 12,13 (A-1)`,
      `[T] María Hormazábal -${T}15/07/26`,
    ].join("\n");
    const { registros } = parsearArchivoFI(txt);
    expect(registros[0].docente).toBe("María Hormazábal");
  });

  test("varios co-docentes se unen con coma", () => {
    const txt = [
      `540110${T}1${T}Introduccion a los Bioprocesos${T}3${T}[T] Ma 1,2 (TQ 2-1)`,
      `[T] Ana Baeza - Manuel Gutiérrez - Felipe Meyer${T}13/08/26`,
    ].join("\n");
    const { registros } = parsearArchivoFI(txt);
    expect(registros[0].docente).toBe("Ana Baeza, Manuel Gutiérrez, Felipe Meyer");
  });

  test("registro sin docente ni fecha no produce error", () => {
    const txt = [
      `500711${T}1${T}Inglés Comunicativo 1${T}3${T}[T] Lu 8,9 (TM 3-3) - Vi 8,9 (TM 3-10)`,
    ].join("\n");
    const { registros, errores } = parsearArchivoFI(txt);
    expect(errores).toHaveLength(0);
    expect(registros[0].docente).toBeNull();
    expect(registros[0].sesiones).toHaveLength(2);
  });
});

describe("horarioFiParser — T-2 y T-1: registros sin código heredan de su bloque", () => {
  test("hereda el código del registro siguiente del mismo bloque", () => {
    const txt = [
      "INGENIERIA INDUSTRIAL",
      `${T}Comportamiento Organizacional${T}3${T}[T] Vi 1,2,3 (DII 4)`,
      `[T] Ramón Díaz${T}14/07/26`,
      `546101${T}1${T}Gestión de Empresas${T}4${T}[T] Ma 12,13 (A-1)`,
      `[T] María Hormazábal${T}15/07/26`,
    ].join("\n");
    const { registros } = parsearArchivoFI(txt);
    const sinCodigo = registros.find((r) => r.ramo === "Comportamiento Organizacional");
    expect(sinCodigo.codigo).toBeNull();
    expect(sinCodigo.codigoHeredado).toBe("546101");
  });

  test("T-1: el bloque sin encabezado hereda de SU bloque, no de la sección anterior", () => {
    const txt = [
      "INGENIERIA QUIMICA",
      `540110${T}1${T}Introduccion a los Bioprocesos${T}3${T}[T] Ma 1,2 (TQ 2-1)`,
      `[T] Gerard Alonso${T}03/06/26`,
      "",
      `1${T}Ciencia de Materiales${T}5${T}[T] Lu 3,4 (I2030) - Ma 1,2 (TM 3-2)`,
      `[T] Alguien${T}10/08/26`,
      `548256${T}1${T}Termodinámica de Materiales${T}4${T}[T] Mi 3,4 (TM 1-1)`,
      `[T] Otro${T}11/08/26`,
    ].join("\n");
    const { registros } = parsearArchivoFI(txt);
    const ciencia = registros.find((r) => r.ramo === "Ciencia de Materiales");
    // Debe heredar 548xxx (Materiales), NO 540xxx (Química) pese a que el
    // último encabezado visto es INGENIERIA QUIMICA.
    expect(ciencia.codigoHeredado).toBe("548256");
  });

  test("la forma de 5 campos con el primero vacío también se interpreta (L1154)", () => {
    const txt = [
      "INGENIERIA METALURGICA",
      `${T}1${T}Balance de Materia y Energía${T}3${T}[T] Lu 10,11 (TM 1-2) - Mi 8,9 (TM 3-13)`,
      `OBLIG${T}[T] Eduardo Balladares${T}14/08/26`,
      `542253${T}1${T}Fenómenos de Transporte${T}4${T}[T] Ma 10,11 (TM 3-3)`,
    ].join("\n");
    const { registros } = parsearArchivoFI(txt);
    const balance = registros.find((r) => r.ramo === "Balance de Materia y Energía");
    expect(balance).toBeDefined();
    expect(balance.seccion).toBe("1");
    expect(balance.sesiones).toHaveLength(2);
    expect(balance.codigoHeredado).toBe("542253");
  });
});

// ── Contra el archivo real de la Facultad ──────────────────────────────────
// Si el archivo no está (por ejemplo en un clon sin la carpeta Extras), estas
// pruebas se saltan en vez de fallar: son de datos, no de código.
const RUTA_REAL = path.join(__dirname, "..", "..", "Extras", "Horarios_FI_UDEC.txt");
const hayArchivo = fs.existsSync(RUTA_REAL);
const describeReal = hayArchivo ? describe : describe.skip;

describeReal("horarioFiParser — archivo real de la Facultad", () => {
  let resultado;
  beforeAll(() => {
    resultado = parsearArchivoFI(fs.readFileSync(RUTA_REAL, "utf8"));
  });

  test("interpreta los 536 registros del archivo", () => {
    expect(resultado.registros).toHaveLength(536);
  });

  test("no deja ninguna línea sin interpretar", () => {
    expect(resultado.errores).toEqual([]);
  });

  test("los 6 registros sin código quedan identificados y con carrera heredada", () => {
    const sinCodigo = resultado.registros.filter((r) => !r.codigo);
    expect(sinCodigo).toHaveLength(6);
    sinCodigo.forEach((r) => expect(r.codigoHeredado).toMatch(/^\d{6}$/));
  });

  test("el mojibake de las dos líneas conocidas quedó reparado", () => {
    const nombres = resultado.registros.map((r) => r.ramo);
    expect(nombres).toContain("Inglés Comunicativo 1 Nivel Principiante");
    expect(nombres.some((n) => n.includes("Ã"))).toBe(false);
    expect(nombres.some((n) => n.includes("­"))).toBe(false);
  });

  test("todo bloque emitido cabe en la grilla 08:00-21:00 y es válido", () => {
    const bloques = resultado.registros.flatMap(aBloques);
    expect(bloques.length).toBeGreaterThan(1000);
    bloques.forEach((b) => {
      expect(b.diaSemana).toBeGreaterThanOrEqual(1);
      expect(b.diaSemana).toBeLessThanOrEqual(5);
      expect(b.horaInicio >= "08:00").toBe(true);
      expect(b.horaFin <= "21:00").toBe(true);
      expect(b.horaFin > b.horaInicio).toBe(true);
      expect(b.descripcion).toBeTruthy();
    });
  });

  test("(código, sección) no se repite: es clave única del archivo", () => {
    const vistos = new Set();
    resultado.registros.filter((r) => r.codigo).forEach((r) => {
      const clave = r.codigo + "|" + r.seccion;
      expect(vistos.has(clave)).toBe(false);
      vistos.add(clave);
    });
  });

  test("Cálculo I sección 1 sale exactamente como dice el archivo", () => {
    const reg = resultado.registros.find((r) => r.codigo === "500107" && r.seccion === "1");
    expect(reg.ramo).toBe("Cálculo I Aplicado a la Ingeniería");
    expect(reg.docente).toBe("Úrsula Moya Moya");
    const bloques = aBloques(reg);
    expect(bloques).toHaveLength(3);
    expect(bloques[0]).toMatchObject({ diaSemana: 2, horaInicio: "08:00", horaFin: "10:00", sala: "A-411" });
    expect(bloques[1]).toMatchObject({ diaSemana: 4, horaInicio: "08:00", horaFin: "10:00", sala: "A-411" });
    expect(bloques[2]).toMatchObject({ diaSemana: 2, horaInicio: "15:00", horaFin: "17:00", sala: "A-9" });
  });
});
