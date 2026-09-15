/**
 * AdminDashboard.jsx — Dashboard principal del panel
 * Muestra estadísticas con gradientes, tabla de paquetes recientes mejorada
 * y un resumen visual de operaciones.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard.jsx";
import { listPackages } from "../services/api.js";

const isToday = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const statusConfig = {
  "Entregado": {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500"
  },
  "En Tránsito": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500"
  },
  "En Almacén": {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500"
  }
};

const getStatusStyle = (status) =>
  statusConfig[status] || { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" };

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    ingresados: 0,
    almacen: 0,
    transito: 0,
    entregado: 0,
    entregadosHoy: 0
  });
  const [latest, setLatest] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listPackages();
        const ingresados = data.filter((p) => isToday(p.creadoEn)).length;
        const almacen = data.filter((p) => p.estadoActual === "En Almacén").length;
        const transito = data.filter((p) => p.estadoActual === "En Tránsito").length;
        const entregado = data.filter((p) => p.estadoActual === "Entregado").length;
        const entregadosHoy = data.filter(
          (p) => p.estadoActual === "Entregado" && isToday(p.creadoEn)
        ).length;
        setStats({ ingresados, almacen, transito, entregado, entregadosHoy });
        setLatest(data.slice(0, 5));
      } catch (err) {
        setError(err.message || "No se pudieron cargar los paquetes.");
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="mt-1 text-slate-500">Resumen de operaciones del día</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/paquetes/nuevo")}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo Paquete
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ingresados Hoy"
          value={stats.ingresados}
          tone="brand"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          }
        />
        <StatCard
          label="En Almacén"
          value={stats.almacen}
          tone="warning"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
            </svg>
          }
        />
        <StatCard
          label="En Tránsito"
          value={stats.transito}
          tone="accent"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 7h11v10H3z" />
              <path d="M14 10h4l3 3v4h-7z" />
              <circle cx="7" cy="19" r="1.5" />
              <circle cx="18" cy="19" r="1.5" />
            </svg>
          }
        />
        <StatCard
          label="Entregados Hoy"
          value={stats.entregadosHoy}
          tone="brand"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12l2.5 2.5L16 9" />
            </svg>
          }
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      )}

      {/* Tabla recientes */}
      <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Paquetes Recientes</h2>
            <p className="text-sm text-slate-500">Últimos envíos registrados</p>
          </div>
          <Link
            to="/admin/paquetes"
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50"
          >
            Ver todos
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {latest.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-400">Sin registros aún</p>
              <p className="mt-1 text-xs text-slate-300">Los paquetes aparecerán aquí</p>
            </div>
          )}
          {latest.map((pkg) => {
            const st = getStatusStyle(pkg.estadoActual);
            return (
              <div
                key={pkg.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 px-5 py-4 transition-all hover:shadow-card hover:border-slate-200 cursor-pointer"
                onClick={() => navigate(`/admin/paquetes/${pkg.id}`)}
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">{pkg.codigoSeguimiento}</p>
                    <p className="text-xs text-slate-400">{pkg.destinatario?.nombre || "Cliente"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1.5 rounded-full ${st.bg} px-3 py-1 text-xs font-semibold ${st.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {pkg.estadoActual}
                  </span>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
