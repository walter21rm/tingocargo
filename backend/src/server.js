/**
 * ============================================================
 * SERVIDOR PRINCIPAL — TingoCargo
 * ============================================================
 * Archivo central del backend. Configura Express, define todas
 * las rutas de la API REST, implementa la autenticación por
 * tokens y la autorización por roles.
 *
 * Patrón de almacenamiento:
 *   Si USE_DB=true  → usa storageDb.js (PostgreSQL / Supabase)
 *   Si USE_DB=false → usa storage.js   (memoria RAM, para pruebas)
 * Ambos módulos exponen las mismas funciones (interfaz por convención).
 * ============================================================
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import * as memory from "./storage.js";
import * as db from "./storageDb.js";
import {
  amountToCents,
  createCulqiCharge,
  createCulqiOrder,
  getCulqiConfig
} from "./culqi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/* ── Carga de config.json (configuración y parametrización centralizada) ── */
const configPath = path.resolve(__dirname, "../../config.json");
let cfg;
try {
  cfg = JSON.parse(readFileSync(configPath, "utf-8"));
} catch {
  console.warn("config.json no encontrado, usando valores por defecto");
  cfg = { configuracion: {}, parametrizacion: {} };
}
const conf = cfg.configuracion || {};
const param = cfg.parametrizacion || {};

/* ── Configuración del servidor (config.json → configuracion.servidor) ── */
const app = express();
const port = process.env.PORT || conf.servidor?.puerto || 4000;

/* ── Selección del módulo de almacenamiento ─────────────── */
const useDb = process.env.USE_DB !== undefined
  ? process.env.USE_DB === "true"
  : (conf.baseDatos?.usar ?? false);
if (useDb && !process.env.DATABASE_URL && !conf.baseDatos?.url) {
  console.error("DATABASE_URL no está configurado en backend/.env ni en config.json");
  process.exit(1);
}
if (useDb && !process.env.DATABASE_URL && conf.baseDatos?.url) {
  process.env.DATABASE_URL = conf.baseDatos.url;
}
const repo = useDb ? db : memory;

/** Envuelve una función del repo en una Promise para unificar manejo síncrono/asíncrono */
const call = (fn, ...args) => Promise.resolve(fn(...args));

/* ── Credenciales y configuración (prioridad: .env > config.json > default) ── */
const adminUser = process.env.ADMIN_USER || conf.auth?.adminUser || "admin";
const adminPass = process.env.ADMIN_PASS || conf.auth?.adminPass || "admin123";
const seedAdminName = process.env.ADMIN_SEED_NAME || conf.auth?.seedNombre || "Walter";
const seedAdminEmail =
  process.env.ADMIN_SEED_EMAIL || conf.auth?.seedEmail || "wruizmarin21@gmail.com";
const seedAdminPass = process.env.ADMIN_SEED_PASS || conf.auth?.seedPassword || "wally21";
const dniApiUrl =
  process.env.DNI_API_URL || conf.api?.dniUrl || "https://api.decolecta.com/v1/reniec/dni";
const dniApiToken = process.env.DNI_API_TOKEN || conf.api?.dniToken || "";

/* ── Parametrización de negocio (config.json → parametrizacion) ── */
const TARIFA_PRECIO = param.tarifas?.precioEstandarSoles ?? 10;
const TARIFA_PESO_LIMITE = param.tarifas?.pesoLimiteKg ?? 2;
const METODOS_PAGO = param.paquetes?.metodosPago || ["tarjeta", "yape", "efectivo"];
const PREFIJO_SEGUIMIENTO = param.paquetes?.prefijoSeguimiento || "TM-";
const ESTADOS_PAQUETE = param.paquetes?.estados || ["En Almacén", "En Tránsito", "Entregado", "Intento fallido"];
const ZONA_HORARIA = conf.servidor?.zonaHoraria || "America/Lima";

/** Mapa en memoria que asocia cada token UUID con los datos del usuario autenticado */
const authTokens = new Map();

/* ── SE3: Registro de actividad (Audit Log) ─────────────── */
const activityLog = [];
const MAX_LOG_ENTRIES = 500;

/**
 * Registra una acción en el log de actividad.
 * @param {string} userId — ID del usuario que realizó la acción
 * @param {string} userName — nombre del usuario
 * @param {string} action — tipo de acción (login, create, update, delete, etc.)
 * @param {string} resource — recurso afectado (paquete, usuario, etc.)
 * @param {string} detail — detalle específico
 */
const logActivity = (userId, userName, action, resource, detail = "") => {
  if (activityLog.length >= MAX_LOG_ENTRIES) activityLog.shift();
  activityLog.push({
    id: activityLog.length + 1,
    fecha: new Date().toISOString(),
    userId,
    userName,
    action,
    resource,
    detail
  });
};

/* ── SE4: Rate limiting en login (protección fuerza bruta) ── */
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MINUTES = 15;

/**
 * Verifica si un usuario/IP está bloqueado por exceso de intentos.
 * Retorna { blocked, remaining, minutesLeft }.
 */
const checkLoginThrottle = (key) => {
  const entry = loginAttempts.get(key);
  if (!entry) return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
  const elapsed = (Date.now() - entry.lastAttempt) / 60000;
  if (entry.count >= MAX_LOGIN_ATTEMPTS && elapsed < LOGIN_BLOCK_MINUTES) {
    return { blocked: true, remaining: 0, minutesLeft: Math.ceil(LOGIN_BLOCK_MINUTES - elapsed) };
  }
  if (elapsed >= LOGIN_BLOCK_MINUTES) {
    loginAttempts.delete(key);
    return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }
  return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS - entry.count };
};

const recordFailedLogin = (key) => {
  const entry = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  entry.count += 1;
  entry.lastAttempt = Date.now();
  loginAttempts.set(key, entry);
};

const clearLoginAttempts = (key) => {
  loginAttempts.delete(key);
};

/* ── Middlewares globales ────────────────────────────────── */
app.use(cors());
app.use(express.json());

/* ── Funciones auxiliares ───────────────────────────────── */

/** Retorna solo los campos seguros de un usuario (sin contraseña) */
const sanitizeUser = (user, roleName) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  rolId: user.rol_id || user.rolId || null,
  roleName: roleName || null,
  sucursalId: user.sucursal_id || user.sucursalId || null,
  clienteId: user.cliente_id || user.clienteId || null,
  activo: user.activo
});

/* ── Middlewares de autorización ─────────────────────────── */

/** Middleware: solo permite acceso al rol Administrador */
const requireAdmin = (req, res, next) => {
  const roleName = req.authUser?.roleName;
  if (roleName !== "Administrador") {
    return res.status(403).json({ error: "Solo administrador" });
  }
  return next();
};

/** Determina si una ruta es pública (no requiere token de autenticación) */
const isPublicRoute = (req) => {
  if (!req.path.startsWith("/api")) return true;
  if (req.path === "/api/health") return true;
  if (req.path === "/api/config/public") return true;
  if (req.path === "/api/auth/login") return true;
  if (req.path === "/api/auth/register") return true;
  if (req.path.startsWith("/api/tracking/")) return true;
  if (/^\/api\/dni\/\d+$/.test(req.path)) return true;
  return false;
};

/**
 * Middleware global de autenticación.
 * Extrae el token del header Authorization: Bearer <token>,
 * lo busca en authTokens y adjunta los datos del usuario a req.authUser.
 */
app.use((req, res, next) => {
  if (isPublicRoute(req)) return next();
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token || !authTokens.has(token)) {
    return res.status(401).json({ error: "No autorizado" });
  }
  req.authUser = authTokens.get(token);
  return next();
});

/** Formatea una fecha a formato legible en zona horaria de Perú (dd/mm/yyyy hh:mm am/pm) */
const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA,
    hour12: true
  }).format(date);
};

/** Escapa un valor para incluirlo de forma segura en un CSV (maneja comillas dobles) */
const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
};

/** Reglas de validación telefónica por país: código de discado y cantidad de dígitos */
const PHONE_RULES = {
  PE: { name: "Peru", dialCode: "51", digits: 9 },
  CL: { name: "Chile", dialCode: "56", digits: 9 },
  CO: { name: "Colombia", dialCode: "57", digits: 10 },
  EC: { name: "Ecuador", dialCode: "593", digits: 9 },
  MX: { name: "Mexico", dialCode: "52", digits: 10 },
  US: { name: "Estados Unidos", dialCode: "1", digits: 10 },
  BO: { name: "Bolivia", dialCode: "591", digits: 8 },
  AR: { name: "Argentina", dialCode: "54", digits: 10 },
  BR: { name: "Brasil", dialCode: "55", digits: 11 }
};

const textValue = (value) => String(value || "").trim();

/**
 * Valida y construye un número de teléfono en formato E.164 (+código+número).
 * Recibe el país (telefonoPais) y el número (telefonoNumero) del payload.
 * Retorna { ok, e164, local, countryIso } o { ok: false, error }.
 */
const resolvePhone = (payload) => {
  const countryIso = textValue(payload.telefonoPais).toUpperCase();
  const source = textValue(payload.telefonoNumero || payload.telefono);
  if (!countryIso || !source) {
    return { ok: false, error: "telefonoPais y telefonoNumero son requeridos" };
  }
  const rule = PHONE_RULES[countryIso];
  if (!rule) {
    return { ok: false, error: "Pais de telefono no soportado" };
  }
  const digitsOnly = source.replace(/\D/g, "");
  const local =
    digitsOnly.startsWith(rule.dialCode) &&
    digitsOnly.length === rule.dialCode.length + rule.digits
      ? digitsOnly.slice(rule.dialCode.length)
      : digitsOnly;
  if (local.length !== rule.digits) {
    return {
      ok: false,
      error: `El telefono para ${rule.name} debe tener ${rule.digits} digitos`
    };
  }
  return {
    ok: true,
    countryIso,
    local,
    e164: `+${rule.dialCode}${local}`
  };
};

/**
 * Normaliza la respuesta de la API de RENIEC para extraer nombres y apellidos,
 * independientemente del formato que devuelva la API externa.
 */
const normalizeDniData = (rawData, dni) => {
  const data = rawData || {};
  const nombres = textValue(data.nombres || data.name || data.first_name);
  const apellidoPaterno = textValue(
    data.apellidoPaterno ||
      data.apellido_paterno ||
      data.father_last_name ||
      data.first_last_name
  );
  const apellidoMaterno = textValue(
    data.apellidoMaterno ||
      data.apellido_materno ||
      data.mother_last_name ||
      data.second_last_name
  );
  const nombreCompleto = textValue(
    data.nombreCompleto ||
      data.nombre_completo ||
      data.full_name ||
      [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ")
  );
  return {
    dni,
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    nombreCompleto
  };
};

/* ── Inicialización de datos (seed) ──────────────────────── */

/** Crea los roles del sistema si no existen (Administrador, Operador, Repartidor, Cliente) */
const ensureRoles = async () => {
  if (!repo.listRoles || !repo.createRole) return;
  const required = ["Administrador", "Operador logístico", "Repartidor", "Cliente"];
  const roles = await call(repo.listRoles);
  const existing = new Set(roles.map((role) => role.nombre));
  for (const name of required) {
    if (!existing.has(name)) {
      await call(repo.createRole, name);
    }
  }
};

/** Crea el usuario administrador inicial si no existe (datos desde .env) */
const ensureAdminUser = async () => {
  try {
    if (!repo.getUserByEmail || !repo.createUser || !repo.listRoles) return;
    await ensureRoles();
    const existing = await call(repo.getUserByEmail, seedAdminEmail);
    if (existing) return;
    let roles = await call(repo.listRoles);
    let adminRole =
      roles.find((role) => role.nombre === "Administrador") || roles[0];
    if (!adminRole && repo.createRole) {
      try {
        await call(repo.createRole, "Administrador");
        roles = await call(repo.listRoles);
        adminRole =
          roles.find((role) => role.nombre === "Administrador") || roles[0];
      } catch (err) {
        console.error("No se pudo crear el rol Administrador:", err.message);
      }
    }
    const passwordHash = await bcrypt.hash(seedAdminPass, 10);
    await call(repo.createUser, {
      nombre: seedAdminName,
      email: seedAdminEmail,
      rolId: adminRole?.id,
      sucursalId: null,
      activo: true,
      passwordHash
    });
  } catch (err) {
    console.error("No se pudo crear el admin inicial:", err.message);
  }
};

/* ================================================================
   RUTAS DE LA API REST
   ================================================================ */

/* ── Rutas públicas (sin autenticación) ─────────────────── */

/** GET /api/health — Verifica que el servidor esté activo */
app.get("/api/health", async (req, res) => {
  res.json(await call(repo.getHealth));
});

/**
 * GET /api/config/public — Expone la parametrización de negocio al frontend.
 * No expone credenciales ni datos sensibles; solo reglas de negocio
 * (tarifas, estados, métodos de pago, países de teléfono).
 */
app.get("/api/config/public", (req, res) => {
  res.json({
    tarifas: {
      precioEstandarSoles: TARIFA_PRECIO,
      pesoLimiteKg: TARIFA_PESO_LIMITE,
      moneda: param.tarifas?.moneda || "soles"
    },
    paquetes: {
      estados: ESTADOS_PAQUETE,
      prefijoSeguimiento: PREFIJO_SEGUIMIENTO,
      metodosPago: METODOS_PAGO
    },
    telefonos: param.telefonos || {
      paisPorDefecto: "PE",
      paises: []
    },
    pagos: {
      culqiEnabled: getCulqiConfig().enabled,
      publicKey: getCulqiConfig().publicKey || null,
      testMode: getCulqiConfig().testMode
    }
  });
});

/**
 * POST /api/auth/login — Inicio de sesión.
 * Primero verifica contra las credenciales de entorno (admin fijo),
 * luego busca en la base de datos y compara el hash con bcrypt.
 * Si es exitoso, genera un token UUID y lo almacena en authTokens.
 */
app.post("/api/auth/login", (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }
  const throttleKey = (usuario || "").toLowerCase();
  const throttle = checkLoginThrottle(throttleKey);
  if (throttle.blocked) {
    logActivity("system", "Sistema", "login_blocked", "auth", `Cuenta bloqueada: ${usuario} (${throttle.minutesLeft} min restantes)`);
    return res.status(429).json({
      error: `Demasiados intentos. Cuenta bloqueada por ${throttle.minutesLeft} minutos.`
    });
  }
  if (usuario === adminUser && password === adminPass) {
    clearLoginAttempts(throttleKey);
    const token = crypto.randomUUID();
    const userData = {
      id: "admin-env",
      nombre: "Administrador Sistema",
      email: adminUser,
      rolId: null,
      roleName: "Administrador",
      sucursalId: null,
      activo: true
    };
    authTokens.set(token, userData);
    logActivity("admin-env", "Administrador Sistema", "login", "auth", `Inicio de sesión exitoso`);
    return res.json({ token, user: userData });
  }
  return call(repo.getUserByEmail, usuario)
    .then(async (user) => {
      if (!user || user.activo === false) {
        throw new Error("Credenciales inválidas");
      }
      const ok = await bcrypt.compare(
        password,
        user.password_hash || user.passwordHash || ""
      );
      if (!ok) {
        throw new Error("Credenciales inválidas");
      }
      clearLoginAttempts(throttleKey);
      const roleId = user.rol_id || user.rolId;
      const role = roleId ? await call(repo.getRoleById, roleId) : null;
      const roleName = role?.nombre || null;
      const token = crypto.randomUUID();
      authTokens.set(token, sanitizeUser(user, roleName));
      logActivity(user.id, user.nombre, "login", "auth", `Inicio de sesión exitoso (${roleName})`);
      return res.json({ token, user: sanitizeUser(user, roleName) });
    })
    .catch(() => {
      recordFailedLogin(throttleKey);
      const remaining = checkLoginThrottle(throttleKey).remaining;
      logActivity("system", "Sistema", "login_failed", "auth", `Intento fallido: ${usuario} (${remaining} intentos restantes)`);
      return res.status(401).json({
        error: remaining > 0
          ? `Credenciales inválidas. ${remaining} intentos restantes.`
          : `Demasiados intentos. Cuenta bloqueada por ${LOGIN_BLOCK_MINUTES} minutos.`
      });
    });
});

/**
 * POST /api/auth/register — Registro de nuevos clientes.
 * Crea un registro en la tabla clientes y un usuario con rol "Cliente".
 * Si el documento ya existe, vincula al cliente existente.
 */
app.post("/api/auth/register", async (req, res) => {
  const { nombre, email, password, telefonoPais, telefonoNumero, tipo, documento, direccion } = req.body || {};
  if (!textValue(nombre) || !textValue(email) || !textValue(password)) {
    return res.status(400).json({ error: "nombre, email y contraseña son requeridos" });
  }
  if (!textValue(documento) || !textValue(direccion)) {
    return res.status(400).json({ error: "documento y direccion son requeridos" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }
  const phone = resolvePhone(req.body || {});
  if (!phone.ok) return res.status(400).json({ error: phone.error });
  const existing = await call(repo.getUserByEmail, email);
  if (existing) {
    return res.status(400).json({ error: "El email ya está registrado" });
  }
  await ensureRoles();
  const roles = await call(repo.listRoles);
  const clientRole = roles.find((r) => r.nombre === "Cliente");
  if (!clientRole) {
    return res.status(500).json({ error: "Rol Cliente no disponible" });
  }
  let cliente;
  const existingClient = repo.getClientByDocumento
    ? await call(repo.getClientByDocumento, documento)
    : null;
  if (existingClient) {
    cliente = {
      id: existingClient.id,
      tipo: existingClient.tipo,
      nombre: existingClient.nombre,
      documento: existingClient.documento,
      telefono: existingClient.telefono,
      email: existingClient.email,
      direccion: existingClient.direccion
    };
    if (repo.updateClient) {
      await call(repo.updateClient, existingClient.id, {
        nombre: textValue(nombre),
        telefono: phone.e164,
        email: textValue(email),
        direccion: textValue(direccion)
      });
    }
  } else {
    cliente = await call(repo.createClient, {
      tipo: textValue(tipo) || "persona",
      nombre: textValue(nombre),
      documento: textValue(documento),
      telefono: phone.e164,
      email: textValue(email),
      direccion: textValue(direccion)
    });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await call(repo.createUser, {
    nombre: textValue(nombre),
    email: textValue(email),
    telefono: phone.e164,
    rolId: clientRole.id,
    sucursalId: null,
    clienteId: cliente.id,
    activo: true,
    passwordHash
  });
  const token = crypto.randomUUID();
  authTokens.set(token, sanitizeUser({ ...user, clienteId: cliente.id }, "Cliente"));
  res.status(201).json({
    token,
    user: { ...sanitizeUser({ ...user, clienteId: cliente.id }, "Cliente"), clienteId: cliente.id }
  });
});

/* ── Rutas del portal de clientes ────────────────────────── */

/** GET /api/client/me/packages — Lista los paquetes del cliente autenticado */
app.get("/api/client/me/packages", async (req, res) => {
  if (req.authUser?.roleName !== "Cliente" || !req.authUser?.clienteId) {
    return res.status(403).json({ error: "Solo clientes registrados" });
  }
  if (!repo.listPackagesByClient) {
    return res.json([]);
  }
  res.json(await call(repo.listPackagesByClient, req.authUser.clienteId));
});

/** POST /api/client/packages — Crea un envío de cliente a cliente */
app.post("/api/client/packages", async (req, res) => {
  if (req.authUser?.roleName !== "Cliente" || !req.authUser?.clienteId) {
    return res.status(403).json({ error: "Solo clientes registrados pueden enviar paquetes" });
  }
  const { destinatarioId, sucursalOrigenId, destinoTexto, descripcion, pesoKg, quienPaga } = req.body || {};
  if (!destinatarioId || !sucursalOrigenId || !textValue(destinoTexto) || !textValue(descripcion)) {
    return res.status(400).json({ error: "destinatarioId, sucursalOrigenId, destinoTexto y descripcion son requeridos" });
  }
  const peso = parseFloat(pesoKg) || 0;
  if (peso <= 0) {
    return res.status(400).json({ error: "El peso debe ser mayor a 0" });
  }
  if (String(destinatarioId) === String(req.authUser.clienteId)) {
    return res.status(400).json({ error: "El destinatario debe ser diferente al remitente" });
  }
  const precioEnvio = peso <= TARIFA_PESO_LIMITE ? TARIFA_PRECIO : 0;
  const pkg = await call(repo.createPackage, {
    tipoEnvio: "cliente_cliente",
    remitenteClienteId: req.authUser.clienteId,
    destinatarioId,
    sucursalOrigenId,
    destinoTexto: textValue(destinoTexto),
    descripcion: textValue(descripcion),
    pesoKg: peso,
    precioEnvio,
    quienPaga: quienPaga === "destinatario" ? "destinatario" : "remitente",
    pagado: false,
    operadorId: null,
    repartidorId: null
  });
  res.status(201).json(pkg);
});

/**
 * PATCH /api/client/packages/:id/pagar — Pago de paquete por el cliente.
 * Verifica que el cliente sea remitente o destinatario según quienPaga.
 * Para paquetes > 2kg, el operador debe haber asignado precio primero.
 */
app.patch("/api/client/packages/:id/pagar", async (req, res) => {
  if (req.authUser?.roleName !== "Cliente" || !req.authUser?.clienteId) {
    return res.status(403).json({ error: "No autorizado" });
  }
  const pkg = await call(repo.getPackageById, req.params.id);
  if (!pkg) return res.status(404).json({ error: "Paquete no encontrado" });
  const isRemitente = String(pkg.remitenteClienteId) === String(req.authUser.clienteId);
  const isDestinatario = String(pkg.destinatarioId) === String(req.authUser.clienteId);
  if (pkg.quienPaga === "remitente" && !isRemitente) {
    return res.status(403).json({ error: "Solo el remitente puede pagar este paquete" });
  }
  if (pkg.quienPaga === "destinatario" && !isDestinatario) {
    return res.status(403).json({ error: "Solo el destinatario puede pagar este paquete al recibir" });
  }
  if (!isRemitente && !isDestinatario) {
    return res.status(403).json({ error: "No autorizado" });
  }
  if (pkg.pagado) {
    return res.status(400).json({ error: "El paquete ya está pagado" });
  }
  if (pkg.pesoKg > TARIFA_PESO_LIMITE && (!pkg.precioEnvio || pkg.precioEnvio <= 0)) {
    return res.status(400).json({ error: `El operador debe asignar el precio antes de pagar (paquete > ${TARIFA_PESO_LIMITE} kg)` });
  }
  if (!repo.markPackagePagado) {
    return res.status(501).json({ error: "Pago no disponible" });
  }
  const { metodoPago } = req.body || {};
  if (metodoPago === "tarjeta" || metodoPago === "yape") {
    return res.status(400).json({
      error: "El pago con tarjeta o Yape debe completarse con Culqi"
    });
  }
  const updated = await call(repo.markPackagePagado, req.params.id, "efectivo");
  res.json(updated);
});

/* ── Rutas de gestión de paquetes ─────────────────────────── */

/**
 * PATCH /api/packages/:id/registrar-pago-destino — Registro de pago en destino.
 * Acceso: Repartidor (solo sus paquetes asignados), Operador, Administrador.
 * Acepta metodoPago: "tarjeta", "yape" o "efectivo" (por defecto: "efectivo").
 */
app.patch("/api/packages/:id/registrar-pago-destino", async (req, res) => {
  const roleName = req.authUser?.roleName;
  if (roleName !== "Repartidor" && roleName !== "Operador logístico" && roleName !== "Administrador") {
    return res.status(403).json({ error: "No autorizado" });
  }
  const pkg = await call(repo.getPackageById, req.params.id);
  if (!pkg) return res.status(404).json({ error: "Paquete no encontrado" });
  if (roleName === "Repartidor") {
    const repartidorId = pkg.repartidorId || pkg.repartidor_id;
    if (String(repartidorId) !== String(req.authUser.id)) {
      return res.status(403).json({ error: "Solo el repartidor asignado puede registrar el pago" });
    }
  }
  if (pkg.pagado) {
    return res.status(400).json({ error: "El paquete ya está pagado" });
  }
  if (pkg.pesoKg > TARIFA_PESO_LIMITE && (!pkg.precioEnvio || pkg.precioEnvio <= 0)) {
    return res.status(400).json({ error: "El operador debe asignar el precio primero" });
  }
  if (!repo.markPackagePagado) {
    return res.status(501).json({ error: "Pago no disponible" });
  }
  const { metodoPago } = req.body || {};
  if (metodoPago === "tarjeta" || metodoPago === "yape") {
    return res.status(400).json({
      error: "El pago con tarjeta o Yape debe completarse con Culqi"
    });
  }
  const updated = await call(repo.markPackagePagado, req.params.id, "efectivo");
  logActivity(req.authUser.id, req.authUser.nombre, "payment", "paquete", `Pago registrado: ${updated.codigoSeguimiento || req.params.id} — efectivo — S/${updated.precioEnvio || 0}`);
  res.json(updated);
});

const denyIfNotPayable = (req, pkg) => {
  if (!pkg) return { status: 404, error: "Paquete no encontrado" };
  if (pkg.pagado) return { status: 400, error: "El paquete ya está pagado" };
  if (pkg.pesoKg > TARIFA_PESO_LIMITE && (!pkg.precioEnvio || pkg.precioEnvio <= 0)) {
    return { status: 400, error: "El operador debe asignar el precio primero" };
  }
  const roleName = req.authUser?.roleName;
  if (roleName === "Cliente") {
    const isRemitente = String(pkg.remitenteClienteId) === String(req.authUser.clienteId);
    const isDestinatario = String(pkg.destinatarioId) === String(req.authUser.clienteId);
    if (pkg.quienPaga === "remitente" && !isRemitente) {
      return { status: 403, error: "Solo el remitente puede pagar este paquete" };
    }
    if (pkg.quienPaga === "destinatario" && !isDestinatario) {
      return { status: 403, error: "Solo el destinatario puede pagar este paquete" };
    }
    if (!isRemitente && !isDestinatario) {
      return { status: 403, error: "No autorizado" };
    }
    return null;
  }
  if (roleName === "Repartidor") {
    const repartidorId = pkg.repartidorId || pkg.repartidor_id;
    if (String(repartidorId) !== String(req.authUser.id)) {
      return { status: 403, error: "Solo el repartidor asignado puede registrar el pago" };
    }
    return null;
  }
  if (roleName === "Administrador" || roleName === "Operador logístico") {
    return null;
  }
  return { status: 403, error: "No autorizado" };
};

/**
 * POST /api/packages/:id/pagos/preparar — Crea orden Culqi (necesaria para Yape)
 * y devuelve la llave pública + monto en céntimos para abrir el Checkout.
 */
app.post("/api/packages/:id/pagos/preparar", async (req, res) => {
  const culqi = getCulqiConfig();
  if (!culqi.enabled) {
    return res.status(503).json({
      error: "Pagos con tarjeta y Yape no configurados. Agrega CULQI_PUBLIC_KEY y CULQI_SECRET_KEY."
    });
  }
  const pkg = await call(repo.getPackageById, req.params.id);
  const denied = denyIfNotPayable(req, pkg);
  if (denied) return res.status(denied.status).json({ error: denied.error });

  const metodoPago = req.body?.metodoPago === "yape" ? "yape" : "tarjeta";
  const amount = amountToCents(pkg.precioEnvio);
  if (amount < 100) {
    return res.status(400).json({ error: "El monto mínimo de pago es S/ 1.00" });
  }

  let orderId = null;
  if (metodoPago === "yape") {
    try {
      const order = await createCulqiOrder({
        amount,
        description: `Envío ${pkg.codigoSeguimiento}`,
        orderNumber: `TC-${pkg.id}-${Date.now()}`,
        client: req.authUser
      });
      orderId = order.id;
    } catch (err) {
      return res.status(400).json({ error: err.message || "No se pudo crear la orden de Yape" });
    }
  }

  res.json({
    publicKey: culqi.publicKey,
    testMode: culqi.testMode,
    amount,
    currency: "PEN",
    orderId,
    email: req.authUser?.email || "",
    codigoSeguimiento: pkg.codigoSeguimiento,
    metodoPago
  });
});

/**
 * POST /api/packages/:id/pagos/confirmar — Crea el cargo en Culqi con el token
 * y recién entonces marca el paquete como pagado.
 */
app.post("/api/packages/:id/pagos/confirmar", async (req, res) => {
  const culqi = getCulqiConfig();
  if (!culqi.enabled) {
    return res.status(503).json({
      error: "Pagos con tarjeta y Yape no configurados."
    });
  }
  const pkg = await call(repo.getPackageById, req.params.id);
  const denied = denyIfNotPayable(req, pkg);
  if (denied) return res.status(denied.status).json({ error: denied.error });

  const { tokenId, email, metodoPago } = req.body || {};
  if (!tokenId) {
    return res.status(400).json({ error: "Falta el token de Culqi" });
  }
  const method = metodoPago === "yape" ? "yape" : "tarjeta";
  const amount = amountToCents(pkg.precioEnvio);
  const chargeEmail = textValue(email) || req.authUser?.email || "pagos@tingocargo.com";

  try {
    const charge = await createCulqiCharge({
      amount,
      email: chargeEmail,
      sourceId: tokenId,
      description: `Envío ${pkg.codigoSeguimiento}`,
      metadata: {
        paqueteId: String(pkg.id),
        codigo: pkg.codigoSeguimiento,
        metodo: method
      }
    });
    if (charge.outcome && charge.outcome.type && charge.outcome.type !== "venta_exitosa") {
      return res.status(402).json({
        error: charge.outcome.user_message || "El pago no fue aprobado"
      });
    }
    const updated = await call(repo.markPackagePagado, req.params.id, method);
    logActivity(
      req.authUser.id,
      req.authUser.nombre,
      "payment",
      "paquete",
      `Pago Culqi: ${updated.codigoSeguimiento} — ${method} — S/${updated.precioEnvio || 0} — ${charge.id || ""}`
    );
    return res.json({ ...updated, culqiChargeId: charge.id || null });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || "No se pudo cobrar" });
  }
});

/* ── Rutas de catálogos (clientes, roles, sucursales, distribuidoras) ── */

/** GET /api/clients — Lista todos los clientes registrados */
app.get("/api/clients", async (req, res) => {
  res.json(await call(repo.listClients));
});

/** POST /api/clients — Crea un nuevo cliente (persona o empresa) */
app.post("/api/clients", async (req, res) => {
  const { tipo, nombre, documento, email, direccion } = req.body || {};
  if (
    !textValue(tipo) ||
    !textValue(nombre) ||
    !textValue(documento) ||
    !textValue(email) ||
    !textValue(direccion)
  ) {
    return res.status(400).json({
      error:
        "tipo, nombre, documento, telefonoPais, telefonoNumero, email y direccion son requeridos"
    });
  }
  const phone = resolvePhone(req.body || {});
  if (!phone.ok) return res.status(400).json({ error: phone.error });
  const client = await call(repo.createClient, {
    tipo: textValue(tipo),
    nombre: textValue(nombre),
    documento: textValue(documento),
    telefono: phone.e164,
    email: textValue(email),
    direccion: textValue(direccion)
  });
  res.status(201).json(client);
});

/** GET /api/packages — Lista paquetes, opcionalmente filtrados por estado */
app.get("/api/packages", async (req, res) => {
  const { status } = req.query;
  res.json(await call(repo.listPackages, status));
});

/**
 * GET /api/packages/expanded — Lista paquetes con datos expandidos.
 * Los Repartidores solo ven sus paquetes asignados.
 * Los Clientes solo ven paquetes donde son remitente o destinatario.
 * Admin y Operador ven todos.
 */
app.get("/api/packages/expanded", async (req, res) => {
  const { status } = req.query;
  if (req.authUser?.roleName === "Repartidor" && repo.listPackagesByCourier) {
    return res.json(await call(repo.listPackagesByCourier, req.authUser.id));
  }
  if (req.authUser?.roleName === "Cliente" && req.authUser?.clienteId && repo.listPackagesByClient) {
    return res.json(await call(repo.listPackagesByClient, req.authUser.clienteId));
  }
  res.json(await call(repo.listPackagesDetailed, status));
});

/** GET /api/packages/:id — Detalle completo de un paquete con historial de estados */
app.get("/api/packages/:id", async (req, res) => {
  const pkg = await call(repo.getPackageDetailsById, req.params.id);
  if (!pkg) {
    return res.status(404).json({ error: "Paquete no encontrado" });
  }
  if (
    req.authUser?.roleName === "Repartidor" &&
    pkg.repartidor?.id !== req.authUser.id
  ) {
    return res.status(403).json({ error: "No autorizado" });
  }
  if (req.authUser?.roleName === "Cliente") {
    const isRemitente = String(pkg.remitenteClienteId) === String(req.authUser.clienteId);
    const isDestinatario = String(pkg.destinatarioId) === String(req.authUser.clienteId);
    if (!isRemitente && !isDestinatario) {
      return res.status(403).json({ error: "No autorizado" });
    }
  }
  res.json(pkg);
});

/** PATCH /api/packages/:id/precio — Asigna precio de envío (solo Admin/Operador) */
app.patch("/api/packages/:id/precio", async (req, res) => {
  const roleName = req.authUser?.roleName;
  if (roleName !== "Administrador" && roleName !== "Operador logístico") {
    return res.status(403).json({ error: "Solo operador o admin pueden asignar precio" });
  }
  const { precioEnvio } = req.body || {};
  const precio = parseFloat(precioEnvio);
  if (Number.isNaN(precio) || precio < 0) {
    return res.status(400).json({ error: "precioEnvio debe ser un número válido >= 0" });
  }
  const pkg = await call(repo.getPackageById, req.params.id);
  if (!pkg) return res.status(404).json({ error: "Paquete no encontrado" });
  if (!repo.updatePackagePrecio) {
    return res.status(501).json({ error: "Actualización de precio no disponible" });
  }
  const updated = await call(repo.updatePackagePrecio, req.params.id, precio);
  res.json(updated);
});

/** PATCH /api/packages/:id/operador — Asigna operador logístico a un paquete */
app.patch("/api/packages/:id/operador", async (req, res) => {
  const roleName = req.authUser?.roleName;
  if (roleName !== "Administrador" && roleName !== "Operador logístico") {
    return res.status(403).json({ error: "Solo administrador o operador" });
  }
  const { operadorId } = req.body || {};
  const pkg = await call(repo.getPackageById, req.params.id);
  if (!pkg) return res.status(404).json({ error: "Paquete no encontrado" });
  if (roleName === "Operador logístico") {
    if (operadorId && String(operadorId) !== String(req.authUser.id)) {
      return res.status(403).json({ error: "Solo puedes asignarte a ti mismo" });
    }
  }
  if (operadorId) {
    const operador = await call(repo.getUserById, operadorId);
    if (!operador) return res.status(400).json({ error: "Operador inválido" });
    const role = await call(repo.getRoleById, operador.rol_id || operador.rolId);
    if (role?.nombre !== "Operador logístico") {
      return res.status(400).json({ error: "El usuario debe ser operador logístico" });
    }
  }
  if (!repo.updatePackageOperador) {
    return res.status(501).json({ error: "No disponible" });
  }
  const updated = await call(repo.updatePackageOperador, req.params.id, operadorId || null);
  res.json(updated);
});

/** PATCH /api/packages/:id/repartidor — Asigna repartidor a un paquete */
app.patch("/api/packages/:id/repartidor", async (req, res) => {
  const roleName = req.authUser?.roleName;
  if (roleName !== "Administrador" && roleName !== "Operador logístico") {
    return res.status(403).json({ error: "Solo administrador o operador pueden asignar repartidor" });
  }
  const { repartidorId } = req.body || {};
  const pkg = await call(repo.getPackageById, req.params.id);
  if (!pkg) return res.status(404).json({ error: "Paquete no encontrado" });
  if (roleName === "Operador logístico") {
    const currentOperadorId = pkg.operadorId || pkg.operador_id;
    if (String(currentOperadorId) !== String(req.authUser.id)) {
      return res.status(403).json({ error: "Solo puedes asignar repartidor a paquetes donde eres el operador" });
    }
  }
  if (repartidorId) {
    const repartidor = await call(repo.getUserById, repartidorId);
    if (!repartidor) return res.status(400).json({ error: "Repartidor inválido" });
    const role = await call(repo.getRoleById, repartidor.rol_id || repartidor.rolId);
    if (role?.nombre !== "Repartidor") {
      return res.status(400).json({ error: "El usuario debe ser repartidor" });
    }
  }
  if (!repo.updatePackageRepartidor) {
    return res.status(501).json({ error: "No disponible" });
  }
  const updated = await call(repo.updatePackageRepartidor, req.params.id, repartidorId || null);
  res.json(updated);
});

/**
 * POST /api/packages — Crea un paquete nuevo (desde panel admin).
 * Soporta tipo_envio: "distribuidora_cliente" o "cliente_cliente".
 * Calcula precio automático: S/10 si peso <= 2kg.
 * Acceso: todos excepto Repartidor.
 */
app.post("/api/packages", async (req, res) => {
  if (req.authUser?.roleName === "Repartidor") {
    return res.status(403).json({ error: "No autorizado" });
  }
  const {
    tipoEnvio,
    remitenteId,
    remitenteClienteId,
    destinatarioId,
    sucursalOrigenId,
    destinoTexto,
    descripcion,
    operadorId,
    repartidorId,
    pesoKg,
    quienPaga
  } = req.body;
  const shippingType = textValue(tipoEnvio || "distribuidora_cliente");
  if (!["distribuidora_cliente", "cliente_cliente"].includes(shippingType)) {
    return res.status(400).json({ error: "tipoEnvio invalido" });
  }
  let operadorFinal = operadorId || null;
  if (!operadorFinal && req.authUser?.roleName === "Operador logístico") {
    operadorFinal = req.authUser.id;
  }
  if (
    !destinatarioId ||
    !sucursalOrigenId ||
    !textValue(destinoTexto) ||
    !textValue(descripcion) ||
    !operadorFinal ||
    !repartidorId
  ) {
    return res.status(400).json({
      error:
        "destinatarioId, sucursalOrigenId, destinoTexto, descripcion, operadorId y repartidorId son requeridos"
    });
  }
  if (shippingType === "distribuidora_cliente" && !remitenteId) {
    return res.status(400).json({ error: "remitenteId es requerido" });
  }
  if (shippingType === "cliente_cliente" && !remitenteClienteId) {
    return res.status(400).json({ error: "remitenteClienteId es requerido" });
  }
  const remitente =
    shippingType === "cliente_cliente"
      ? await call(repo.getClientById, remitenteClienteId)
      : await call(repo.getDistributorById, remitenteId);
  const destinatario = await call(repo.getClientById, destinatarioId);
  if (!remitente || !destinatario) {
    return res.status(400).json({ error: "Remitente o cliente invalido" });
  }
  if (
    shippingType === "cliente_cliente" &&
    String(remitenteClienteId) === String(destinatarioId)
  ) {
    return res.status(400).json({
      error: "Remitente y destinatario no pueden ser el mismo cliente"
    });
  }
  const origen = await call(repo.getBranchById, sucursalOrigenId);
  if (!origen) {
    return res.status(400).json({ error: "Sucursal inválida" });
  }
  if (operadorFinal) {
    const operador = await call(repo.getUserById, operadorFinal);
    if (!operador) {
      return res.status(400).json({ error: "Operador inválido" });
    }
    const role = await call(repo.getRoleById, operador.rol_id || operador.rolId);
    if (role?.nombre !== "Operador logístico") {
      return res.status(400).json({ error: "Operador inválido" });
    }
  }
  if (repartidorId) {
    const repartidor = await call(repo.getUserById, repartidorId);
    if (!repartidor) {
      return res.status(400).json({ error: "Repartidor inválido" });
    }
    const role = await call(
      repo.getRoleById,
      repartidor.rol_id || repartidor.rolId
    );
    if (role?.nombre !== "Repartidor") {
      return res.status(400).json({ error: "Repartidor inválido" });
    }
  }
  const peso = parseFloat(pesoKg) || 0;
  const precioEnvio = peso > 0 && peso <= TARIFA_PESO_LIMITE ? TARIFA_PRECIO : (parseFloat(req.body.precioEnvio) || 0);
  const pkg = await call(repo.createPackage, {
    ...req.body,
    tipoEnvio: shippingType,
    remitenteId: shippingType === "distribuidora_cliente" ? remitenteId : null,
    remitenteClienteId:
      shippingType === "cliente_cliente" ? remitenteClienteId : null,
    operadorId: operadorFinal,
    destinoTexto: textValue(destinoTexto),
    descripcion: textValue(descripcion),
    pesoKg: peso,
    precioEnvio,
    quienPaga: quienPaga === "destinatario" ? "destinatario" : "remitente",
    pagado: false
  });
  logActivity(req.authUser.id, req.authUser.nombre, "create", "paquete", `Nuevo paquete: ${pkg.codigoSeguimiento}`);
  res.status(201).json(pkg);
});

/**
 * PATCH /api/packages/:id/status — Cambia el estado de un paquete.
 * Los Repartidores solo pueden cambiar a "Entregado" o "Intento fallido"
 * y solo en paquetes que tengan asignados.
 */
app.patch("/api/packages/:id/status", async (req, res) => {
  const { id } = req.params;
  const { estado, observacion } = req.body;
  const statuses = await call(repo.listStatuses);
  if (!estado || !statuses.includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }
  const existing = await call(repo.getPackageById, id);
  if (!existing) {
    return res.status(404).json({ error: "Paquete no encontrado" });
  }
  if (req.authUser?.roleName === "Repartidor") {
    const repartidorId = existing.repartidor_id || existing.repartidorId;
    if (repartidorId !== req.authUser.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (estado !== "Entregado" && estado !== "Intento fallido") {
      return res.status(403).json({ error: "Acción no permitida" });
    }
  }
  const pkg = await call(repo.updatePackageStatus, id, estado, observacion);
  logActivity(req.authUser.id, req.authUser.nombre, "status_change", "paquete", `${pkg.codigoSeguimiento || id}: ${estado}${observacion ? " — " + observacion : ""}`);
  res.json(pkg);
});

/** PATCH /api/packages/:id/reprogramar — Reprograma entrega (solo si estado es "Intento fallido") */
app.patch("/api/packages/:id/reprogramar", async (req, res) => {
  const { id } = req.params;
  const { fecha, horaInicio, horaFin, direccion } = req.body || {};
  if (!fecha || !horaInicio || !horaFin) {
    return res.status(400).json({
      error: "fecha, horaInicio y horaFin son requeridos"
    });
  }
  const existing = await call(repo.getPackageById, id);
  if (!existing) {
    return res.status(404).json({ error: "Paquete no encontrado" });
  }
  if (existing.estado_actual !== "Intento fallido" && existing.estadoActual !== "Intento fallido") {
    return res.status(400).json({
      error: "Solo se puede reprogramar un paquete con estado Intento fallido"
    });
  }
  if (req.authUser?.roleName === "Repartidor") {
    const repartidorId = existing.repartidor_id || existing.repartidorId;
    if (repartidorId !== req.authUser.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
  }
  if (!repo.updatePackageReprogramar) {
    return res.status(501).json({ error: "Reprogramación no disponible" });
  }
  const pkg = await call(repo.updatePackageReprogramar, id, {
    fecha,
    horaInicio,
    horaFin,
    direccion: direccion || null
  });
  res.json(pkg);
});

/* ── Rutas de seguimiento público ─────────────────────────── */

/** POST /api/tracking/:code/reprogramar — Reprogramación pública por código de seguimiento */
app.post("/api/tracking/:code/reprogramar", async (req, res) => {
  const { code } = req.params;
  const { fecha, horaInicio, horaFin, direccion } = req.body || {};
  if (!fecha || !horaInicio || !horaFin) {
    return res.status(400).json({
      error: "fecha, horaInicio y horaFin son requeridos"
    });
  }
  const tracking = await call(repo.getTrackingByCode, code);
  if (!tracking) {
    return res.status(404).json({ error: "Código no encontrado" });
  }
  if (tracking.estadoActual !== "Intento fallido") {
    return res.status(400).json({
      error: "Solo se puede reprogramar un paquete con estado Intento fallido"
    });
  }
  if (!repo.updatePackageReprogramar) {
    return res.status(501).json({ error: "Reprogramación no disponible" });
  }
  const pkg = await call(repo.updatePackageReprogramar, tracking.id, {
    fecha,
    horaInicio,
    horaFin,
    direccion: direccion || null
  });
  const updated = await call(repo.getTrackingByCode, code);
  res.json(updated);
});

/** GET /api/tracking/:code — Consulta pública del estado de un paquete por código */
app.get("/api/tracking/:code", async (req, res) => {
  const tracking = await call(repo.getTrackingByCode, req.params.code);
  if (!tracking) {
    return res.status(404).json({ error: "Código no encontrado" });
  }
  res.json(tracking);
});

/** GET /api/dni/:dni — Consulta datos de RENIEC por DNI (8 dígitos) usando API externa */
app.get("/api/dni/:dni", async (req, res) => {
  const dni = textValue(req.params.dni).replace(/\D/g, "");
  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: "DNI invalido. Debe tener 8 digitos" });
  }
  if (!dniApiToken) {
    return res.status(503).json({
      error:
        "Consulta DNI no configurada. Define DNI_API_TOKEN en backend/.env"
    });
  }
  try {
    const response = await fetch(
      `${dniApiUrl}?numero=${encodeURIComponent(dni)}`,
      {
        headers: {
          Authorization: `Bearer ${dniApiToken}`,
          Accept: "application/json"
        }
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(502).json({
        error: data?.message || data?.error || "No se pudo consultar el DNI"
      });
    }
    const normalized = normalizeDniData(data, dni);
    if (!normalized.nombreCompleto) {
      return res
        .status(404)
        .json({ error: "No se encontraron datos para el DNI consultado" });
    }
    return res.json(normalized);
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || "Error consultando API de DNI" });
  }
});

/* ── Rutas de operadores y repartidores ──────────────────── */

/** GET /api/operators/phone — Obtiene el teléfono del primer operador activo */
app.get("/api/operators/phone", async (req, res) => {
  if (!repo.getOperatorPhone) {
    return res.json({ telefono: "" });
  }
  const telefono = await call(repo.getOperatorPhone);
  res.json({ telefono: telefono || "" });
});

app.get("/api/operators", async (req, res) => {
  if (!repo.listOperators) {
    return res.json([]);
  }
  res.json(await call(repo.listOperators));
});

app.get("/api/couriers", async (req, res) => {
  if (!repo.listCouriers) {
    return res.json([]);
  }
  res.json(await call(repo.listCouriers));
});

/** GET /api/couriers/me/packages — Paquetes asignados al repartidor autenticado */
app.get("/api/couriers/me/packages", async (req, res) => {
  if (req.authUser?.roleName !== "Repartidor") {
    return res.status(403).json({ error: "No autorizado" });
  }
  if (!repo.listPackagesByCourier) {
    return res.json([]);
  }
  res.json(await call(repo.listPackagesByCourier, req.authUser.id));
});

/* ── Rutas de gestión de usuarios (solo Administrador) ──── */

/** GET /api/users — Lista todos los usuarios del sistema */
app.get("/api/users", requireAdmin, async (req, res) => {
  res.json(await call(repo.listUsers));
});

/** GET /api/users/:id — Obtiene un usuario (incluye placa/vehículo si es repartidor) */
app.get("/api/users/:id", requireAdmin, async (req, res) => {
  const user = await call(repo.getUserById, req.params.id);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  res.json({
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    telefono: user.telefono || "",
    rolId: user.rol_id || user.rolId || null,
    sucursalId: user.sucursal_id || user.sucursalId || null,
    activo: user.activo,
    placa: user.placa || null,
    vehiculo: user.vehiculo || null
  });
});

/** POST /api/users — Crea un nuevo usuario. La contraseña se cifra con bcrypt antes de guardar. */
app.post("/api/users", requireAdmin, async (req, res) => {
  const { nombre, email, rolId, sucursalId, password } = req.body || {};
  if (
    !textValue(nombre) ||
    !textValue(email) ||
    !textValue(password) ||
    !rolId ||
    !sucursalId
  ) {
    return res
      .status(400)
      .json({
        error:
          "nombre, email, telefonoPais, telefonoNumero, contraseña, rolId y sucursalId son requeridos"
      });
  }
  if (rolId && !(await call(repo.getRoleById, rolId))) {
    return res.status(400).json({ error: "Rol inválido" });
  }
  if (sucursalId && !(await call(repo.getBranchById, sucursalId))) {
    return res.status(400).json({ error: "Sucursal inválida" });
  }
  const phone = resolvePhone(req.body || {});
  if (!phone.ok) return res.status(400).json({ error: phone.error });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await call(repo.createUser, {
    ...req.body,
    nombre: textValue(nombre),
    email: textValue(email),
    telefono: phone.e164,
    passwordHash
  });
  res.status(201).json(user);
});

/** PUT /api/users/:id — Actualiza un usuario. Si se envía contraseña, se re-cifra. */
app.put("/api/users/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rolId, sucursalId, activo, password } =
    req.body;
  const existing = await call(repo.getUserById, id);
  if (!existing) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  if (rolId && !(await call(repo.getRoleById, rolId))) {
    return res.status(400).json({ error: "Rol inválido" });
  }
  if (sucursalId && !(await call(repo.getBranchById, sucursalId))) {
    return res.status(400).json({ error: "Sucursal inválida" });
  }
  if (!textValue(nombre) || !textValue(email) || !rolId || !sucursalId) {
    return res.status(400).json({
      error:
        "nombre, email, telefonoPais, telefonoNumero, rolId y sucursalId son requeridos"
    });
  }
  const phone = resolvePhone(req.body || {});
  if (!phone.ok) return res.status(400).json({ error: phone.error });
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const { placa, vehiculo } = req.body || {};
  const updated = await call(repo.updateUser, id, {
    nombre: textValue(nombre),
    email: textValue(email),
    telefono: phone.e164,
    rolId,
    sucursalId,
    activo,
    passwordHash,
    placa: placa !== undefined ? (placa || null) : undefined,
    vehiculo: vehiculo !== undefined ? (vehiculo || null) : undefined
  });
  if (!updated) {
    return res.status(400).json({ error: "No se pudo actualizar" });
  }
  res.json(updated);
});

/** DELETE /api/users/:id — Elimina un usuario del sistema */
app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  const userToDelete = await call(repo.getUserById, req.params.id);
  const removed = await call(repo.deleteUser, req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  logActivity(req.authUser.id, req.authUser.nombre, "delete", "usuario", `Eliminó usuario: ${userToDelete?.nombre || req.params.id}`);
  res.json({ ok: true });
});

/* ── SE3: Endpoint de registro de actividad ──────────────── */

/** GET /api/activity-log — Devuelve el historial de actividad del sistema (solo admin) */
app.get("/api/activity-log", requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, MAX_LOG_ENTRIES);
  const recent = activityLog.slice(-limit).reverse();
  res.json(recent);
});

/* ── Rutas de catálogos generales ─────────────────────────── */

/** GET /api/roles — Lista los roles del sistema */
app.get("/api/roles", async (req, res) => {
  res.json(await call(repo.listRoles));
});

app.get("/api/branches", async (req, res) => {
  res.json(await call(repo.listBranches));
});

app.post("/api/branches", async (req, res) => {
  const { nombre, direccion } = req.body;
  if (!textValue(nombre) || !textValue(direccion)) {
    return res.status(400).json({ error: "nombre y direccion son requeridos" });
  }
  const branch = await call(repo.createBranch, {
    nombre: textValue(nombre),
    direccion: textValue(direccion)
  });
  res.status(201).json(branch);
});

app.get("/api/statuses", async (req, res) => {
  res.json(await call(repo.listStatuses));
});

app.get("/api/distributors", async (req, res) => {
  res.json(await call(repo.listDistributors));
});

app.post("/api/distributors", async (req, res) => {
  const { nombre, razonSocial, direccion } = req.body || {};
  if (!textValue(nombre) || !textValue(razonSocial) || !textValue(direccion)) {
    return res.status(400).json({
      error:
        "nombre, razonSocial, telefonoPais, telefonoNumero y direccion son requeridos"
    });
  }
  const phone = resolvePhone(req.body || {});
  if (!phone.ok) return res.status(400).json({ error: phone.error });
  const distributor = await call(repo.createDistributor, {
    nombre: textValue(nombre),
    razonSocial: textValue(razonSocial),
    telefono: phone.e164,
    direccion: textValue(direccion)
  });
  res.status(201).json(distributor);
});

/* ── Ruta de reportes ─────────────────────────────────────── */

/**
 * GET /api/reports/packages — Genera y descarga un reporte de todos los paquetes.
 * Acepta ?format=csv o ?format=xlsx.
 * Incluye datos completos: remitente, destinatario, estados, historial, etc.
 */
app.get("/api/reports/packages", async (req, res) => {
  const format = String(req.query.format || "csv").toLowerCase();
  if (!["csv", "xlsx"].includes(format)) {
    return res.status(400).json({ error: "Formato no soportado" });
  }
  const packages = await call(repo.listPackagesDetailed);
  const packagesWithHistory = await Promise.all(
    packages.map(async (pkg) => {
      if (repo.getPackageDetailsById) {
        const full = await call(repo.getPackageDetailsById, pkg.id);
        return full || pkg;
      }
      return pkg;
    })
  );
  const headers = [
    "ID",
    "Codigo",
    "Tipo Envio",
    "Tipo Remitente",
    "Estado",
    "Descripcion",
    "Destino",
    "Distribuidora",
    "Razon Social Distribuidora",
    "Telefono Distribuidora",
    "Direccion Distribuidora",
    "Cliente",
    "Documento Cliente",
    "Telefono Cliente",
    "Email Cliente",
    "Direccion Cliente",
    "Sucursal Origen",
    "Direccion Sucursal Origen",
    "Sucursal Destino",
    "Direccion Sucursal Destino",
    "Creado En",
    "Ultima Actualizacion",
    "Ultima Observacion",
    "Reprogramacion Fecha",
    "Reprogramacion Hora Inicio",
    "Reprogramacion Hora Fin",
    "Reprogramacion Direccion",
    "Historial Estados"
  ];
  const rows = packagesWithHistory.map((pkg) => {
    const history = Array.isArray(pkg.historial) ? pkg.historial : [];
    const lastEntry = history.length ? history[history.length - 1] : null;
    const historyText = history
      .map(
        (item) =>
          `${item.estado} (${formatDate(item.fechaHora) || "sin fecha"})${
            item.observacion ? ` - ${item.observacion}` : ""
          }`
      )
      .join(" | ");
    return [
      pkg.id,
      pkg.codigoSeguimiento,
      pkg.tipoEnvio || "",
      pkg.remitenteTipo || "",
      pkg.estadoActual,
      pkg.descripcion,
      pkg.destinoTexto,
      pkg.remitente?.nombre || "",
      pkg.remitente?.razonSocial || "",
      pkg.remitente?.telefono || "",
      pkg.remitente?.direccion || "",
      pkg.destinatario?.nombre || "",
      pkg.destinatario?.documento || "",
      pkg.destinatario?.telefono || "",
      pkg.destinatario?.email || "",
      pkg.destinatario?.direccion || "",
      pkg.sucursalOrigen?.nombre || "",
      pkg.sucursalOrigen?.direccion || "",
      pkg.sucursalDestino?.nombre || "",
      pkg.sucursalDestino?.direccion || "",
      formatDate(pkg.creadoEn),
      formatDate(lastEntry?.fechaHora),
      lastEntry?.observacion || "",
      pkg.reprogramacionFecha || "",
      pkg.reprogramacionHoraInicio || "",
      pkg.reprogramacionHoraFin || "",
      pkg.reprogramacionDireccion || "",
      historyText
    ];
  });
  if (format === "xlsx") {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Paquetes");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reporte-paquetes.xlsx"'
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(buffer);
    return;
  }

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="reporte-paquetes.csv"'
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.send(`\uFEFF${csv}`);
});

/* ── FI3: Manejador global de errores (tolerancia a fallos) ── */
app.use((err, req, res, _next) => {
  console.error("Error no controlado:", err);
  logActivity("system", "Sistema", "error", "server", `Error: ${err.message || "desconocido"}`);
  res.status(500).json({
    error: "Error interno del servidor. Intente nuevamente."
  });
});

/* ── SA2: Health check con diagnóstico ────────────────────── */
app.get("/api/health/detailed", requireAdmin, async (req, res) => {
  const checks = {
    server: true,
    database: false,
    activeTokens: authTokens.size,
    uptime: Math.floor(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  };
  try {
    if (useDb) {
      await call(repo.listRoles);
      checks.database = true;
    } else {
      checks.database = true;
    }
  } catch {
    checks.database = false;
  }
  const status = checks.database ? "healthy" : "degraded";
  res.json({ status, ...checks });
});

/* ── Arranque del servidor ────────────────────────────────── */

const startServer = () => {
  app.listen(port, () => {
    console.log(`API logística en http://localhost:${port}`);
    ensureAdminUser();
  });
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export { app, startServer };
