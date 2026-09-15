/**
 * AdminActivityLog.jsx — SE3: Registro de actividad del sistema
 * Muestra el historial de acciones (logins, cambios de estado, pagos, etc.)
 * Solo visible para administradores.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActivityLog } from "../services/api.js";

const actionLabels = {
  login: { label: "Inicio de sesión", color: "bg-blue-50 text-blue-700" },
  login_failed: { label: "Login fallido", color: "bg-red-50 text-red-700" },
  login_blocked: { label: "Cuenta bloqueada", color: "bg-red-100 text-red-800" },
  create: { label: "Creación", color: "bg-emerald-50 text-emerald-700" },
  status_change: { label: "Cambio de estado", color: "bg-amber-50 text-amber-700" },
  payment: { label: "Pago registrado", color: "bg-purple-50 text-purple-700" },
  delete: { label: "Eliminación", color: "bg-red-50 text-red-600" },
  update: { label: "Actualización", color: "bg-sky-50 text-sky-700" }
};

const formatDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Lima",
    hour12: true
  }).format(d);
};

const AdminActivityLog = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getActivityLog(200)
      .then(setLogs)
      .catch((err) => setError(err.message || "No se pudo cargar el registro"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.action === filter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Registro de Actividad
          </h1>
          <p className="mt-1 text-slate-500">
            Historial de acciones del sistema (SE3 — Trazabilidad)
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Volver al dashboard
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "Todos" },
          { id: "login", label: "Logins" },
          { id: "login_failed", label: "Fallos" },
          { id: "create", label: "Creaciones" },
          { id: "status_change", label: "Cambios estado" },
          { id: "payment", label: "Pagos" },
          { id: "delete", label: "Eliminaciones" }
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.id
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-400">Sin registros de actividad</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card ring-1 ring-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Acción</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Recurso</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((log) => {
                  const cfg = actionLabels[log.action] || { label: log.action, color: "bg-slate-50 text-slate-600" };
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(log.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{log.userName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{log.resource}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{log.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminActivityLog;
