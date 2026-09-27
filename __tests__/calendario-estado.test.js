"use strict";
/**
 * Spec 006 · posicion del calendario en la URL y permiso de edicion.
 *
 * El calendario volvia al mes en curso al recargar Y al cambiar cualquier
 * filtro: se destruia y se recreaba sin recordar nada. La posicion ahora vive
 * en la URL; este modulo la lee y la escribe. Todo lo que se prueba aqui es
 * puro: sin DOM, sin FullCalendar, sin red.
 */
const E = require("../js/calendario-estado");

describe("leerEstado — la URL es la fuente de la posicion", () => {
  test("lee vista, fecha y filtros validos", () => {
    const e = E.leerEstado("?vista=semana&fecha=2026-11-09&carreraId=6&nivel=2&entidadId=7&tipo=EXAMEN&soloParticipacion=1");
    expect(e.vista).toBe("semana");
    expect(e.fecha).toBe("2026-11-09");
    expect(e.filtros).toEqual({ carreraId: "6", nivel: "2", entidadId: "7", tipo: "EXAMEN", soloParticipacion: "1" });
    expect(e.tieneCarrera).toBe(true);
  });

  test("acepta la query con o sin el signo de interrogacion", () => {
    expect(E.leerEstado("vista=agenda").vista).toBe("agenda");
    expect(E.leerEstado("?vista=agenda").vista).toBe("agenda");
  });

  test("entrada limpia: vista Mes, sin fecha (FullCalendar abre hoy), sin filtros", () => {
    const e = E.leerEstado("");
    expect(e.vista).toBe("mes");
    expect(e.fecha).toBeNull();
    expect(e.filtros).toEqual({});
    expect(e.tieneCarrera).toBe(false);
  });

  test.each(["inventada", "dayGridMonth", "MES", ""])("una vista desconocida (%s) cae a Mes", (v) => {
    expect(E.leerEstado("?vista=" + v).vista).toBe("mes");
  });

  test.each(["2026-13-45", "2026-02-30", "2026-11-9", "manana", "2026-11-09T10:00"])(
    "una fecha que no existe o mal escrita (%s) se descarta", (f) => {
      expect(E.leerEstado("?fecha=" + f).fecha).toBeNull();
    }
  );

  test("el 29 de febrero vale solo en bisiesto", () => {
    expect(E.leerEstado("?fecha=2028-02-29").fecha).toBe("2028-02-29");
    expect(E.leerEstado("?fecha=2026-02-29").fecha).toBeNull();
  });

  test("un valor invalido NO tumba a los demas (FR-013)", () => {
    const e = E.leerEstado("?vista=inventada&fecha=2026-13-45&carreraId=6&nivel=9&tipo=NADA");
    expect(e.vista).toBe("mes");
    expect(e.fecha).toBeNull();
    expect(e.filtros).toEqual({ carreraId: "6" });
  });

  test.each([["nivel", "0"], ["nivel", "6"], ["nivel", "1.5"], ["carreraId", "-3"], ["carreraId", "abc"], ["entidadId", "0"]])(
    "%s=%s se descarta", (clave, valor) => {
      expect(E.leerEstado("?" + clave + "=" + valor).filtros[clave]).toBeUndefined();
    }
  );

  test("soloParticipacion solo cuenta con 1", () => {
    expect(E.leerEstado("?soloParticipacion=1").filtros.soloParticipacion).toBe("1");
    expect(E.leerEstado("?soloParticipacion=true").filtros.soloParticipacion).toBeUndefined();
  });

  test("carreraId vacio = 'Todas las carreras' elegido a proposito, distinto de ausente", () => {
    const vacio = E.leerEstado("?carreraId=");
    expect(vacio.tieneCarrera).toBe(true);
    expect(vacio.filtros.carreraId).toBe("");
    const ausente = E.leerEstado("?vista=mes");
    expect(ausente.tieneCarrera).toBe(false);
    expect(ausente.filtros.carreraId).toBeUndefined();
  });

  test("un carreraId basura cuenta como ausente, no como 'Todas'", () => {
    expect(E.leerEstado("?carreraId=abc").tieneCarrera).toBe(false);
  });

  test("no revienta con null o undefined", () => {
    expect(E.leerEstado(null).vista).toBe("mes");
    expect(E.leerEstado(undefined).filtros).toEqual({});
  });
});

describe("escribirEstado — la URL que se comparte", () => {
  test("orden estable y solo lo que tiene valor", () => {
    expect(E.escribirEstado({ vista: "semana", fecha: "2026-11-09", filtros: { nivel: "2", carreraId: "6" } }))
      .toBe("vista=semana&fecha=2026-11-09&carreraId=6&nivel=2");
  });

  test("carreraId vacio se escribe: recuerda que se eligio 'Todas'", () => {
    expect(E.escribirEstado({ vista: "mes", filtros: { carreraId: "" } })).toBe("vista=mes&carreraId=");
  });

  test("los demas filtros vacios no se escriben", () => {
    expect(E.escribirEstado({ vista: "mes", filtros: { nivel: "", tipo: "" } })).toBe("vista=mes");
  });

  test.each([
    "vista=semana&fecha=2026-11-09&carreraId=6&nivel=2",
    "vista=agenda&carreraId=",
    "vista=mes&fecha=2026-10-01&entidadId=3&tipo=CHARLA&soloParticipacion=1",
  ])("leer y volver a escribir una URL valida la deja igual: %s", (q) => {
    expect(E.escribirEstado(E.leerEstado("?" + q))).toBe(q);
  });

  test("no escribe valores invalidos aunque se los pasen", () => {
    expect(E.escribirEstado({ vista: "rara", fecha: "2026-13-01", filtros: { nivel: "9" } })).toBe("vista=mes");
  });
});

describe("vistas: castellano en la URL, nombres de FullCalendar dentro", () => {
  test.each([["mes", "dayGridMonth"], ["semana", "timeGridWeek"], ["agenda", "listWeek"]])(
    "%s <-> %s", (es, fc) => {
      expect(E.aVistaFullCalendar(es)).toBe(fc);
      expect(E.deVistaFullCalendar(fc)).toBe(es);
    }
  );

  test("lo desconocido cae a Mes en los dos sentidos", () => {
    expect(E.aVistaFullCalendar("x")).toBe("dayGridMonth");
    expect(E.deVistaFullCalendar("timeGridDay")).toBe("mes");
  });
});

describe("aFechaIso — fecha de anclaje en hora LOCAL", () => {
  test("no pasa por UTC: las 23:30 del 9 siguen siendo el 9", () => {
    // Con toISOString, en Chile (UTC-3) las 23:30 del 9 serian el 10.
    expect(E.aFechaIso(new Date(2026, 10, 9, 23, 30))).toBe("2026-11-09");
  });
});

describe("carreraInicial — URL frente a la carrera propia del centro (R-03)", () => {
  const centro = { rol: "APORTANTE", entidadId: 6, carreraId: 6 };

  test("sin carreraId en la URL, un centro abre en su carrera", () => {
    expect(E.carreraInicial(E.leerEstado(""), centro)).toBe("6");
  });

  test("con carreraId en la URL, manda la URL", () => {
    expect(E.carreraInicial(E.leerEstado("?carreraId=7"), centro)).toBe("7");
  });

  test("'Todas' elegido a proposito no se pisa con la carrera propia", () => {
    expect(E.carreraInicial(E.leerEstado("?carreraId="), centro)).toBe("");
  });

  test("sin sesion o sin carrera propia: todas", () => {
    expect(E.carreraInicial(E.leerEstado(""), null)).toBe("");
    expect(E.carreraInicial(E.leerEstado(""), { rol: "ADMIN", carreraId: null })).toBe("");
  });
});

describe("puedeEditar — espejo de puedeEditarActividad (data-model §4)", () => {
  const act = { id: 1, entidad_id: 6 };

  test.each([
    ["sin sesion", null, false],
    ["ADMIN", { rol: "ADMIN" }, true],
    ["SUPERADMIN", { rol: "SUPERADMIN" }, true],
    ["centro dueño", { rol: "APORTANTE", entidadId: 6 }, true],
    ["centro dueño con id en texto", { rol: "APORTANTE", entidadId: "6" }, true],
    ["centro ajeno", { rol: "APORTANTE", entidadId: 7 }, false],
    ["centro sin entidad", { rol: "APORTANTE", entidadId: null }, false],
  ])("%s -> %s", (_, usuario, esperado) => {
    expect(E.puedeEditar(act, usuario)).toBe(esperado);
  });

  test("una actividad sin entidad no la edita ningun centro", () => {
    expect(E.puedeEditar({ id: 2 }, { rol: "APORTANTE", entidadId: null })).toBe(false);
  });

  test("sin actividad, falso", () => {
    expect(E.puedeEditar(null, { rol: "ADMIN" })).toBe(false);
  });
});
