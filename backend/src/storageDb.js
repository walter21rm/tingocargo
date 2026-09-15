/**
 * ============================================================
 * CAPA DE ALMACENAMIENTO — PostgreSQL (Supabase)
 * ============================================================
 * Implementa todas las funciones de acceso a datos usando
 * consultas SQL directas contra PostgreSQL.
 *
 * Este módulo y storage.js (memoria) exponen exactamente las
 * mismas funciones. El servidor (server.js) elige cuál usar
 * según la variable USE_DB. Este patrón se conoce como
 * "interfaz por convención" — ambos módulos cumplen el mismo
 * contrato sin usar clases ni interfaces formales.
 * ============================================================
 */

import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const { Pool } = pg;

/* ── Carga de parametrización desde config.json ──────────── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let param;
try {
  const cfg = JSON.parse(readFileSync(path.resolve(__dirname, "../../config.json"), "utf-8"));
  param = cfg.parametrizacion || {};
} catch {
  param = {};
}

let pool;

/**
 * Crea o retorna el pool de conexiones a PostgreSQL.
 * Detecta automáticamente si es Supabase para activar SSL.
 */
const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const useSsl = connectionString?.includes("supabase.co");
    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
};

/** Estados posibles de un paquete (leídos desde config.json) */
const statuses = param.paquetes?.estados || ["En Almacén", "En Tránsito", "Entregado", "Intento fallido"];

/** Atajo para ejecutar consultas SQL parametrizadas */
const query = (text, params) => getPool().query(text, params);

/** Convierte fechas de PostgreSQL a formato ISO UTC para el frontend */
const toIsoUtc = (value) => {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    return `${withT}Z`;
  }
  return value;
};

/** Transforma una fila de la tabla paquetes (snake_case) al formato camelCase del frontend */
const mapPackageRow = (row) => ({
  id: row.id,
  codigoSeguimiento: row.codigo_seguimiento,
  tipoEnvio: row.tipo_envio || "distribuidora_cliente",
  remitenteId: row.remitente_id,
  remitenteClienteId: row.remitente_cliente_id,
  destinatarioId: row.destinatario_id,
  operadorId: row.operador_id,
  repartidorId: row.repartidor_id,
  sucursalOrigenId: row.sucursal_origen_id,
  sucursalDestinoId: row.sucursal_destino_id,
  destinoTexto: row.destino_texto || "",
  descripcion: row.descripcion,
  estadoActual: row.estado_actual,
  reprogramacionFecha: row.reprogramacion_fecha,
  reprogramacionHoraInicio: row.reprogramacion_hora_inicio,
  reprogramacionHoraFin: row.reprogramacion_hora_fin,
  reprogramacionDireccion: row.reprogramacion_direccion,
  pesoKg: parseFloat(row.peso_kg) || 0,
  precioEnvio: parseFloat(row.precio_envio) || 0,
  quienPaga: row.quien_paga || "remitente",
  pagado: Boolean(row.pagado),
  metodoPago: row.metodo_pago || null,
  creadoEn: toIsoUtc(row.creado_en)
});

/** Transforma una fila de paquete con JOINs expandidos (remitente, destinatario, operador, etc.) */
const mapPackageDetailsRow = (row) => ({
  ...mapPackageRow(row),
  remitenteTipo: row.remitente_tipo || "Distribuidora",
  remitente: row.remitente_ref_id
    ? {
        id: row.remitente_ref_id,
        nombre: row.remitente_nombre,
        razonSocial: row.remitente_razon_social,
        documento: row.remitente_documento,
        telefono: row.remitente_telefono,
        direccion: row.remitente_direccion
      }
    : null,
  destinatario: row.destinatario_id
    ? {
        id: row.destinatario_id,
        nombre: row.destinatario_nombre,
        documento: row.destinatario_documento,
        telefono: row.destinatario_telefono,
        email: row.destinatario_email,
        direccion: row.destinatario_direccion
      }
    : null,
  operador: row.operador_id
    ? {
        id: row.operador_id,
        nombre: row.operador_nombre,
        telefono: row.operador_telefono,
        email: row.operador_email
      }
    : null,
  repartidor: row.repartidor_id
    ? {
        id: row.repartidor_id,
        nombre: row.repartidor_nombre,
        telefono: row.repartidor_telefono,
        email: row.repartidor_email
      }
    : null,
  sucursalOrigen: row.suc_origen_id
    ? {
        id: row.suc_origen_id,
        nombre: row.suc_origen_nombre,
        direccion: row.suc_origen_direccion
      }
    : null,
  sucursalDestino: row.suc_destino_id
    ? {
        id: row.suc_destino_id,
        nombre: row.suc_destino_nombre,
        direccion: row.suc_destino_direccion
      }
    : null
});

const PREFIJO = param.paquetes?.prefijoSeguimiento || "TM-";
const METODOS_PAGO_VALIDOS = param.paquetes?.metodosPago || ["tarjeta", "yape", "efectivo"];

/** Genera un código de seguimiento con el prefijo de config.json (ej: TM-2026-4821) */
const generateTrackingCode = () =>
  `${PREFIJO}${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

/* ================================================================
   FUNCIONES EXPORTADAS — CRUD contra PostgreSQL
   ================================================================ */

/** Retorna el estado del servidor y la hora actual */
export const getHealth = () => ({
  status: "ok",
  time: new Date().toISOString()
});

/* ── Clientes ────────────────────────────────────────────── */

/** Lista todos los clientes ordenados por ID descendente */
export const listClients = async () => {
  const { rows } = await query("SELECT * FROM clientes ORDER BY id DESC");
  return rows.map((row) => ({
    id: row.id,
    tipo: row.tipo,
    nombre: row.nombre,
    documento: row.documento,
    telefono: row.telefono,
    email: row.email,
    direccion: row.direccion,
    creadoEn: row.creado_en
  }));
};

/** Inserta un nuevo cliente en la base de datos */
export const createClient = async (data) => {
  const { rows } = await query(
    `INSERT INTO clientes (tipo, nombre, documento, telefono, email, direccion)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.tipo || "persona",
      data.nombre || "Cliente sin nombre",
      data.documento || "",
      data.telefono || "",
      data.email || "",
      data.direccion || ""
    ]
  );
  const row = rows[0];
  return {
    id: row.id,
    tipo: row.tipo,
    nombre: row.nombre,
    documento: row.documento,
    telefono: row.telefono,
    email: row.email,
    direccion: row.direccion,
    creadoEn: row.creado_en
  };
};

/** Actualiza los campos de un cliente existente. Usa COALESCE para mantener valores previos si no se envían nuevos */
export const updateClient = async (id, data) => {
  const { rows } = await query(
    `UPDATE clientes
     SET nombre = COALESCE($1, nombre),
         telefono = COALESCE($2, telefono),
         email = COALESCE($3, email),
         direccion = COALESCE($4, direccion)
     WHERE id = $5
     RETURNING *`,
    [
      data.nombre || null,
      data.telefono || null,
      data.email || null,
      data.direccion || null,
      id
    ]
  );
  return rows[0] || null;
};

/** Busca un cliente por su ID */
export const getClientById = async (id) => {
  const { rows } = await query("SELECT * FROM clientes WHERE id = $1", [id]);
  return rows[0] || null;
};

/** Busca un cliente por su número de documento (solo dígitos, ignora guiones y letras) */
export const getClientByDocumento = async (documento) => {
  const doc = String(documento || "").replace(/\D/g, "");
  if (!doc) return null;
  const { rows } = await query(
    `SELECT * FROM clientes
     WHERE regexp_replace(documento, '\D', '', 'g') = $1
     ORDER BY id DESC
     LIMIT 1`,
    [doc]
  );
  return rows[0] || null;
};

/* ── Distribuidoras ──────────────────────────────────────── */

/** Busca una distribuidora por su ID */
export const getDistributorById = async (id) => {
  const { rows } = await query(
    "SELECT * FROM distribuidoras WHERE id = $1",
    [id]
  );
  return rows[0] || null;
};

/* ── Sucursales ──────────────────────────────────────────── */

/** Lista todas las sucursales */
export const listBranches = async () => {
  const { rows } = await query("SELECT * FROM sucursales ORDER BY id");
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion
  }));
};

export const createBranch = async (data) => {
  const { rows } = await query(
    `INSERT INTO sucursales (nombre, direccion)
     VALUES ($1, $2)
     RETURNING *`,
    [data.nombre || "Sucursal", data.direccion || ""]
  );
  const row = rows[0];
  return {
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion
  };
};

export const getBranchById = async (id) => {
  const { rows } = await query("SELECT * FROM sucursales WHERE id = $1", [id]);
  return rows[0] || null;
};

/* ── Roles ───────────────────────────────────────────────── */

/** Lista todos los roles del sistema */
export const listRoles = async () => {
  const { rows } = await query("SELECT * FROM roles ORDER BY id");
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre
  }));
};

export const createRole = async (nombre) => {
  const { rows } = await query(
    "INSERT INTO roles (nombre) VALUES ($1) RETURNING *",
    [nombre]
  );
  return rows[0] || null;
};

export const getRoleById = async (id) => {
  const { rows } = await query("SELECT * FROM roles WHERE id = $1", [id]);
  return rows[0] || null;
};

/* ── Usuarios ────────────────────────────────────────────── */

/** Lista todos los usuarios (sin password_hash por seguridad) */
export const listUsers = async () => {
  const { rows } = await query(
    "SELECT id, nombre, email, telefono, rol_id, sucursal_id, cliente_id, activo, placa, vehiculo, creado_en FROM usuarios ORDER BY id DESC"
  );
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    rolId: row.rol_id,
    sucursalId: row.sucursal_id,
    clienteId: row.cliente_id,
    activo: row.activo,
    placa: row.placa || null,
    vehiculo: row.vehiculo || null,
    creadoEn: row.creado_en
  }));
};

export const getUserById = async (id) => {
  const { rows } = await query("SELECT * FROM usuarios WHERE id = $1", [id]);
  return rows[0] || null;
};

/** Busca un usuario por email (case insensitive). Usado en el login. */
export const getUserByEmail = async (email) => {
  if (!email) return null;
  const { rows } = await query(
    "SELECT * FROM usuarios WHERE lower(email) = lower($1) LIMIT 1",
    [email]
  );
  return rows[0] || null;
};

/** Obtiene el teléfono del primer operador logístico activo */
export const getOperatorPhone = async () => {
  const { rows } = await query(
    `SELECT u.telefono
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE r.nombre = $1 AND u.activo = true
     ORDER BY u.id ASC
     LIMIT 1`,
    ["Operador logístico"]
  );
  return rows[0]?.telefono || "";
};

/** Lista todos los operadores logísticos activos */
export const listOperators = async () => {
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.telefono, u.email
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE r.nombre = $1 AND u.activo = true
     ORDER BY u.id ASC`,
    ["Operador logístico"]
  );
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    email: row.email
  }));
};

/** Lista todos los repartidores activos (incluye placa y vehículo) */
export const listCouriers = async () => {
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.telefono, u.email, u.placa, u.vehiculo
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE r.nombre = $1 AND u.activo = true
     ORDER BY u.id ASC`,
    ["Repartidor"]
  );
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    email: row.email,
    placa: row.placa || null,
    vehiculo: row.vehiculo || null
  }));
};

/** Crea un nuevo usuario en la BD. Incluye placa/vehículo si es repartidor. */
export const createUser = async (data) => {
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, email, telefono, rol_id, sucursal_id, cliente_id, activo, password_hash, placa, vehiculo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.nombre || "Usuario",
      data.email || "",
      data.telefono || "",
      data.rolId,
      data.sucursalId ?? null,
      data.clienteId ?? null,
      data.activo ?? true,
      data.passwordHash || "",
      data.placa || null,
      data.vehiculo || null
    ]
  );
  const row = rows[0];
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    rolId: row.rol_id,
    sucursalId: row.sucursal_id,
    clienteId: row.cliente_id,
    activo: row.activo,
    creadoEn: row.creado_en
  };
};

/** Actualiza un usuario. Si no se envía contraseña, mantiene la actual (COALESCE). */
export const updateUser = async (id, data) => {
  const { rows } = await query(
    `UPDATE usuarios
     SET nombre = $1,
         email = $2,
         telefono = $3,
         rol_id = $4,
         sucursal_id = $5,
         activo = $6,
         password_hash = COALESCE($7, password_hash),
         placa = $8,
         vehiculo = $9
     WHERE id = $10
     RETURNING *`,
    [
      data.nombre || "Usuario",
      data.email || "",
      data.telefono || "",
      data.rolId,
      data.sucursalId,
      data.activo ?? true,
      data.passwordHash || null,
      data.placa ?? null,
      data.vehiculo ?? null,
      id
    ]
  );
  return rows[0] || null;
};

export const deleteUser = async (id) => {
  const { rows } = await query("DELETE FROM usuarios WHERE id = $1 RETURNING *", [
    id
  ]);
  return rows[0] || null;
};

/* ── Paquetes ────────────────────────────────────────────── */

/** Lista paquetes. Si se pasa status, filtra por estado. */
export const listPackages = async (status) => {
  if (!status) {
    const { rows } = await query("SELECT * FROM paquetes ORDER BY id DESC");
    return rows.map(mapPackageRow);
  }
  const { rows } = await query(
    "SELECT * FROM paquetes WHERE estado_actual = $1 ORDER BY id DESC",
    [status]
  );
  return rows.map(mapPackageRow);
};

/**
 * Lista paquetes con datos expandidos (JOIN con distribuidoras, clientes,
 * usuarios operador/repartidor, y sucursales origen/destino).
 */
export const listPackagesDetailed = async (status) => {
  const baseQuery = `
    SELECT
      p.*,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.id ELSE r.id END as remitente_ref_id,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.nombre ELSE r.nombre END as remitente_nombre,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN NULL ELSE r.razon_social END as remitente_razon_social,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.documento ELSE NULL END as remitente_documento,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.telefono ELSE r.telefono END as remitente_telefono,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.direccion ELSE r.direccion END as remitente_direccion,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN 'Cliente' ELSE 'Distribuidora' END as remitente_tipo,
      d.id as destinatario_id, d.nombre as destinatario_nombre, d.documento as destinatario_documento,
      d.telefono as destinatario_telefono, d.email as destinatario_email, d.direccion as destinatario_direccion,
      u.id as operador_id, u.nombre as operador_nombre, u.telefono as operador_telefono, u.email as operador_email,
      ur.id as repartidor_id, ur.nombre as repartidor_nombre, ur.telefono as repartidor_telefono, ur.email as repartidor_email,
      so.id as suc_origen_id, so.nombre as suc_origen_nombre, so.direccion as suc_origen_direccion,
      sd.id as suc_destino_id, sd.nombre as suc_destino_nombre, sd.direccion as suc_destino_direccion
    FROM paquetes p
    LEFT JOIN distribuidoras r ON r.id = p.remitente_id
    LEFT JOIN clientes rc ON rc.id = p.remitente_cliente_id
    JOIN clientes d ON d.id = p.destinatario_id
    LEFT JOIN usuarios u ON u.id = p.operador_id
    LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
    JOIN sucursales so ON so.id = p.sucursal_origen_id
    LEFT JOIN sucursales sd ON sd.id = p.sucursal_destino_id
  `;

  const { rows } = status
    ? await query(`${baseQuery} WHERE p.estado_actual = $1 ORDER BY p.id DESC`, [
        status
      ])
    : await query(`${baseQuery} ORDER BY p.id DESC`);

  return rows.map(mapPackageDetailsRow);
};

/** Lista paquetes asignados a un repartidor específico (con datos expandidos) */
export const listPackagesByCourier = async (courierId) => {
  const baseQuery = `
    SELECT
      p.*,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.id ELSE r.id END as remitente_ref_id,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.nombre ELSE r.nombre END as remitente_nombre,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN NULL ELSE r.razon_social END as remitente_razon_social,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.documento ELSE NULL END as remitente_documento,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.telefono ELSE r.telefono END as remitente_telefono,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.direccion ELSE r.direccion END as remitente_direccion,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN 'Cliente' ELSE 'Distribuidora' END as remitente_tipo,
      d.id as destinatario_id, d.nombre as destinatario_nombre, d.documento as destinatario_documento,
      d.telefono as destinatario_telefono, d.email as destinatario_email, d.direccion as destinatario_direccion,
      u.id as operador_id, u.nombre as operador_nombre, u.telefono as operador_telefono, u.email as operador_email,
      ur.id as repartidor_id, ur.nombre as repartidor_nombre, ur.telefono as repartidor_telefono, ur.email as repartidor_email,
      so.id as suc_origen_id, so.nombre as suc_origen_nombre, so.direccion as suc_origen_direccion,
      sd.id as suc_destino_id, sd.nombre as suc_destino_nombre, sd.direccion as suc_destino_direccion
    FROM paquetes p
    LEFT JOIN distribuidoras r ON r.id = p.remitente_id
    LEFT JOIN clientes rc ON rc.id = p.remitente_cliente_id
    JOIN clientes d ON d.id = p.destinatario_id
    LEFT JOIN usuarios u ON u.id = p.operador_id
    LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
    JOIN sucursales so ON so.id = p.sucursal_origen_id
    LEFT JOIN sucursales sd ON sd.id = p.sucursal_destino_id
    WHERE p.repartidor_id = $1
    ORDER BY p.id DESC
  `;
  const { rows } = await query(baseQuery, [courierId]);
  return rows.map(mapPackageDetailsRow);
};

export const getPackageById = async (id) => {
  const { rows } = await query("SELECT * FROM paquetes WHERE id = $1", [id]);
  return rows[0] ? mapPackageRow(rows[0]) : null;
};

/** Lista paquetes donde el cliente es remitente O destinatario */
export const listPackagesByClient = async (clienteId) => {
  const baseQuery = `
    SELECT
      p.*,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.id ELSE r.id END as remitente_ref_id,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.nombre ELSE r.nombre END as remitente_nombre,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN NULL ELSE r.razon_social END as remitente_razon_social,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.documento ELSE NULL END as remitente_documento,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.telefono ELSE r.telefono END as remitente_telefono,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.direccion ELSE r.direccion END as remitente_direccion,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN 'Cliente' ELSE 'Distribuidora' END as remitente_tipo,
      d.id as destinatario_id, d.nombre as destinatario_nombre, d.documento as destinatario_documento,
      d.telefono as destinatario_telefono, d.email as destinatario_email, d.direccion as destinatario_direccion,
      u.id as operador_id, u.nombre as operador_nombre, u.telefono as operador_telefono, u.email as operador_email,
      ur.id as repartidor_id, ur.nombre as repartidor_nombre, ur.telefono as repartidor_telefono, ur.email as repartidor_email,
      so.id as suc_origen_id, so.nombre as suc_origen_nombre, so.direccion as suc_origen_direccion,
      sd.id as suc_destino_id, sd.nombre as suc_destino_nombre, sd.direccion as suc_destino_direccion
    FROM paquetes p
    LEFT JOIN distribuidoras r ON r.id = p.remitente_id
    LEFT JOIN clientes rc ON rc.id = p.remitente_cliente_id
    JOIN clientes d ON d.id = p.destinatario_id
    LEFT JOIN usuarios u ON u.id = p.operador_id
    LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
    JOIN sucursales so ON so.id = p.sucursal_origen_id
    LEFT JOIN sucursales sd ON sd.id = p.sucursal_destino_id
    WHERE (p.remitente_cliente_id = $1 OR p.destinatario_id = $1)
    ORDER BY p.id DESC
  `;
  const { rows } = await query(baseQuery, [clienteId]);
  return rows.map(mapPackageDetailsRow);
};

/** Actualiza el precio de envío de un paquete */
export const updatePackagePrecio = async (id, precioEnvio) => {
  const { rows } = await query(
    "UPDATE paquetes SET precio_envio = $1 WHERE id = $2 RETURNING *",
    [precioEnvio, id]
  );
  return rows[0] ? mapPackageRow(rows[0]) : null;
};

export const updatePackageOperador = async (id, operadorId) => {
  const { rows } = await query(
    "UPDATE paquetes SET operador_id = $1 WHERE id = $2 RETURNING *",
    [operadorId || null, id]
  );
  return rows[0] ? mapPackageRow(rows[0]) : null;
};

export const updatePackageRepartidor = async (id, repartidorId) => {
  const { rows } = await query(
    "UPDATE paquetes SET repartidor_id = $1 WHERE id = $2 RETURNING *",
    [repartidorId || null, id]
  );
  return rows[0] ? mapPackageRow(rows[0]) : null;
};

/** Marca un paquete como pagado y registra el método de pago (tarjeta/yape/efectivo) */
export const markPackagePagado = async (id, metodoPago = null) => {
  const validMetodo = METODOS_PAGO_VALIDOS.includes(metodoPago)
    ? metodoPago
    : null;
  const { rows } = await query(
    "UPDATE paquetes SET pagado = true, metodo_pago = $1 WHERE id = $2 RETURNING *",
    [validMetodo, id]
  );
  return rows[0] ? mapPackageRow(rows[0]) : null;
};

/** Obtiene el detalle completo de un paquete con todos sus JOINs y el historial de estados */
export const getPackageDetailsById = async (id) => {
  const { rows } = await query(
    `
    SELECT
      p.*,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.id ELSE r.id END as remitente_ref_id,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.nombre ELSE r.nombre END as remitente_nombre,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN NULL ELSE r.razon_social END as remitente_razon_social,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.documento ELSE NULL END as remitente_documento,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.telefono ELSE r.telefono END as remitente_telefono,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.direccion ELSE r.direccion END as remitente_direccion,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN 'Cliente' ELSE 'Distribuidora' END as remitente_tipo,
      d.id as destinatario_id, d.nombre as destinatario_nombre, d.documento as destinatario_documento,
      d.telefono as destinatario_telefono, d.email as destinatario_email, d.direccion as destinatario_direccion,
      u.id as operador_id, u.nombre as operador_nombre, u.telefono as operador_telefono, u.email as operador_email,
      ur.id as repartidor_id, ur.nombre as repartidor_nombre, ur.telefono as repartidor_telefono, ur.email as repartidor_email,
      so.id as suc_origen_id, so.nombre as suc_origen_nombre, so.direccion as suc_origen_direccion,
      sd.id as suc_destino_id, sd.nombre as suc_destino_nombre, sd.direccion as suc_destino_direccion
    FROM paquetes p
    LEFT JOIN distribuidoras r ON r.id = p.remitente_id
    LEFT JOIN clientes rc ON rc.id = p.remitente_cliente_id
    JOIN clientes d ON d.id = p.destinatario_id
    LEFT JOIN usuarios u ON u.id = p.operador_id
    LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
    JOIN sucursales so ON so.id = p.sucursal_origen_id
    LEFT JOIN sucursales sd ON sd.id = p.sucursal_destino_id
    WHERE p.id = $1
    `,
    [id]
  );

  if (!rows[0]) return null;
  const pkg = mapPackageDetailsRow(rows[0]);
  const history = await query(
    "SELECT estado, fecha_hora, observacion FROM historial_estados WHERE paquete_id = $1 ORDER BY fecha_hora ASC",
    [id]
  );
  return {
    ...pkg,
    historial: history.rows.map((row) => ({
      estado: row.estado,
      fechaHora: toIsoUtc(row.fecha_hora),
      observacion: row.observacion
    }))
  };
};

/**
 * Crea un paquete nuevo. Genera código de seguimiento automáticamente (TM-YYYY-XXXX).
 * Reintenta hasta 5 veces si el código generado ya existe (constraint UNIQUE).
 * También crea el primer registro en historial_estados ("En Almacén").
 */
export const createPackage = async (data) => {
  let code = data.codigoSeguimiento || generateTrackingCode();
  let pkgRow = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { rows } = await query(
        `INSERT INTO paquetes (
          codigo_seguimiento,
          tipo_envio,
          remitente_id,
          remitente_cliente_id,
          destinatario_id,
          operador_id,
          repartidor_id,
          sucursal_origen_id,
          sucursal_destino_id,
          destino_texto,
          descripcion,
          estado_actual,
          peso_kg,
          precio_envio,
          quien_paga,
          pagado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          code,
          data.tipoEnvio || "distribuidora_cliente",
          data.remitenteId || null,
          data.remitenteClienteId || null,
          data.destinatarioId,
          data.operadorId || null,
          data.repartidorId || null,
          data.sucursalOrigenId,
          data.sucursalDestinoId || null,
          data.destinoTexto || "",
          data.descripcion || "",
          "En Almacén",
          data.pesoKg ?? 0,
          data.precioEnvio ?? 10,
          data.quienPaga || "remitente",
          data.pagado ?? false
        ]
      );
      pkgRow = rows[0];
      break;
    } catch (err) {
      if (err.code === "23505") {
        code = generateTrackingCode();
      } else {
        throw err;
      }
    }
  }

  if (!pkgRow) {
    throw new Error("No se pudo generar el código de seguimiento");
  }

  await query(
    "INSERT INTO historial_estados (paquete_id, estado) VALUES ($1, $2)",
    [pkgRow.id, "En Almacén"]
  );

  return mapPackageRow(pkgRow);
};

/** Cambia el estado de un paquete y registra el cambio en historial_estados */
export const updatePackageStatus = async (id, estado, observacion = "") => {
  const { rows } = await query(
    "UPDATE paquetes SET estado_actual = $1 WHERE id = $2 RETURNING *",
    [estado, id]
  );
  await query(
    "INSERT INTO historial_estados (paquete_id, estado, observacion) VALUES ($1, $2, $3)",
    [id, estado, observacion]
  );
  return rows[0] ? mapPackageRow(rows[0]) : null;
};

/** Reprograma la entrega de un paquete: guarda nueva fecha/hora/dirección y cambia estado a "En Tránsito" */
export const updatePackageReprogramar = async (
  id,
  { fecha, horaInicio, horaFin, direccion }
) => {
  const updates = [
    "reprogramacion_fecha = $1",
    "reprogramacion_hora_inicio = $2",
    "reprogramacion_hora_fin = $3",
    "reprogramacion_direccion = $4",
    "estado_actual = $5"
  ];
  const params = [fecha, horaInicio, horaFin, direccion || null, "En Tránsito"];
  if (direccion && String(direccion).trim()) {
    updates.push("destino_texto = $6");
    params.push(direccion.trim());
  }
  params.push(id);
  const { rows } = await query(
    `UPDATE paquetes SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  await query(
    "INSERT INTO historial_estados (paquete_id, estado, observacion) VALUES ($1, $2, $3)",
    [id, "En Tránsito", "Reprogramado para entrega"]
  );
  return rows[0] ? mapPackageRow(rows[0]) : null;
};

/** Busca un paquete por código de seguimiento con todos los datos expandidos y su historial (para seguimiento público) */
export const getTrackingByCode = async (code) => {
  const { rows } = await query(
    `
    SELECT
      p.*,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.id ELSE r.id END as remitente_ref_id,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.nombre ELSE r.nombre END as remitente_nombre,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN NULL ELSE r.razon_social END as remitente_razon_social,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.documento ELSE NULL END as remitente_documento,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.telefono ELSE r.telefono END as remitente_telefono,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN rc.direccion ELSE r.direccion END as remitente_direccion,
      CASE WHEN p.tipo_envio = 'cliente_cliente' THEN 'Cliente' ELSE 'Distribuidora' END as remitente_tipo,
      d.id as destinatario_id, d.nombre as destinatario_nombre, d.documento as destinatario_documento,
      d.telefono as destinatario_telefono, d.email as destinatario_email, d.direccion as destinatario_direccion,
      u.id as operador_id, u.nombre as operador_nombre, u.telefono as operador_telefono, u.email as operador_email,
      ur.id as repartidor_id, ur.nombre as repartidor_nombre, ur.telefono as repartidor_telefono, ur.email as repartidor_email,
      so.id as suc_origen_id, so.nombre as suc_origen_nombre, so.direccion as suc_origen_direccion,
      sd.id as suc_destino_id, sd.nombre as suc_destino_nombre, sd.direccion as suc_destino_direccion
    FROM paquetes p
    LEFT JOIN distribuidoras r ON r.id = p.remitente_id
    LEFT JOIN clientes rc ON rc.id = p.remitente_cliente_id
    JOIN clientes d ON d.id = p.destinatario_id
    LEFT JOIN usuarios u ON u.id = p.operador_id
    LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
    JOIN sucursales so ON so.id = p.sucursal_origen_id
    LEFT JOIN sucursales sd ON sd.id = p.sucursal_destino_id
    WHERE p.codigo_seguimiento = $1
    `,
    [code]
  );

  if (!rows[0]) return null;
  const pkg = mapPackageDetailsRow(rows[0]);
  const history = await query(
    "SELECT estado, fecha_hora, observacion FROM historial_estados WHERE paquete_id = $1 ORDER BY fecha_hora ASC",
    [pkg.id]
  );
  return {
    id: pkg.id,
    codigoSeguimiento: pkg.codigoSeguimiento,
    estadoActual: pkg.estadoActual,
    descripcion: pkg.descripcion,
    destinoTexto: pkg.destinoTexto || "",
    tipoEnvio: pkg.tipoEnvio,
    remitenteTipo: pkg.remitenteTipo,
    remitente: pkg.remitente,
    destinatario: pkg.destinatario,
    operador: pkg.operador,
    repartidor: pkg.repartidor,
    sucursalOrigen: pkg.sucursalOrigen,
    sucursalDestino: pkg.sucursalDestino,
    reprogramacionFecha: pkg.reprogramacionFecha,
    reprogramacionHoraInicio: pkg.reprogramacionHoraInicio,
    reprogramacionHoraFin: pkg.reprogramacionHoraFin,
    reprogramacionDireccion: pkg.reprogramacionDireccion,
    historial: history.rows.map((row) => ({
      estado: row.estado,
      fechaHora: toIsoUtc(row.fecha_hora),
      observacion: row.observacion
    }))
  };
};

/** Lista todas las distribuidoras registradas */
export const listDistributors = async () => {
  const { rows } = await query("SELECT * FROM distribuidoras ORDER BY id DESC");
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    razonSocial: row.razon_social,
    telefono: row.telefono,
    direccion: row.direccion,
    creadoEn: row.creado_en
  }));
};

export const createDistributor = async (data) => {
  const { rows } = await query(
    `INSERT INTO distribuidoras (nombre, razon_social, telefono, direccion)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.nombre || "Distribuidora",
      data.razonSocial || "",
      data.telefono || "",
      data.direccion || ""
    ]
  );
  const row = rows[0];
  return {
    id: row.id,
    nombre: row.nombre,
    razonSocial: row.razon_social,
    telefono: row.telefono,
    direccion: row.direccion,
    creadoEn: row.creado_en
  };
};

/** Retorna la lista de estados posibles de un paquete */
export const listStatuses = () => statuses;
