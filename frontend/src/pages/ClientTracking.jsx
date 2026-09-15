/**
 * ClientTracking.jsx — Buscador de paquetes por código
 * Permite a los clientes autenticados buscar y consultar el estado
 * de sus envíos mediante el código de rastreo.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { getTracking } from "../services/api.js";
import Timeline from "../components/Timeline.jsx";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
    hour12: true
  }).format(date);
};

const statusTone = (status) => {
  if (status === "Entregado") return "bg-brand-50 text-brand-700";
  if (status === "En Tránsito") return "bg-accent-50 text-accent-500";
  return "bg-slate-100 text-slate-600";
};

const ClientTracking = () => {
  const [code, setCode] = useState("");
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setTracking(null);
    if (!code.trim()) return;
    setLoading(true);
    try {
      const data = await getTracking(code.trim());
      setTracking(data);
    } catch (err) {
      setError(err.message || "Código no encontrado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Rastrear paquete</h1>
      <p className="mt-1 text-slate-600">
        Ingresa el código de seguimiento para ver el estado de tu envío
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: TM-2026-1234"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Buscando..." : "Rastrear"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {tracking && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xl font-bold text-slate-900">
                  {tracking.codigoSeguimiento}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {tracking.descripcion || "Sin descripción"}
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-1 text-sm font-semibold ${statusTone(
                  tracking.estadoActual
                )}`}
              >
                {tracking.estadoActual}
              </span>
            </div>
            <h3 className="mt-6 text-sm font-semibold text-slate-700">
              Destinatario
            </h3>
            <p className="mt-1 text-slate-800">
              {tracking.destinatario?.nombre || "—"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {tracking.destinoTexto || tracking.destinatario?.direccion || ""}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Timeline items={tracking.historial || []} title="Línea de tiempo" />
          </div>

          <div className="text-center">
            <Link
              to="/cliente/envios"
              className="inline-block rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600"
            >
              Ver mis envíos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientTracking;
