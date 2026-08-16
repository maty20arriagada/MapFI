"use strict";

jest.mock("../../js/db", () => {
  const data = { bloque_horario: [] };
  let nextId = 1;

  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  let snapshot = null;

  mockClient.query.mockImplementation(async (sql, params = []) => {
    if (sql === "BEGIN") { snapshot = data.bloque_horario.map((r) => ({ ...r })); return { rows: [] }; }
    if (sql === "COMMIT") { snapshot = null; return { rows: [] }; }
    if (sql === "ROLLBACK") {
      if (snapshot) { data.bloque_horario.length = 0; data.bloque_horario.push(...snapshot); snapshot = null; }
      return { rows: [] };
    }

    if (/^INSERT INTO bloque_horario/.test(sql)) {
      const [carreraId, nivel, diaSemana, horaInicio, horaFin, tipo, descripcion, codigo, seccion, sala, docente] = params;
      // Simula la falla real de una fila invalida (dia_semana fuera de 1..5,
      // como el CHECK de la tabla), para probar el ROLLBACK de importar().
      if (diaSemana < 1 || diaSemana > 5) throw new Error("dia_semana fuera de rango");
      const id = nextId++;
      data.bloque_horario.push({
        id, carrera_id: carreraId, nivel, dia_semana: diaSemana,
        hora_inicio: horaInicio, hora_fin: horaFin, tipo,
        descripcion: descripcion || null, codigo: codigo || null,
        seccion: seccion || null, sala: sala || null, docente: docente || null,
      });
      return /RETURNING id/.test(sql) ? { rows: [{ id }] } : { rows: [] };
    }

    if (/^SELECT dia_semana, hora_inicio, hora_fin, tipo\s+FROM bloque_horario/.test(sql)) {
      const [carreraId, nivel] = params;
      return { rows: data.bloque_horario.filter((b) => b.carrera_id === carreraId && b.nivel === nivel) };
    }

    if (/^SELECT carrera_id FROM bloque_horario WHERE id/.test(sql)) {
      const b = data.bloque_horario.find((r) => r.id === params[0]);
      return { rows: b ? [{ carrera_id: b.carrera_id }] : [] };
    }

    if (/^SELECT id, carrera_id, nivel,.*FROM bloque_horario/s.test(sql)) {
      let rows = data.bloque_horario;
      let i = 0;
      if (/carrera_id = \$1/.test(sql)) { const idx = i++; rows = rows.filter((b) => b.carrera_id === params[idx]); }
      if (/nivel = \$\d/.test(sql)) { const idx = i++; rows = rows.filter((b) => b.nivel === params[idx]); }
      return { rows: rows.slice() };
    }

    if (/^DELETE FROM bloque_horario WHERE id = /.test(sql)) {
      const before = data.bloque_horario.length;
      data.bloque_horario = data.bloque_horario.filter((r) => r.id !== params[0]);
      return { rowCount: before - data.bloque_horario.length };
    }

    if (/^DELETE FROM bloque_horario WHERE carrera_id = \$1 AND nivel = \$2/.test(sql)) {
      const [carreraId, nivel] = params;
      const before = data.bloque_horario.length;
      data.bloque_horario = data.bloque_horario.filter((b) => !(b.carrera_id === carreraId && b.nivel === nivel));
      return { rowCount: before - data.bloque_horario.length };
    }

    throw new Error("SQL no esperado en el mock: " + sql);
  });

  const pool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: mockClient.query,
    on: jest.fn(),
  };

  return { pool, query: mockClient.query, __data: data, __resetId: () => { nextId = 1; } };
});

const dao = require("../../js/dao/bloqueHorarioDao");
const dbMock = require("../../js/db");

beforeEach(() => {
  jest.clearAllMocks();
  dbMock.__data.bloque_horario.length = 0;
  dbMock.__resetId();
});

describe("bloqueHorarioDao — campos nuevos", () => {
  test("crear() persiste sala, docente, seccion y codigo", async () => {
    const { id } = await dao.crear({
      carreraId: 7, nivel: 1, diaSemana: 1, horaInicio: "08:00", horaFin: "09:30",
      tipo: "CLASE", descripcion: "Cálculo I", codigo: "525101", seccion: "1",
      sala: "Aula 201", docente: "J. Pérez",
    });
    const [bloques] = await Promise.all([dao.listar({ carreraId: 7, nivel: 1 })]);
    const b = bloques.find((x) => x.id === id);
    expect(b).toMatchObject({
      codigo: "525101", seccion: "1", sala: "Aula 201", docente: "J. Pérez",
    });
  });

  test("crear() sin campos opcionales los deja en null", async () => {
    const { id } = await dao.crear({
      carreraId: 7, nivel: 1, diaSemana: 1, horaInicio: "08:00", horaFin: "09:30", tipo: "CLASE",
    });
    const bloques = await dao.listar({ carreraId: 7, nivel: 1 });
    const b = bloques.find((x) => x.id === id);
    expect(b.codigo).toBeNull();
    expect(b.docente).toBeNull();
  });
});

describe("bloqueHorarioDao — carreraDelBloque", () => {
  test("devuelve la carrera del bloque, no la que declare el llamador", async () => {
    const { id } = await dao.crear({
      carreraId: 9, nivel: 2, diaSemana: 2, horaInicio: "10:00", horaFin: "11:00", tipo: "CLASE",
    });
    await expect(dao.carreraDelBloque(id)).resolves.toBe(9);
  });

  test("devuelve null si el bloque no existe", async () => {
    await expect(dao.carreraDelBloque(999)).resolves.toBeNull();
  });
});

describe("bloqueHorarioDao — eliminarPorSegmento", () => {
  test("borra solo los bloques del segmento indicado", async () => {
    await dao.crear({ carreraId: 6, nivel: 1, diaSemana: 1, horaInicio: "08:00", horaFin: "09:00", tipo: "CLASE" });
    await dao.crear({ carreraId: 6, nivel: 1, diaSemana: 2, horaInicio: "08:00", horaFin: "09:00", tipo: "CLASE" });
    await dao.crear({ carreraId: 6, nivel: 2, diaSemana: 1, horaInicio: "08:00", horaFin: "09:00", tipo: "CLASE" });

    const r = await dao.eliminarPorSegmento(6, 1);

    expect(r).toEqual({ eliminados: 2, carreraId: 6, nivel: 1 });
    const restantes = await dao.listar({});
    expect(restantes).toHaveLength(1);
    expect(restantes[0].nivel).toBe(2);
  });

  test("es idempotente: eliminar un segmento vacio devuelve 0", async () => {
    await expect(dao.eliminarPorSegmento(6, 1)).resolves.toEqual({ eliminados: 0, carreraId: 6, nivel: 1 });
  });
});

describe("bloqueHorarioDao — importar (transaccional)", () => {
  test("modo agregar suma sin borrar lo existente", async () => {
    await dao.crear({ carreraId: 7, nivel: 1, diaSemana: 1, horaInicio: "08:00", horaFin: "09:00", tipo: "CLASE" });

    const r = await dao.importar(7, 1, "agregar", [
      { diaSemana: 2, horaInicio: "09:00", horaFin: "10:30", tipo: "CLASE", descripcion: "Física I" },
    ]);

    expect(r).toEqual({ insertados: 1, eliminados: 0, modo: "agregar" });
    const bloques = await dao.listar({ carreraId: 7, nivel: 1 });
    expect(bloques).toHaveLength(2);
  });

  test("modo reemplazar borra el segmento antes de insertar", async () => {
    await dao.crear({ carreraId: 7, nivel: 1, diaSemana: 1, horaInicio: "08:00", horaFin: "09:00", tipo: "CLASE", descripcion: "viejo" });

    const r = await dao.importar(7, 1, "reemplazar", [
      { diaSemana: 2, horaInicio: "09:00", horaFin: "10:30", tipo: "CLASE", descripcion: "nuevo" },
    ]);

    expect(r).toEqual({ insertados: 1, eliminados: 1, modo: "reemplazar" });
    const bloques = await dao.listar({ carreraId: 7, nivel: 1 });
    expect(bloques).toHaveLength(1);
    expect(bloques[0].descripcion).toBe("nuevo");
  });

  test("una fila invalida hace ROLLBACK: el horario previo queda intacto", async () => {
    await dao.crear({ carreraId: 7, nivel: 1, diaSemana: 1, horaInicio: "08:00", horaFin: "09:00", tipo: "CLASE", descripcion: "original" });

    await expect(
      dao.importar(7, 1, "reemplazar", [
        { diaSemana: 2, horaInicio: "09:00", horaFin: "10:30", tipo: "CLASE", descripcion: "fila valida" },
        { diaSemana: 99, horaInicio: "11:00", horaFin: "12:00", tipo: "CLASE", descripcion: "fila invalida" },
      ])
    ).rejects.toThrow();

    const bloques = await dao.listar({ carreraId: 7, nivel: 1 });
    expect(bloques).toHaveLength(1);
    expect(bloques[0].descripcion).toBe("original");
  });
});
