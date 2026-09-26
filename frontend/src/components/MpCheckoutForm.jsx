/**
 * Formulario directo de Mercado Pago.
 * Yape pide celular y código de aprobación.
 * Tarjeta muestra solo los datos de la tarjeta, sin el selector de medios.
 */
import { useEffect, useState } from "react";
import { getPublicConfig, processMpPayment } from "../services/api.js";

const loadMercadoPago = () =>
  new Promise((resolve, reject) => {
    if (window.MercadoPago) {
      resolve(window.MercadoPago);
      return;
    }
    const existing = document.querySelector("script[data-mp-sdk]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.MercadoPago));
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Mercado Pago")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.dataset.mpSdk = "1";
    script.onload = () => resolve(window.MercadoPago);
    script.onerror = () => reject(new Error("No se pudo cargar Mercado Pago"));
    document.body.appendChild(script);
  });

const fieldClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500";

const MpCheckoutForm = ({ method, packageId, amount, email, onSuccess }) => {
  const [publicKey, setPublicKey] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(method !== "tarjeta");

  useEffect(() => {
    let active = true;
    getPublicConfig()
      .then((cfg) => {
        if (!active) return;
        const key = cfg?.pagos?.publicKey || "";
        setPublicKey(key);
        setTestMode(Boolean(cfg?.pagos?.testMode));
        if (!key) setError("Falta la llave pública de Mercado Pago.");
      })
      .catch(() => {
        if (active) setError("No se pudo leer la configuración de pagos.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (method !== "tarjeta" || !publicKey) return undefined;
    let active = true;
    setReady(false);
    setError("");
    loadMercadoPago()
      .then((MercadoPago) => {
        if (!active) return;
        const mp = new MercadoPago(publicKey, { locale: "es-PE" });
        const cardForm = mp.cardForm({
          amount: Number(amount || 0).toFixed(2),
          iframe: true,
          form: {
            id: "form-checkout-tarjeta",
            cardNumber: { id: "form-checkout__cardNumber", placeholder: "Número de tarjeta" },
            expirationDate: { id: "form-checkout__expirationDate", placeholder: "MM/AA" },
            securityCode: { id: "form-checkout__securityCode", placeholder: "CVV" },
            cardholderName: { id: "form-checkout__cardholderName", placeholder: "Titular" },
            issuer: { id: "form-checkout__issuer", placeholder: "Banco" },
            installments: { id: "form-checkout__installments", placeholder: "Cuotas" },
            identificationType: { id: "form-checkout__identificationType" },
            identificationNumber: { id: "form-checkout__identificationNumber", placeholder: "Documento" },
            cardholderEmail: { id: "form-checkout__cardholderEmail", placeholder: "Correo" }
          },
          callbacks: {
            onFormMounted: (err) => {
              if (!active) return;
              if (err) setError("No se pudo abrir el formulario de tarjeta.");
              else setReady(true);
            },
            onSubmit: (event) => {
              event.preventDefault();
              const data = cardForm.getCardFormData();
              submitCharge({
                metodoPago: "tarjeta",
                token: data.token,
                paymentMethodId: data.paymentMethodId,
                installments: data.installments,
                issuerId: data.issuerId,
                email: data.cardholderEmail || email,
                identificationType: data.identificationType,
                identificationNumber: data.identificationNumber
              });
            }
          }
        });
        if (email) {
          const emailInput = document.getElementById("form-checkout__cardholderEmail");
          if (emailInput && !emailInput.value) emailInput.value = email;
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "No se pudo abrir el formulario de tarjeta.");
      });
    return () => {
      active = false;
    };
  }, [method, publicKey, amount]);

  const submitCharge = async (payload) => {
    setLoading(true);
    setError("");
    try {
      const updated = await processMpPayment(packageId, payload);
      onSuccess(updated);
    } catch (err) {
      setError(err.message || "No se pudo completar el pago.");
    } finally {
      setLoading(false);
    }
  };

  const handleYape = async (event) => {
    event.preventDefault();
    if (!publicKey) {
      setError("Falta la llave pública de Mercado Pago.");
      return;
    }
    const phoneNumber = phone.replace(/\D/g, "");
    const code = otp.replace(/\D/g, "");
    if (phoneNumber.length < 9 || code.length !== 6) {
      setError("Ingresa el celular (9 dígitos) y el código de aprobación (6 dígitos).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const MercadoPago = await loadMercadoPago();
      const mp = new MercadoPago(publicKey, { locale: "es-PE" });
      const yapeToken = await mp.yape({ otp: code, phoneNumber }).create();
      await submitCharge({
        metodoPago: "yape",
        token: yapeToken?.id,
        paymentMethodId: "yape",
        installments: 1,
        email
      });
    } catch (err) {
      setError(err.message || "No se pudo iniciar el pago con Yape.");
      setLoading(false);
    }
  };

  if (method === "yape") {
    return (
      <form onSubmit={handleYape} className="space-y-4">
        <p className="text-sm text-slate-600">
          Paga <strong>{amount || 0} soles</strong> con Yape. El código de aprobación sale en la app de Yape, menú Código de aprobación.
        </p>
        {testMode && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Prueba, sin cobro real: celular 111111111 y código 123456.
          </p>
        )}
        <label className="block text-sm font-medium text-slate-700">
          Celular
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="numeric"
            autoComplete="tel"
            maxLength={9}
            placeholder="9 dígitos"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Código de aprobación
          <input
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6 dígitos"
            className={fieldClass}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#742284] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Procesando..." : "Pagar con Yape"}
        </button>
      </form>
    );
  }

  return (
    <form id="form-checkout-tarjeta" className="space-y-3">
      <p className="text-sm text-slate-600">
        Paga <strong>{amount || 0} soles</strong> con tarjeta.
      </p>
      {testMode && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Prueba, sin cobro real: Visa 4009 1753 3280 6176, CVV 123, 11/30, titular APRO, documento 12345678.
        </p>
      )}
      <div>
        <p className="text-sm font-medium text-slate-700">Número</p>
        <div id="form-checkout__cardNumber" className="mt-1 h-11 rounded-xl border border-slate-200 px-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Vencimiento</p>
          <div id="form-checkout__expirationDate" className="mt-1 h-11 rounded-xl border border-slate-200 px-2" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">CVV</p>
          <div id="form-checkout__securityCode" className="mt-1 h-11 rounded-xl border border-slate-200 px-2" />
        </div>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Titular
        <input id="form-checkout__cardholderName" type="text" className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Banco
        <select id="form-checkout__issuer" className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Cuotas
        <select id="form-checkout__installments" className={fieldClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Documento
          <select id="form-checkout__identificationType" className={fieldClass} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Número
          <input id="form-checkout__identificationNumber" type="text" className={fieldClass} />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Correo
        <input id="form-checkout__cardholderEmail" type="email" defaultValue={email || ""} className={fieldClass} />
      </label>
      {!ready && !error && <p className="text-sm text-slate-500">Abriendo el formulario de tarjeta...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !ready}
        className="w-full rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Procesando..." : "Pagar con tarjeta"}
      </button>
    </form>
  );
};

export default MpCheckoutForm;
