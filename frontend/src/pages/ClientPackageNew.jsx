/**
 * ClientPackageNew.jsx — Crear envío cliente a cliente
 * Formulario para registrar nuevos envíos entre clientes con datos de
 * remitente, destinatario, peso y dimensiones.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createClientPackage,
  listClients,
  listBranches,
  getUser,
  createClient,
  getDniData,
  getPublicConfig
} from "../services/api.js";
import PhoneField from "../components/PhoneField.jsx";
import { DEFAULT_PHONE_COUNTRY, onlyDigits } from "../utils/phone.js";

const ClientPackageNew = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [clients, setClients] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    destinatarioId: "",
    sucursalOrigenId: "",
    destinoTexto: "",
    descripcion: "",
    pesoKg: "",
    quienPaga: "remitente"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    tipoDocumento: "dni",
    documento: "",
    nombre: "",
    telefonoPais: DEFAULT_PHONE_COUNTRY,
    telefonoNumero: "",
    email: "",
    direccion: ""
  });
  const [newClientError, setNewClientError] = useState("");
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [dniLoading, setDniLoading] = useState(false);
  const [dniError, setDniError] = useState("");
  const lastDniQueriedRef = useRef("");
  const [tarifaPrecio, setTarifaPrecio] = useState(10);
  const [tarifaPesoLimite, setTarifaPesoLimite] = useState(2);

  const loadData = async () => {
    try {
      const [clientsData, branchesData] = await Promise.all([
        listClients(),
        listBranches()
      ]);
      const myId = String(user?.clienteId || "");
      setClients(clientsData.filter((c) => String(c.id) !== myId));
      setBranches(branchesData);
      getPublicConfig().then((cfg) => {
        if (cfg.tarifas) {
          setTarifaPrecio(cfg.tarifas.precioEstandarSoles ?? 10);
          setTarifaPesoLimite(cfg.tarifas.pesoLimiteKg ?? 2);
        }
      }).catch(() => {});
    } catch (err) {
      setError(err.message || "No se pudieron cargar los datos.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!showNewClient || newClient.tipoDocumento !== "dni") return;
    const dni = onlyDigits(newClient.documento);
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
        setNewClient((prev) => ({ ...prev, documento: dni, nombre: fullName || prev.nombre }));
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
  }, [showNewClient, newClient.documento, newClient.tipoDocumento]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "destinatarioId" && value) {
      const client = clients.find((c) => String(c.id) === String(value));
      if (client?.direccion) {
        setForm((prev) => ({ ...prev, destinoTexto: client.direccion }));
      }
    }
  };

  const handleNewClientChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === "documento" ? onlyDigits(value) : value;
    setNewClient((prev) => {
      const next = { ...prev, [name]: nextValue };
      if (name === "tipoDocumento") {
        if (value === "ruc") next.documento = "";
        return next;
      }
      if (name === "documento" && prev.tipoDocumento === "ruc") {
        return { ...next, documento: nextValue.slice(0, 11) };
      }
      if (name === "documento" && prev.tipoDocumento === "dni") {
        return { ...next, documento: nextValue.slice(0, 8) };
      }
      return next;
    });
    if (name === "documento") setDniError("");
  };

  const handlePhoneChange = (e) => {
    const { name, value } = e.target;
    setNewClient((prev) => ({ ...prev, [name]: value }));
  };

  const precioCalculado = () => {
    const peso = parseFloat(form.pesoKg) || 0;
    return peso > 0 ? (peso <= tarifaPesoLimite ? tarifaPrecio : 0) : null;
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setNewClientError("");
    setNewClientLoading(true);
    try {
      const payload = {
        ...newClient,
        tipo: newClient.tipoDocumento === "dni" ? "persona" : "empresa"
      };
      const created = await createClient(payload);
      setClients((prev) => [...prev, created]);
      setForm((prev) => ({ ...prev, destinatarioId: String(created.id) }));
      setShowNewClient(false);
      lastDniQueriedRef.current = "";
      setNewClient({
        tipoDocumento: "dni",
        documento: "",
        nombre: "",
        telefonoPais: DEFAULT_PHONE_COUNTRY,
        telefonoNumero: "",
        email: "",
        direccion: ""
      });
    } catch (err) {
      setNewClientError(err.message || "No se pudo crear el destinatario.");
    } finally {
      setNewClientLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const peso = parseFloat(form.pesoKg) || 0;
      if (peso <= 0) {
        setError("El peso debe ser mayor a 0");
        setLoading(false);
        return;
      }
      await createClientPackage({
        destinatarioId: form.destinatarioId,
        sucursalOrigenId: form.sucursalOrigenId,
        destinoTexto: form.destinoTexto.trim(),
        descripcion: form.descripcion.trim(),
        pesoKg: peso,
        quienPaga: form.quienPaga
      });
      navigate("/cliente/envios");
    } catch (err) {
      setError(err.message || "No se pudo crear el envío.");
    } finally {
      setLoading(false);
    }
  };

  const precio = precioCalculado();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Enviar paquete</h1>
      <p className="mt-1 text-slate-600">
        Tarifa estándar: 10 soles por paquete hasta 2 kg. Si supera 2 kg, el operador asignará el precio.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Destinatario *</label>
            <button
              type="button"
              onClick={() => setShowNewClient(true)}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              + Agregar nuevo
            </button>
          </div>
          <select
            name="destinatarioId"
            value={form.destinatarioId}
            onChange={handleChange}
            required
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="">Seleccionar destinatario</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.documento ? `(${c.documento})` : ""}
              </option>
            ))}
          </select>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          Sucursal de origen *
          <select
            name="sucursalOrigenId"
            value={form.sucursalOrigenId}
            onChange={handleChange}
            required
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="">Seleccionar sucursal</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre} - {b.direccion}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Dirección de entrega *
          <input
            name="destinoTexto"
            value={form.destinoTexto}
            onChange={handleChange}
            required
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Jr. Ejemplo 456, Tingo María"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Descripción del paquete *
          <input
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            required
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Ej: Medicinas, documentos..."
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Peso (kg) *
          <input
            type="number"
            name="pesoKg"
            value={form.pesoKg}
            onChange={handleChange}
            required
            min="0.1"
            step="0.1"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Ej: 1.5"
          />
          {precio !== null && (
            <p className="mt-2 text-sm text-slate-600">
              {precio > 0 ? (
                <>Precio del envío: <strong>{precio} soles</strong></>
              ) : (
                <span className="text-amber-600">
                  Paquete mayor a 2 kg. El operador asignará el precio.
                </span>
              )}
            </p>
          )}
        </label>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">¿Quién paga el envío?</p>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="quienPaga"
                value="remitente"
                checked={form.quienPaga === "remitente"}
                onChange={handleChange}
                className="text-brand-600"
              />
              <span className="text-sm text-slate-700">Yo pago ahora (remitente)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="quienPaga"
                value="destinatario"
                checked={form.quienPaga === "destinatario"}
                onChange={handleChange}
                className="text-brand-600"
              />
              <span className="text-sm text-slate-700">El destinatario paga al recibir</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate("/cliente")}
            className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Crear envío"}
          </button>
        </div>
      </form>

      {showNewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Nuevo destinatario</h3>
            <p className="mt-1 text-sm text-slate-500">
              Ingresa los datos de la persona que recibirá el paquete
            </p>
            <form onSubmit={handleCreateClient} className="mt-6 space-y-4" autoComplete="off">
              <div className="block text-sm text-slate-600">
                Documento *
                <div className="mt-2 flex gap-2">
                  <select
                    name="tipoDocumento"
                    value={newClient.tipoDocumento}
                    onChange={handleNewClientChange}
                    className="w-24 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <option value="dni">DNI</option>
                    <option value="ruc">RUC</option>
                  </select>
                  <input
                    name="documento"
                    value={newClient.documento}
                    onChange={handleNewClientChange}
                    required
                    maxLength={newClient.tipoDocumento === "dni" ? 8 : 11}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400"
                    placeholder={newClient.tipoDocumento === "dni" ? "8 dígitos" : "11 dígitos"}
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
                Nombre *
                <input
                  name="nombre"
                  value={newClient.nombre}
                  onChange={handleNewClientChange}
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
                  value={newClient.email}
                  onChange={handleNewClientChange}
                  required
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400"
                  placeholder="correo@ejemplo.com"
                />
              </label>
              <PhoneField
                countryValue={newClient.telefonoPais}
                numberValue={newClient.telefonoNumero}
                onChange={handlePhoneChange}
              />
              <label className="block text-sm text-slate-600">
                Dirección *
                <input
                  name="direccion"
                  value={newClient.direccion}
                  onChange={handleNewClientChange}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400"
                  placeholder="Jr. Ejemplo 123, Tingo María"
                />
              </label>
              {newClientError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {newClientError}
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    lastDniQueriedRef.current = "";
                    setDniError("");
                    setShowNewClient(false);
                  }}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newClientLoading}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {newClientLoading ? "Guardando..." : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPackageNew;
