/**
 * AdminDistributors.jsx — Lista de distribuidoras
 * Muestra todas las distribuidoras registradas en el sistema.
 * Permite navegar al formulario para crear nuevas distribuidoras.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, listDistributors } from "../services/api.js";

const AdminDistributors = () => {
  const navigate = useNavigate();
  const user = getUser();
  const isAdmin = user?.roleName === "Administrador";
  const [distributors, setDistributors] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await listDistributors();
      setDistributors(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las distribuidoras.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Distribuidoras</h1>
          <p className="text-slate-500">Gestión de empresas distribuidoras</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate("/admin/distribuidoras/nuevo")}
            className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
          >
            + Nueva distribuidora
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {distributors.map((distributor) => (
          <div
            key={distributor.id}
            className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h10v16H4z" />
                  <path d="M8 4v16" />
                  <path d="M18 8h2l2 2v8h-4z" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-slate-900">{distributor.nombre}</p>
                <p className="text-sm text-slate-500">{distributor.razonSocial}</p>
                <p className="mt-3 text-sm text-brand-700">{distributor.telefono}</p>
              </div>
            </div>
          </div>
        ))}
        {distributors.length === 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-slate-500">
            Sin distribuidoras registradas.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDistributors;
