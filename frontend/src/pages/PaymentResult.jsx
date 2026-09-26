/**
 * PaymentResult.jsx — Retorno de Mercado Pago
 * Mercado Pago redirige aquí tras tarjeta/Yape. Se verifica el payment_id
 * en el backend y recién entonces se considera pagado.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getUser, verifyMpPayment } from "../services/api.js";

const PaymentResult = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Verificando el pago...");
  const paqueteId = params.get("paqueteId");
  const estado = params.get("estado") || params.get("collection_status") || params.get("status");
  const paymentId =
    params.get("payment_id") || params.get("collection_id") || params.get("paymentId");
  const user = getUser();
  const backTo = user?.roleName === "Cliente"
    ? `/cliente/envios/${paqueteId}`
    : `/admin/paquetes/${paqueteId}`;

  useEffect(() => {
    if (!paqueteId) {
      setStatus("error");
      setMessage("No se identificó el paquete.");
      return;
    }
    if (!paymentId) {
      if (estado === "failure") {
        setStatus("error");
        setMessage("El pago fue cancelado o rechazado.");
        return;
      }
      if (estado === "pending") {
        setStatus("pending");
        setMessage("Pago pendiente. En Yape se confirma cuando Mercado Pago lo aprueba.");
        return;
      }
      setStatus("error");
      setMessage("Mercado Pago no envió el identificador del pago.");
      return;
    }
    verifyMpPayment(paqueteId, paymentId)
      .then((pkg) => {
        if (pkg?.pagado) {
          setStatus("ok");
          setMessage(`Pago aprobado. El envío ${pkg.codigoSeguimiento} quedó pagado.`);
        } else {
          setStatus("pending");
          setMessage("Mercado Pago aún no confirma el cobro.");
        }
      })
      .catch((err) => {
        setStatus(estado === "pending" ? "pending" : "error");
        setMessage(err.message || "No se pudo verificar el pago.");
      });
  }, [paqueteId, paymentId, estado]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-900">Resultado del pago</h1>
        <p className={`mt-4 text-sm ${
          status === "ok" ? "text-brand-700" : status === "pending" ? "text-amber-700" : "text-slate-600"
        }`}>
          {message}
        </p>
        {paqueteId && (
          <Link
            to={backTo}
            className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white"
          >
            Volver al envío
          </Link>
        )}
      </div>
    </div>
  );
};

export default PaymentResult;
