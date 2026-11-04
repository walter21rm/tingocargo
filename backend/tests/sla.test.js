/**
 * Requisitos de sesión, volumen y tiempo de respuesta.
 * 100 solicitudes concurrentes deben terminar en menos de 3 segundos.
 * 10.000 envíos deben poder consultarse por página sin degradarse.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const request = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
};

describe("SLA y volumen", () => {
  let server;
  let baseUrl;
  let token;
  let setSessionIdleMs;

  before(async () => {
    process.env.USE_DB = "false";
    process.env.ADMIN_USER = "admin";
    process.env.ADMIN_PASS = "admin123";
    const module = await import("../src/server.js");
    setSessionIdleMs = module.setSessionIdleMs;
    server = module.app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const login = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "admin", password: "admin123" })
    });
    token = login.body.token;
  });

  after(async () => {
    setSessionIdleMs(30 * 60 * 1000);
    server?.close();
  });

  it("100 lecturas concurrentes responden en menos de 3 segundos", async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        request(
          baseUrl,
          index % 2 === 0 ? "/api/health" : "/api/tracking/TM-2026-0001",
          index % 2 === 0 ? {} : { headers }
        )
      )
    );
    const elapsed = Date.now() - started;
    assert.ok(results.every((result) => result.status === 200));
    assert.ok(elapsed < 3000, `Tardó ${elapsed} ms`);
  });

  it("10.000 envíos se consultan por página en menos de 3 segundos", async () => {
    const storage = await import("../src/storage.js");
    for (let i = 0; i < 10000; i += 1) {
      storage.createPackage({
        codigoSeguimiento: `TM-VOL-${i}`,
        remitenteId: "d1",
        destinatarioId: "c1",
        sucursalOrigenId: "b1",
        sucursalDestinoId: "b2",
        destinoTexto: `Jr. Volumen ${i}`,
        descripcion: "Carga"
      });
    }
    const started = Date.now();
    const page = await request(baseUrl, "/api/packages?limit=50&offset=0", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const elapsed = Date.now() - started;
    assert.equal(page.status, 200);
    assert.equal(page.body.length, 50);
    assert.ok(elapsed < 3000, `La página tardó ${elapsed} ms`);
  });

  it("la sesión caduca por inactividad", async () => {
    setSessionIdleMs(1);
    const login = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "admin", password: "admin123" })
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const res = await request(baseUrl, "/api/packages?limit=1", {
      headers: { Authorization: `Bearer ${login.body.token}` }
    });
    assert.equal(res.status, 401);
    setSessionIdleMs(30 * 60 * 1000);
  });
});
