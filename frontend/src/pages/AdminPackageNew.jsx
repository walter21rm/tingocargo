/**
 * AdminPackageNew.jsx — Formulario de creación de paquetes
 * Permite registrar nuevos envíos con datos de remitente, destinatario, peso, dimensiones
 * y sucursal de origen. Incluye validación y opción de crear cliente al vuelo.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createClient,
  createPackage,
  getDniData,
  getUser,
  listBranches,
  listClients,
  listDistributors,
  listOperators,
  listCouriers,
  getPublicConfig
} from "../services/api.js";
import PhoneField from "../components/PhoneField.jsx";
import {
  buildPhoneValue,
  DEFAULT_PHONE_COUNTRY,
  onlyDigits
} from "../utils/phone.js";

const emptyForm = {
  tipoEnvio: "distribuidora_cliente",
  remitenteId: "",
  remitenteClienteId: "",
  destinatarioId: "",
  operadorId: "",
  repartidorId: "",
  sucursalOrigenId: "",
  destinoTexto: "",
  descripcion: "",
  pesoKg: "",
  quienPaga: "remitente"
};

const emptyClientForm = {
  tipo: "persona",
  nombre: "",
  documento: "",
  telefonoPais: DEFAULT_PHONE_COUNTRY,
  telefonoNumero: "",
  email: "",
  direccion: ""
};

const AdminPackageNew = () => {
  const navigate = useNavigate();
  const user = getUser();
  const isAdmin = user?.roleName === "Administrador";
  const [clients, setClients] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [operators, setOperators] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientModalTarget, setClientModalTarget] = useState("destinatarioId");
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [clientError, setClientError] = useState("");
  const [clientLoading, setClientLoading] = useState(false);
  const [clientDniLoading, setClientDniLoading] = useState(false);
  const [clientDniError, setClientDniError] = useState("");
  const lastClientDniRef = useRef("");
  const [tarifaPrecio, setTarifaPrecio] = useState(10);
  const [tarifaPesoLimite, setTarifaPesoLimite] = useState(2);

  const loadData = async () => {
    try {
      const [
        clientsData,
        branchesData,
        distributorsData,
        operatorsData,
        couriersData
      ] = await Promise.all([
        listClients(),
        listBranches(),
        listDistributors(),
        listOperators(),
        listCouriers()
      ]);
      setClients(clientsData);
      setBranches(branchesData);
      setDistributors(distributorsData);
      setOperators(operatorsData);
      setCouriers(couriersData);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los datos.");
    }
  };

  useEffect(() => {
    loadData();
    getPublicConfig().then((cfg) => {
      if (cfg.tarifas) {
        setTarifaPrecio(cfg.tarifas.precioEstandarSoles ?? 10);
        setTarifaPesoLimite(cfg.tarifas.pesoLimiteKg ?? 2);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.roleName === "Operador logístico" && user.id) {
      setForm((prev) => ({
        ...prev,
        operadorId: user.id
      }));
    }
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "tipoEnvio") {
        next.remitenteId = "";
        next.remitenteClienteId = "";
      }
      if (name === "destinatarioId" && value) {
        const client = clients.find((c) => String(c.id) === String(value));
        if (client?.direccion) {
          next.destinoTexto = client.direccion;
        }
      }
      return next;
    });
  };

  const handleCancel = () => {
    navigate("/admin/paquetes");
  };

  const handleCreateBranch = () => {
    navigate("/admin/sucursales/nuevo");
  };

  const openClientModal = (targetField) => {
    setClientModalTarget(targetField);
    setClientForm(emptyClientForm);
    setClientError("");
    setClientModalOpen(true);
  };

  const closeClientModal = () => {
    setClientModalOpen(false);
    setClientError("");
    setClientDniError("");
  };

  const handleClientFieldChange = (event) => {
    const { name, value } = event.target;
    setClientForm((prev) => ({
      ...prev,
      [name]:
        name === "telefonoNumero" || name === "documento" ? onlyDigits(value) : value
    }));
    if (name === "documento") {
      setClientDniError("");
      if (onlyDigits(value).length < 8) {
        lastClientDniRef.current = "";
      }
    }
    if (name === "tipo") {
      setClientDniError("");
      lastClientDniRef.current = "";
    }
  };

  const handleClientDocumentoKeyDown = (event) => {
    if (clientForm.tipo !== "persona") return;
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
    if (!/^\d$/.test(event.key)) event.preventDefault();
  };

  useEffect(() => {
    if (!clientModalOpen || clientForm.tipo !== "persona") return;
    const dni = onlyDigits(clientForm.documento);
    if (dni.length !== 8 || dni === lastClientDniRef.current) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setClientDniLoading(true);
      setClientDniError("");
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
          setClientForm((prev) => ({
            ...prev,
            documento: dni,
            nombre: fullName
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setClientDniError(
            err.message || "No se pudo consultar DNI. Completa manualmente."
          );
        }
      } finally {
        if (!cancelled) {
          lastClientDniRef.current = dni;
          setClientDniLoading(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clientForm.documento, clientForm.tipo, clientModalOpen]);

  const handleCreateClientInline = async (event) => {
    event.preventDefault();
    setClientError("");
    if (
      !clientForm.tipo ||
      !clientForm.nombre.trim() ||
      !clientForm.documento.trim() ||
      !clientForm.email.trim() ||
      !clientForm.direccion.trim()
    ) {
      setClientError("Completa todos los campos del cliente.");
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientForm.email.trim());
    if (!emailOk) {
      setClientError("Ingresa un email valido.");
      return;
    }
    const phone = buildPhoneValue(clientForm.telefonoPais, clientForm.telefonoNumero);
    if (!phone.ok) {
      setClientError(phone.error);
      return;
    }
    setClientLoading(true);
    try {
      const created = await createClient({
        tipo: clientForm.tipo,
        nombre: clientForm.nombre.trim(),
        documento: clientForm.documento.trim(),
        telefonoPais: clientForm.telefonoPais,
        telefonoNumero: phone.local,
        telefono: phone.e164,
        email: clientForm.email.trim(),
        direccion: clientForm.direccion.trim()
      });
      await loadData();
      setForm((prev) => {
        const next = { ...prev, [clientModalTarget]: created.id };
        if (clientModalTarget === "destinatarioId" && created.direccion) {
          next.destinoTexto = created.direccion;
        }
        return next;
      });
      closeClientModal();
      setSuccess("Cliente creado con exito y asignado al paquete.");
    } catch (err) {
      setClientError(err.message || "No se pudo crear el cliente.");
    } finally {
      setClientLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const nextErrors = {};
    const operadorFinal =
      form.operadorId || (user?.roleName === "Operador logístico" ? user.id : "");
    const isClientToClient = form.tipoEnvio === "cliente_cliente";
    if (!isClientToClient && !form.remitenteId) {
      nextErrors.remitenteId = "Selecciona una distribuidora.";
    }
    if (isClientToClient && !form.remitenteClienteId) {
      nextErrors.remitenteClienteId = "Selecciona un cliente remitente.";
    }
    if (
      isClientToClient &&
      form.remitenteClienteId &&
      String(form.remitenteClienteId) === String(form.destinatarioId)
    ) {
      nextErrors.destinatarioId =
        "El destinatario debe ser diferente al cliente remitente.";
    }
    if (!form.destinatarioId) nextErrors.destinatarioId = "Selecciona un cliente.";
    if (!operadorFinal) nextErrors.operadorId = "Selecciona un operador.";
    if (!form.repartidorId) nextErrors.repartidorId = "Selecciona un repartidor.";
    if (!form.sucursalOrigenId) nextErrors.sucursalOrigenId = "Selecciona una sucursal.";
    if (!form.destinoTexto.trim()) nextErrors.destinoTexto = "Ingresa el destino.";
    if (!form.descripcion.trim()) nextErrors.descripcion = "Ingresa la descripcion.";
    const peso = parseFloat(form.pesoKg) || 0;
    if (peso <= 0) nextErrors.pesoKg = "El peso debe ser mayor a 0.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Revisa los campos marcados.");
      return;
    }
    setLoading(true);
    try {
      const precioEnvio = peso <= tarifaPesoLimite ? tarifaPrecio : 0;
      const payload = {
        ...form,
        tipoEnvio: form.tipoEnvio,
        remitenteId: isClientToClient ? "" : form.remitenteId,
        remitenteClienteId: isClientToClient ? form.remitenteClienteId : "",
        operadorId: operadorFinal,
        destinoTexto: form.destinoTexto.trim(),
        descripcion: form.descripcion.trim(),
        pesoKg: peso,
        precioEnvio,
        quienPaga: form.quienPaga
      };
      const created = await createPackage(payload);
      setSuccess("Paquete creado con exito.");
      setTimeout(() => {
        navigate(`/admin/paquetes/${created.id}`);
      }, 900);
    } catch (err) {
      setError(err.message || "No se pudo registrar el paquete.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Registro de nuevo ingreso
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa los datos del paquete recibido
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h10v16H4z" />
                  <path d="M8 4v16" />
                  <path d="M18 8h2l2 2v8h-4z" />
                </svg>
              </span>
              Datos de origen (distribuidora)
            </div>
            <label className="mt-4 block text-sm text-slate-600">
              Tipo de envio *
              <select
                name="tipoEnvio"
                value={form.tipoEnvio}
                onChange={handleChange}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                required
              >
                <option value="distribuidora_cliente">
                  Distribuidora a Cliente
                </option>
                <option value="cliente_cliente">Cliente a Cliente</option>
              </select>
            </label>
            {form.tipoEnvio === "distribuidora_cliente" ? (
              <label className="mt-4 block text-sm text-slate-600">
                Distribuidora remitente *
                <select
                  name="remitenteId"
                  value={form.remitenteId}
                  onChange={handleChange}
                  className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                    fieldErrors.remitenteId ? "border-red-300" : "border-slate-200"
                  }`}
                  required
                >
                  <option value="">Seleccionar distribuidora</option>
                  {distributors.map((distributor) => (
                    <option key={distributor.id} value={distributor.id}>
                      {distributor.nombre}
                    </option>
                  ))}
                </select>
                {fieldErrors.remitenteId && (
                  <span className="mt-1 block text-xs text-red-600">
                    {fieldErrors.remitenteId}
                  </span>
                )}
              </label>
            ) : (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Cliente remitente *</span>
                  <button
                    type="button"
                    onClick={() => openClientModal("remitenteClienteId")}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-brand-700"
                  >
                    + Nuevo cliente
                  </button>
                </div>
                <select
                  name="remitenteClienteId"
                  value={form.remitenteClienteId}
                  onChange={handleChange}
                  className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                    fieldErrors.remitenteClienteId
                      ? "border-red-300"
                      : "border-slate-200"
                  }`}
                  required
                >
                  <option value="">Seleccionar cliente remitente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nombre}
                    </option>
                  ))}
                </select>
                {fieldErrors.remitenteClienteId && (
                  <span className="mt-1 block text-xs text-red-600">
                    {fieldErrors.remitenteClienteId}
                  </span>
                )}
              </div>
            )}
            <label className="mt-4 block text-sm text-slate-600">
              Operador asignado *
              <select
                name="operadorId"
                value={form.operadorId}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.operadorId ? "border-red-300" : "border-slate-200"
                }`}
                disabled={user?.roleName === "Operador logístico"}
                required
              >
                <option value="">Seleccionar operador</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.nombre}
                  </option>
                ))}
              </select>
              {fieldErrors.operadorId && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors.operadorId}</span>
              )}
            </label>
            <label className="mt-4 block text-sm text-slate-600">
              Repartidor asignado *
              <select
                name="repartidorId"
                value={form.repartidorId}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.repartidorId ? "border-red-300" : "border-slate-200"
                }`}
                required
              >
                <option value="">Seleccionar repartidor</option>
                {couriers.map((courier) => (
                  <option key={courier.id} value={courier.id}>
                    {courier.nombre}
                  </option>
                ))}
              </select>
              {fieldErrors.repartidorId && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors.repartidorId}</span>
              )}
            </label>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a7 7 0 0 0-4 12.7V22l4-3 4 3v-7.3A7 7 0 0 0 12 2z" />
                </svg>
              </span>
              Datos del destinatario
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Cliente destinatario *</span>
                <button
                  type="button"
                  onClick={() => openClientModal("destinatarioId")}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-brand-700"
                >
                  + Nuevo cliente
                </button>
              </div>
              <select
                name="destinatarioId"
                value={form.destinatarioId}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.destinatarioId ? "border-red-300" : "border-slate-200"
                }`}
                required
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nombre}
                  </option>
                ))}
              </select>
              {fieldErrors.destinatarioId && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors.destinatarioId}</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7l9-4 9 4-9 4-9-4z" />
                <path d="M3 7v10l9 4 9-4V7" />
              </svg>
            </span>
            Detalles del paquete
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Sucursal origen *
              <select
                name="sucursalOrigenId"
                value={form.sucursalOrigenId}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.sucursalOrigenId ? "border-red-300" : "border-slate-200"
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
              {fieldErrors.sucursalOrigenId && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors.sucursalOrigenId}</span>
              )}
              {branches.length === 0 && isAdmin && (
                <button
                  type="button"
                  onClick={handleCreateBranch}
                  className="mt-3 text-xs font-semibold text-brand-700"
                >
                  + Crear sucursal
                </button>
              )}
            </label>
            <label className="text-sm text-slate-600">
              Destino / ubicación de entrega *
              <input
                name="destinoTexto"
                value={form.destinoTexto}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.destinoTexto ? "border-red-300" : "border-slate-200"
                }`}
                placeholder="Ej: Jr. Callao 456, Tingo María"
                required
              />
              {fieldErrors.destinoTexto && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors.destinoTexto}</span>
              )}
            </label>
            <label className="text-sm text-slate-600 md:col-span-2">
              Descripcion del contenido *
              <input
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.descripcion ? "border-red-300" : "border-slate-200"
                }`}
                placeholder="Ej: Medicamentos varios, Antibióticos..."
                required
              />
              {fieldErrors.descripcion && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors.descripcion}</span>
              )}
            </label>
            <label className="text-sm text-slate-600">
              Peso (kg) *
              <input
                name="pesoKg"
                type="number"
                step="0.01"
                min="0.01"
                value={form.pesoKg}
                onChange={handleChange}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm ${
                  fieldErrors.pesoKg ? "border-red-300" : "border-slate-200"
                }`}
                placeholder="Ej: 1.5"
                required
              />
              {fieldErrors.pesoKg && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors.pesoKg}</span>
              )}
            </label>
            <div className="text-sm text-slate-600">
              <span className="font-medium">¿Quién paga el envío?</span>
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="quienPaga"
                    value="remitente"
                    checked={form.quienPaga === "remitente"}
                    onChange={handleChange}
                    className="text-brand-600"
                  />
                  <span className="text-sm text-slate-700">Remitente paga ahora</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
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
            {(() => {
              const peso = parseFloat(form.pesoKg) || 0;
              if (peso <= 0) return null;
              const precio = peso <= tarifaPesoLimite ? tarifaPrecio : 0;
              return (
                <div className="md:col-span-2 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-sm text-brand-800">
                  {precio > 0 ? (
                    <>Precio del envío: <strong>{precio} soles</strong></>
                  ) : (
                    <>Paquete mayor a {tarifaPesoLimite} kg. El operador deberá asignar el precio desde el detalle del paquete.</>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-between">
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
            {loading ? "Guardando..." : "Registrar paquete"}
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
      {clientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Nuevo cliente</h3>
              <button
                type="button"
                onClick={closeClientModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600"
              >
                Cerrar
              </button>
            </div>
            <form onSubmit={handleCreateClientInline} className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-600">
                Tipo *
                <select
                  name="tipo"
                  value={clientForm.tipo}
                  onChange={handleClientFieldChange}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                >
                  <option value="persona">Persona</option>
                  <option value="empresa">Empresa</option>
                </select>
              </label>
              <label className="text-sm text-slate-600">
                {clientForm.tipo === "persona" ? "Nombre completo *" : "Razon social *"}
                <input
                  name="nombre"
                  value={clientForm.nombre}
                  onChange={handleClientFieldChange}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={
                    clientForm.tipo === "persona"
                      ? "Nombre completo"
                      : "Razon social de la empresa"
                  }
                  required
                />
              </label>
              <label className="text-sm text-slate-600">
                {clientForm.tipo === "persona" ? "DNI *" : "RUC *"}
                <input
                  name="documento"
                  value={clientForm.documento}
                  onChange={handleClientFieldChange}
                  onKeyDown={handleClientDocumentoKeyDown}
                  inputMode={clientForm.tipo === "persona" ? "numeric" : "text"}
                  maxLength={clientForm.tipo === "persona" ? 8 : 20}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={
                    clientForm.tipo === "persona" ? "DNI (8 digitos)" : "RUC (11 digitos)"
                  }
                  required
                />
                {clientDniLoading && clientForm.tipo === "persona" && (
                  <span className="mt-1 block text-xs text-brand-700">
                    Consultando DNI...
                  </span>
                )}
                {clientDniError && clientForm.tipo === "persona" && (
                  <span className="mt-1 block text-xs text-amber-700">
                    {clientDniError}
                  </span>
                )}
              </label>
              <PhoneField
                countryValue={clientForm.telefonoPais}
                numberValue={clientForm.telefonoNumero}
                onChange={handleClientFieldChange}
              />
              <label className="text-sm text-slate-600">
                Email *
                <input
                  name="email"
                  value={clientForm.email}
                  onChange={handleClientFieldChange}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                />
              </label>
              <label className="text-sm text-slate-600">
                Direccion *
                <input
                  name="direccion"
                  value={clientForm.direccion}
                  onChange={handleClientFieldChange}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                />
              </label>
              <div className="md:col-span-2 flex items-center justify-between">
                <div className="text-sm text-red-600">{clientError}</div>
                <button
                  type="submit"
                  disabled={clientLoading}
                  className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white"
                >
                  {clientLoading ? "Guardando..." : "Guardar cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPackageNew;
