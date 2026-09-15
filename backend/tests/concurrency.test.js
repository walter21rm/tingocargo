/**
 * PRUEBAS DE CONCURRENCIA DE LA API DE LOGÍSTICA
 * ===============================================
 * Simulan múltiples peticiones HTTP simultáneas (Promise.all) para verificar:
 * - Que el servidor responde correctamente bajo carga
 * - Que no hay condiciones de carrera ni bloqueos
 * - Que los tiempos de respuesta son aceptables (< 15s por escenario)
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const jsonHeaders = { "Content-Type": "application/json" };

const request = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const bodyText = await response.text();
  let body = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }
  return { status: response.status, body };
};

/**
 * Ejecuta `count` peticiones en paralelo usando Promise.all.
 * fn recibe el índice (0..count-1). Retorna { results, elapsedMs }.
 */
const runConcurrent = async (count, fn) => {
  const startedAt = Date.now();
  const results = await Promise.all(
    Array.from({ length: count }, (_, index) => fn(index))
  );
  const elapsedMs = Date.now() - startedAt;
  return { results, elapsedMs };
};

/**
 * Suite de pruebas de concurrencia.
 * Orden: login paralelo → tracking paralelo → listado paralelo → setup → creación paquetes → actualización estado.
 */
describe("Pruebas de concurrencia API logística", () => {
  let app;
  let server;
  let baseUrl;
  let adminToken;
  let operatorId;
  let courierId;
  const createdPackageIds = [];

  /* Inicia el servidor en puerto aleatorio para las pruebas de carga. */
  before(async () => {
    process.env.USE_DB = "false";
    process.env.ADMIN_USER = "admin";
    process.env.ADMIN_PASS = "admin123";
    const module = await import("../src/server.js");
    app = module.app;
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  /* Cierra el servidor al finalizar. */
  after(async () => {
    if (server) server.close();
  });

  /**
   * CONCURRENCIA DE LOGIN ADMIN (30 peticiones paralelas)
   * Lanza 30 POST /api/auth/login simultáneos con las mismas credenciales.
   * Verifica: las 30 respuestas son 200, todas incluyen token válido,
   * y el tiempo total < 15s. Guarda un token para pruebas posteriores.
   */
  it("concurrencia de login admin (30 requests paralelos)", async () => {
    const { results, elapsedMs } = await runConcurrent(30, async () =>
      request(baseUrl, "/api/auth/login", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ usuario: "admin", password: "admin123" })
      })
    );

    const ok = results.filter((r) => r.status === 200);
    assert.equal(ok.length, 30, "Todos los logins concurrentes deben responder 200");
    assert.ok(
      ok.every((r) => typeof r.body?.token === "string" && r.body.token.length > 10),
      "Todas las respuestas deben incluir token"
    );
    adminToken = ok[0].body.token;
    assert.ok(adminToken, "Debe quedar un token admin para pruebas siguientes");
    assert.ok(elapsedMs < 15000, `Tiempo elevado en login concurrente: ${elapsedMs}ms`);
  });

  /**
   * CONCURRENCIA DE TRACKING PÚBLICO (50 peticiones paralelas)
   * Lanza 50 GET /api/tracking/TM-2026-0001 simultáneos (sin auth).
   * Verifica: las 50 respuestas son 200, todas devuelven el mismo codigoSeguimiento,
   * y tiempo < 15s. Prueba el endpoint más usado por clientes públicos.
   */
  it("concurrencia de tracking público (50 requests paralelos)", async () => {
    const { results, elapsedMs } = await runConcurrent(50, async () =>
      request(baseUrl, "/api/tracking/TM-2026-0001")
    );

    const ok = results.filter((r) => r.status === 200);
    assert.equal(ok.length, 50, "Todos los tracking concurrentes deben responder 200");
    assert.ok(
      ok.every((r) => r.body?.codigoSeguimiento === "TM-2026-0001"),
      "El código de seguimiento debe coincidir en todas las respuestas"
    );
    assert.ok(elapsedMs < 15000, `Tiempo elevado en tracking concurrente: ${elapsedMs}ms`);
  });

  /**
   * CONCURRENCIA EN LISTADO AUTENTICADO (40 peticiones paralelas)
   * Lanza 40 GET /api/packages/expanded con el mismo token admin.
   * Verifica: las 40 respuestas son 200, body es array en todas,
   * y tiempo < 15s. Simula varios usuarios del panel viendo la lista a la vez.
   */
  it("concurrencia en listado autenticado de paquetes (40 requests paralelos)", async () => {
    const { results, elapsedMs } = await runConcurrent(40, async () =>
      request(baseUrl, "/api/packages/expanded", {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
    );

    const ok = results.filter((r) => r.status === 200);
    assert.equal(ok.length, 40, "Todos los listados concurrentes deben responder 200");
    assert.ok(
      ok.every((r) => Array.isArray(r.body)),
      "Todas las respuestas deben devolver un array"
    );
    assert.ok(elapsedMs < 15000, `Tiempo elevado en listado concurrente: ${elapsedMs}ms`);
  });

  /**
   * PREPARACIÓN: OPERADOR Y REPARTIDOR
   * Crea un operador y un repartidor vía POST /api/users para poder crear
   * paquetes en paralelo. Verifica 201 y que ambos tengan id. Los IDs se
   * usan en el body de las creaciones concurrentes de paquetes.
   */
  it("prepara operador y repartidor para pruebas concurrentes", async () => {
    const roles = await request(baseUrl, "/api/roles", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const branches = await request(baseUrl, "/api/branches", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const operatorRole = roles.body.find((role) => role.nombre === "Operador logístico");
    const courierRole = roles.body.find((role) => role.nombre === "Repartidor");
    assert.ok(operatorRole?.id);
    assert.ok(courierRole?.id);
    assert.ok(branches.body?.[0]?.id);

    const operator = await request(baseUrl, "/api/users", {
      method: "POST",
      headers: { ...jsonHeaders, Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        nombre: "Operador Concurrency",
        email: "operator.concurrency@test.com",
        telefonoPais: "PE",
        telefonoNumero: "911111111",
        telefono: "911111111",
        password: "operator123",
        rolId: operatorRole.id,
        sucursalId: branches.body[0].id,
        activo: true
      })
    });
    assert.equal(operator.status, 201);
    operatorId = operator.body?.id;
    assert.ok(operatorId);

    const courier = await request(baseUrl, "/api/users", {
      method: "POST",
      headers: { ...jsonHeaders, Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        nombre: "Courier Concurrency",
        email: "courier.concurrency@test.com",
        telefonoPais: "PE",
        telefonoNumero: "922222222",
        telefono: "922222222",
        password: "courier123",
        rolId: courierRole.id,
        sucursalId: branches.body[0].id,
        activo: true
      })
    });
    assert.equal(courier.status, 201);
    courierId = courier.body?.id;
    assert.ok(courierId);
  });

  /**
   * CONCURRENCIA DE CREACIÓN DE PAQUETES (20 peticiones paralelas)
   * Lanza 20 POST /api/packages simultáneos con destinos distintos (Jr. Concurrencia 1..20).
   * Verifica: las 20 respuestas son 201, cada paquete tiene id único,
   * y tiempo < 15s. Prueba que no haya colisiones al generar códigos de seguimiento.
   */
  it("concurrencia de creación de paquetes (1000 requests paralelos)", async () => {
    const { results, elapsedMs } = await runConcurrent(1000, async (i) =>
      request(baseUrl, "/api/packages", {
        method: "POST",
        headers: { ...jsonHeaders, Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          remitenteId: "d1",
          destinatarioId: "c1",
          operadorId: operatorId,
          repartidorId: courierId,
          sucursalOrigenId: "b1",
          destinoTexto: `Jr. Concurrencia ${i + 1}`,
          descripcion: `Paquete paralelo ${i + 1}`
        })
      })
    );

    const created = results.filter((r) => r.status === 201);
    assert.equal(created.length, 200, "Todos los paquetes concurrentes deben crearse");
    created.forEach((r) => {
      if (r.body?.id) createdPackageIds.push(r.body.id);
    });
    assert.equal(createdPackageIds.length, 200, "Se deben capturar 20 IDs de paquetes");
    assert.ok(elapsedMs < 15000, `Tiempo elevado en creación concurrente: ${elapsedMs}ms`);
  });

  /**
   * CONCURRENCIA DE ACTUALIZACIÓN DE ESTADO
   * Lanza 20 PATCH /api/packages/:id/status en paralelo (uno por cada paquete creado).
   * Todas cambian el estado a "En Tránsito". Verifica: las 20 respuestas son 200,
   * estadoActual en cada respuesta es "En Tránsito", y tiempo < 15s.
   * Prueba que las actualizaciones concurrentes no corrompan el historial.
   */
  it("concurrencia de actualización de estado en paquetes creados", async () => {
    const { results, elapsedMs } = await runConcurrent(createdPackageIds.length, async (i) =>
      request(baseUrl, `/api/packages/${createdPackageIds[i]}/status`, {
        method: "PATCH",
        headers: { ...jsonHeaders, Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          estado: "En Tránsito",
          observacion: "Actualización concurrente"
        })
      })
    );

    const ok = results.filter((r) => r.status === 200);
    assert.equal(ok.length, createdPackageIds.length, "Todas las actualizaciones deben responder 200");
    assert.ok(
      ok.every((r) => r.body?.estadoActual === "En Tránsito"),
      "El estado final debe quedar en En Tránsito"
    );
    assert.ok(elapsedMs < 15000, `Tiempo elevado en actualización concurrente: ${elapsedMs}ms`);
  });
});
