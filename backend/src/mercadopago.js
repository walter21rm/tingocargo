/**
 * Cliente de Mercado Pago.
 * Yape y tarjeta se cobran con Checkout API (formulario propio).
 * En pruebas usa Access Token TEST-/APP_USR de sandbox: no cobra dinero real.
 */

import crypto from "crypto";

const MP_API = "https://api.mercadopago.com";

export const getMpConfig = () => {
  const accessToken = process.env.MP_ACCESS_TOKEN || "";
  return {
    accessToken,
    publicKey: process.env.MP_PUBLIC_KEY || "",
    enabled: Boolean(accessToken),
    testMode: /^(TEST-|APP_USR-)/.test(accessToken) && !accessToken.includes("PROD")
  };
};

const mpFetch = async (path, { method = "GET", body, headers = {} } = {}) => {
  const { accessToken } = getMpConfig();
  const response = await fetch(`${MP_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data.message ||
      data.error ||
      data.cause?.[0]?.description ||
      "Error en Mercado Pago";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
};

export const parseExternalReference = (ref) => {
  const [prefix, packageId, metodoPago] = String(ref || "").split(":");
  if (prefix !== "pkg" || !packageId) return null;
  return {
    packageId,
    metodoPago: metodoPago === "yape" ? "yape" : "tarjeta"
  };
};

export const createMpPreference = async ({
  pkg,
  metodoPago,
  payerEmail,
  frontendUrl,
  backendUrl
}) => {
  const amount = Number(pkg.precioEnvio) || 0;
  const method = metodoPago === "yape" ? "yape" : "tarjeta";
  const backBase = frontendUrl.replace(/\/$/, "");
  const successPath = `/pagos/resultado?paqueteId=${pkg.id}`;
  const paymentMethods =
    method === "yape"
      ? {
          excluded_payment_types: [
            { id: "credit_card" },
            { id: "prepaid_card" },
            { id: "ticket" },
            { id: "atm" }
          ],
          excluded_payment_methods: [{ id: "debvisa" }, { id: "debmaster" }],
          default_payment_method_id: "yape",
          installments: 1
        }
      : {
          excluded_payment_methods: [{ id: "yape" }],
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
          installments: 1
        };

  const payload = {
    items: [
      {
        title: `Envío ${pkg.codigoSeguimiento}`,
        description: pkg.descripcion || "Servicio de transporte TingoCargo",
        quantity: 1,
        currency_id: "PEN",
        unit_price: amount
      }
    ],
    payer: {
      email: payerEmail || "test_user@tingocargo.com"
    },
    external_reference: `pkg:${pkg.id}:${method}`,
    metadata: {
      paqueteId: String(pkg.id),
      codigo: pkg.codigoSeguimiento,
      metodo: method
    },
    payment_methods: paymentMethods,
    statement_descriptor: "TINGOCARGO"
  };

  if (backBase.startsWith("https://")) {
    payload.back_urls = {
      success: `${backBase}${successPath}&estado=approved`,
      failure: `${backBase}${successPath}&estado=failure`,
      pending: `${backBase}${successPath}&estado=pending`
    };
    payload.auto_return = "approved";
  }

  if (backendUrl && backendUrl.startsWith("https://")) {
    payload.notification_url = `${backendUrl.replace(/\/$/, "")}/api/pagos/mercadopago/webhook`;
  }

  const preference = await mpFetch("/checkout/preferences", {
    method: "POST",
    body: payload
  });

  return {
    preferenceId: preference.id,
    checkoutUrl: preference.sandbox_init_point || preference.init_point,
    testMode: Boolean(preference.sandbox_init_point)
  };
};

export const getMpPayment = (paymentId) =>
  mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);

const PAYMENT_STATUS_TEXT = {
  cc_rejected_call_for_authorize: "El banco pidió autorización. Prueba con otro medio.",
  cc_rejected_insufficient_amount: "Fondos insuficientes.",
  cc_rejected_other_reason: "El pago fue rechazado.",
  cc_rejected_card_type_not_allowed: "Ese tipo de tarjeta no está permitido.",
  cc_rejected_max_attempts: "Se superó el número de intentos.",
  cc_rejected_bad_filled_security_code: "El código de seguridad no es válido.",
  cc_rejected_bad_filled_card_number: "El número de tarjeta no es válido.",
  cc_rejected_bad_filled_date: "La fecha de vencimiento no es válida.",
  cc_rejected_bad_filled_other: "Revisa los datos de la tarjeta.",
  cc_rejected_form_error: "Revisa los datos del formulario."
};

export const paymentStatusMessage = (payment) => {
  const detail = payment?.status_detail;
  if (PAYMENT_STATUS_TEXT[detail]) return PAYMENT_STATUS_TEXT[detail];
  if (payment?.status === "pending" || payment?.status === "in_process") {
    return "El pago quedó pendiente. Aún no se marcó el envío como pagado.";
  }
  return "El pago no fue aprobado.";
};

/**
 * Crea un cobro directo (Yape o tarjeta) con el token que generó el navegador.
 * El número de tarjeta y el código de Yape no llegan a este servidor.
 */
export const createMpCharge = ({
  token,
  amount,
  description,
  paymentMethodId,
  installments,
  issuerId,
  email,
  identificationType,
  identificationNumber,
  externalReference,
  backendUrl
}) => {
  const payer = { email: email || "test_user_pe@testuser.com" };
  if (identificationType && identificationNumber) {
    payer.identification = {
      type: identificationType,
      number: String(identificationNumber)
    };
  }
  const body = {
    transaction_amount: amount,
    token,
    description,
    installments: Number(installments) || 1,
    payment_method_id: paymentMethodId,
    payer,
    external_reference: externalReference,
    binary_mode: true
  };
  if (issuerId) body.issuer_id = String(issuerId);
  if (backendUrl && backendUrl.startsWith("https://")) {
    body.notification_url = `${backendUrl.replace(/\/$/, "")}/api/pagos/mercadopago/webhook`;
  }
  return mpFetch("/v1/payments", {
    method: "POST",
    body,
    headers: { "X-Idempotency-Key": crypto.randomUUID() }
  });
};
