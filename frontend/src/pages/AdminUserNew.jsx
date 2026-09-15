/**
 * AdminUserNew.jsx — Formulario de creación de usuarios
 * Permite crear usuarios con rol, sucursal y datos de contacto.
 * Incluye campos adicionales para repartidores (sucursal asignada, etc.).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUser, getDniData, listBranches, listRoles } from "../services/api.js";
import PhoneField from "../components/PhoneField.jsx";
import {
  buildPhoneValue,
  DEFAULT_PHONE_COUNTRY,
  onlyDigits
} from "../utils/phone.js";

const emptyForm = {
  documento: "",
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
};

const AdminUserNew = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [dniLoading, setDniLoading] = useState(false);
  const [dniError, setDniError] = useState("");
  const lastDniRef = useRef("");

  useEffect(() => {
    const load = async () => {
      try {
        const [rolesData, branchesData] = await Promise.all([
          listRoles(),
          listBranches()
        ]);
        setRoles(rolesData);
        setBranches(branchesData);
      } catch (err) {
        setError(err.message || "No se pudieron cargar los datos.");
      }
    };
    load();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    if (name === "documento") setDniError("");
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "telefonoNumero" || name === "documento"
            ? onlyDigits(value)
            : value
    }));
  };

  const handleDocumentoKeyDown = (event) => {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"];
    if (allowed.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) event.preventDefault();
  };

  useEffect(() => {
    const dni = onlyDigits(form.documento);
    if (dni.length < 8) {
      lastDniRef.current = "";
      return;
    }
    if (dni === lastDniRef.current) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setDniLoading(true);
      setDniError("");
      try {
        const result = await getDniData(dni);
        if (cancelled) return;
        const fullName =
          String(result.nombreCompleto || "").trim() ||
          [
            String(result.nombres || "").trim(),
            String(result.apellidoPaterno || "").trim(),
            String(result.apellidoMaterno || "").trim()
          ]
            .filter(Boolean)
            .join(" ");
        if (fullName) {
          setForm((prev) => ({ ...prev, documento: dni, nombre: fullName }));
        }
      } catch (err) {
        if (!cancelled) {
          setDniError(err.message || "No se pudo consultar DNI. Completa manualmente.");
        }
      } finally {
        if (!cancelled) {
          lastDniRef.current = dni;
          setDniLoading(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.documento]);

  const handleCancel = () => {
    navigate("/admin/usuarios");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const nextErrors = {};
    if (
      !form.nombre.trim() ||
      !form.email.trim() ||
      !form.password.trim() ||
      !form.rolId ||
      !form.sucursalId
    ) {
      if (!form.nombre.trim()) nextErrors.nombre = "El nombre es obligatorio.";
      if (!form.email.trim()) nextErrors.email = "El email es obligatorio.";
      if (!form.password.trim()) nextErrors.password = "La contraseña es obligatoria.";
      if (!form.rolId) nextErrors.rolId = "Selecciona un rol.";
      if (!form.sucursalId) nextErrors.sucursalId = "Selecciona una sucursal.";
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Ingresa un email valido.";
    }
    if (form.password.trim().length < 6) {
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
        ...form,
        telefonoPais: form.telefonoPais,
        telefonoNumero: phone.local,
        telefono: phone.e164
      };
      if (roles.find((r) => String(r.id) === String(form.rolId))?.nombre === "Repartidor") {
        payload.placa = form.placa?.trim() || null;
        payload.vehiculo = form.vehiculo?.trim() || null;
      }
      await createUser(payload);
      setSuccess("Usuario creado con exito.");
      setTimeout(() => {
        navigate("/admin/usuarios");
      }, 900);
    } catch (err) {
      setError(err.message || "No se pudo registrar el usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Registrar usuario
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Completa la información del usuario
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-600">
          DNI (opcional)
          <input
            name="documento"
            value={form.documento}
            onChange={handleChange}
            onKeyDown={handleDocumentoKeyDown}
            inputMode="numeric"
            maxLength={8}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="8 dígitos para autollenar nombre"
            autoComplete="off"
          />
          {dniLoading && (
            <span className="mt-1 block text-xs text-brand-700">Consultando DNI...</span>
          )}
          {dniError && (
            <span className="mt-1 block text-xs text-amber-700">{dniError}</span>
          )}
        </label>
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
          Contraseña *
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-sm ${
              fieldErrors.password ? "border-red-300" : "border-slate-200"
            }`}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            required
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
            {loading ? "Guardando..." : "Guardar usuario"}
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

export default AdminUserNew;
