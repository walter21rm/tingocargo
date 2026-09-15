/**
 * AdminBranchNew.jsx — Formulario de creación de sucursales
 * Permite crear nuevas sucursales asociadas a una distribuidora.
 * Incluye nombre, dirección y datos de contacto de la sucursal.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBranch } from "../services/api.js";

const emptyForm = {
  nombre: "",
  direccion: ""
};

const AdminBranchNew = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    navigate("/admin/sucursales");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const nextErrors = {};
    if (!form.nombre.trim() || !form.direccion.trim()) {
      if (!form.nombre.trim()) nextErrors.nombre = "El nombre es obligatorio.";
      if (!form.direccion.trim()) nextErrors.direccion = "La direccion es obligatoria.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Revisa los campos marcados.");
      return;
    }
    setLoading(true);
    try {
      await createBranch({
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim()
      });
      setSuccess("Sucursal creada con exito.");
      setTimeout(() => {
        navigate("/admin/sucursales");
      }, 900);
    } catch (err) {
      setError(err.message || "No se pudo registrar la sucursal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-8 shadow-sm">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Registrar sucursal
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Completa la información de la sucursal
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <label className="text-sm text-slate-600">
          Nombre *
          <input
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
              fieldErrors.nombre ? "border-red-300" : "border-slate-200"
            }`}
            placeholder="Sucursal Tingo María"
            required
          />
          {fieldErrors.nombre && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.nombre}</span>
          )}
        </label>
        <label className="text-sm text-slate-600">
          Direccion *
          <input
            name="direccion"
            value={form.direccion}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
              fieldErrors.direccion ? "border-red-300" : "border-slate-200"
            }`}
            placeholder="Av. Principal 123"
            required
          />
          {fieldErrors.direccion && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.direccion}</span>
          )}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-brand-600 px-8 py-3 text-sm font-semibold text-white"
          >
            {loading ? "Guardando..." : "Guardar sucursal"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}
    </div>
  );
};

export default AdminBranchNew;
