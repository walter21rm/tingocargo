/**
 * ============================================================
 * api.js — Servicio de comunicación con el backend
 * ============================================================
 * Centraliza TODAS las llamadas HTTP al backend.
 * Ningún componente del frontend usa fetch() directamente;
 * todos importan funciones de este archivo.
 *
 * Funcionalidades:
 *   - Gestión de sesión (token y datos de usuario en localStorage)
 *   - Función apiFetch() que adjunta automáticamente el token
 *   - Funciones exportadas para cada endpoint de la API
 * ============================================================
 */

/** URL base del backend. Configurable con VITE_API_BASE en producción */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/** Claves de localStorage para persistir la sesión entre recargas */
const TOKEN_KEY = "adminToken";
const USER_KEY = "adminUser";

/* ── Gestión de sesión en localStorage ────────────────────── */

export const getToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const getUser = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setUser = (user) => {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(USER_KEY);
    return;
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
};

/**
 * Función base para todas las llamadas a la API.
 * Adjunta automáticamente el header Authorization con el token.
 * Si la respuesta no es OK, lanza un Error con el mensaje del backend.
 */
const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const message = await response.json().catch(() => null);
    throw new Error(message?.error || "Error al comunicarse con la API");
  }
  return response.json();
};

/* ── Configuración pública (parametrización de negocio) ──── */

let _configCache = null;

/** Obtiene la parametrización pública del sistema (tarifas, estados, métodos de pago, países). Se cachea tras la primera llamada. */
export const getPublicConfig = async () => {
  if (_configCache) return _configCache;
  _configCache = await apiFetch("/api/config/public");
  return _configCache;
};

/* ── Seguimiento público ──────────────────────────────────── */

export const getTracking = (code) => apiFetch(`/api/tracking/${code}`);

export const reprogramarTracking = (code, payload) =>
  apiFetch(`/api/tracking/${code}/reprogramar`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const getHealth = () => apiFetch("/api/health");
export const getActivityLog = (limit = 200) =>
  apiFetch(`/api/activity-log?limit=${limit}`);

/* ── Autenticación ────────────────────────────────────────── */

export const login = (payload) =>
  apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const register = (payload) =>
  apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });

/* ── Portal del cliente ───────────────────────────────────── */

export const listClientPackages = () => apiFetch("/api/client/me/packages");

export const createClientPackage = (payload) =>
  apiFetch("/api/client/packages", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const payClientPackage = (id, metodoPago) =>
  apiFetch(`/api/client/packages/${id}/pagar`, {
    method: "PATCH",
    body: JSON.stringify({ metodoPago: metodoPago || null })
  });

export const prepareCulqiPayment = (id, metodoPago) =>
  apiFetch(`/api/packages/${id}/pagos/preparar`, {
    method: "POST",
    body: JSON.stringify({ metodoPago })
  });

export const confirmCulqiPayment = (id, payload) =>
  apiFetch(`/api/packages/${id}/pagos/confirmar`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

/* ── Gestión de paquetes (panel admin) ────────────────────── */

export const updatePackagePrecio = (id, precioEnvio) =>
  apiFetch(`/api/packages/${id}/precio`, {
    method: "PATCH",
    body: JSON.stringify({ precioEnvio })
  });

export const updatePackageOperador = (id, operadorId) =>
  apiFetch(`/api/packages/${id}/operador`, {
    method: "PATCH",
    body: JSON.stringify({ operadorId: operadorId || null })
  });

export const updatePackageRepartidor = (id, repartidorId) =>
  apiFetch(`/api/packages/${id}/repartidor`, {
    method: "PATCH",
    body: JSON.stringify({ repartidorId: repartidorId || null })
  });

export const registrarPagoDestino = (id, metodoPago = "efectivo") =>
  apiFetch(`/api/packages/${id}/registrar-pago-destino`, {
    method: "PATCH",
    body: JSON.stringify({ metodoPago })
  });

/* ── Clientes y DNI ───────────────────────────────────────── */

export const listClients = () => apiFetch("/api/clients");
export const getDniData = (dni) => apiFetch(`/api/dni/${dni}`);
export const createClient = (payload) =>
  apiFetch("/api/clients", {
    method: "POST",
    body: JSON.stringify(payload)
  });

/* ── Paquetes ─────────────────────────────────────────────── */

export const listPackages = () => apiFetch("/api/packages/expanded");
export const listCourierPackages = () => apiFetch("/api/couriers/me/packages");
export const getPackageById = (id) => apiFetch(`/api/packages/${id}`);
export const createPackage = (payload) =>
  apiFetch("/api/packages", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const updatePackageStatus = (id, payload) =>
  apiFetch(`/api/packages/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const reprogramarPackage = (id, payload) =>
  apiFetch(`/api/packages/${id}/reprogramar`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const getOperatorPhone = () => apiFetch("/api/operators/phone");
export const listOperators = () => apiFetch("/api/operators");
export const listCouriers = () => apiFetch("/api/couriers");

/* ── Usuarios (solo Administrador) ────────────────────────── */

export const listUsers = () => apiFetch("/api/users");
export const getUserById = (id) => apiFetch(`/api/users/${id}`);
export const createUser = (payload) =>
  apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const updateUser = (id, payload) =>
  apiFetch(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
export const deleteUser = (id) =>
  apiFetch(`/api/users/${id}`, {
    method: "DELETE"
  });

/* ── Catálogos (roles, sucursales, estados, distribuidoras) ── */

export const listRoles = () => apiFetch("/api/roles");
export const listBranches = () => apiFetch("/api/branches");
export const listStatuses = () => apiFetch("/api/statuses");
export const createBranch = (payload) =>
  apiFetch("/api/branches", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const listDistributors = () => apiFetch("/api/distributors");
export const createDistributor = (payload) =>
  apiFetch("/api/distributors", {
    method: "POST",
    body: JSON.stringify(payload)
  });

/* ── Reportes ─────────────────────────────────────────────── */

/** Descarga reporte de paquetes en CSV o XLSX. Retorna { blob, filename }. */
export const downloadPackagesReport = async (format = "csv") => {
  const token = getToken();
  const response = await fetch(
    `${API_BASE}/api/reports/packages?format=${format}`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }
  );
  if (!response.ok) {
    const message = await response.json().catch(() => null);
    throw new Error(message?.error || "No se pudo generar el reporte");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="(.+)"/);
  return {
    blob,
    filename: match?.[1]
  };
};
