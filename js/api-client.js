/* MapFI · api-client.js — wrapper unico de fetch hacia /api. */
(function (global) {
  "use strict";

  async function req(method, url, body) {
    const opts = { method, headers: {}, credentials: "same-origin" };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const serverMsg = (data && data.error) ? data.error : null;
      const T = {
        400: "Datos inválidos", 401: "Sesión expirada", 403: "No autorizado",
        404: "No encontrado", 409: "Conflicto", 422: "Datos inválidos",
        429: "Demasiados intentos", 500: "Error del servidor",
        502: "Servicio no disponible", 503: "Servicio en mantención",
      };
      throw new Error(serverMsg || T[res.status] || "Error inesperado");
    }
    return data;
  }

  global.api = {
    get: (u) => req("GET", u),
    post: (u, b) => req("POST", u, b),
    put: (u, b) => req("PUT", u, b),
    patch: (u, b) => req("PATCH", u, b),
    del: (u) => req("DELETE", u),
  };
})(window);
