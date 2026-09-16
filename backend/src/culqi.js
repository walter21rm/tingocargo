/**
 * Cliente HTTP mínimo para Culqi (modo test o live según las llaves).
 * Las tarjetas nunca llegan a este servidor: solo token + cargo.
 */

const CULQI_API = "https://api.culqi.com/v2";

export const getCulqiConfig = () => {
  const publicKey = process.env.CULQI_PUBLIC_KEY || "";
  const secretKey = process.env.CULQI_SECRET_KEY || "";
  return {
    publicKey,
    secretKey,
    enabled: Boolean(publicKey && secretKey),
    testMode: publicKey.startsWith("pk_test_")
  };
};

const culqiFetch = async (path, body) => {
  const { secretKey } = getCulqiConfig();
  const response = await fetch(`${CULQI_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.object === "error") {
    const message =
      data.user_message ||
      data.merchant_message ||
      data.message ||
      "No se pudo procesar el pago con Culqi";
    const error = new Error(message);
    error.status = response.status || 400;
    throw error;
  }
  return data;
};

export const amountToCents = (soles) => {
  const n = Number(soles) || 0;
  return Math.round(n * 100);
};

export const createCulqiOrder = async ({ amount, description, orderNumber, client }) => {
  const expiration = Math.floor(Date.now() / 1000) + 60 * 60;
  const names = String(client?.nombre || "Cliente TingoCargo").trim().split(/\s+/);
  return culqiFetch("/orders", {
    amount,
    currency_code: "PEN",
    description: description.slice(0, 80),
    order_number: String(orderNumber).slice(0, 128),
    expiration_date: expiration,
    confirm: true,
    client_details: {
      first_name: names[0] || "Cliente",
      last_name: names.slice(1).join(" ") || "TingoCargo",
      email: client?.email || "pagos@tingocargo.com",
      phone_number: String(client?.telefono || "999999999").replace(/\D/g, "").slice(-9)
    }
  });
};

export const createCulqiCharge = async ({ amount, email, sourceId, description, metadata }) =>
  culqiFetch("/charges", {
    amount,
    currency_code: "PEN",
    email,
    source_id: sourceId,
    description: description.slice(0, 80),
    metadata
  });
