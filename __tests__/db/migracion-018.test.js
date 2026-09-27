"use strict";
/**
 * Spec 006 · US1 — migracion que retira las actividades de ejemplo.
 *
 * Borra datos de produccion, asi que lo que importa probar es que NO pueda
 * borrar de mas: la huella exige los cuatro campos de fabrica, y un centro que
 * cree una actividad real titulada "Certamen 1 - Calculo I" no se ve afectado.
 * El SQL se prueba como texto porque las pruebas no tienen Postgres (pg-mem no
 * soporta la columna tstzrange GENERATED); el ensayo contra una base real esta
 * en quickstart.md, US1.
 */
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(
  path.join(__dirname, "../../db/migrations/018_limpiar_actividades_muestra.sql"),
  "utf8"
);
// Sin comentarios, para que una palabra en un comentario no haga pasar la prueba.
const CODIGO = SQL.replace(/--[^\n]*/g, "");

const MUESTRAS = [
  { titulo: "Certamen 1 - Cálculo I", descripcion: "Primera evaluación del semestre", ubicacion: "Aula 301", sigla: "DOCFI" },
  { titulo: "Semana del Novato", descripcion: "Actividad de bienvenida a primer año", ubicacion: "Patio central FI", sigla: "CEEIND" },
];

describe("migracion 018 — huella completa de las actividades de ejemplo", () => {
  test.each(MUESTRAS)("la huella de '$titulo' incluye los cuatro campos", (m) => {
    for (const valor of [m.titulo, m.descripcion, m.ubicacion, m.sigla]) {
      expect(CODIGO).toContain("'" + valor + "'");
    }
  });

  test("compara los cuatro campos, no solo el titulo", () => {
    for (const col of ["titulo", "descripcion", "ubicacion", "sigla"]) {
      expect(CODIGO).toMatch(new RegExp("\\b" + col + "\\b"));
    }
  });

  test("no identifica por id: en otra base el id 1 puede ser real", () => {
    expect(CODIGO).not.toMatch(/\bid\s*=\s*1\b/i);
  });
});

describe("migracion 018 — trazabilidad y efecto", () => {
  test("deja constancia en borrado_definitivo ANTES de borrar", () => {
    const insercion = CODIGO.search(/INSERT\s+INTO\s+borrado_definitivo/i);
    const borrado = CODIGO.search(/DELETE\s+FROM\s+actividad\b/i);
    expect(insercion).toBeGreaterThanOrEqual(0);
    expect(borrado).toBeGreaterThan(insercion);
  });

  test("registra el motivo acordado", () => {
    expect(CODIGO).toContain("'Dato de ejemplo de instalacion (migracion 018)'");
  });

  test("NO archiva: archivar publicaria una cancelacion falsa en el aviso publico", () => {
    expect(CODIGO).not.toMatch(/ARCHIVADA/);
  });

  test("NO escribe schema_migrations: eso lo hace el runner (Principio V)", () => {
    expect(CODIGO).not.toMatch(/schema_migrations/i);
  });
});
