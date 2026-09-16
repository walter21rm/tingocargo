/**
 * ClientPackageDetail.jsx — Detalle de envío del cliente
 * Vista detallada de un paquete con timeline de seguimiento, información
 * del envío y opción de pago cuando aplique.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPackageById, payClientPackage, getUser, prepareCulqiPayment, confirmCulqiPayment } from "../services/api.js";
import { openCulqiCheckout } from "../services/culqiCheckout.js";
import Timeline from "../components/Timeline.jsx";

const METODOS_PAGO = [
  { id: "tarjeta", label: "Tarjeta de crédito/débito", icon: "💳" },
  { id: "yape", label: "Yape", icon: "📱" },
  { id: "efectivo", label: "Efectivo", icon: "💵" }
];

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
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
  return "bg-slate-100 text-slate-600";
};

const ClientPackageDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const [pkg, setPkg] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);

  const load = async () => {
    try {
      const data = await getPackageById(id);
      setPkg(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar el paquete.");
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const canPay = () => {
    if (!pkg || !user) return false;
    const isRemitente = String(pkg.remitenteClienteId) === String(user.clienteId);
    const isDestinatario = String(pkg.destinatarioId) === String(user.clienteId);
    if (pkg.pagado) return false;
    if (pkg.quienPaga === "remitente" && !isRemitente) return false;
    if (pkg.quienPaga === "destinatario" && !isDestinatario) return false;
    if (pkg.pesoKg > 2 && (!pkg.precioEnvio || pkg.precioEnvio <= 0)) return false;
    return true;
  };

  const confirmPayment = async () => {
    if (!pkg || !canPay()) return;
    setPayLoading(true);
    setError("");
    setNotice("");
    try {
      await payClientPackage(pkg.id, selectedMethod);
      setNotice("Pago registrado correctamente.");
      setPaymentModalOpen(false);
      setSelectedMethod(null);
      await load();
    } catch (err) {
      setError(err.message || "No se pudo registrar el pago.");
    } finally {
      setPayLoading(false);
    }
  };

  const handlePay = () => {
    if (!pkg || !canPay()) return;
    setError("");
    setPaymentModalOpen(true);
    setSelectedMethod(null);
  };

  const handleSimulatePayment = async () => {
    if (selectedMethod === "tarjeta" || selectedMethod === "yape") {
      setError("");
      setPayLoading(true);
      try {
        const prep = await prepareCulqiPayment(pkg.id, selectedMethod);
        const token = await openCulqiCheckout({
          publicKey: prep.publicKey,
          amount: prep.amount,
          orderId: prep.orderId,
          metodo: selectedMethod,
          title: `TingoCargo ${prep.codigoSeguimiento}`
        });
        await confirmCulqiPayment(pkg.id, {
          tokenId: token.tokenId,
          email: token.email || prep.email,
          metodoPago: selectedMethod
        });
        setNotice("Pago aprobado.");
        setPaymentModalOpen(false);
        setSelectedMethod(null);
        await load();
      } catch (err) {
        setError(err.message || "No se pudo completar el pago.");
      } finally {
        setPayLoading(false);
      }
      return;
    }
    setError("");
    await confirmPayment();
  };

  if (!pkg && !error) {
    return <div className="text-slate-500">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/cliente/envios")}
            className="mb-2 text-sm font-medium text-slate-500 hover:text-brand-600"
          >
            ← Volver a mis envíos
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {pkg?.codigoSeguimiento}
          </h1>
          <p className="text-sm text-slate-500">
            Registrado el {formatDate(pkg?.creadoEn)}
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-1 text-sm font-semibold ${statusTone(
            pkg?.estadoActual
          )}`}
        >
          {pkg?.estadoActual}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          {notice}
        </div>
      )}

      {pkg && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Detalles</p>
              <p className="mt-3 text-slate-800">{pkg.descripcion || "Sin descripción"}</p>
              <p className="mt-2 text-sm text-slate-500">
                Peso: {pkg.pesoKg || 0} kg • Precio: {pkg.precioEnvio || 0} soles
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Pago: {pkg.quienPaga === "remitente" ? "Remitente" : "Destinatario al recibir"}
                {pkg.pagado && (
                  <span className="ml-2 text-brand-600 font-semibold">• Pagado</span>
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Destinatario</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {pkg.destinatario?.nombre || "—"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {pkg.destinoTexto || pkg.destinatario?.direccion || "Sin dirección"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Pago</p>
              {pkg.pagado ? (
                <p className="mt-3 text-brand-600 font-semibold">Envío pagado</p>
              ) : canPay() ? (
                <div className="mt-4">
                  <p className="text-sm text-slate-600">
                    Monto: {pkg.precioEnvio || 0} soles
                  </p>
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={payLoading}
                    className="mt-4 w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Pagar ahora
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-slate-500">
                    {pkg.quienPaga === "destinatario"
                      ? "Pago a cargo del destinatario al recibir"
                      : pkg.pesoKg > 2 && (!pkg.precioEnvio || pkg.precioEnvio <= 0)
                      ? "El operador debe asignar el precio antes de pagar (paquete > 2 kg)"
                      : "Otro usuario debe realizar el pago"}
                  </p>
                  {pkg.quienPaga === "destinatario" && !pkg.pagado && (
                    <p className="text-xs text-slate-500">
                      Si tienes cuenta: paga aquí con tarjeta, Yape o efectivo. Si pagarás en efectivo al repartidor, él registrará el pago al entregar.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Timeline items={pkg.historial || []} title="Línea de tiempo" />
          </div>
        </div>
      )}

      {paymentModalOpen && canPay() && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Elegir método de pago</h3>
              <p className="mt-1 text-sm text-slate-500">
                Monto a pagar: <strong>{pkg?.precioEnvio || 0} soles</strong>
              </p>
            </div>
            <div className="p-6">
              {!selectedMethod ? (
                <div className="space-y-2">
                  {METODOS_PAGO.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className="flex w-full items-center gap-4 rounded-xl border border-slate-200 px-4 py-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
                    >
                      <span className="text-2xl">{m.icon}</span>
                      <span className="font-medium text-slate-800">{m.label}</span>
                    </button>
                  ))}
                </div>
              ) : selectedMethod === "tarjeta" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <span className="text-3xl">💳</span>
                    <p className="mt-2 text-sm text-slate-700">
                      Se abrirá Culqi para cobrar <strong>{pkg?.precioEnvio || 0} soles</strong> con tarjeta.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Modo prueba: usa la tarjeta 4111 1111 1111 1111, CVV 123 y una fecha futura.
                    </p>
                  </div>
                </div>
              ) : selectedMethod === "yape" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <span className="text-3xl">📱</span>
                    <p className="mt-2 text-sm text-slate-700">
                      Se abrirá Culqi para pagar <strong>{pkg?.precioEnvio || 0} soles</strong> con Yape (número y código de aprobación de la app).
                    </p>
                  </div>
                </div>
              ) : selectedMethod === "efectivo" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700">
                      Pagarás en efectivo al momento de la entrega. El repartidor recibirá el monto de{" "}
                      <strong>{pkg?.precioEnvio || 0} soles</strong>.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  if (selectedMethod) setSelectedMethod(null);
                  else setPaymentModalOpen(false);
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
              >
                {selectedMethod ? "Volver" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={handleSimulatePayment}
                disabled={payLoading || !selectedMethod}
                className="flex-1 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {payLoading
                  ? "Procesando..."
                  : selectedMethod === "tarjeta" || selectedMethod === "yape"
                    ? "Pagar ahora"
                    : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPackageDetail;
