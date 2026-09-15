/**
 * AdminBranches.jsx — Lista de sucursales
 * Muestra todas las sucursales con su distribuidora asociada.
 * Permite navegar al formulario para crear nuevas sucursales.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBranches } from "../services/api.js";

const AdminBranches = () => {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await listBranches();
      setBranches(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las sucursales.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sucursales</h1>
          <p className="text-slate-500">Gestión de sucursales</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/sucursales/nuevo")}
          className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
        >
          + Nueva sucursal
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h18v18H3z" />
                  <path d="M7 7h3v3H7z" />
                  <path d="M14 7h3v3h-3z" />
                  <path d="M7 14h3v3H7z" />
                  <path d="M14 14h3v3h-3z" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-slate-900">{branch.nombre}</p>
                <p className="text-sm text-slate-500">{branch.direccion}</p>
              </div>
            </div>
          </div>
        ))}
        {branches.length === 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-slate-500">
            Sin sucursales registradas.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBranches;
