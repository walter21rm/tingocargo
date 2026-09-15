/**
 * AdminClientNew.jsx — Formulario de registro de clientes
 * Permite crear nuevos clientes con DNI, nombre, teléfono y dirección.
 * Incluye consulta de datos por DNI y validación de campos.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient, getDniData } from "../services/api.js";
import PhoneField from "../components/PhoneField.jsx";
import { buildPhoneValue, DEFAULT_PHONE_COUNTRY, onlyDigits } from "../utils/phone.js";

const emptyForm = {
  tipo: "persona",
  nombre: "",
  nombres: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  documento: "",
  telefonoPais: DEFAULT_PHONE_COUNTRY,
  telefonoNumero: "",
  email: "",
  direccion: ""
};

const AdminClientNew = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [dniLoading, setDniLoading] = useState(false);
  const [dniLookupError, setDniLookupError] = useState("");
  const lastDniQueriedRef = useRef("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue =
      name === "telefonoNumero"
        ? onlyDigits(value)
        : name === "documento"
          ? onlyDigits(value)
          : value;
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setForm((prev) => {
      const next = { ...prev, [name]: nextValue };
      if (name === "tipo") {
        setDniLookupError("");
        if (nextValue !== "persona") {
          lastDniQueriedRef.current = "";
          next.documento = "";
          next.nombres = "";
          next.apellidoPaterno = "";
          next.apellidoMaterno = "";
        }
      }
      if (name === "documento") {
        setDniLookupError("");
        if (nextValue.length < 8) {
          lastDniQueriedRef.current = "";
          next.nombres = "";
          next.apellidoPaterno = "";
          next.apellidoMaterno = "";
          if (!next.nombre.includes(" ")) next.nombre = "";
        }
      }
      if (
        name === "nombres" ||
        name === "apellidoPaterno" ||
        name === "apellidoMaterno"
      ) {
        next.nombre = [next.nombres, next.apellidoPaterno, next.apellidoMaterno]
          .filter(Boolean)
          .join(" ")
          .trim();
      }
      return next;
    });
  };

  const handleCancel = () => {
    navigate("/admin/clientes");
  };

  const handleDocumentoKeyDown = (event) => {
    if (form.tipo !== "persona") return;
    const allowed = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End"
    ];
    if (allowed.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    if (form.tipo !== "persona") return;
    const dni = onlyDigits(form.documento);
    if (dni.length !== 8 || dni === lastDniQueriedRef.current) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setDniLoading(true);
      setDniLookupError("");
      try {
        const result = await getDniData(dni);
        if (cancelled) return;
        const nombres = String(result.nombres || "").trim();
        const apellidoPaterno = String(result.apellidoPaterno || "").trim();
        const apellidoMaterno = String(result.apellidoMaterno || "").trim();
        const fullName =
          String(result.nombreCompleto || "").trim() ||
          [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ");
        setForm((prev) => ({
          ...prev,
          documento: dni,
          nombres: nombres || prev.nombres,
          apellidoPaterno: apellidoPaterno || prev.apellidoPaterno,
          apellidoMaterno: apellidoMaterno || prev.apellidoMaterno,
          nombre: fullName || prev.nombre
        }));
        setFieldErrors((prev) => ({
          ...prev,
          documento: "",
          nombres: "",
          apellidoPaterno: "",
          apellidoMaterno: "",
          nombre: ""
        }));
      } catch (err) {
        if (!cancelled) {
          setDniLookupError(
            err.message ||
              "No se pudo consultar RENIEC. Completa los datos manualmente."
          );
        }
      } finally {
        if (!cancelled) {
          lastDniQueriedRef.current = dni;
          setDniLoading(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.documento, form.tipo]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const nextErrors = {};
    if (!form.tipo || !form.email.trim() || !form.direccion.trim()) {
      if (!form.tipo) nextErrors.tipo = "Selecciona el tipo.";
      if (!form.email.trim()) nextErrors.email = "El email es obligatorio.";
      if (!form.direccion.trim()) nextErrors.direccion = "La direccion es obligatoria.";
    }
    if (form.tipo === "persona") {
      const dni = onlyDigits(form.documento);
      if (!dni) nextErrors.documento = "El DNI es obligatorio.";
      else if (dni.length !== 8) nextErrors.documento = "El DNI debe tener 8 digitos.";
      if (!form.nombres.trim()) nextErrors.nombres = "Los nombres son obligatorios.";
      if (!form.apellidoPaterno.trim()) {
        nextErrors.apellidoPaterno = "El apellido paterno es obligatorio.";
      }
      if (!form.apellidoMaterno.trim()) {
        nextErrors.apellidoMaterno = "El apellido materno es obligatorio.";
      }
      if (!form.nombre.trim()) nextErrors.nombre = "Completa nombres y apellidos.";
    } else if (!form.nombre.trim()) {
      nextErrors.nombre = "La razon social es obligatoria.";
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (form.email.trim() && !emailOk) nextErrors.email = "Ingresa un email valido.";
    const phone = buildPhoneValue(form.telefonoPais, form.telefonoNumero);
    if (!phone.ok) nextErrors.telefonoNumero = phone.error;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Revisa los campos marcados.");
      return;
    }
    setLoading(true);
    try {
      await createClient({
        tipo: form.tipo,
        nombre: form.nombre.trim(),
        nombres: form.nombres.trim(),
        apellidoPaterno: form.apellidoPaterno.trim(),
        apellidoMaterno: form.apellidoMaterno.trim(),
        documento: form.documento.trim(),
        telefonoPais: form.telefonoPais,
        telefonoNumero: phone.local,
        telefono: phone.e164,
        email: form.email.trim(),
        direccion: form.direccion.trim()
      });
      setSuccess("Cliente creado con exito.");
      setTimeout(() => {
        navigate("/admin/clientes");
      }, 900);
    } catch (err) {
      setError(err.message || "No se pudo registrar el cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Registrar cliente
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Completa la información del cliente
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-600">
          Tipo *
          <select
            name="tipo"
            value={form.tipo}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
              fieldErrors.tipo ? "border-red-300" : "border-slate-200"
            }`}
            required
          >
            <option value="persona">Persona</option>
            <option value="empresa">Empresa</option>
          </select>
          {fieldErrors.tipo && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.tipo}</span>
          )}
        </label>
        <label className="text-sm text-slate-600">
          {form.tipo === "persona" ? "DNI *" : "Documento *"}
          <input
            name="documento"
            value={form.documento}
            onChange={handleChange}
            onKeyDown={handleDocumentoKeyDown}
            inputMode={form.tipo === "persona" ? "numeric" : "text"}
            pattern={form.tipo === "persona" ? "[0-9]*" : undefined}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
              fieldErrors.documento ? "border-red-300" : "border-slate-200"
            }`}
            placeholder={form.tipo === "persona" ? "DNI (8 digitos)" : "RUC u otro"}
            maxLength={form.tipo === "persona" ? 8 : 20}
            required
          />
          {dniLoading && form.tipo === "persona" && (
            <span className="mt-1 block text-xs text-brand-700">
              Consultando DNI...
            </span>
          )}
          {dniLookupError && form.tipo === "persona" && (
            <span className="mt-1 block text-xs text-amber-700">{dniLookupError}</span>
          )}
          {fieldErrors.documento && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.documento}</span>
          )}
        </label>
        {form.tipo === "persona" ? (
          <>
            <label className="text-sm text-slate-600">
              Nombres *
              <input
                name="nombres"
                value={form.nombres}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.nombres ? "border-red-300" : "border-slate-200"
                }`}
                placeholder="Nombres"
                required
              />
              {fieldErrors.nombres && (
                <span className="mt-1 block text-xs text-red-600">
                  {fieldErrors.nombres}
                </span>
              )}
            </label>
            <label className="text-sm text-slate-600">
              Apellido paterno *
              <input
                name="apellidoPaterno"
                value={form.apellidoPaterno}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.apellidoPaterno ? "border-red-300" : "border-slate-200"
                }`}
                placeholder="Apellido paterno"
                required
              />
              {fieldErrors.apellidoPaterno && (
                <span className="mt-1 block text-xs text-red-600">
                  {fieldErrors.apellidoPaterno}
                </span>
              )}
            </label>
            <label className="text-sm text-slate-600">
              Apellido materno *
              <input
                name="apellidoMaterno"
                value={form.apellidoMaterno}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.apellidoMaterno ? "border-red-300" : "border-slate-200"
                }`}
                placeholder="Apellido materno"
                required
              />
              {fieldErrors.apellidoMaterno && (
                <span className="mt-1 block text-xs text-red-600">
                  {fieldErrors.apellidoMaterno}
                </span>
              )}
            </label>
            <label className="text-sm text-slate-600">
              Nombre completo *
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.nombre ? "border-red-300" : "border-slate-200"
                }`}
                placeholder="Nombre completo"
                required
              />
              {fieldErrors.nombre && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors.nombre}</span>
              )}
            </label>
          </>
        ) : (
          <label className="text-sm text-slate-600">
            Razon social *
            <input
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                fieldErrors.nombre ? "border-red-300" : "border-slate-200"
              }`}
              placeholder="Razon social"
              required
            />
            {fieldErrors.nombre && (
              <span className="mt-1 block text-xs text-red-600">{fieldErrors.nombre}</span>
            )}
          </label>
        )}
        <PhoneField
          countryValue={form.telefonoPais}
          numberValue={form.telefonoNumero}
          onChange={handleChange}
          error={fieldErrors.telefonoNumero}
        />
        <label className="text-sm text-slate-600">
          Email *
          <input
            name="email"
            value={form.email}
            onChange={handleChange}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
              fieldErrors.email ? "border-red-300" : "border-slate-200"
            }`}
            placeholder="correo@empresa.com"
            required
          />
          {fieldErrors.email && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.email}</span>
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
            placeholder="Direccion"
            required
          />
          {fieldErrors.direccion && (
            <span className="mt-1 block text-xs text-red-600">{fieldErrors.direccion}</span>
          )}
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
            {loading ? "Guardando..." : "Guardar cliente"}
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

export default AdminClientNew;
