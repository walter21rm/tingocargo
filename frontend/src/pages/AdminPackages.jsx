/**
 * AdminPackages.jsx — Lista de paquetes
 * Muestra todos los paquetes con filtros por estado (pendiente, en tránsito, entregado).
 * Permite descargar reportes de los paquetes filtrados.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  downloadPackagesReport,
  getUser,
  listClients,
  listCourierPackages,
  listPackages,
  listStatuses
} from "../services/api.js";

const AdminPackages = () => {
  const [packages, setPackages] = useState([]);
  const [clients, setClients] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [filter, setFilter] = useState("Todos");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [reportFormat, setReportFormat] = useState("csv");
  const navigate = useNavigate();
  const user = getUser();
  const isAdmin = user?.roleName === "Administrador";
  const isCourier = user?.roleName === "Repartidor";

  const load = async () => {
    try {
      const [packagesData, clientsData, statusesData] = await Promise.all([
        isCourier ? listCourierPackages() : listPackages(),
        listClients(),
        listStatuses()
      ]);
      setPackages(packagesData);
      setClients(clientsData);
      setStatuses(statusesData);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los datos.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleNew = () => {
    navigate("/admin/paquetes/nuevo");
  };

  const handleDownload = async () => {
    setError("");
    setDownloading(true);
    try {
      const { blob, filename } = await downloadPackagesReport(reportFormat);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        filename ||
        `reporte-paquetes-${new Date().toISOString().slice(0, 10)}.${
          reportFormat === "xlsx" ? "xlsx" : "csv"
        }`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "No se pudo descargar el reporte.");
    } finally {
      setDownloading(false);
    }
  };

  const clientMap = useMemo(() => {
    return Object.fromEntries(clients.map((c) => [c.id, c.nombre]));
  }, [clients]);

  const filteredPackages =
    filter === "Todos"
      ? packages
      : packages.filter((pkg) => pkg.estadoActual === filter);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isCourier ? "Mis entregas" : "Paquetes"}
          </h1>
          <p className="text-slate-500">
            {isCourier
              ? "Paquetes asignados para entrega"
              : "Gestión de todos los paquetes"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600"
          >
            <option value="Todos">Todos</option>
            {(isCourier
              ? ["En Tránsito", "Entregado", "Intento fallido"]
              : statuses
            ).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <select
                value={reportFormat}
                onChange={(event) => setReportFormat(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (.xlsx)</option>
              </select>
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                disabled={downloading}
              >
                {downloading ? "Descargando..." : "Descargar reporte"}
              </button>
            </div>
          )}
          {!isCourier && (
            <button
              type="button"
              onClick={handleNew}
              className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
            >
              + Nuevo
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Listado</h2>
        <div className="mt-4 space-y-4">
          {filteredPackages.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => navigate(`/admin/paquetes/${pkg.id}`)}
              className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-slate-100 bg-white/70 px-4 py-4 sm:px-5 sm:py-5 text-left shadow-sm hover:bg-white"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7l9-4 9 4-9 4-9-4z" />
                    <path d="M3 7v10l9 4 9-4V7" />
                  </svg>
                </span>
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {pkg.codigoSeguimiento}
                  </p>
                  <p className="text-sm text-slate-500">
                    {pkg.destinatario?.nombre || clientMap[pkg.destinatarioId]}
                  </p>
                  <p className="text-xs text-slate-400">
                    Remitente ({pkg.remitenteTipo || "Distribuidora"}):{" "}
                    {pkg.remitente?.nombre || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {pkg.reprogramacionFecha && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Reprogramado
                  </span>
                )}
                <span className="rounded-full bg-brand-50 px-4 py-1 text-xs font-semibold text-brand-700">
                  {pkg.estadoActual}
                </span>
              </div>
            </button>
          ))}
          {filteredPackages.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">
              Sin paquetes registrados.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
};

export default AdminPackages;
