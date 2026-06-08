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
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
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
