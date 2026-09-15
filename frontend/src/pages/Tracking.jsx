/**
 * Tracking.jsx — Seguimiento público de envíos
 * Página de rastreo público que muestra el timeline del paquete y
 * permite reprogramar citas de entrega.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Timeline from "../components/Timeline.jsx";
import { getTracking, reprogramarTracking } from "../services/api.js";

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      return new Date(trimmed);
    }
    const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    return new Date(`${withT}Z`);
  }
  return new Date(value);
};

const formatDate = (value) => {
  const date = normalizeDate(value);
  if (!date || Number.isNaN(date.getTime())) return value || "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
    hour12: true
  }).format(date);
};

const statusTone = (status) => {
  if (status === "Entregado") return "bg-brand-50 text-brand-700";
  if (status === "En Tránsito") return "bg-accent-50 text-accent-500";
  return "bg-warning-50 text-warning-500";
};

const horaFinFromInicio = (horaInicio) => {
  const [h, m] = horaInicio.split(":").map(Number);
  const end = h + 3;
  return `${String(end).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const Tracking = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(null);
  const [searchParams] = useSearchParams();
  const [reprogramarModalOpen, setReprogramarModalOpen] = useState(false);
  const [reprogramarForm, setReprogramarForm] = useState({
    direccion: "",
    fecha: "",
    horaInicio: "09:00"
  });
  const [reprogramarLoading, setReprogramarLoading] = useState(false);

  const fetchTracking = async (value) => {
    if (!value.trim()) return;
    setLoading(true);
    setError("");
    setTracking(null);

    try {
      const data = await getTracking(value.trim());
      setTracking(data);
    } catch (err) {
      setError(err.message || "No se encontró el código de seguimiento.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await fetchTracking(code);
  };

  useEffect(() => {
    const queryCode = searchParams.get("code");
    if (!queryCode) return;
    setCode(queryCode);
    fetchTracking(queryCode);
  }, [searchParams]);

  const openReprogramarModal = () => {
    setReprogramarForm({
      direccion: tracking?.destinoTexto || tracking?.destinatario?.direccion || "",
      fecha: "",
      horaInicio: "09:00"
    });
    setReprogramarModalOpen(true);
  };

  const closeReprogramarModal = () => setReprogramarModalOpen(false);

  const handleReprogramarChange = (e) => {
    const { name, value } = e.target;
    setReprogramarForm((prev) => ({ ...prev, [name]: value }));
  };

  const confirmReprogramar = async () => {
    const { direccion, fecha, horaInicio } = reprogramarForm;
    if (!fecha || !horaInicio) {
      setError("Ingresa la fecha y la hora.");
      return;
    }
    if (!tracking?.codigoSeguimiento) return;
    setReprogramarLoading(true);
    setError("");
    try {
      const updated = await reprogramarTracking(tracking.codigoSeguimiento, {
        fecha,
        horaInicio,
        horaFin: horaFinFromInicio(horaInicio),
        direccion: direccion?.trim() || null
      });
      setTracking(updated);
      closeReprogramarModal();
    } catch (err) {
      setError(err.message || "No se pudo reprogramar.");
    } finally {
      setReprogramarLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900 text-center">
          Rastrea tu pedido
        </h1>
        <p className="mt-2 text-center text-slate-500">
          Ingresa el código de seguimiento que te proporcionamos.
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-4 sm:flex-row"
        >
          <div className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600 flex items-center gap-3">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Ej. TM-2026-0001"
              className="w-full bg-transparent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm"
            disabled={loading}
          >
            {loading ? "Buscando..." : "Rastrear paquete"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {tracking && (
        <div className="mt-10 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {tracking.codigoSeguimiento}
              </p>
              <p className="text-sm text-slate-500">
                Registrado el {formatDate(tracking.historial?.[0]?.fechaHora)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-4 py-1 text-sm font-semibold ${statusTone(
                  tracking.estadoActual
                )}`}
              >
                {tracking.estadoActual}
              </span>
              {tracking.estadoActual === "Intento fallido" && (
                <button
                  type="button"
                  onClick={openReprogramarModal}
                  disabled={reprogramarLoading}
                  className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Reprogramar envío
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
                <p className="text-sm font-semibold text-slate-700">
                  Distribuidora
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {tracking.remitente?.nombre || "Sin remitente"}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
                <p className="text-sm font-semibold text-slate-700">
                  Cliente destino
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {tracking.destinatario?.nombre || "Sin destinatario"}
                </p>
                <div className="mt-3 text-sm text-slate-500">
                  <p>{tracking.destinatario?.direccion || "Dirección no registrada"}</p>
                  <p>{tracking.destinatario?.telefono || "Teléfono no registrado"}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Detalles</p>
                <p className="mt-3 text-sm text-slate-500">Descripción</p>
                <p className="text-slate-800">
                  {tracking.descripcion || "Sin descripción"}
                </p>
                {tracking.reprogramacionFecha && (
                  <div className="mt-4 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
                    <p className="text-xs font-semibold text-brand-700">Próxima entrega programada</p>
                    <p className="mt-1 text-sm text-slate-800">
                      {new Date(tracking.reprogramacionFecha + "T12:00:00").toLocaleDateString("es-PE", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}{" "}
                      • {tracking.reprogramacionHoraInicio} — {tracking.reprogramacionHoraFin}
                    </p>
                    {tracking.reprogramacionDireccion && (
                      <p className="mt-1 text-xs text-slate-600">{tracking.reprogramacionDireccion}</p>
                    )}
                  </div>
                )}
                <p className="mt-3 text-sm text-slate-500">Observaciones</p>
                <p className="text-slate-800">
                  {tracking.historial?.[tracking.historial.length - 1]?.observacion ||
                    "Sin observaciones"}
                </p>
              </div>
            </div>

            <Timeline items={tracking.historial} title="Línea de tiempo" />
          </div>
        </div>
      )}

      {reprogramarModalOpen && tracking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5">
              <div className="flex items-center gap-3 text-white">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-xl font-bold">Reprogramar envío</h3>
                  <p className="text-sm text-white/90">Define la nueva fecha y horario en que estarás disponible</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Dirección (opcional)</span>
                <input
                  type="text"
                  name="direccion"
                  value={reprogramarForm.direccion}
                  onChange={handleReprogramarChange}
                  placeholder="Ej: Jr. Callao 456, Tingo María"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Fecha de entrega *</span>
                  <input
                    type="date"
                    name="fecha"
                    value={reprogramarForm.fecha}
                    onChange={handleReprogramarChange}
                    min={new Date().toISOString().split("T")[0]}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Disponible desde *</span>
                  <select
                    name="horaInicio"
                    value={reprogramarForm.horaInicio}
                    onChange={handleReprogramarChange}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    {Array.from({ length: 13 }, (_, i) => i + 6).map((h) => {
                      const val = `${String(h).padStart(2, "0")}:00`;
                      return (
                        <option key={val} value={val}>
                          {val} - {horaFinFromInicio(val)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Ventana de entrega (3 horas)</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {reprogramarForm.horaInicio} — {horaFinFromInicio(reprogramarForm.horaInicio)}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 pb-6 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeReprogramarModal}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmReprogramar}
                disabled={reprogramarLoading}
                className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
              >
                {reprogramarLoading ? "Guardando..." : "Reprogramar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Tracking;
