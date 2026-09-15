/**
 * AdminUserEdit.jsx — Formulario de edición de usuarios
 * Permite modificar los datos de un usuario existente (rol, sucursal, contacto).
 * Carga los datos actuales y los actualiza en la API al guardar.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getUserById,
  listBranches,
  listRoles,
  updateUser
} from "../services/api.js";
import PhoneField from "../components/PhoneField.jsx";
import {
  buildPhoneValue,
  DEFAULT_PHONE_COUNTRY,
  onlyDigits,
  splitPhoneValue
} from "../utils/phone.js";

const AdminUserEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefonoPais: DEFAULT_PHONE_COUNTRY,
    telefonoNumero: "",
    password: "",
    rolId: "",
    sucursalId: "",
    activo: true,
    placa: "",
    vehiculo: ""
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [userData, rolesData, branchesData] = await Promise.all([
          getUserById(id),
          listRoles(),
          listBranches()
        ]);
        setRoles(rolesData);
        setBranches(branchesData);
        setForm((prev) => ({
          ...prev,
          nombre: userData.nombre || "",
          email: userData.email || "",
          ...splitPhoneValue(userData.telefono || ""),
          rolId: userData.rolId || "",
          sucursalId: userData.sucursalId || "",
          activo: userData.activo ?? true,
          placa: userData.placa || "",
          vehiculo: userData.vehiculo || ""
        }));
      } catch (err) {
        setError(err.message || "No se pudo cargar el usuario.");
      }
    };
    load();
  }, [id]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "telefonoNumero"
            ? onlyDigits(value)
            : value
    }));
  };

  const handleCancel = () => {
    navigate("/admin/usuarios");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const nextErrors = {};
    if (
      !form.nombre.trim() ||
      !form.email.trim() ||
      !form.rolId ||
      !form.sucursalId
    ) {
      if (!form.nombre.trim()) nextErrors.nombre = "El nombre es obligatorio.";
      if (!form.email.trim()) nextErrors.email = "El email es obligatorio.";
      if (!form.rolId) nextErrors.rolId = "Selecciona un rol.";
      if (!form.sucursalId) nextErrors.sucursalId = "Selecciona una sucursal.";
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Ingresa un email valido.";
    }
    if (form.password && form.password.trim().length < 6) {
      nextErrors.password = "La contraseña debe tener al menos 6 caracteres.";
    }
    const phone = buildPhoneValue(form.telefonoPais, form.telefonoNumero);
    if (!phone.ok) nextErrors.telefonoNumero = phone.error;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Revisa los campos marcados.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        telefonoPais: form.telefonoPais,
        telefonoNumero: phone.local,
        telefono: phone.e164,
        rolId: form.rolId,
        sucursalId: form.sucursalId,
        activo: form.activo
      };
      if (form.password) {
        payload.password = form.password;
      }
      if (roles.find((r) => String(r.id) === String(form.rolId))?.nombre === "Repartidor") {
        payload.placa = form.placa?.trim() || null;
        payload.vehiculo = form.vehiculo?.trim() || null;
      }
      await updateUser(id, payload);
      navigate("/admin/usuarios");
    } catch (err) {
      setError(err.message || "No se pudo actualizar el usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-8 shadow-sm">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Editar usuario
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Actualiza la información del usuario
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-600">
          Nombre *
          <input
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
              fieldErrors.nombre ? "border-red-300" : "border-slate-200"
            }`}
            placeholder="Nombre completo"
            autoComplete="off"
            required
          />
          {fieldErrors.nombre && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.nombre}</span>
          )}
        </label>
        <label className="text-sm text-slate-600">
          Email *
          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm ${
              fieldErrors.email ? "border-red-300" : "border-slate-200"
            }`}
            placeholder="correo@empresa.com"
            autoComplete="new-email"
            required
          />
          {fieldErrors.email && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.email}</span>
          )}
        </label>
        <PhoneField
          countryValue={form.telefonoPais}
          numberValue={form.telefonoNumero}
          onChange={handleChange}
          error={fieldErrors.telefonoNumero}
        />
        <label className="text-sm text-slate-600">
          Nueva contraseña (opcional)
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm ${
              fieldErrors.password ? "border-red-300" : "border-slate-200"
            }`}
            placeholder="Deja en blanco para mantener"
            autoComplete="new-password"
          />
          {fieldErrors.password && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.password}</span>
          )}
        </label>
        <label className="text-sm text-slate-600">
          Rol *
          <select
            name="rolId"
            value={form.rolId}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
              fieldErrors.rolId ? "border-red-300" : "border-slate-200"
            }`}
            required
          >
            <option value="">Seleccionar rol</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.nombre}
              </option>
            ))}
          </select>
          {fieldErrors.rolId && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.rolId}</span>
          )}
        </label>
        <label className="text-sm text-slate-600">
          Sucursal *
          <select
            name="sucursalId"
            value={form.sucursalId}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
              fieldErrors.sucursalId ? "border-red-300" : "border-slate-200"
            }`}
            required
          >
            <option value="">Seleccionar sucursal</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.nombre}
              </option>
            ))}
          </select>
          {fieldErrors.sucursalId && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.sucursalId}</span>
          )}
        </label>
        {roles.find((r) => String(r.id) === String(form.rolId))?.nombre === "Repartidor" && (
          <>
            <label className="text-sm text-slate-600">
              Placa
              <input
                name="placa"
                value={form.placa}
                onChange={handleChange}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="Ej: ABC-123"
                autoComplete="off"
              />
            </label>
            <label className="text-sm text-slate-600">
              Vehículo
              <input
                name="vehiculo"
                value={form.vehiculo}
                onChange={handleChange}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="Ej: Moto Honda 125, Camioneta Toyota Hilux"
                autoComplete="off"
              />
            </label>
          </>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="activo"
            checked={form.activo}
            onChange={handleChange}
            className="h-4 w-4"
          />
          Usuario activo
        </label>
        <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-between">
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
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
};

export default AdminUserEdit;
