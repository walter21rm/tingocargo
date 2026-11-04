/**
 * Pruebas de los requisitos no funcionales, en orden del RNF-01 al RNF-14.
 * Se ejecutan con npm run test:rnf y no necesitan una base externa ni el servidor levantado.
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "url";
import { buildInsertSql } from "../src/backup.js";
import { decryptField, encryptField } from "../src/fieldCrypto.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const request = async (baseUrl, urlPath, options = {}) => {
  const response = await fetch(`${baseUrl}${urlPath}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
};

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

describe("Requisitos no funcionales", () => {
  let server;
  let baseUrl;
  let token;
  let setSessionIdleMs;
  let operadorId;
  let repartidorId;

  before(async () => {
    process.env.USE_DB = "false";
    process.env.ADMIN_USER = "admin";
    process.env.ADMIN_PASS = "admin123";
    const serverModule = await import("../src/server.js");
    setSessionIdleMs = serverModule.setSessionIdleMs;
    server = serverModule.app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const login = await request(baseUrl, "/api/auth/login", json({
      usuario: "admin",
      password: "admin123"
    }));
    assert.equal(login.status, 200);
    token = login.body.token;
    const auth = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    };
    const roles = await request(baseUrl, "/api/roles", { headers: auth.headers });
    const branches = await request(baseUrl, "/api/branches", { headers: auth.headers });
    const role = (name) => roles.body.find((item) => item.nombre === name).id;
    const userBody = (nombre, email, rol, phone) => ({
      nombre,
      email,
      telefonoPais: "PE",
      telefonoNumero: phone,
      rolId: role(rol),
      sucursalId: branches.body[0].id,
      password: "prueba123",
      activo: true
    });
    const operador = await request(baseUrl, "/api/users", {
      ...auth,
      body: JSON.stringify(userBody("Operador RNF", "operador.rnf@test.pe", "Operador logístico", "999111222"))
    });
    const repartidor = await request(baseUrl, "/api/users", {
      ...auth,
      body: JSON.stringify(userBody("Repartidor RNF", "repartidor.rnf@test.pe", "Repartidor", "999333444"))
    });
    assert.equal(operador.status, 201);
    assert.equal(repartidor.status, 201);
    operadorId = operador.body.id;
    repartidorId = repartidor.body.id;
  });

  after(async () => {
    setSessionIdleMs(30 * 60 * 1000);
    await new Promise((resolve) => server.close(resolve));
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  });

  it("RNF01 disponibilidad", async () => {
    const health = await request(baseUrl, "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");
    assert.equal(health.body.disponibilidad.objetivo, 99);
    assert.match(health.body.disponibilidad.horario, /08:00-20:00/);
    assert.equal(typeof health.body.disponibilidad.porcentaje, "number");
  });

  it("RNF02 seguridad de acceso", async () => {
    const anon = await request(baseUrl, "/api/packages");
    assert.equal(anon.status, 401);

    setSessionIdleMs(1);
    const login = await request(baseUrl, "/api/auth/login", json({
      usuario: "admin",
      password: "admin123"
    }));
    assert.equal(login.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const expired = await request(baseUrl, "/api/packages?limit=1", {
      headers: { Authorization: `Bearer ${login.body.token}` }
    });
    assert.equal(expired.status, 401);
    setSessionIdleMs(30 * 60 * 1000);

    const fresh = await request(baseUrl, "/api/auth/login", json({
      usuario: "admin",
      password: "admin123"
    }));
    token = fresh.body.token;
  });

  it("RNF03 confidencialidad", async () => {
    const phone = "+51987654321";
    const encrypted = encryptField(phone);
    assert.ok(encrypted.startsWith("enc:v1:"));
    assert.notEqual(encrypted, phone);
    assert.equal(decryptField(encrypted), phone);

    const created = await request(baseUrl, "/api/users", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        nombre: "Clave Oculta",
        email: "clave.oculta@test.pe",
        telefonoPais: "PE",
        telefonoNumero: "999000111",
        rolId: (await request(baseUrl, "/api/roles", { headers: authHeaders() })).body.find((role) => role.nombre === "Operador logístico").id,
        sucursalId: (await request(baseUrl, "/api/branches", { headers: authHeaders() })).body[0].id,
        password: "secreto123",
        activo: true
      })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.password, undefined);
    assert.equal(created.body.passwordHash, undefined);
    const storage = await import("../src/storage.js");
    const stored = storage.getUserByEmail("clave.oculta@test.pe");
    assert.ok(stored.passwordHash.startsWith("$2"));
    assert.notEqual(stored.passwordHash, "secreto123");
  });

  it("RNF04 integridad", async () => {
    const body = {
      remitenteId: "d1",
      destinatarioId: "c1",
      sucursalOrigenId: "b1",
      sucursalDestinoId: "b2",
      destinoTexto: "Jr. Integridad 1",
      descripcion: "Prueba",
      operadorId,
      repartidorId,
      pesoKg: 1
    };
    const first = await request(baseUrl, "/api/packages", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...body, codigoSeguimiento: `TM-RNF4A-${Date.now()}` })
    });
    const second = await request(baseUrl, "/api/packages", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...body, codigoSeguimiento: `TM-RNF4B-${Date.now()}` })
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.body.codigoSeguimiento, second.body.codigoSeguimiento);
    const invalid = await request(baseUrl, `/api/packages/${first.body.id}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ estado: "Perdido" })
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /Estado inválido/);
  });

  it("RNF05 rendimiento", async () => {
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: 100 }, () => request(baseUrl, "/api/tracking/TM-2026-0001"))
    );
    const elapsed = Date.now() - started;
    assert.ok(results.every((result) => result.status === 200));
    assert.ok(elapsed < 3000, `Tardó ${elapsed} ms`);
  });

  it("RNF06 escalabilidad", async () => {
    const storage = await import("../src/storage.js");
    for (let i = 0; i < 10000; i += 1) {
      storage.createPackage({
        codigoSeguimiento: `TM-RNF6-${i}`,
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

  it("RNF07 usabilidad", async () => {
    const missing = await request(baseUrl, "/api/packages", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        remitenteId: "d1",
        destinatarioId: "c1",
        sucursalOrigenId: "b1",
        destinoTexto: "Jr. Sin destino",
        descripcion: "Falta sucursal",
        operadorId,
        repartidorId,
        pesoKg: 1
      })
    });
    assert.equal(missing.status, 400);
    assert.match(missing.body.error, /sucursalDestinoId/);
    const form = fs.readFileSync(
      path.join(root, "frontend/src/pages/AdminPackageNew.jsx"),
      "utf8"
    );
    assert.match(form, /Selecciona la sucursal de destino/);
    assert.match(form, /sm:|md:/);
  });

  it("RNF08 compatibilidad", async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "frontend/package.json"), "utf8"));
    const browsers = (pkg.browserslist || []).join(" ").toLowerCase();
    assert.match(browsers, /chrome/);
    assert.match(browsers, /edge/);
    assert.match(browsers, /firefox/);
    const html = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");
    assert.match(html, /viewport/);
  });

  it("RNF09 portabilidad", async () => {
    const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8");
    assert.match(compose, /db:/);
    assert.match(compose, /api:/);
    assert.match(compose, /web:/);
    assert.match(compose, /DATABASE_URL/);
    assert.ok(fs.existsSync(path.join(root, "backend/Dockerfile")));
    assert.ok(fs.existsSync(path.join(root, "frontend/Dockerfile")));
  });

  it("RNF10 auditoria", async () => {
    const changed = await request(baseUrl, "/api/packages/p1/status", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ estado: "En Tránsito", observacion: "Auditoria RNF-10" })
    });
    assert.equal(changed.status, 200);
    const detail = await request(baseUrl, "/api/packages/p1", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const last = detail.body.historial.at(-1);
    assert.equal(last.estado, "En Tránsito");
    assert.equal(last.usuarioNombre, "Administrador Sistema");
    assert.ok(last.fechaHora);
    const log = await request(baseUrl, "/api/activity-log", {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(log.status, 200);
    const entry = log.body.find((item) => item.action === "status_change" && String(item.detail).includes("RNF-10"));
    assert.ok(entry);
    assert.equal(entry.userName, "Administrador Sistema");
    assert.ok(entry.fecha);
  });

  it("RNF11 respaldo", async () => {
    const sql = buildInsertSql("sucursales", [
      { nombre: "Centro", direccion: "Av. O'Higgins 123" }
    ]);
    assert.match(sql, /INSERT INTO "sucursales"/);
    assert.match(sql, /Av\. O''Higgins 123/);
    assert.ok(fs.existsSync(path.join(root, "backend/scripts/backup-db.js")));
    assert.ok(fs.existsSync(path.join(root, "backend/scripts/restore-db.js")));
    const started = Date.now();
    const again = buildInsertSql("sucursales", [{ nombre: "Centro", direccion: "Av. O'Higgins 123" }]);
    assert.equal(again, sql);
    assert.ok(Date.now() - started < 2 * 60 * 60 * 1000);
  });

  it("RNF12 mantenibilidad", async () => {
    assert.ok(fs.existsSync(path.join(root, "frontend/src")));
    assert.ok(fs.existsSync(path.join(root, "backend/src/server.js")));
    assert.ok(fs.existsSync(path.join(root, "sql/schema.sql")));
    const health = await request(baseUrl, "/api/health");
    assert.equal(health.status, 200);
  });

  it("RNF13 confiabilidad", async () => {
    const missing = await request(baseUrl, "/api/tracking/TM-NO-EXISTE");
    assert.equal(missing.status, 404);
    assert.match(missing.body.error, /no encontrado/i);
    const health = await request(baseUrl, "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");
  });

  it("RNF14 zona horaria", async () => {
    const config = await request(baseUrl, "/api/config/public");
    assert.equal(config.status, 200);
    assert.equal(config.body.zonaHoraria, "America/Lima");
    const formatted = new Intl.DateTimeFormat("es-PE", {
      timeZone: config.body.zonaHoraria,
      hour: "2-digit",
      hourCycle: "h23"
    }).format(new Date("2026-01-15T15:00:00.000Z"));
    assert.equal(formatted, "10");
  });
});
