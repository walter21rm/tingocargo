/**
 * ClientPackages.jsx — Lista de envíos del cliente
 * Muestra el listado de paquetes del cliente con estado, fechas y
 * enlaces al detalle de cada envío.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listClientPackages } from "../services/api.js";

const statusTone = (status) => {
  if (status === "Entregado") return "bg-brand-50 text-brand-700";
  if (status === "En Tránsito") return "bg-accent-50 text-accent-500";
  return "bg-slate-100 text-slate-600";
};

const ClientPackages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await listClientPackages();
      setPackages(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los envíos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="text-slate-500">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Mis envíos</h1>
      <p className="text-slate-600">
        Paquetes que enviaste o que recibirás. Puedes rastrear y pagar desde aquí.
      </p>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {packages.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">No tienes envíos aún.</p>
          <Link
            to="/cliente/enviar"
            className="mt-4 inline-block rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white"
          >
            Enviar mi primer paquete
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg) => (
            <Link
              key={pkg.id}
              to={`/cliente/envios/${pkg.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono font-semibold text-slate-900">
                    {pkg.codigoSeguimiento}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {pkg.descripcion || "Sin descripción"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Destinatario: {pkg.destinatario?.nombre || "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Peso: {pkg.pesoKg || 0} kg • Precio: {pkg.precioEnvio || 0} soles
                    {pkg.quienPaga === "remitente" && !pkg.pagado && (
                      <span className="ml-2 text-amber-600">• Pendiente de pago</span>
                    )}
                    {pkg.quienPaga === "destinatario" && (
                      <span className="ml-2 text-slate-500">• Paga al recibir</span>
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full px-4 py-1 text-sm font-semibold ${statusTone(
                    pkg.estadoActual
                  )}`}
                >
                  {pkg.estadoActual}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientPackages;
