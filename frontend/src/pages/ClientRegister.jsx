/**
 * ClientRegister.jsx — Registro de nuevos clientes
 * Formulario de alta de clientes con validación de DNI, datos de contacto
 * y credenciales de acceso.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, setToken, setUser, getDniData } from "../services/api.js";
import PhoneField from "../components/PhoneField.jsx";
import { onlyDigits } from "../utils/phone.js";

const ClientRegister = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tipoDocumento: "dni",
    documento: "",
    nombre: "",
    email: "",
    password: "",
    telefonoPais: "PE",
    telefonoNumero: "",
    tipo: "persona",
    direccion: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dniLoading, setDniLoading] = useState(false);
  const [dniError, setDniError] = useState("");
  const lastDniQueriedRef = useRef("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === "documento" ? onlyDigits(value) : value;
    setForm((prev) => {
      const next = { ...prev, [name]: nextValue };
      if (name === "tipoDocumento") {
        if (value === "ruc") next.documento = "";
        return next;
      }
      if (name === "documento" && form.tipoDocumento === "ruc") {
        return { ...next, documento: nextValue.slice(0, 11) };
      }
      if (name === "documento" && form.tipoDocumento === "dni") {
        return { ...next, documento: nextValue.slice(0, 8) };
      }
      return next;
    });
    if (name === "documento") setDniError("");
  };

  const handlePhoneChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (form.tipoDocumento !== "dni") return;
    const dni = onlyDigits(form.documento);
    if (dni.length !== 8 || dni === lastDniQueriedRef.current) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setDniLoading(true);
      setDniError("");
      try {
        const result = await getDniData(dni);
        if (cancelled) return;
        const fullName =
          String(result.nombreCompleto || "").trim() ||
          [result.nombres, result.apellidoPaterno, result.apellidoMaterno]
            .filter(Boolean)
            .join(" ");
        setForm((prev) => ({ ...prev, documento: dni, nombre: fullName || prev.nombre }));
        lastDniQueriedRef.current = dni;
      } catch (err) {
        if (!cancelled) {
          setDniError(err.message || "No se pudo consultar. Completa el nombre manualmente.");
        }
      } finally {
        if (!cancelled) setDniLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.documento, form.tipoDocumento]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        tipo: form.tipoDocumento === "dni" ? "persona" : "empresa"
      };
      const data = await register(payload);
      setToken(data.token);
      setUser(data.user || { nombre: payload.nombre, email: payload.email, roleName: "Cliente", clienteId: data.user?.clienteId });
      navigate("/cliente");
    } catch (err) {
      setError(err.message || "No se pudo registrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 py-4">
        <div className="mx-auto max-w-xl px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-brand-600 font-semibold">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h11v10H3z" />
              <path d="M14 10h4l3 3v4h-7z" />
              <circle cx="7" cy="19" r="1.5" />
              <circle cx="18" cy="19" r="1.5" />
            </svg>
            Volver al inicio
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-slate-500">
            Regístrate para enviar paquetes y rastrear tus envíos
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Si te agregaron como destinatario, usa el mismo DNI/RUC para ver y pagar tus paquetes.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" autoComplete="off">
            <div className="block text-sm text-slate-600">
              Documento *
              <div className="mt-2 flex gap-2">
                <select
                  name="tipoDocumento"
                  value={form.tipoDocumento}
                  onChange={handleChange}
                  className="w-24 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <option value="dni">DNI</option>
                  <option value="ruc">RUC</option>
                </select>
                <input
                  name="documento"
                  value={form.documento}
                  onChange={handleChange}
                  required
                  maxLength={form.tipoDocumento === "dni" ? 8 : 11}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400"
                  placeholder={form.tipoDocumento === "dni" ? "8 dígitos" : "11 dígitos"}
                />
              </div>
              {dniLoading && (
                <p className="mt-1 text-xs text-slate-500">Consultando RENIEC...</p>
              )}
              {dniError && (
                <p className="mt-1 text-xs text-amber-600">{dniError}</p>
              )}
            </div>
            <label className="block text-sm text-slate-600">
              Nombre completo *
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                required
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400"
                placeholder="Se completa con DNI o escribe manualmente"
              />
            </label>
            <label className="block text-sm text-slate-600">
              Email *
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400"
                placeholder="correo@ejemplo.com"
              />
            </label>
            <PhoneField
              countryValue={form.telefonoPais}
              numberValue={form.telefonoNumero}
              onChange={handlePhoneChange}
            />
            <label className="block text-sm text-slate-600">
              Dirección *
              <input
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                required
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400"
                placeholder="Jr. Ejemplo 123, Tingo María"
              />
            </label>
            <label className="block text-sm text-slate-600">
              Contraseña (mín. 6 caracteres) *
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400"
                placeholder="Mínimo 6 caracteres"
              />
            </label>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Registrando..." : "Registrarme"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{" "}
            <Link to="/cliente/login" className="font-semibold text-brand-600">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ClientRegister;
