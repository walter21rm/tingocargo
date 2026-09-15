/**
 * AdminClients.jsx — Lista de clientes
 * Muestra todos los clientes registrados en el sistema con sus datos de contacto.
 * Permite buscar y navegar al detalle o formulario de nuevo cliente.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listClients } from "../services/api.js";

const emptyForm = {
  tipo: "persona",
  nombre: "",
  documento: "",
  telefono: "",
  email: "",
  direccion: ""
};

const AdminClients = () => {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await listClients();
      setClients(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los clientes.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleNew = () => {
    navigate("/admin/clientes/nuevo");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500">Gestión de clientes</p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          className="rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
        >
          + Nuevo cliente
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => (
          <div
            key={client.id}
            className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2a7 7 0 0 0-4 12.7V22l4-3 4 3v-7.3A7 7 0 0 0 12 2z" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-slate-900">{client.nombre}</p>
                <p className="text-sm text-slate-500">{client.direccion}</p>
                <p className="mt-3 text-sm text-brand-700">{client.telefono}</p>
              </div>
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-slate-500">
            Sin clientes registrados.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminClients;
