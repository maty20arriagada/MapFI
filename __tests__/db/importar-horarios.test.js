"use strict";

// El script abre el pool de Postgres solo en la carga real; al importarlo como
// modulo no ejecuta main() (guardia `require.main === module`). Aun asi se
// simula js/db para que ningun require transitivo intente conectarse.
jest.mock("../../js/db", () => ({
  pool: { connect: jest.fn(), query: jest.fn(), on: jest.fn(), end: jest.fn() },
  query: jest.fn(),
}));

const { construir, aTextoCsv, campoCsv, escribirSalidas } = require("../../js/db/importar-horarios");
const { CARRERA } = require("../../js/services/horarioCarrera");
const fs = require("fs");

const T = "\t";

// Malla mínima de Plan Común, para que los ramos comunes resuelvan su año.
const indicePlanComun = new Map([
  [CARRERA.ICPC, new Map([
    ["calculo i aplicado a la ingenieria", 1],
    ["calculo ii aplicado a la ingenieria", 2],
  ])],
]);

describe("importar-horarios — campoCsv", () => {
  test("entrecomilla cuando hay separador o comillas", () => {
    expect(campoCsv("Cálculo; Álgebra")).toBe('"Cálculo; Álgebra"');
    expect(campoCsv('Dijo "hola"')).toBe('"Dijo ""hola"""');
  });

  test("neutraliza la inyección de fórmulas igual que HorarioCsv.aCsv", () => {
    // El apóstrofo va delante del valor; si además hay que entrecomillar el
    // campo, queda DENTRO de las comillas del CSV — que es lo correcto.
    const sinComillasCsv = (s) => s.replace(/^"|"$/g, "");
    expect(sinComillasCsv(campoCsv('=HYPERLINK("http://evil")')).startsWith("'")).toBe(true);
    expect(campoCsv("+1+1")).toBe("'+1+1");
    expect(campoCsv("@SUM(1,1)")).toBe("'@SUM(1,1)");
    expect(campoCsv("-1+1")).toBe("'-1+1");
  });

  test("un texto normal no se toca", () => {
    expect(campoCsv("Cálculo I")).toBe("Cálculo I");
    expect(campoCsv(null)).toBe("");
  });
});

describe("importar-horarios — aTextoCsv", () => {
  const bloques = [{
    diaSemana: 1, horaInicio: "08:00", horaFin: "09:30", tipo: "CLASE",
    descripcion: "Cálculo I", codigo: "500107", seccion: "1", sala: "A-411", docente: "Ana",
  }];

  test("emite el encabezado que acepta js/horario-csv.js", () => {
    expect(aTextoCsv(bloques)).toContain("dia;inicio;fin;ramo;tipo;codigo;seccion;sala;docente");
  });

  test("usa las siglas de día y separa por punto y coma", () => {
    expect(aTextoCsv(bloques)).toContain("LUN;08:00;09:30;Cálculo I;CLASE;500107;1;A-411;Ana");
  });

  test("lleva BOM UTF-8 para que Excel respete los acentos", () => {
    expect(aTextoCsv(bloques).charCodeAt(0)).toBe(0xfeff);
  });

  test("el CSV generado se puede volver a leer con el parser de la plataforma", () => {
    const { parsear } = require("../../js/horario-csv");
    const { bloques: leidos, errores } = parsear(aTextoCsv(bloques));
    expect(errores).toHaveLength(0);
    expect(leidos).toHaveLength(1);
    expect(leidos[0]).toMatchObject({
      diaSemana: 1, horaInicio: "08:00", horaFin: "09:30",
      descripcion: "Cálculo I", codigo: "500107", seccion: "1", sala: "A-411", docente: "Ana",
    });
  });
});

describe("importar-horarios — escribirSalidas no bloquea la carga", () => {
  // En el contenedor de producción /app es de root y el proceso corre como
  // usuario no-root, así que escribir el respaldo falla con EACCES. Ese
  // respaldo es un extra: si no se puede escribir, la carga debe seguir.
  const segmentos = new Map([["6|1", [{
    diaSemana: 1, horaInicio: "08:00", horaFin: "09:30", tipo: "CLASE",
    descripcion: "Cálculo I", codigo: "500107", seccion: "1", sala: "A-411", docente: null,
  }]]]);

  afterEach(() => jest.restoreAllMocks());

  test("un EACCES devuelve {ok:false} en vez de lanzar", () => {
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => {
      const e = new Error("EACCES: permission denied, mkdir '/app/Extras/salida'");
      e.code = "EACCES";
      throw e;
    });
    let r;
    expect(() => { r = escribirSalidas(segmentos, "informe", "/app/Extras/salida"); }).not.toThrow();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/EACCES/);
    expect(r.dir).toBe("/app/Extras/salida");
  });

  test("un fallo al escribir un CSV tampoco lanza", () => {
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => { throw new Error("ENOSPC"); });
    const r = escribirSalidas(segmentos, "informe", "/lo/que/sea");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ENOSPC/);
  });

  test("cuando sí puede escribir, devuelve ok con el directorio usado", () => {
    const escritos = [];
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    jest.spyOn(fs, "writeFileSync").mockImplementation((ruta) => { escritos.push(String(ruta)); });
    const r = escribirSalidas(segmentos, "informe", "/destino");
    expect(r).toMatchObject({ ok: true, dir: "/destino" });
    expect(escritos.some((p) => p.includes("REVISION.md"))).toBe(true);
    expect(escritos.some((p) => p.includes("horario-ICI-1.csv"))).toBe(true);
  });
});

describe("importar-horarios — construir", () => {
  const TXT_COMUN = [
    "INGENIERIA CIVIL (TODAS LAS CARRERAS)",
    `500107${T}1${T}Cálculo I Aplicado a la Ingeniería${T}5${T}[T] Ma 1,2 (A-411) - Ju 1,2 (A-411)`,
    `[T] Úrsula Moya Moya${T}23/06/26`,
  ].join("\n");

  test("un ramo común se replica en las 14 carreras", () => {
    const { segmentos } = construir(TXT_COMUN, indicePlanComun);
    const conCalculo = [...segmentos.entries()].filter(([, bs]) =>
      bs.some((b) => b.descripcion.startsWith("Cálculo I"))
    );
    expect(conCalculo).toHaveLength(14);
  });

  test("el ramo común cae en 1.er año en todas ellas", () => {
    const { segmentos } = construir(TXT_COMUN, indicePlanComun);
    [...segmentos.keys()].forEach((clave) => expect(clave.split("|")[1]).toBe("1"));
  });

  test("cada carrera recibe su propia copia, no una compartida", () => {
    const { segmentos } = construir(TXT_COMUN, indicePlanComun);
    const [a, b] = [...segmentos.values()];
    expect(a[0]).not.toBe(b[0]);
    a[0].descripcion = "MUTADO";
    expect(b[0].descripcion).not.toBe("MUTADO");
  });

  test("un ramo de carrera va solo a la suya", () => {
    const txt = [
      "INGENIERIA INFORMATICA",
      `503307${T}1${T}Bases de Datos I${T}4${T}[T] Lu 3,4 (IS 2-1)`,
      `[T] Alguien${T}10/08/26`,
    ].join("\n");
    const { segmentos } = construir(txt, new Map());
    expect(segmentos.size).toBe(1);
    expect([...segmentos.keys()][0].startsWith(String(CARRERA.ICINF))).toBe(true);
  });

  test("los registros sin sesiones no generan bloques pero sí quedan reportados", () => {
    const txt = `544499${T}1${T}Memoria de Título${T}20${T}${T}OBLIG${T}[T] Rodrigo Silva${T}02/06/26`;
    const { segmentos, revision } = construir(txt, new Map());
    expect(segmentos.size).toBe(0);
    expect(revision.sinSesiones).toHaveLength(1);
    expect(revision.sinSesiones[0].ramo).toBe("Memoria de Título");
  });

  test("un prefijo desconocido no se carga y queda listado", () => {
    const txt = [
      `999999${T}1${T}Ramo Fantasma${T}3${T}[T] Lu 1,2 (A-1)`,
      `[T] Nadie${T}10/08/26`,
    ].join("\n");
    const { segmentos, revision } = construir(txt, new Map());
    expect(segmentos.size).toBe(0);
    expect(revision.sinCarrera).toHaveLength(1);
  });

  test("los bloques generados son válidos para bloque_horario", () => {
    const { segmentos } = construir(TXT_COMUN, indicePlanComun);
    [...segmentos.values()].flat().forEach((b) => {
      expect(b.diaSemana).toBeGreaterThanOrEqual(1);
      expect(b.diaSemana).toBeLessThanOrEqual(5);
      expect(["CLASE", "PROTEGIDO", "LIBRE"]).toContain(b.tipo);
      expect(b.horaFin > b.horaInicio).toBe(true);
      expect(b.descripcion).toBeTruthy();
    });
  });

  test("la sección del archivo llega al bloque, para poder filtrar por paralelo", () => {
    const { segmentos } = construir(TXT_COMUN, indicePlanComun);
    [...segmentos.values()].flat().forEach((b) => expect(b.seccion).toBe("1"));
  });

  test("los ramos con año dudoso quedan clasificados por confianza", () => {
    const txt = [
      "INGENIERIA CIVIL (TODAS LAS CARRERAS)",
      `500701${T}1${T}Inglés Comunicativo 1${T}3${T}[T] Lu 5,6 (TM 3-16)`,
      `[T] Alguien${T}09/06/26`,
    ].join("\n");
    // Sin malla que lo cubra y con prefijo 500 (que no da señal de nivel),
    // debe caer en confianza baja, no inventar un año con aire de certeza.
    const { revision } = construir(txt, indicePlanComun);
    expect(revision.confianzaBaja.length).toBeGreaterThan(0);
    expect(revision.confianzaBaja[0].reg.ramo).toBe("Inglés Comunicativo 1");
  });
});
