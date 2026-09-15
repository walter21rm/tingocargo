/**
 * ============================================================
 * CAPA DE ALMACENAMIENTO — Memoria RAM (desarrollo/pruebas)
 * ============================================================
 * Alternativa a storageDb.js que guarda todo en arrays en memoria.
 * Los datos se pierden al reiniciar el servidor.
 * Útil para pruebas rápidas sin necesidad de PostgreSQL.
 *
 * Expone exactamente las mismas funciones que storageDb.js
 * (interfaz por convención). server.js elige este módulo
 * cuando USE_DB=false.
 * ============================================================
 */

import { v4 as uuid } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

/* ── Carga de parametrización desde config.json ──────────── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let param;
try {
  const cfg = JSON.parse(readFileSync(path.resolve(__dirname, "../../config.json"), "utf-8"));
  param = cfg.parametrizacion || {};
} catch {
  param = {};
}

/** Retorna la fecha/hora actual en formato ISO */
const now = () => new Date().toISOString();

const PREFIJO = param.paquetes?.prefijoSeguimiento || "TM-";
const METODOS_PAGO_VALIDOS = param.paquetes?.metodosPago || ["tarjeta", "yape", "efectivo"];

/* ── Datos iniciales en memoria (seed) ──────────────────── */

const roles = [
  { id: "r1", nombre: "Administrador" },
  { id: "r2", nombre: "Operador logístico" },
  { id: "r3", nombre: "Repartidor" },
  { id: "r4", nombre: "Cliente" }
];

/** Estados posibles de un paquete (leídos desde config.json) */
const statuses = param.paquetes?.estados || ["En Almacén", "En Tránsito", "Entregado", "Intento fallido"];

const branches = [
  { id: "b1", nombre: "Tingo María - Centro", direccion: "Av. Principal 123" },
  { id: "b2", nombre: "Tingo María - Norte", direccion: "Jr. Logística 456" }
];

const clients = [
  {
    id: "c1",
    tipo: "persona",
    nombre: "Carlos Rojas",
    documento: "DNI 12345678",
    telefono: "987654321",
    email: "carlos@correo.com",
    direccion: "Jr. Perú 123"
  },
  {
    id: "c2",
    tipo: "empresa",
    nombre: "Botica San José",
    documento: "RUC 20123456789",
    telefono: "065-123456",
    email: "contacto@boticasanjose.pe",
    direccion: "Av. Amazonas 456"
  }
];

const distributors = [
  {
    id: "d1",
    nombre: "DIMEXA",
    razonSocial: "Distribuidora de Medicamentos S.A.",
    telefono: "064-562100",
    direccion: "Av. Ejemplo 123, Tingo María"
  },
  {
    id: "d2",
    nombre: "ALFARO",
    razonSocial: "Droguería Alfaro S.A.C.",
    telefono: "064-562234",
    direccion: "Jr. Ucayali 789, Tingo María"
  }
];

const packages = [
  {
    id: "p1",
    codigoSeguimiento: `${PREFIJO}2026-0001`,
    remitenteId: "d1",
    destinatarioId: "c1",
    sucursalOrigenId: "b1",
    sucursalDestinoId: null,
    destinoTexto: "Jr. Callao 456, Tingo María",
    descripcion: "Medicinas",
    estadoActual: "En Tránsito",
    creadoEn: now(),
    historial: [
      { estado: "En Almacén", fechaHora: now() },
      { estado: "En Tránsito", fechaHora: now() }
    ]
  }
];

const users = [
  {
    id: "u1",
    nombre: "Ana Pérez",
    email: "ana@logistica.pe",
    telefono: "999888777",
    rolId: "r1",
    sucursalId: "b1",
    activo: true,
    passwordHash: "",
    creadoEn: now()
  }
];

/* ── Funciones auxiliares de mapeo ────────────────────────── */

/** Construye el objeto completo de tracking con datos expandidos del paquete */
const buildTracking = (pkg) => {
  const remitente =
    pkg.tipoEnvio === "cliente_cliente"
      ? clients.find((c) => c.id === pkg.remitenteClienteId)
      : distributors.find((d) => d.id === pkg.remitenteId);
  const destinatario = clients.find((c) => c.id === pkg.destinatarioId);
  const operador = users.find((u) => u.id === pkg.operadorId);
  const repartidor = users.find((u) => u.id === pkg.repartidorId);
  const origen = branches.find((b) => b.id === pkg.sucursalOrigenId);
  const destino = branches.find((b) => b.id === pkg.sucursalDestinoId);

  return {
    id: pkg.id,
    codigoSeguimiento: pkg.codigoSeguimiento,
    estadoActual: pkg.estadoActual,
    descripcion: pkg.descripcion,
    destinoTexto: pkg.destinoTexto || "",
    tipoEnvio: pkg.tipoEnvio || "distribuidora_cliente",
    remitenteTipo:
      pkg.tipoEnvio === "cliente_cliente" ? "Cliente" : "Distribuidora",
    remitente,
    destinatario,
    operador,
    repartidor,
    sucursalOrigen: origen,
    sucursalDestino: destino,
    reprogramacionFecha: pkg.reprogramacionFecha,
    reprogramacionHoraInicio: pkg.reprogramacionHoraInicio,
    reprogramacionHoraFin: pkg.reprogramacionHoraFin,
    reprogramacionDireccion: pkg.reprogramacionDireccion,
    historial: pkg.historial
  };
};

/** Expande un paquete con sus entidades relacionadas (remitente, destinatario, operador, etc.) */
const buildPackageDetails = (pkg) => ({
  ...pkg,
  tipoEnvio: pkg.tipoEnvio || "distribuidora_cliente",
  remitenteClienteId: pkg.remitenteClienteId || null,
  remitenteTipo:
    pkg.tipoEnvio === "cliente_cliente" ? "Cliente" : "Distribuidora",
  remitente:
    (pkg.tipoEnvio === "cliente_cliente"
      ? clients.find((c) => c.id === pkg.remitenteClienteId)
      : distributors.find((d) => d.id === pkg.remitenteId)) || null,
  destinatario: clients.find((c) => c.id === pkg.destinatarioId) || null,
  operador: users.find((u) => u.id === pkg.operadorId) || null,
  repartidor: users.find((u) => u.id === pkg.repartidorId) || null,
  sucursalOrigen: branches.find((b) => b.id === pkg.sucursalOrigenId) || null,
  sucursalDestino: branches.find((b) => b.id === pkg.sucursalDestinoId) || null
});

/* ================================================================
   FUNCIONES EXPORTADAS — CRUD en memoria
   ================================================================ */

export const getHealth = () => ({
  status: "ok",
  time: now()
});

export const listClients = () => clients;

export const createClient = (data) => {
  const client = {
    id: uuid(),
    tipo: data.tipo || "persona",
    nombre: data.nombre || "Cliente sin nombre",
    documento: data.documento || "",
    telefono: data.telefono || "",
    email: data.email || "",
    direccion: data.direccion || ""
  };
  clients.push(client);
  return client;
};

export const listPackages = (status) => {
  if (!status) return packages;
  return packages.filter((p) => p.estadoActual === status);
};

export const listPackagesDetailed = (status) =>
  listPackages(status).map(buildPackageDetails);

export const listPackagesByCourier = (courierId) =>
  packages
    .filter((pkg) => pkg.repartidorId === courierId)
    .map(buildPackageDetails);

export const listPackagesByClient = (clienteId) =>
  packages
    .filter(
      (pkg) =>
        String(pkg.remitenteClienteId) === String(clienteId) ||
        String(pkg.destinatarioId) === String(clienteId)
    )
    .map(buildPackageDetails);

const generateTrackingCode = () =>
  `${PREFIJO}${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

/** Crea un paquete nuevo con código de seguimiento único y estado inicial "En Almacén" */
export const createPackage = (data) => {
  let code = data.codigoSeguimiento || generateTrackingCode();
  while (packages.some((p) => p.codigoSeguimiento === code)) {
    code = generateTrackingCode();
  }
  const pkg = {
    id: uuid(),
    codigoSeguimiento: code,
    tipoEnvio: data.tipoEnvio || "distribuidora_cliente",
    remitenteId: data.remitenteId || null,
    remitenteClienteId: data.remitenteClienteId || null,
    destinatarioId: data.destinatarioId,
    operadorId: data.operadorId || null,
    repartidorId: data.repartidorId || null,
    sucursalOrigenId: data.sucursalOrigenId,
    sucursalDestinoId: data.sucursalDestinoId || null,
    destinoTexto: data.destinoTexto || "",
    descripcion: data.descripcion || "",
    estadoActual: "En Almacén",
    pesoKg: data.pesoKg ?? 0,
    precioEnvio: data.precioEnvio ?? 10,
    quienPaga: data.quienPaga || "remitente",
    pagado: data.pagado ?? false,
    creadoEn: now(),
    historial: [{ estado: "En Almacén", fechaHora: now() }]
  };
  packages.push(pkg);
  return pkg;
};

export const updatePackageStatus = (id, estado, observacion = "") => {
  const pkg = packages.find((p) => p.id === id);
  if (!pkg) return null;
  pkg.estadoActual = estado;
  pkg.historial.push({ estado, fechaHora: now(), observacion });
  return pkg;
};

export const updatePackageReprogramar = (id, { fecha, horaInicio, horaFin, direccion }) => {
  const pkg = packages.find((p) => p.id === id);
  if (!pkg) return null;
  pkg.reprogramacionFecha = fecha;
  pkg.reprogramacionHoraInicio = horaInicio;
  pkg.reprogramacionHoraFin = horaFin;
  pkg.reprogramacionDireccion = direccion || null;
  if (direccion && String(direccion).trim()) {
    pkg.destinoTexto = direccion.trim();
  }
  pkg.estadoActual = "En Tránsito";
  pkg.historial.push({ estado: "En Tránsito", fechaHora: now(), observacion: "Reprogramado para entrega" });
  return pkg;
};

export const getPackageById = (id) => packages.find((p) => p.id === id) || null;

export const getPackageDetailsById = (id) => {
  const pkg = getPackageById(id);
  if (!pkg) return null;
  return buildPackageDetails(pkg);
};

export const getTrackingByCode = (code) => {
  const pkg = packages.find((p) => p.codigoSeguimiento === code);
  if (!pkg) return null;
  return buildTracking(pkg);
};

/* ── Usuarios ────────────────────────────────────────────── */

/** Lista usuarios omitiendo el campo passwordHash por seguridad */
export const listUsers = () =>
  users.map(({ passwordHash, ...rest }) => rest);

export const getUserByEmail = (email) => {
  if (!email) return null;
  const normalized = email.toLowerCase();
  return users.find((user) => user.email.toLowerCase() === normalized) || null;
};

export const getOperatorPhone = () => {
  const operatorRole = roles.find((role) => role.nombre === "Operador logístico");
  if (!operatorRole) return "";
  const operator = users.find(
    (user) => user.rolId === operatorRole.id && user.activo
  );
  return operator?.telefono || "";
};

export const listOperators = () => {
  const operatorRole = roles.find((role) => role.nombre === "Operador logístico");
  if (!operatorRole) return [];
  return users
    .filter((user) => user.rolId === operatorRole.id && user.activo)
    .map(({ passwordHash, ...rest }) => rest);
};

export const listCouriers = () => {
  const courierRole = roles.find((role) => role.nombre === "Repartidor");
  if (!courierRole) return [];
  return users
    .filter((user) => user.rolId === courierRole.id && user.activo)
    .map(({ passwordHash, ...rest }) => rest);
};

export const getUserById = (id) => users.find((user) => user.id === id) || null;

export const createUser = (data) => {
  const user = {
    id: uuid(),
    nombre: data.nombre || "Usuario",
    email: data.email || "",
    telefono: data.telefono || "",
    rolId: data.rolId || roles[0].id,
    sucursalId: data.sucursalId || branches[0].id,
    clienteId: data.clienteId || null,
    activo: data.activo ?? true,
    passwordHash: data.passwordHash || "",
    placa: data.placa || null,
    vehiculo: data.vehiculo || null,
    creadoEn: now()
  };
  users.push(user);
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

export const updateUser = (id, data) => {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return null;
  const existing = users[index];
  const updated = {
    ...existing,
    nombre: data.nombre ?? existing.nombre,
    email: data.email ?? existing.email,
    telefono: data.telefono ?? existing.telefono,
    rolId: data.rolId ?? existing.rolId,
    sucursalId: data.sucursalId ?? existing.sucursalId,
    activo: data.activo ?? existing.activo,
    passwordHash: data.passwordHash || existing.passwordHash,
    placa: data.placa !== undefined ? data.placa : existing.placa,
    vehiculo: data.vehiculo !== undefined ? data.vehiculo : existing.vehiculo
  };
  users[index] = updated;
  const { passwordHash, ...safeUser } = updated;
  return safeUser;
};

export const deleteUser = (id) => {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return null;
  const [removed] = users.splice(index, 1);
  const { passwordHash, ...safeUser } = removed;
  return safeUser;
};

export const listRoles = () => roles;

export const createRole = (nombre) => {
  const role = { id: uuid(), nombre };
  roles.push(role);
  return role;
};

export const listBranches = () => branches;

export const createBranch = (data) => {
  const branch = {
    id: uuid(),
    nombre: data.nombre || "Sucursal",
    direccion: data.direccion || ""
  };
  branches.push(branch);
  return branch;
};

export const listStatuses = () => statuses;

export const listDistributors = () => distributors;

export const createDistributor = (data) => {
  const distributor = {
    id: uuid(),
    nombre: data.nombre || "Distribuidora",
    razonSocial: data.razonSocial || "",
    telefono: data.telefono || "",
    direccion: data.direccion || ""
  };
  distributors.push(distributor);
  return distributor;
};

export const getDistributorById = (id) =>
  distributors.find((distributor) => distributor.id === id) || null;

export const getClientById = (id) =>
  clients.find((client) => client.id === id) || null;

const normalizeDoc = (d) => String(d || "").replace(/\D/g, "");

export const getClientByDocumento = (documento) => {
  const doc = normalizeDoc(documento);
  if (!doc) return null;
  return clients.find((c) => normalizeDoc(c.documento) === doc) || null;
};

export const updateClient = (id, data) => {
  const client = clients.find((c) => c.id === id);
  if (!client) return null;
  if (data.nombre) client.nombre = data.nombre;
  if (data.telefono) client.telefono = data.telefono;
  if (data.email) client.email = data.email;
  if (data.direccion) client.direccion = data.direccion;
  return client;
};

export const getBranchById = (id) =>
  branches.find((branch) => branch.id === id) || null;

export const updatePackagePrecio = (id, precioEnvio) => {
  const pkg = packages.find((p) => p.id === id);
  if (!pkg) return null;
  pkg.precioEnvio = precioEnvio;
  return pkg;
};

export const updatePackageOperador = (id, operadorId) => {
  const pkg = packages.find((p) => p.id === id);
  if (!pkg) return null;
  pkg.operadorId = operadorId || null;
  return pkg;
};

export const updatePackageRepartidor = (id, repartidorId) => {
  const pkg = packages.find((p) => p.id === id);
  if (!pkg) return null;
  pkg.repartidorId = repartidorId || null;
  return pkg;
};

/** Marca un paquete como pagado y registra el método de pago */
export const markPackagePagado = (id, metodoPago = null) => {
  const pkg = packages.find((p) => p.id === id);
  if (!pkg) return null;
  pkg.pagado = true;
  pkg.metodoPago = METODOS_PAGO_VALIDOS.includes(metodoPago)
    ? metodoPago
    : null;
  return pkg;
};

export const getRoleById = (id) =>
  roles.find((role) => role.id === id) || null;
