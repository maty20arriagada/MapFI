"use strict";
/**
 * Spec 002 (auditoría de robustez) · T010 · H-01.
 *
 * El defecto no aparece al analizar un string naive una sola vez dentro del
 * MISMO proceso (parsear y leer en la misma zona es autoconsistente). Node
 * (via V8/ICU) fija la zona horaria local al iniciar el proceso: reasignar
 * `process.env.TZ` a mitad de ejecución NO afecta los `Date` que se creen
 * despues dentro del mismo worker — se probo aparte que dentro de un worker
 * de Jest esta reasignacion tardia queda sin efecto, a diferencia de un
 * script node plano de un solo bloque. Por eso estas pruebas lanzan
 * subprocesos de Node con `TZ` fijada ANTES de arrancar (igual que hace
 * `npm run test:tz` con toda la suite), que es la unica forma fiable de
 * observar el efecto real de una zona horaria distinta.
 *
 * Esto es exactamente el mecanismo del bug en producción: un contenedor
 * Docker sin `TZ` configurada arranca en UTC desde el primer instante (no es
 * una reasignación tardía), por lo que toda hora ingresada por el usuario
 * como texto naive ("2026-04-17T21:00") se interpreta como UTC en vez de
 * America/Santiago.
 */
const { execFileSync } = require("child_process");
const holiday = require("../../js/services/holidayService");

function ejecutarBajoTZ(tz, script) {
  return execFileSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
  }).trim();
}

describe("Zona horaria — instante mal interpretado por falta de TZ en el proceso (H-01)", () => {
  test("Caso A (FR-001) — la misma hora escrita por el usuario produce instantes UTC distintos segun la TZ del proceso al arrancar", () => {
    const naive = "2026-04-17T21:00"; // el usuario escribe "21:00" en el formulario
    const script = `console.log(new Date(${JSON.stringify(naive)}).toISOString())`;

    // Contenedor SIN TZ configurada (el bug de hoy: Docker por defecto usa UTC).
    const instanteBug = ejecutarBajoTZ("UTC", script);
    // Contenedor CON TZ fijada (el fix, Fase 3 / T012-T013).
    const instanteFix = ejecutarBajoTZ("America/Santiago", script);

    expect(instanteBug).toBe("2026-04-17T21:00:00.000Z"); // "21:00" tratado como si ya fuera UTC: hoy se guarda mal
    expect(instanteFix).toBe("2026-04-18T01:00:00.000Z"); // "21:00" Chile (UTC-4 en abril, ya sin horario de verano) = "01:00" UTC del dia siguiente
    expect(instanteBug).not.toBe(instanteFix); // mismo texto, instantes absolutos distintos → la hora mostrada despues difiere
  });

  test("Caso B — el mismo instante ya almacenado cae en un dia de semana distinto si Node lee sin la TZ correcta", () => {
    // Lunes 20-abr-2026 23:30 hora de Chile, ya como instante absoluto real
    // (equivalente a un valor TIMESTAMPTZ leido desde Postgres).
    const instante = "2026-04-21T03:30:00.000Z";
    const script = `console.log(new Date(${JSON.stringify(instante)}).getDay())`;

    const diaConTZCorrecta = ejecutarBajoTZ("America/Santiago", script);
    const diaSinTZ = ejecutarBajoTZ("UTC", script);

    expect(diaConTZCorrecta).toBe("1"); // lunes
    expect(diaSinTZ).toBe("2"); // martes: mismo instante, "dia calendario" distinto según la TZ del proceso que lo lee
  });
});

describe("holidayService — logica pura bajo la TZ correctamente configurada (America/Santiago, ver jest.setup.js)", () => {
  test("esFinDeSemana no confunde un lunes tarde con fin de semana", () => {
    const lunesTarde = new Date("2026-04-20T23:30");
    expect(holiday.esFinDeSemana(lunesTarde)).toBe(false);
  });

  test("diasHabilesEntre cuenta correctamente un rango lunes-viernes cercano a medianoche", () => {
    const inicio = new Date("2026-04-20T23:30"); // lunes tarde
    const fin = new Date("2026-04-24T00:30"); // viernes de madrugada
    expect(holiday.diasHabilesEntre(inicio, fin, [])).toBe(5);
  });
});
