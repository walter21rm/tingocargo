/**
 * ============================================================
 * EVALUACIÓN DE ADECUACIÓN FUNCIONAL — Casos de prueba de la API
 * ============================================================
 * Ejecuta, contra un backend de TingoCargo ya levantado, los casos de
 * prueba de caja negra trazados a cada requisito del SRS (RF-01..RF-20)
 * y a las funciones documentadas fuera del SRS (FD-01..FD-06).
 * Los casos de interfaz (CP-20, CP-50, CP-58, CP-60, CP-62..CP-64, CP-71, CP-88) están
 * en casos_ui.mjs.
 *
 * Uso:
 *   node casos_api.mjs base=http://localhost:4100 modo=postgresql \
 *        salida=../resultados/resultados_api_postgresql.json
 *
 * Cada caso registra: función, entrada, resultado esperado, resultado
 * obtenido y veredicto (PASA / FALLA). Una petición que no responde en
 * TIMEOUT_MS se registra como "Sin respuesta".
 * ============================================================
 */

import fs from "fs";
import path from "path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split("=");
    return [key, rest.join("=")];
  })
);
const BASE = args.base || "http://localhost:4100";
const MODO = args.modo || "postgresql";
const SALIDA = args.salida || "";
const TIMEOUT_MS = Number(args.timeout || 6000);
const ADMIN = { usuario: "wruizmarin21@gmail.com", password: "wally21" };
const ZONA = "America/Lima";

const casos = [];
const fixtures = {};

/* ── Utilidades ─────────────────────────────────────────────── */

const api = async (method, urlPath, { token, body, raw = false } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(`${BASE}${urlPath}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get("content-type") || "";
    let data;
    if (type.includes("application/json")) {
      const text = buffer.toString("utf8");
      data = text ? JSON.parse(text) : null;
    } else {
      data = raw ? buffer : buffer.toString("utf8");
    }
    return {
      status: response.status,
      body: data,
      type,
      ms: Math.round(performance.now() - started),
      timeout: false
    };
  } catch (err) {
    if (err.name === "AbortError") {
      return { status: null, body: null, type: "", ms: TIMEOUT_MS, timeout: true };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const http = (res) =>
  res.timeout
    ? `Sin respuesta tras ${TIMEOUT_MS / 1000} s (la petición queda colgada)`
    : `HTTP ${res.status}`;

const conError = (res) => {
  if (res.timeout) return http(res);
  const msg = res.body && typeof res.body === "object" ? res.body.error : "";
  return msg ? `${http(res)} — "${msg}"` : http(res);
};

const random = (digits) =>
  Array.from({ length: digits }, () => Math.floor(Math.random() * 10)).join("");
const telefono = () => `9${random(8)}`;
const dni = () => `4${random(7)}`;
const sfx = Date.now().toString(36).slice(-5);

const hoyLima = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
const sumarDias = (iso, dias) => {
  const fecha = new Date(`${iso}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

const ok = (cond) => Boolean(cond);

const caso = async (def, ejecutar) => {
  let resultado;
  try {
    resultado = await ejecutar();
  } catch (err) {
    resultado = { pasa: false, obtenido: `Error en la ejecución: ${err.message}` };
  }
  const registro = {
    id: def.id,
    funcion: def.funcion,
    titulo: def.titulo,
    entrada: def.entrada,
    esperado: def.esperado,
    obtenido: resultado.obtenido,
    pasa: resultado.pasa,
    modo: MODO
  };
  casos.push(registro);
  const etiqueta = resultado.pasa ? "PASA " : "FALLA";
  console.log(`${etiqueta} ${def.id} [${def.funcion}] ${def.titulo}`);
  console.log(`       Esperado: ${def.esperado}`);
  console.log(`       Obtenido: ${resultado.obtenido}`);
};

const fallaPreparacion = (paso, res) => {
  throw new Error(`Preparación fallida en "${paso}": ${conError(res)}`);
};

/* ── Preparación de datos (no se contabiliza como caso) ─────── */

const login = async (usuario, password) => {
  const res = await api("POST", "/api/auth/login", { body: { usuario, password } });
  if (res.status !== 200) fallaPreparacion(`login ${usuario}`, res);
  return res.body;
};

const crearUsuario = async (token, rolId, sucursalId, prefijo, extra = {}) => {
  const email = `${prefijo}.${sfx}@tingocargo.pe`;
  const password = "Clave2026";
  const tel = telefono();
  const res = await api("POST", "/api/users", {
    token,
    body: {
      nombre: extra.nombre || `${prefijo} ${sfx}`,
      email,
      telefonoPais: "PE",
      telefonoNumero: tel,
      rolId,
      sucursalId,
      password,
      activo: true,
      ...extra
    }
  });
  if (res.status !== 201) fallaPreparacion(`crear usuario ${prefijo}`, res);
  return { ...res.body, email, password, telefono: `+51${tel}` };
};

const crearPaquete = async (token, datos) => {
  const res = await api("POST", "/api/packages", {
    token,
    body: {
      remitenteId: fixtures.distribuidora.id,
      destinatarioId: fixtures.clienteC1.id,
      sucursalOrigenId: fixtures.sucursalOrigen.id,
      sucursalDestinoId: fixtures.sucursalDestino.id,
      destinoTexto: "Jr. Callao 456, Tingo María",
      descripcion: "Caja de medicamentos",
      operadorId: fixtures.opA.id,
      repartidorId: fixtures.repA.id,
      pesoKg: 1.5,
      ...datos
    }
  });
  if (res.status !== 201) fallaPreparacion("crear paquete", res);
  return res.body;
};

const cambiarEstado = async (token, id, estado, observacion = "") =>
  api("PATCH", `/api/packages/${id}/status`, { token, body: { estado, observacion } });

const paqueteEnIntentoFallido = async () => {
  const pkg = await crearPaquete(fixtures.tokens.opA, {});
  const salida = await cambiarEstado(fixtures.tokens.opA, pkg.id, "En Tránsito", "Salida registrada");
  if (salida.status !== 200) fallaPreparacion("salida para intento fallido", salida);
  const fallo = await cambiarEstado(fixtures.tokens.repA, pkg.id, "Intento fallido", "Cliente ausente");
  if (fallo.status !== 200) fallaPreparacion("intento fallido", fallo);
  return pkg;
};

const preparar = async () => {
  const admin = await login(ADMIN.usuario, ADMIN.password);
  fixtures.tokens = { admin: admin.token };
  const t = fixtures.tokens;

  const roles = await api("GET", "/api/roles", { token: t.admin });
  const rol = (nombre) => roles.body.find((r) => r.nombre === nombre)?.id;
  fixtures.roles = {
    operador: rol("Operador logístico"),
    repartidor: rol("Repartidor"),
    cliente: rol("Cliente"),
    admin: rol("Administrador")
  };

  const so = await api("POST", "/api/branches", {
    token: t.admin,
    body: { nombre: "Tingo María - Centro", direccion: "Av. Raimondi 123, Tingo María" }
  });
  const sd = await api("POST", "/api/branches", {
    token: t.admin,
    body: { nombre: "Tingo María - Norte", direccion: "Jr. Monzón 456, Tingo María" }
  });
  if (so.status !== 201 || sd.status !== 201) fallaPreparacion("sucursales", so.status !== 201 ? so : sd);
  fixtures.sucursalOrigen = so.body;
  fixtures.sucursalDestino = sd.body;

  const dist = await api("POST", "/api/distributors", {
    token: t.admin,
    body: {
      nombre: "DIMEXA",
      razonSocial: "Distribuidora de Medicamentos S.A.",
      telefonoPais: "PE",
      telefonoNumero: telefono(),
      direccion: "Av. Ejemplo 123, Tingo María"
    }
  });
  if (dist.status !== 201) fallaPreparacion("distribuidora", dist);
  fixtures.distribuidora = dist.body;

  const crearCliente = async (nombre, documento) => {
    const tel = telefono();
    const res = await api("POST", "/api/clients", {
      token: t.admin,
      body: {
        tipo: "persona",
        nombre,
        documento,
        telefonoPais: "PE",
        telefonoNumero: tel,
        email: `${nombre.split(" ")[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}.${sfx}@correo.pe`,
        direccion: "Jr. Callao 456, Tingo María"
      }
    });
    if (res.status !== 201) fallaPreparacion(`cliente ${nombre}`, res);
    return res.body;
  };
  fixtures.clienteC1 = await crearCliente("Carlos Mendoza", dni());
  fixtures.clienteC2 = await crearCliente("María Flores", dni());

  const sucursal = fixtures.sucursalOrigen.id;
  fixtures.opA = await crearUsuario(t.admin, fixtures.roles.operador, sucursal, "operador.a", { nombre: "Ana Torres" });
  fixtures.opB = await crearUsuario(t.admin, fixtures.roles.operador, sucursal, "operador.b", { nombre: "Luis Huamán" });
  fixtures.repA = await crearUsuario(t.admin, fixtures.roles.repartidor, sucursal, "repartidor.a", {
    nombre: "Pedro Quispe",
    placa: "ABC-123",
    vehiculo: "Moto Honda"
  });
  fixtures.repB = await crearUsuario(t.admin, fixtures.roles.repartidor, sucursal, "repartidor.b", { nombre: "Miguel Rojas" });
  fixtures.bloqueo = await crearUsuario(t.admin, fixtures.roles.operador, sucursal, "bloqueo", { nombre: "Usuario Bloqueo" });

  t.opA = (await login(fixtures.opA.email, fixtures.opA.password)).token;
  t.opB = (await login(fixtures.opB.email, fixtures.opB.password)).token;
  t.repA = (await login(fixtures.repA.email, fixtures.repA.password)).token;
  t.repB = (await login(fixtures.repB.email, fixtures.repB.password)).token;

  const documentoPortal = dni();
  const registro = await api("POST", "/api/auth/register", {
    body: {
      nombre: "Lucía Vargas",
      email: `lucia.${sfx}@correo.pe`,
      password: "Clave2026",
      telefonoPais: "PE",
      telefonoNumero: telefono(),
      tipo: "persona",
      documento: documentoPortal,
      direccion: "Av. Amazonas 789, Tingo María"
    }
  });
  if (registro.status !== 201) fallaPreparacion("registro cliente portal", registro);
  fixtures.clientePortal = {
    ...registro.body.user,
    email: `lucia.${sfx}@correo.pe`,
    password: "Clave2026",
    documento: documentoPortal
  };
  t.cliente = registro.body.token;
};

/* ── Casos de prueba ────────────────────────────────────────── */

const ejecutarCasos = async () => {
  const t = fixtures.tokens;
  const f = fixtures;

  /* RF-02 Registro de paquetes */
  let p1;
  await caso(
    {
      id: "CP-03",
      funcion: "RF-02",
      titulo: "Operador registra un paquete con datos completos",
      entrada: "Distribuidora, destinatario, sucursales origen/destino, destino, descripción, repartidor, 1.5 kg (sin operadorId)",
      esperado: "HTTP 201, código TM-AAAA-NNNN, estado «En Almacén» y operador autoasignado"
    },
    async () => {
      const res = await api("POST", "/api/packages", {
        token: t.opA,
        body: {
          remitenteId: f.distribuidora.id,
          destinatarioId: f.clienteC1.id,
          sucursalOrigenId: f.sucursalOrigen.id,
          sucursalDestinoId: f.sucursalDestino.id,
          destinoTexto: "Jr. Callao 456, Tingo María",
          descripcion: "Caja de medicamentos",
          repartidorId: f.repA.id,
          pesoKg: 1.5
        }
      });
      p1 = res.body;
      const pasa =
        res.status === 201 &&
        /^TM-\d{4}-\d{4}$/.test(res.body?.codigoSeguimiento || "") &&
        res.body?.estadoActual === "En Almacén" &&
        String(res.body?.operadorId) === String(f.opA.id);
      return {
        pasa,
        obtenido: res.status === 201
          ? `HTTP 201 — código ${res.body.codigoSeguimiento}, estado «${res.body.estadoActual}», operadorId=${res.body.operadorId}`
          : conError(res)
      };
    }
  );
  f.p1 = p1;

  await caso(
    {
      id: "CP-04",
      funcion: "RF-02",
      titulo: "Registro de paquete sin sucursal de destino",
      entrada: "Mismos datos sin sucursalDestinoId",
      esperado: "HTTP 400 indicando el campo obligatorio faltante"
    },
    async () => {
      const res = await api("POST", "/api/packages", {
        token: t.opA,
        body: {
          remitenteId: f.distribuidora.id,
          destinatarioId: f.clienteC1.id,
          sucursalOrigenId: f.sucursalOrigen.id,
          destinoTexto: "Jr. Callao 456",
          descripcion: "Caja",
          repartidorId: f.repA.id,
          pesoKg: 1
        }
      });
      return {
        pasa: res.status === 400 && /sucursalDestinoId/.test(res.body?.error || ""),
        obtenido: conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-05",
      funcion: "RF-02",
      titulo: "Tarifa automática para paquete de hasta 2 kg",
      entrada: "Paquete de 1.5 kg (config.json: S/ 10 hasta 2 kg)",
      esperado: "precioEnvio = 10"
    },
    async () => ({
      pasa: Number(p1?.precioEnvio) === 10,
      obtenido: `precioEnvio = ${p1?.precioEnvio}`
    })
  );

  await caso(
    {
      id: "CP-06",
      funcion: "RF-02",
      titulo: "Registro con distribuidora remitente inexistente",
      entrada: "remitenteId = 999999",
      esperado: "HTTP 400 «Remitente o cliente invalido»"
    },
    async () => {
      const res = await api("POST", "/api/packages", {
        token: t.opA,
        body: {
          remitenteId: "999999",
          destinatarioId: f.clienteC1.id,
          sucursalOrigenId: f.sucursalOrigen.id,
          sucursalDestinoId: f.sucursalDestino.id,
          destinoTexto: "Jr. Callao 456",
          descripcion: "Caja",
          repartidorId: f.repA.id
        }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  /* RF-01 Consulta de estado de paquete */
  await caso(
    {
      id: "CP-01",
      funcion: "RF-01",
      titulo: "Consulta pública con código válido (sin autenticación)",
      entrada: `GET /api/tracking/${p1?.codigoSeguimiento} sin token`,
      esperado: "HTTP 200 con estado actual e historial"
    },
    async () => {
      const res = await api("GET", `/api/tracking/${p1.codigoSeguimiento}`);
      return {
        pasa:
          res.status === 200 &&
          res.body?.codigoSeguimiento === p1.codigoSeguimiento &&
          typeof res.body?.estadoActual === "string" &&
          Array.isArray(res.body?.historial),
        obtenido: res.status === 200
          ? `HTTP 200 — estado «${res.body.estadoActual}», ${res.body.historial?.length} registro(s) de historial`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-02",
      funcion: "RF-01",
      titulo: "Consulta pública con código inexistente",
      entrada: "GET /api/tracking/TM-1999-0000",
      esperado: "HTTP 404 «Código no encontrado»"
    },
    async () => {
      const res = await api("GET", "/api/tracking/TM-1999-0000");
      return { pasa: res.status === 404, obtenido: conError(res) };
    }
  );

  /* RF-03 Actualización de estado */
  await caso(
    {
      id: "CP-07",
      funcion: "RF-03",
      titulo: "Operador registra la salida del paquete",
      entrada: "En Almacén → En Tránsito, observación «Salida registrada»",
      esperado: "HTTP 200 y estado «En Tránsito»"
    },
    async () => {
      const res = await cambiarEstado(t.opA, p1.id, "En Tránsito", "Salida registrada");
      return {
        pasa: res.status === 200 && res.body?.estadoActual === "En Tránsito",
        obtenido: res.status === 200 ? `HTTP 200 — estado «${res.body.estadoActual}»` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-08",
      funcion: "RF-03",
      titulo: "Cambio a un estado no definido",
      entrada: "estado = «Perdido»",
      esperado: "HTTP 400 «Estado inválido»"
    },
    async () => {
      const res = await cambiarEstado(t.opA, p1.id, "Perdido");
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-09",
      funcion: "RF-03",
      titulo: "Repartidor intenta marcar «En Tránsito»",
      entrada: "Token del repartidor asignado, estado «En Tránsito»",
      esperado: "HTTP 403 (el repartidor solo registra entrega o intento fallido)"
    },
    async () => {
      const res = await cambiarEstado(t.repA, p1.id, "En Tránsito");
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  const entrega = await cambiarEstado(t.repA, p1.id, "Entregado", "Entregado al destinatario");
  if (entrega.status !== 200) fallaPreparacion("entrega de P1", entrega);

  /* RF-04 Historial de estados */
  await caso(
    {
      id: "CP-12",
      funcion: "RF-04",
      titulo: "Línea de tiempo cronológica del paquete",
      entrada: "GET /api/packages/:id tras registrar, despachar y entregar",
      esperado: "Historial En Almacén → En Tránsito → Entregado, fechas ascendentes"
    },
    async () => {
      const res = await api("GET", `/api/packages/${p1.id}`, { token: t.opA });
      const hist = res.body?.historial || [];
      const estados = hist.map((h) => h.estado);
      const fechas = hist.map((h) => new Date(h.fechaHora).getTime());
      const ascendente = fechas.every((v, i) => i === 0 || v >= fechas[i - 1]);
      return {
        pasa:
          res.status === 200 &&
          estados.join("|") === "En Almacén|En Tránsito|Entregado" &&
          ascendente,
        obtenido: res.status === 200
          ? `HTTP 200 — ${estados.join(" → ")} (${ascendente ? "orden ascendente" : "orden incorrecto"})`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-10",
      funcion: "RF-03",
      titulo: "Retroceder un paquete ya entregado",
      entrada: "Paquete «Entregado» → «En Almacén» (operador)",
      esperado: "HTTP 400/409: transición no permitida (flujo En Almacén → En Tránsito → Entregado)"
    },
    async () => {
      const res = await cambiarEstado(t.opA, p1.id, "En Almacén", "Retroceso de prueba");
      return {
        pasa: res.status === 400 || res.status === 409,
        obtenido: res.status === 200
          ? `HTTP 200 — el paquete entregado vuelve a «${res.body.estadoActual}»`
          : conError(res)
      };
    }
  );

  const p2 = await crearPaquete(t.opA, { descripcion: "Paquete sin despachar" });
  f.p2 = p2;
  await caso(
    {
      id: "CP-11",
      funcion: "RF-03",
      titulo: "Repartidor confirma la entrega de un paquete que nunca salió del almacén",
      entrada: "Paquete «En Almacén» → «Entregado» (repartidor asignado)",
      esperado: "HTTP 400/409: no puede entregarse sin haber pasado por «En Tránsito»"
    },
    async () => {
      const res = await cambiarEstado(t.repA, p2.id, "Entregado", "Entrega directa");
      return {
        pasa: res.status === 400 || res.status === 409,
        obtenido: res.status === 200
          ? `HTTP 200 — estado «${res.body.estadoActual}» sin pasar por «En Tránsito»`
          : conError(res)
      };
    }
  );

  /* RF-05 Autenticación */
  await caso(
    {
      id: "CP-14",
      funcion: "RF-05",
      titulo: "Inicio de sesión válido de un usuario registrado",
      entrada: "Email y contraseña del operador",
      esperado: "HTTP 200 con token y rol «Operador logístico»"
    },
    async () => {
      const res = await api("POST", "/api/auth/login", {
        body: { usuario: f.opA.email, password: f.opA.password }
      });
      return {
        pasa: res.status === 200 && Boolean(res.body?.token) && res.body?.user?.roleName === "Operador logístico",
        obtenido: res.status === 200 ? `HTTP 200 — token emitido, rol «${res.body.user?.roleName}»` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-15",
      funcion: "RF-05",
      titulo: "Inicio de sesión con contraseña incorrecta",
      entrada: "Email válido, contraseña errónea",
      esperado: "HTTP 401 sin token"
    },
    async () => {
      const res = await api("POST", "/api/auth/login", {
        body: { usuario: f.opB.email, password: "incorrecta" }
      });
      return { pasa: res.status === 401 && !res.body?.token, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-16",
      funcion: "RF-05",
      titulo: "Bloqueo tras 5 intentos fallidos",
      entrada: "5 contraseñas erróneas y luego la contraseña correcta",
      esperado: "HTTP 429 en el sexto intento (cuenta bloqueada 15 min)"
    },
    async () => {
      for (let i = 0; i < 5; i += 1) {
        await api("POST", "/api/auth/login", { body: { usuario: f.bloqueo.email, password: "mala" } });
      }
      const res = await api("POST", "/api/auth/login", {
        body: { usuario: f.bloqueo.email, password: f.bloqueo.password }
      });
      return { pasa: res.status === 429, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-17",
      funcion: "RF-05",
      titulo: "Acceso con token inválido",
      entrada: "Authorization: Bearer token-falso",
      esperado: "HTTP 401"
    },
    async () => {
      const res = await api("GET", "/api/packages", { token: "token-falso" });
      return { pasa: res.status === 401, obtenido: conError(res) };
    }
  );

  /* RF-07 Gestión de roles */
  await caso(
    {
      id: "CP-25",
      funcion: "RF-07",
      titulo: "Roles básicos asegurados al arrancar",
      entrada: "GET /api/roles",
      esperado: "Administrador, Operador logístico, Repartidor y Cliente"
    },
    async () => {
      const res = await api("GET", "/api/roles", { token: t.admin });
      const nombres = (res.body || []).map((r) => r.nombre);
      const requeridos = ["Administrador", "Operador logístico", "Repartidor", "Cliente"];
      return {
        pasa: res.status === 200 && requeridos.every((n) => nombres.includes(n)),
        obtenido: `HTTP ${res.status} — ${nombres.join(", ")}`
      };
    }
  );

  await caso(
    {
      id: "CP-26",
      funcion: "RF-07",
      titulo: "Crear usuario con un rol inexistente",
      entrada: "rolId = 999999",
      esperado: "HTTP 400 «Rol inválido»"
    },
    async () => {
      const res = await api("POST", "/api/users", {
        token: t.admin,
        body: {
          nombre: "Rol Falso",
          email: `rol.falso.${sfx}@tingocargo.pe`,
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          rolId: "999999",
          sucursalId: f.sucursalOrigen.id,
          password: "Clave2026"
        }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  /* RF-08 Gestión de clientes */
  const documentoNuevo = dni();
  await caso(
    {
      id: "CP-27",
      funcion: "RF-08",
      titulo: "Operador registra un cliente (persona)",
      entrada: `Tipo persona, DNI ${documentoNuevo}, teléfono PE de 9 dígitos`,
      esperado: "HTTP 201 con teléfono en formato E.164 (+51…)"
    },
    async () => {
      const res = await api("POST", "/api/clients", {
        token: t.opA,
        body: {
          tipo: "persona",
          nombre: "Julio Ramos",
          documento: documentoNuevo,
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          email: `pedro.${sfx}@correo.pe`,
          direccion: "Jr. Huallaga 321, Tingo María"
        }
      });
      f.clienteNuevo = res.body;
      return {
        pasa: res.status === 201 && /^\+51\d{9}$/.test(res.body?.telefono || ""),
        obtenido: res.status === 201 ? `HTTP 201 — id ${res.body.id}, teléfono ${res.body.telefono}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-28",
      funcion: "RF-08",
      titulo: "Registro de cliente con teléfono de longitud inválida",
      entrada: "Teléfono PE de 8 dígitos",
      esperado: "HTTP 400 «El telefono para Peru debe tener 9 digitos»"
    },
    async () => {
      const res = await api("POST", "/api/clients", {
        token: t.opA,
        body: {
          tipo: "persona",
          nombre: "Teléfono Corto",
          documento: dni(),
          telefonoPais: "PE",
          telefonoNumero: "98765432",
          email: `corto.${sfx}@correo.pe`,
          direccion: "Jr. Test 1"
        }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-29",
      funcion: "RF-08",
      titulo: "Registro de un cliente con un DNI ya registrado",
      entrada: `Mismo DNI ${documentoNuevo} con otro nombre`,
      esperado: "HTTP 400/409: el documento ya pertenece a un cliente (no se duplica)"
    },
    async () => {
      const res = await api("POST", "/api/clients", {
        token: t.opA,
        body: {
          tipo: "persona",
          nombre: "Julio Ramos Díaz",
          documento: documentoNuevo,
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          email: `pedro.dup.${sfx}@correo.pe`,
          direccion: "Jr. Huallaga 321, Tingo María"
        }
      });
      f.clienteDuplicado = res.body;
      return {
        pasa: res.status === 400 || res.status === 409,
        obtenido: res.status === 201
          ? `HTTP 201 — se creó un segundo cliente (id ${res.body.id}) con el mismo DNI`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-30",
      funcion: "RF-08",
      titulo: "Consulta del listado de clientes",
      entrada: "GET /api/clients",
      esperado: "HTTP 200 con el cliente registrado y su documento legible"
    },
    async () => {
      const res = await api("GET", "/api/clients", { token: t.opA });
      const encontrado = (res.body || []).find((c) => String(c.id) === String(f.clienteNuevo?.id));
      return {
        pasa: res.status === 200 && encontrado?.documento === documentoNuevo,
        obtenido: res.status === 200
          ? `HTTP 200 — ${res.body.length} clientes; documento del registrado: ${encontrado?.documento}`
          : conError(res)
      };
    }
  );

  /* RF-09 Gestión de distribuidoras */
  await caso(
    {
      id: "CP-31",
      funcion: "RF-09",
      titulo: "Administrador registra una distribuidora",
      entrada: "Nombre, razón social, teléfono y dirección",
      esperado: "HTTP 201"
    },
    async () => {
      const res = await api("POST", "/api/distributors", {
        token: t.admin,
        body: {
          nombre: "ALFARO",
          razonSocial: "Droguería Alfaro S.A.C.",
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          direccion: "Jr. Ucayali 789, Tingo María"
        }
      });
      f.distribuidora2 = res.body;
      return { pasa: res.status === 201, obtenido: res.status === 201 ? `HTTP 201 — id ${res.body.id}` : conError(res) };
    }
  );

  await caso(
    {
      id: "CP-32",
      funcion: "RF-09",
      titulo: "Operador intenta registrar una distribuidora",
      entrada: "Token de operador",
      esperado: "HTTP 403 (solo administrador)"
    },
    async () => {
      const res = await api("POST", "/api/distributors", {
        token: t.opA,
        body: {
          nombre: "No permitida",
          razonSocial: "X",
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          direccion: "Jr. X"
        }
      });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-33",
      funcion: "RF-09",
      titulo: "Registro de distribuidora sin razón social",
      entrada: "razonSocial vacío",
      esperado: "HTTP 400"
    },
    async () => {
      const res = await api("POST", "/api/distributors", {
        token: t.admin,
        body: { nombre: "Incompleta", telefonoPais: "PE", telefonoNumero: telefono(), direccion: "Jr. X" }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-34",
      funcion: "RF-09",
      titulo: "Consulta del listado de distribuidoras",
      entrada: "GET /api/distributors",
      esperado: "HTTP 200 con la distribuidora registrada y teléfono legible"
    },
    async () => {
      const res = await api("GET", "/api/distributors", { token: t.opA });
      const d = (res.body || []).find((x) => String(x.id) === String(f.distribuidora2?.id));
      return {
        pasa: res.status === 200 && /^\+51\d{9}$/.test(d?.telefono || ""),
        obtenido: res.status === 200 ? `HTTP 200 — teléfono de la registrada: ${d?.telefono}` : conError(res)
      };
    }
  );

  /* RF-10 Gestión de sucursales */
  await caso(
    {
      id: "CP-35",
      funcion: "RF-10",
      titulo: "Administrador registra una sucursal",
      entrada: "Nombre y dirección",
      esperado: "HTTP 201"
    },
    async () => {
      const res = await api("POST", "/api/branches", {
        token: t.admin,
        body: { nombre: "Aucayacu", direccion: "Av. Principal s/n, Aucayacu" }
      });
      f.sucursal3 = res.body;
      return { pasa: res.status === 201, obtenido: res.status === 201 ? `HTTP 201 — id ${res.body.id}` : conError(res) };
    }
  );

  await caso(
    {
      id: "CP-36",
      funcion: "RF-10",
      titulo: "Registro de sucursal sin dirección",
      entrada: "direccion vacía",
      esperado: "HTTP 400 «nombre y direccion son requeridos»"
    },
    async () => {
      const res = await api("POST", "/api/branches", { token: t.admin, body: { nombre: "Sin dirección" } });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-37",
      funcion: "RF-10",
      titulo: "Operador intenta registrar una sucursal",
      entrada: "Token de operador",
      esperado: "HTTP 403"
    },
    async () => {
      const res = await api("POST", "/api/branches", {
        token: t.opA,
        body: { nombre: "No permitida", direccion: "Jr. X" }
      });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-38",
      funcion: "RF-10",
      titulo: "Consulta del listado de sucursales",
      entrada: "GET /api/branches",
      esperado: "HTTP 200 con la sucursal registrada y dirección legible"
    },
    async () => {
      const res = await api("GET", "/api/branches", { token: t.opA });
      const s = (res.body || []).find((x) => String(x.id) === String(f.sucursal3?.id));
      return {
        pasa: res.status === 200 && s?.direccion === "Av. Principal s/n, Aucayacu",
        obtenido: res.status === 200 ? `HTTP 200 — dirección de la registrada: «${s?.direccion}»` : conError(res)
      };
    }
  );

  /* RF-11 Asignación de operador */
  const p3 = await crearPaquete(t.admin, { descripcion: "Paquete asignación operador" });
  f.p3 = p3;
  await caso(
    {
      id: "CP-39",
      funcion: "RF-11",
      titulo: "Administrador asigna un operador",
      entrada: "operadorId = Operador B",
      esperado: "HTTP 200 con operadorId = Operador B"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p3.id}/operador`, {
        token: t.admin,
        body: { operadorId: f.opB.id }
      });
      return {
        pasa: res.status === 200 && String(res.body?.operadorId) === String(f.opB.id),
        obtenido: res.status === 200 ? `HTTP 200 — operadorId=${res.body.operadorId}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-40",
      funcion: "RF-11",
      titulo: "Asignar como operador a un usuario que es repartidor",
      entrada: "operadorId = Repartidor A",
      esperado: "HTTP 400 «El usuario debe ser operador logístico»"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p3.id}/operador`, {
        token: t.admin,
        body: { operadorId: f.repA.id }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  await api("PATCH", `/api/packages/${p3.id}/operador`, { token: t.admin, body: { operadorId: null } });
  await caso(
    {
      id: "CP-41",
      funcion: "RF-11",
      titulo: "Operador se autoasigna un paquete sin operador",
      entrada: "Token Operador A, operadorId = Operador A",
      esperado: "HTTP 200 con operadorId = Operador A"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p3.id}/operador`, {
        token: t.opA,
        body: { operadorId: f.opA.id }
      });
      return {
        pasa: res.status === 200 && String(res.body?.operadorId) === String(f.opA.id),
        obtenido: res.status === 200 ? `HTTP 200 — operadorId=${res.body.operadorId}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-42",
      funcion: "RF-11",
      titulo: "Operador intenta asignar el paquete a otro operador",
      entrada: "Token Operador A, operadorId = Operador B",
      esperado: "HTTP 403 «Solo puedes asignarte a ti mismo»"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p3.id}/operador`, {
        token: t.opA,
        body: { operadorId: f.opB.id }
      });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-43",
      funcion: "RF-11",
      titulo: "Operador B quita la asignación de un paquete del Operador A",
      entrada: "Token Operador B, operadorId = null sobre un paquete del Operador A",
      esperado: "HTTP 403: un operador solo puede autoasignarse, no desasignar a otro"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p3.id}/operador`, {
        token: t.opB,
        body: { operadorId: null }
      });
      return {
        pasa: res.status === 403,
        obtenido: res.status === 200
          ? `HTTP 200 — el paquete queda sin operador (operadorId=${res.body.operadorId})`
          : conError(res)
      };
    }
  );

  /* RF-12 Asignación de repartidor */
  const p4 = await crearPaquete(t.opA, { descripcion: "Paquete asignación repartidor" });
  f.p4 = p4;
  await caso(
    {
      id: "CP-44",
      funcion: "RF-12",
      titulo: "Operador del paquete asigna otro repartidor",
      entrada: "repartidorId = Repartidor B",
      esperado: "HTTP 200 con repartidorId = Repartidor B"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p4.id}/repartidor`, {
        token: t.opA,
        body: { repartidorId: f.repB.id }
      });
      return {
        pasa: res.status === 200 && String(res.body?.repartidorId) === String(f.repB.id),
        obtenido: res.status === 200 ? `HTTP 200 — repartidorId=${res.body.repartidorId}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-45",
      funcion: "RF-12",
      titulo: "Asignar como repartidor a un operador",
      entrada: "repartidorId = Operador B",
      esperado: "HTTP 400 «El usuario debe ser repartidor»"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p4.id}/repartidor`, {
        token: t.opA,
        body: { repartidorId: f.opB.id }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-46",
      funcion: "RF-12",
      titulo: "Operador ajeno al paquete intenta asignar repartidor",
      entrada: "Token Operador B sobre paquete del Operador A",
      esperado: "HTTP 403"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p4.id}/repartidor`, {
        token: t.opB,
        body: { repartidorId: f.repA.id }
      });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  /* RF-13 Vista «Mis entregas» */
  await caso(
    {
      id: "CP-47",
      funcion: "RF-13",
      titulo: "Repartidor consulta «Mis entregas»",
      entrada: "GET /api/couriers/me/packages con token del Repartidor A",
      esperado: "HTTP 200 solo con paquetes asignados al Repartidor A"
    },
    async () => {
      const res = await api("GET", "/api/couriers/me/packages", { token: t.repA });
      const lista = res.body || [];
      const soloPropios = lista.every((p) => String(p.repartidor?.id ?? p.repartidorId) === String(f.repA.id));
      const incluyeP1 = lista.some((p) => String(p.id) === String(p1.id));
      const excluyeP4 = !lista.some((p) => String(p.id) === String(p4.id));
      return {
        pasa: res.status === 200 && soloPropios && incluyeP1 && excluyeP4,
        obtenido: `HTTP ${res.status} — ${lista.length} paquetes, ${soloPropios ? "todos del Repartidor A" : "incluye paquetes ajenos"}`
      };
    }
  );

  await caso(
    {
      id: "CP-48",
      funcion: "RF-13",
      titulo: "Operador intenta usar la vista «Mis entregas»",
      entrada: "GET /api/couriers/me/packages con token de operador",
      esperado: "HTTP 403"
    },
    async () => {
      const res = await api("GET", "/api/couriers/me/packages", { token: t.opA });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-49",
      funcion: "RF-13",
      titulo: "Repartidor intenta ver un paquete que no tiene asignado",
      entrada: "Token Repartidor A sobre paquete del Repartidor B",
      esperado: "HTTP 403"
    },
    async () => {
      const res = await api("GET", `/api/packages/${p4.id}`, { token: t.repA });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  /* RF-14 Intento fallido */
  const p5 = await crearPaquete(t.opA, { descripcion: "Paquete intento fallido" });
  f.p5 = p5;
  await cambiarEstado(t.opA, p5.id, "En Tránsito", "Salida registrada");
  await caso(
    {
      id: "CP-51",
      funcion: "RF-14",
      titulo: "Repartidor registra un intento fallido con observación",
      entrada: "Paquete «En Tránsito», observación «Cliente ausente»",
      esperado: "HTTP 200, estado «Intento fallido» y observación en el historial"
    },
    async () => {
      const res = await cambiarEstado(t.repA, p5.id, "Intento fallido", "Cliente ausente");
      const det = await api("GET", `/api/packages/${p5.id}`, { token: t.repA });
      const ultimo = det.body?.historial?.at(-1);
      return {
        pasa: res.status === 200 && res.body?.estadoActual === "Intento fallido" && ultimo?.observacion === "Cliente ausente",
        obtenido: res.status === 200
          ? `HTTP 200 — estado «${res.body.estadoActual}», última observación «${ultimo?.observacion}»`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-52",
      funcion: "RF-14",
      titulo: "Repartidor no asignado intenta registrar un intento fallido",
      entrada: "Token Repartidor B sobre paquete del Repartidor A",
      esperado: "HTTP 403"
    },
    async () => {
      const res = await cambiarEstado(t.repB, p5.id, "Intento fallido", "No corresponde");
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-13",
      funcion: "RF-04",
      titulo: "Seguimiento público muestra el historial con observaciones",
      entrada: `GET /api/tracking/${p5.codigoSeguimiento}`,
      esperado: "Historial con «Intento fallido» y la observación «Cliente ausente»"
    },
    async () => {
      const res = await api("GET", `/api/tracking/${p5.codigoSeguimiento}`);
      const ultimo = res.body?.historial?.at(-1);
      return {
        pasa: res.status === 200 && ultimo?.estado === "Intento fallido" && ultimo?.observacion === "Cliente ausente",
        obtenido: res.status === 200
          ? `HTTP 200 — último registro «${ultimo?.estado}» / «${ultimo?.observacion}»`
          : conError(res)
      };
    }
  );

  /* RF-15 Reportes */
  await caso(
    {
      id: "CP-53",
      funcion: "RF-15",
      titulo: "Administrador descarga el reporte CSV",
      entrada: "GET /api/reports/packages?format=csv",
      esperado: "HTTP 200, text/csv con cabeceras y los paquetes registrados"
    },
    async () => {
      const res = await api("GET", "/api/reports/packages?format=csv", { token: t.admin });
      const texto = typeof res.body === "string" ? res.body : "";
      const filas = texto.split("\n").length - 1;
      return {
        pasa: res.status === 200 && res.type.includes("text/csv") && texto.includes("Codigo") && texto.includes(p1.codigoSeguimiento),
        obtenido: res.status === 200 ? `HTTP 200 — ${res.type}, ${filas} filas de datos` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-54",
      funcion: "RF-15",
      titulo: "Administrador descarga el reporte Excel (.xlsx)",
      entrada: "GET /api/reports/packages?format=xlsx",
      esperado: "HTTP 200 con un libro Excel válido"
    },
    async () => {
      const res = await api("GET", "/api/reports/packages?format=xlsx", { token: t.admin, raw: true });
      const buffer = Buffer.isBuffer(res.body) ? res.body : Buffer.alloc(0);
      const esZip = buffer.subarray(0, 2).toString() === "PK";
      return {
        pasa: res.status === 200 && res.type.includes("spreadsheetml") && esZip,
        obtenido: res.status === 200 ? `HTTP 200 — ${buffer.length} bytes, firma ${esZip ? "XLSX válida" : "inválida"}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-55",
      funcion: "RF-15",
      titulo: "Operador intenta descargar el reporte",
      entrada: "Token de operador",
      esperado: "HTTP 403 (solo administrador)"
    },
    async () => {
      const res = await api("GET", "/api/reports/packages?format=csv", { token: t.opA });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-56",
      funcion: "RF-15",
      titulo: "Reporte en formato no soportado",
      entrada: "format=pdf",
      esperado: "HTTP 400 «Formato no soportado»"
    },
    async () => {
      const res = await api("GET", "/api/reports/packages?format=pdf", { token: t.admin });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  /* RF-16/17/18 — datos de contacto que alimentan los botones «Llamar» */
  await caso(
    {
      id: "CP-57",
      funcion: "RF-16",
      titulo: "El detalle del paquete entrega el teléfono del operador asignado",
      entrada: "GET /api/packages/:id (paquete del Operador A)",
      esperado: `operador.telefono = ${f.opA.telefono}`
    },
    async () => {
      const res = await api("GET", `/api/packages/${p2.id}`, { token: t.opA });
      return {
        pasa: res.status === 200 && res.body?.operador?.telefono === f.opA.telefono,
        obtenido: res.status === 200 ? `operador.telefono = ${res.body.operador?.telefono}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-59",
      funcion: "RF-17",
      titulo: "El detalle del paquete entrega el teléfono del repartidor asignado",
      entrada: "GET /api/packages/:id (paquete del Repartidor A)",
      esperado: `repartidor.telefono = ${f.repA.telefono}`
    },
    async () => {
      const res = await api("GET", `/api/packages/${p2.id}`, { token: t.opA });
      return {
        pasa: res.status === 200 && res.body?.repartidor?.telefono === f.repA.telefono,
        obtenido: res.status === 200 ? `repartidor.telefono = ${res.body.repartidor?.telefono}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-61",
      funcion: "RF-18",
      titulo: "El detalle del paquete entrega el teléfono del cliente destinatario",
      entrada: "GET /api/packages/:id",
      esperado: `destinatario.telefono = ${f.clienteC1.telefono}`
    },
    async () => {
      const res = await api("GET", `/api/packages/${p2.id}`, { token: t.opA });
      return {
        pasa: res.status === 200 && res.body?.destinatario?.telefono === f.clienteC1.telefono,
        obtenido: res.status === 200 ? `destinatario.telefono = ${res.body.destinatario?.telefono}` : conError(res)
      };
    }
  );

  /* RF-20 Control de acceso por rol */
  await caso(
    {
      id: "CP-65",
      funcion: "RF-20",
      titulo: "Ruta protegida sin token",
      entrada: "GET /api/packages sin Authorization",
      esperado: "HTTP 401"
    },
    async () => {
      const res = await api("GET", "/api/packages");
      return { pasa: res.status === 401, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-66",
      funcion: "RF-20",
      titulo: "Operador intenta listar usuarios",
      entrada: "GET /api/users con token de operador",
      esperado: "HTTP 403 «Solo administrador»"
    },
    async () => {
      const res = await api("GET", "/api/users", { token: t.opA });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-67",
      funcion: "RF-20",
      titulo: "Repartidor intenta registrar un paquete",
      entrada: "POST /api/packages con token de repartidor",
      esperado: "HTTP 403"
    },
    async () => {
      const res = await api("POST", "/api/packages", {
        token: t.repA,
        body: { remitenteId: f.distribuidora.id, destinatarioId: f.clienteC1.id }
      });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-68",
      funcion: "RF-20",
      titulo: "Cliente intenta ver el detalle de un paquete ajeno",
      entrada: "GET /api/packages/:id con token de cliente",
      esperado: "HTTP 403"
    },
    async () => {
      const res = await api("GET", `/api/packages/${p1.id}`, { token: t.cliente });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  const p8 = await crearPaquete(t.opA, { descripcion: "Paquete ajeno al cliente" });
  f.p8 = p8;
  await cambiarEstado(t.opA, p8.id, "En Tránsito", "Salida registrada");
  await caso(
    {
      id: "CP-69",
      funcion: "RF-20",
      titulo: "Cliente cambia el estado de un paquete ajeno a «Entregado»",
      entrada: "PATCH /api/packages/:id/status con token de cliente (paquete de otro destinatario)",
      esperado: "HTTP 403: el cliente no puede modificar estados"
    },
    async () => {
      const res = await cambiarEstado(t.cliente, p8.id, "Entregado", "Marcado por un cliente");
      return {
        pasa: res.status === 403,
        obtenido: res.status === 200
          ? `HTTP 200 — el paquete ${p8.codigoSeguimiento} queda «${res.body.estadoActual}»`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-70",
      funcion: "RF-20",
      titulo: "Cliente registra un paquete por el endpoint administrativo",
      entrada: "POST /api/packages (distribuidora → cliente) con token de cliente",
      esperado: "HTTP 403 (registro reservado a Administrador y Operador)"
    },
    async () => {
      const res = await api("POST", "/api/packages", {
        token: t.cliente,
        body: {
          remitenteId: f.distribuidora.id,
          destinatarioId: f.clienteC2.id,
          sucursalOrigenId: f.sucursalOrigen.id,
          sucursalDestinoId: f.sucursalDestino.id,
          destinoTexto: "Jr. Prueba 1",
          descripcion: "Registrado por cliente",
          operadorId: f.opA.id,
          repartidorId: f.repA.id,
          pesoKg: 1
        }
      });
      return {
        pasa: res.status === 403,
        obtenido: res.status === 201
          ? `HTTP 201 — paquete ${res.body.codigoSeguimiento} creado a nombre de la distribuidora`
          : conError(res)
      };
    }
  );

  /* FD-01 Registro de cliente en el portal */
  await caso(
    {
      id: "CP-72",
      funcion: "FD-01",
      titulo: "Autoregistro de un cliente nuevo en el portal",
      entrada: "Nombre, email, contraseña, teléfono, DNI nuevo, dirección",
      esperado: "HTTP 201 con token, rol «Cliente» y clienteId"
    },
    async () => {
      const res = await api("POST", "/api/auth/register", {
        body: {
          nombre: "Rosa Vela",
          email: `rosa.${sfx}@correo.pe`,
          password: "Clave2026",
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          tipo: "persona",
          documento: dni(),
          direccion: "Jr. Tito Jaime 12, Tingo María"
        }
      });
      return {
        pasa: res.status === 201 && res.body?.user?.roleName === "Cliente" && Boolean(res.body?.user?.clienteId),
        obtenido: res.status === 201
          ? `HTTP 201 — rol «${res.body.user.roleName}», clienteId=${res.body.user.clienteId}`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-73",
      funcion: "FD-01",
      titulo: "Autoregistro con un email ya registrado",
      entrada: "Email de un cliente existente",
      esperado: "HTTP 400 «El email ya está registrado»"
    },
    async () => {
      const res = await api("POST", "/api/auth/register", {
        body: {
          nombre: "Duplicado",
          email: f.clientePortal.email,
          password: "Clave2026",
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          tipo: "persona",
          documento: dni(),
          direccion: "Jr. X"
        }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  let tokenC1;
  await caso(
    {
      id: "CP-74",
      funcion: "FD-01",
      titulo: "Destinatario que ya recibió envíos se registra con su DNI",
      entrada: `DNI de ${f.clienteC1.nombre} (cliente con paquetes registrados por el operador)`,
      esperado: "La cuenta se vincula al cliente existente y «Mis envíos» muestra sus paquetes"
    },
    async () => {
      const res = await api("POST", "/api/auth/register", {
        body: {
          nombre: f.clienteC1.nombre,
          email: `carlos.portal.${sfx}@correo.pe`,
          password: "Clave2026",
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          tipo: "persona",
          documento: f.clienteC1.documento,
          direccion: "Jr. Callao 456, Tingo María"
        }
      });
      if (res.status !== 201) return { pasa: false, obtenido: conError(res) };
      tokenC1 = res.body.token;
      f.clienteC1Portal = { email: `carlos.portal.${sfx}@correo.pe`, password: "Clave2026", clienteId: res.body.user.clienteId };
      const mis = await api("GET", "/api/client/me/packages", { token: tokenC1 });
      const vinculado = String(res.body.user.clienteId) === String(f.clienteC1.id);
      const n = Array.isArray(mis.body) ? mis.body.length : 0;
      return {
        pasa: vinculado && n > 0,
        obtenido: vinculado
          ? `Vinculado al cliente ${res.body.user.clienteId}; «Mis envíos» muestra ${n} paquete(s)`
          : `Se creó otro cliente (id ${res.body.user.clienteId} ≠ ${f.clienteC1.id}); «Mis envíos» muestra ${n} paquete(s)`
      };
    }
  );

  /* FD-02 Envío cliente a cliente */
  let envioCliente;
  await caso(
    {
      id: "CP-75",
      funcion: "FD-02",
      titulo: "Cliente registra un envío a un destinatario existente",
      entrada: "Destinatario existente, sucursales, 1 kg, paga el remitente",
      esperado: "HTTP 201, tipo «cliente_cliente», precio S/ 10"
    },
    async () => {
      const res = await api("POST", "/api/client/packages", {
        token: t.cliente,
        body: {
          destinatarioId: f.clienteC2.id,
          sucursalOrigenId: f.sucursalOrigen.id,
          sucursalDestinoId: f.sucursalDestino.id,
          destinoTexto: "Jr. Callao 456, Tingo María",
          descripcion: "Sobre con documentos",
          pesoKg: 1,
          quienPaga: "remitente"
        }
      });
      envioCliente = res.body;
      f.envioCliente = envioCliente;
      return {
        pasa: res.status === 201 && res.body?.tipoEnvio === "cliente_cliente" && Number(res.body?.precioEnvio) === 10,
        obtenido: res.status === 201
          ? `HTTP 201 — ${res.body.codigoSeguimiento}, tipo ${res.body.tipoEnvio}, precio ${res.body.precioEnvio}`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-76",
      funcion: "FD-02",
      titulo: "Cliente agrega un destinatario nuevo desde «Enviar paquete»",
      entrada: "POST /api/clients con token de cliente (botón «+ Agregar nuevo» del portal)",
      esperado: "HTTP 201: el destinatario queda disponible para el envío"
    },
    async () => {
      const res = await api("POST", "/api/clients", {
        token: t.cliente,
        body: {
          tipo: "persona",
          nombre: "Jorge Paredes",
          documento: dni(),
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          email: `jorge.${sfx}@correo.pe`,
          direccion: "Jr. Prado 55, Tingo María"
        }
      });
      return { pasa: res.status === 201, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-77",
      funcion: "FD-02",
      titulo: "Cliente intenta enviarse un paquete a sí mismo",
      entrada: "destinatarioId = clienteId propio",
      esperado: "HTTP 400 «El destinatario debe ser diferente al remitente»"
    },
    async () => {
      const res = await api("POST", "/api/client/packages", {
        token: t.cliente,
        body: {
          destinatarioId: f.clientePortal.clienteId,
          sucursalOrigenId: f.sucursalOrigen.id,
          sucursalDestinoId: f.sucursalDestino.id,
          destinoTexto: "Jr. X",
          descripcion: "A mí mismo",
          pesoKg: 1
        }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  /* FD-03 Pago del envío por el cliente (portal) */
  await caso(
    {
      id: "CP-78",
      funcion: "FD-03",
      titulo: "Cliente intenta pagar un envío que no le corresponde",
      entrada: "PATCH /api/client/packages/:id/pagar sobre un paquete ajeno (paga el remitente)",
      esperado: "HTTP 403 «Solo el remitente puede pagar este paquete»"
    },
    async () => {
      const res = await api("PATCH", `/api/client/packages/${f.p8.id}/pagar`, {
        token: t.cliente,
        body: { metodoPago: "efectivo" }
      });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-79",
      funcion: "FD-03",
      titulo: "Cliente intenta pagar un envío de más de 2 kg sin precio asignado",
      entrada: "Envío propio de 3 kg (precio pendiente de asignar por el operador)",
      esperado: "HTTP 400 «El operador debe asignar el precio antes de pagar»"
    },
    async () => {
      const pesado = await api("POST", "/api/client/packages", {
        token: t.cliente,
        body: {
          destinatarioId: f.clienteC2.id,
          sucursalOrigenId: f.sucursalOrigen.id,
          sucursalDestinoId: f.sucursalDestino.id,
          destinoTexto: "Jr. Callao 456, Tingo María",
          descripcion: "Caja de 3 kg",
          pesoKg: 3,
          quienPaga: "remitente"
        }
      });
      if (pesado.status !== 201) return { pasa: false, obtenido: `Precondición: ${conError(pesado)}` };
      const res = await api("PATCH", `/api/client/packages/${pesado.body.id}/pagar`, {
        token: t.cliente,
        body: { metodoPago: "efectivo" }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  /* FD-04 Registro de pago en destino (repartidor u operador) */
  const p9 = await crearPaquete(t.opA, { descripcion: "Pago contra entrega", quienPaga: "destinatario", pesoKg: 1 });
  f.p9 = p9;
  await caso(
    {
      id: "CP-81",
      funcion: "FD-04",
      titulo: "Repartidor registra el pago en efectivo al entregar",
      entrada: "PATCH /registrar-pago-destino, método efectivo",
      esperado: "HTTP 200, pagado = true, método «efectivo»"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p9.id}/registrar-pago-destino`, {
        token: t.repA,
        body: { metodoPago: "efectivo" }
      });
      return {
        pasa: res.status === 200 && res.body?.pagado === true && res.body?.metodoPago === "efectivo",
        obtenido: res.status === 200 ? `HTTP 200 — pagado=${res.body.pagado}, método=${res.body.metodoPago}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-82",
      funcion: "FD-04",
      titulo: "Intento de registrar dos veces el mismo pago",
      entrada: "Segundo registro sobre el paquete ya pagado",
      esperado: "HTTP 400 «El paquete ya está pagado»"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p9.id}/registrar-pago-destino`, {
        token: t.repA,
        body: { metodoPago: "efectivo" }
      });
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  const p10 = await crearPaquete(t.opA, { descripcion: "Pago en destino ajeno", quienPaga: "destinatario", pesoKg: 1 });
  await caso(
    {
      id: "CP-83",
      funcion: "FD-04",
      titulo: "Repartidor no asignado intenta registrar el pago",
      entrada: "Token del Repartidor B sobre un paquete del Repartidor A",
      esperado: "HTTP 403 «Solo el repartidor asignado puede registrar el pago»"
    },
    async () => {
      const res = await api("PATCH", `/api/packages/${p10.id}/registrar-pago-destino`, {
        token: t.repB,
        body: { metodoPago: "efectivo" }
      });
      return { pasa: res.status === 403, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-80",
      funcion: "FD-03",
      titulo: "Cliente elige «Efectivo: pagarás al momento de la entrega»",
      entrada: "PATCH /api/client/packages/:id/pagar con metodoPago «efectivo» (lo que envía el portal)",
      esperado: "El envío queda pendiente de cobro (pagado = false) hasta que el repartidor reciba el dinero"
    },
    async () => {
      const res = await api("PATCH", `/api/client/packages/${envioCliente.id}/pagar`, {
        token: t.cliente,
        body: { metodoPago: "efectivo" }
      });
      return {
        pasa: res.status === 200 && res.body?.pagado === false,
        obtenido: res.status === 200
          ? `HTTP 200 — pagado=${res.body.pagado}, método=${res.body.metodoPago} sin haberse cobrado`
          : conError(res)
      };
    }
  );

  /* FD-05 Reprogramación de entrega */
  const manana = sumarDias(hoyLima(), 1);
  const ayer = sumarDias(hoyLima(), -1);
  await caso(
    {
      id: "CP-84",
      funcion: "FD-05",
      titulo: "Destinatario reprograma la entrega desde el seguimiento público",
      entrada: `Paquete con intento fallido, fecha ${manana}, 09:00–12:00, nueva dirección`,
      esperado: "HTTP 200, estado «En Tránsito», fecha guardada y registro «Reprogramado para entrega»"
    },
    async () => {
      const res = await api("POST", `/api/tracking/${p5.codigoSeguimiento}/reprogramar`, {
        body: { fecha: manana, horaInicio: "09:00", horaFin: "12:00", direccion: "Jr. Callao 999, Tingo María" }
      });
      const ultimo = res.body?.historial?.at(-1);
      const fecha = String(res.body?.reprogramacionFecha || "").slice(0, 10);
      return {
        pasa: res.status === 200 && res.body?.estadoActual === "En Tránsito" && ultimo?.observacion === "Reprogramado para entrega",
        obtenido: res.status === 200
          ? `HTTP 200 — estado «${res.body.estadoActual}», fecha ${fecha}, «${ultimo?.observacion}»`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-85",
      funcion: "FD-05",
      titulo: "Reprogramar un paquete que no tuvo intento fallido",
      entrada: "Paquete «En Almacén»",
      esperado: "HTTP 400 «Solo se puede reprogramar un paquete con estado Intento fallido»"
    },
    async () => {
      const res = await api("POST", `/api/tracking/${p2.codigoSeguimiento}/reprogramar`, {
        body: { fecha: manana, horaInicio: "09:00", horaFin: "12:00" }
      });
      const actual = await api("GET", `/api/tracking/${p2.codigoSeguimiento}`);
      if (actual.body?.estadoActual === "Intento fallido") {
        return { pasa: false, obtenido: "Precondición alterada" };
      }
      return { pasa: res.status === 400, obtenido: conError(res) };
    }
  );

  const p6 = await paqueteEnIntentoFallido();
  f.p6 = p6;
  await caso(
    {
      id: "CP-86",
      funcion: "FD-05",
      titulo: "Reprogramar la entrega para una fecha pasada",
      entrada: `fecha = ${ayer} (ayer)`,
      esperado: "HTTP 400: la nueva fecha debe ser hoy o posterior"
    },
    async () => {
      const res = await api("POST", `/api/tracking/${p6.codigoSeguimiento}/reprogramar`, {
        body: { fecha: ayer, horaInicio: "09:00", horaFin: "12:00" }
      });
      return {
        pasa: res.status === 400,
        obtenido: res.status === 200
          ? `HTTP 200 — reprogramado para ${String(res.body.reprogramacionFecha).slice(0, 10)} y estado «${res.body.estadoActual}»`
          : conError(res)
      };
    }
  );

  const p7 = await paqueteEnIntentoFallido();
  f.p7 = p7;
  await caso(
    {
      id: "CP-87",
      funcion: "FD-05",
      titulo: "Reprogramar con hora de fin anterior a la de inicio",
      entrada: `fecha ${manana}, horaInicio 15:00, horaFin 09:00`,
      esperado: "HTTP 400: rango horario inválido"
    },
    async () => {
      const res = await api("POST", `/api/tracking/${p7.codigoSeguimiento}/reprogramar`, {
        body: { fecha: manana, horaInicio: "15:00", horaFin: "09:00" }
      });
      return {
        pasa: res.status === 400,
        obtenido: res.status === 200
          ? `HTTP 200 — ventana guardada ${res.body.reprogramacionHoraInicio}–${res.body.reprogramacionHoraFin}`
          : conError(res)
      };
    }
  );

  /* FD-06 Mis envíos (portal del cliente) */
  await caso(
    {
      id: "CP-89",
      funcion: "FD-06",
      titulo: "Cliente consulta «Mis envíos»",
      entrada: "GET /api/client/me/packages",
      esperado: "HTTP 200 con sus envíos (como remitente o destinatario) y ninguno ajeno"
    },
    async () => {
      const res = await api("GET", "/api/client/me/packages", { token: t.cliente });
      const id = String(f.clientePortal.clienteId);
      const lista = res.body || [];
      const propios = lista.every((p) => String(p.remitenteClienteId) === id || String(p.destinatarioId) === id);
      const incluye = lista.some((p) => String(p.id) === String(envioCliente?.id));
      return {
        pasa: res.status === 200 && propios && incluye,
        obtenido: `HTTP ${res.status} — ${lista.length} envío(s), ${propios ? "todos propios" : "incluye ajenos"}`
      };
    }
  );

  await caso(
    {
      id: "CP-90",
      funcion: "FD-06",
      titulo: "Cliente ve el detalle y la línea de tiempo de su envío",
      entrada: "GET /api/packages/:id del envío propio",
      esperado: "HTTP 200 con historial"
    },
    async () => {
      const res = await api("GET", `/api/packages/${envioCliente.id}`, { token: t.cliente });
      return {
        pasa: res.status === 200 && Array.isArray(res.body?.historial) && res.body.historial.length >= 1,
        obtenido: res.status === 200 ? `HTTP 200 — ${res.body.historial.length} registro(s) de historial` : conError(res)
      };
    }
  );

  /* RF-06 Gestión de usuarios (al final: incluye eliminaciones) */
  let usuarioNuevo;
  await caso(
    {
      id: "CP-18",
      funcion: "RF-06",
      titulo: "Administrador crea un repartidor con placa y vehículo",
      entrada: "Nombre, email, teléfono, rol Repartidor, sucursal, contraseña, placa, vehículo",
      esperado: "HTTP 201 sin exponer la contraseña ni su hash"
    },
    async () => {
      const res = await api("POST", "/api/users", {
        token: t.admin,
        body: {
          nombre: "Raúl Cárdenas",
          email: `repartidor.c.${sfx}@tingocargo.pe`,
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          rolId: f.roles.repartidor,
          sucursalId: f.sucursalOrigen.id,
          password: "Clave2026",
          placa: "XYZ-987",
          vehiculo: "Moto Yamaha",
          activo: true
        }
      });
      usuarioNuevo = res.body;
      const expone = res.body && ("passwordHash" in res.body || "password_hash" in res.body || "password" in res.body);
      return {
        pasa: res.status === 201 && !expone,
        obtenido: res.status === 201 ? `HTTP 201 — id ${res.body.id}, ${expone ? "expone hash" : "sin hash"}` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-19",
      funcion: "RF-06",
      titulo: "Datos del usuario para el formulario de edición",
      entrada: "GET /api/users/:id del Repartidor A",
      esperado: `Teléfono legible en formato E.164 (${f.repA.telefono})`
    },
    async () => {
      const res = await api("GET", `/api/users/${f.repA.id}`, { token: t.admin });
      const tel = String(res.body?.telefono || "");
      return {
        pasa: res.status === 200 && tel === f.repA.telefono,
        obtenido: res.status === 200
          ? `HTTP 200 — telefono = «${tel.length > 40 ? `${tel.slice(0, 38)}…` : tel}»`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-21",
      funcion: "RF-06",
      titulo: "Administrador edita el nombre de un usuario",
      entrada: "PUT /api/users/:id con nombre nuevo",
      esperado: "HTTP 200 con el nombre actualizado"
    },
    async () => {
      const res = await api("PUT", `/api/users/${usuarioNuevo.id}`, {
        token: t.admin,
        body: {
          nombre: "Raúl Cárdenas Soto",
          email: `repartidor.c.${sfx}@tingocargo.pe`,
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          rolId: f.roles.repartidor,
          sucursalId: f.sucursalOrigen.id,
          activo: true
        }
      });
      return {
        pasa: res.status === 200 && res.body?.nombre === "Raúl Cárdenas Soto",
        obtenido: res.status === 200 ? `HTTP 200 — nombre «${res.body.nombre}»` : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-22",
      funcion: "RF-06",
      titulo: "Crear un usuario con un email ya registrado",
      entrada: `email = ${f.opA.email}`,
      esperado: "HTTP 400/409 con mensaje «email ya registrado»"
    },
    async () => {
      const res = await api("POST", "/api/users", {
        token: t.admin,
        body: {
          nombre: "Operador Duplicado",
          email: f.opA.email,
          telefonoPais: "PE",
          telefonoNumero: telefono(),
          rolId: f.roles.operador,
          sucursalId: f.sucursalOrigen.id,
          password: "Clave2026"
        }
      });
      return {
        pasa: res.status === 400 || res.status === 409,
        obtenido: res.status === 201
          ? `HTTP 201 — se creó un segundo usuario con el mismo email (id ${res.body.id})`
          : conError(res)
      };
    }
  );

  await caso(
    {
      id: "CP-23",
      funcion: "RF-06",
      titulo: "Eliminar un usuario sin paquetes",
      entrada: "DELETE /api/users/:id (repartidor recién creado)",
      esperado: "HTTP 200 { ok: true }"
    },
    async () => {
      const res = await api("DELETE", `/api/users/${usuarioNuevo.id}`, { token: t.admin });
      return { pasa: res.status === 200 && res.body?.ok === true, obtenido: conError(res) };
    }
  );

  await caso(
    {
      id: "CP-24",
      funcion: "RF-06",
      titulo: "Eliminar un repartidor que tiene paquetes asignados",
      entrada: "DELETE /api/users/:id del Repartidor B (tiene un paquete asignado)",
      esperado: "Respuesta controlada (HTTP 400/409 con mensaje) sin dejar paquetes inconsistentes"
    },
    async () => {
      const res = await api("DELETE", `/api/users/${f.repB.id}`, { token: t.admin });
      if (res.timeout) return { pasa: false, obtenido: http(res) };
      if (res.status === 200) {
        const det = await api("GET", `/api/packages/${p4.id}`, { token: t.admin });
        return {
          pasa: false,
          obtenido: `HTTP 200 — usuario eliminado; el paquete ${p4.codigoSeguimiento} queda con repartidor «${det.body?.repartidor?.nombre ?? "inexistente"}»`
        };
      }
      return { pasa: res.status === 400 || res.status === 409, obtenido: conError(res) };
    }
  );
};

/* ── Ejecución ──────────────────────────────────────────────── */

const main = async () => {
  console.log("============================================================");
  console.log(" EVALUACIÓN DE ADECUACIÓN FUNCIONAL — TingoCargo");
  console.log(` Backend: ${BASE}   Almacenamiento: ${MODO}`);
  console.log(` Inicio: ${new Date().toLocaleString("es-PE", { timeZone: ZONA })} (hora de Lima)`);
  console.log("============================================================");
  await preparar();
  console.log(`Datos de prueba preparados (sufijo ${sfx}).\n`);
  await ejecutarCasos();
  const total = casos.length;
  const pasan = casos.filter((c) => c.pasa).length;
  console.log("\n------------------------------------------------------------");
  console.log(` Casos ejecutados: ${total}   Pasan: ${pasan}   Fallan: ${total - pasan}`);
  const funciones = [...new Set(casos.map((c) => c.funcion))];
  const conFalla = funciones.filter((fn) => casos.some((c) => c.funcion === fn && !c.pasa));
  console.log(` Funciones con al menos un caso fallido: ${conFalla.join(", ") || "ninguna"}`);
  console.log("------------------------------------------------------------");
  const ordenados = [...casos].sort((a, b) => a.id.localeCompare(b.id));
  for (const c of ordenados) {
    console.log(` ${c.id}  ${c.funcion}  ${c.pasa ? "PASA " : "FALLA"}  ${c.titulo}`);
  }
  console.log("------------------------------------------------------------");
  if (SALIDA) {
    const salida = path.resolve(SALIDA);
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    fs.writeFileSync(
      salida,
      JSON.stringify(
        {
          modo: MODO,
          base: BASE,
          fecha: new Date().toISOString(),
          sufijo: sfx,
          casos,
          fixtures: {
            sufijo: sfx,
            admin: ADMIN,
            operadorA: { email: fixtures.opA.email, password: fixtures.opA.password, id: fixtures.opA.id, nombre: fixtures.opA.nombre },
            operadorB: { email: fixtures.opB.email, password: fixtures.opB.password, id: fixtures.opB.id },
            repartidorA: { email: fixtures.repA.email, password: fixtures.repA.password, id: fixtures.repA.id, nombre: fixtures.repA.nombre },
            clientePortal: { email: fixtures.clientePortal.email, password: fixtures.clientePortal.password, clienteId: fixtures.clientePortal.clienteId },
            repartidorB: { email: fixtures.repB.email, password: fixtures.repB.password, id: fixtures.repB.id },
            sucursalOrigen: fixtures.sucursalOrigen,
            sucursalDestino: fixtures.sucursalDestino,
            distribuidora: fixtures.distribuidora,
            roles: fixtures.roles,
            clienteC2: fixtures.clienteC2,
            clienteC1: fixtures.clienteC1,
            clienteC1Portal: fixtures.clienteC1Portal || null,
            clienteNuevo: fixtures.clienteNuevo || null,
            paquetes: {
              p1: fixtures.p1 && { id: fixtures.p1.id, codigo: fixtures.p1.codigoSeguimiento },
              p2: fixtures.p2 && { id: fixtures.p2.id, codigo: fixtures.p2.codigoSeguimiento },
              p3: fixtures.p3 && { id: fixtures.p3.id, codigo: fixtures.p3.codigoSeguimiento },
              p4: fixtures.p4 && { id: fixtures.p4.id, codigo: fixtures.p4.codigoSeguimiento },
              p5: fixtures.p5 && { id: fixtures.p5.id, codigo: fixtures.p5.codigoSeguimiento },
              p6: fixtures.p6 && { id: fixtures.p6.id, codigo: fixtures.p6.codigoSeguimiento },
              p7: fixtures.p7 && { id: fixtures.p7.id, codigo: fixtures.p7.codigoSeguimiento },
              p8: fixtures.p8 && { id: fixtures.p8.id, codigo: fixtures.p8.codigoSeguimiento },
              p9: fixtures.p9 && { id: fixtures.p9.id, codigo: fixtures.p9.codigoSeguimiento },
              envioCliente: fixtures.envioCliente && { id: fixtures.envioCliente.id, codigo: fixtures.envioCliente.codigoSeguimiento }
            }
          }
        },
        null,
        2
      )
    );
    console.log(` Resultados guardados en ${path.relative(process.cwd(), salida)}`);
  }
};

main().catch((err) => {
  console.error("La evaluación no pudo completarse:", err.message);
  process.exit(1);
});
