"use strict";

jest.mock("../../js/db", () => {
  const data = { actividad: [], actividad_publico: [] };
  let nextId = 1;

  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  mockClient.query.mockImplementation(async (sql, params) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
    if (/^INSERT INTO actividad\b/.test(sql)) {
      const id = nextId++;
      data.actividad.push({
        id, titulo: params[0], entidad_id: params[2],
        fecha_inicio: params[4], fecha_fin: params[5],
        tipo: params[6], ramo: params[7], estado: params[8] || "PROPUESTA",
        created_by: params[12],
      });
      return { rows: [{ id }] };
    }
    if (/^INSERT INTO actividad_publico/.test(sql)) {
      data.actividad_publico.push({ actividad_id: params[0], carrera_id: params[1], nivel: params[2] });
      return { rows: [] };
    }
    if (/^DELETE FROM actividad_publico WHERE actividad_id/.test(sql)) {
      data.actividad_publico = data.actividad_publico.filter((r) => r.actividad_id !== params[0]);
      return { rows: [] };
    }
    if (/^DELETE FROM actividad WHERE id/.test(sql)) {
      const idx = data.actividad.findIndex((r) => r.id === params[0]);
      if (idx >= 0) data.actividad.splice(idx, 1);
      return { rows: [] };
    }
    if (/^SELECT \* FROM actividad WHERE id/.test(sql)) {
      const a = data.actividad.find((r) => r.id === params[0]);
      return { rows: a ? [a] : [] };
    }
    if (/FROM actividad_publico WHERE actividad_id/.test(sql)) {
      return { rows: data.actividad_publico.filter((r) => r.actividad_id === params[0]) };
    }
    if (/^UPDATE actividad SET/.test(sql)) {
      const a = data.actividad.find((r) => r.id === params[0]);
      if (a) {
        const setClause = sql.match(/SET([\s\S]*?)WHERE/);
        if (setClause && setClause[1].includes("titulo") && params[1] !== undefined) a.titulo = params[1];
        if (setClause && setClause[1].includes("estado")) {
          for (let i = 0; i < params.length; i++) {
            if (params[i] === "REALIZADA" || params[i] === "CONFIRMADA" || params[i] === "SUSPENDIDA") { a.estado = params[i]; break; }
          }
        }
      }
      return { rows: [] };
    }
    if (/FROM feriado|FROM bloque_horario|FROM matricula|COUNT\(\*\) AS eventos|WITH saturacion/.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const pool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: mockClient.query,
    on: jest.fn(),
  };

  return { pool, query: mockClient.query };
});

const dao = require("../../js/dao/actividadDao");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("actividadDao — CRUD", () => {
  test("crear devuelve id", async () => {
    const { id } = await dao.crear(
      { titulo: "Certamen 1", fechaInicio: "2026-04-15T18:30:00Z", fechaFin: "2026-04-15T20:00:00Z", tipo: "EXAMEN", entidadId: 17 },
      [{ carreraId: 6, nivel: 1 }]
    );
    expect(id).toBeGreaterThan(0);
  });

  test("obtener devuelve actividad con público", async () => {
    const { id } = await dao.crear(
      { titulo: "Test", fechaInicio: "2026-03-01T10:00:00Z", fechaFin: "2026-03-01T12:00:00Z", tipo: "EVENTO", entidadId: 17 },
      [{ carreraId: 6, nivel: 1 }, { carreraId: 7, nivel: 2 }]
    );
    const a = await dao.obtener(id);
    expect(a).not.toBeNull();
    expect(a.titulo).toBe("Test");
    expect(a.publico).toHaveLength(2);
  });

  test("obtener con id inexistente devuelve null", async () => {
    const a = await dao.obtener(99999);
    expect(a).toBeNull();
  });

  test("actualizar modifica título y público", async () => {
    const { id } = await dao.crear(
      { titulo: "Original", fechaInicio: "2026-03-01T10:00:00Z", fechaFin: "2026-03-01T12:00:00Z", tipo: "EVENTO", entidadId: 17 },
      [{ carreraId: 6, nivel: 1 }]
    );
    await dao.actualizar(id, { titulo: "Modificado" }, [{ carreraId: 6, nivel: 1 }, { carreraId: 7, nivel: 1 }]);
    const a = await dao.obtener(id);
    expect(a.titulo).toBe("Modificado");
    expect(a.publico).toHaveLength(2);
  });

  test("cambiarEstado actualiza el estado", async () => {
    const { id } = await dao.crear(
      { titulo: "E", fechaInicio: "2026-03-01T10:00:00Z", fechaFin: "2026-03-01T12:00:00Z", tipo: "EVENTO", entidadId: 17 },
      [{ carreraId: 6, nivel: 1 }]
    );
    await dao.cambiarEstado(id, "CONFIRMADA");
    const a = await dao.obtener(id);
    expect(a.estado).toBe("CONFIRMADA");
  });

  test("eliminar borra actividad", async () => {
    const { id } = await dao.crear(
      { titulo: "Borrar", fechaInicio: "2026-03-01T10:00:00Z", fechaFin: "2026-03-01T12:00:00Z", tipo: "EVENTO", entidadId: 17 },
      [{ carreraId: 6, nivel: 1 }]
    );
    await dao.eliminar(id);
    const a = await dao.obtener(id);
    expect(a).toBeNull();
  });

  test("cargarContextoMatch con público vacío devuelve contexto limpio", async () => {
    const ctx = await dao.cargarContextoMatch([], "2026-04-15T10:00:00Z");
    expect(ctx.feriados).toEqual([]);
    expect(ctx.actividades).toEqual([]);
  });
});
