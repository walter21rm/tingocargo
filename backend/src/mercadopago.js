/**
 * Cliente de Mercado Pago (Checkout Pro).
 * En pruebas usa Access Token TEST-/APP_USR de sandbox: no cobra dinero real.
 */

const MP_API = "https://api.mercadopago.com";

export const getMpConfig = () => {
  const accessToken = process.env.MP_ACCESS_TOKEN || "";
  return {
    accessToken,
    enabled: Boolean(accessToken),
    testMode: /^(TEST-|APP_USR-)/.test(accessToken) && !accessToken.includes("PROD")
  };
};

const mpFetch = async (path, { method = "GET", body } = {}) => {
  const { accessToken } = getMpConfig();
  const response = await fetch(`${MP_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
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
