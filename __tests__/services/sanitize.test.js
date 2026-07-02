"use strict";
const { escapeHtml } = require("../../js/sanitize");

describe("escapeHtml (anti-XSS)", () => {
  test("escapa las 5 entidades peligrosas", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  test("null/undefined → cadena vacia; numeros → string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });

  test("texto normal con acentos pasa intacto", () => {
    expect(escapeHtml("Ingeniería Civil – Año 1")).toBe("Ingeniería Civil – Año 1");
  });
});
