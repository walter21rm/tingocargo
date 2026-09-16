/**
 * Culqi Checkout v4 — abre el formulario oficial de tarjeta o Yape.
 * El número de tarjeta nunca pasa por nuestro backend.
 */

const loadCulqiScript = () => {
  if (window.Culqi) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-culqi-checkout]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("No se pudo cargar Culqi Checkout"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.culqi.com/js/v4";
    script.async = true;
    script.dataset.culqiCheckout = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Culqi Checkout"));
    document.body.appendChild(script);
  });
};

export const openCulqiCheckout = async ({
  publicKey,
  amount,
  orderId,
  metodo,
  title
}) => {
  await loadCulqiScript();
  window.Culqi.publicKey = publicKey;
  window.Culqi.settings({
    title: title || "TingoCargo",
    currency: "PEN",
    amount,
    ...(orderId ? { order: orderId } : {})
  });
  window.Culqi.options({
    lang: "es",
    installments: false,
    paymentMethods: {
      tarjeta: metodo === "tarjeta",
      yape: metodo === "yape",
      bancaMovil: false,
      agente: false,
      billetera: false,
      cuotealo: false
    },
    style: {
      bannerColor: "#177a55",
      buttonBackground: "#177a55",
      menuColor: "#177a55",
      linksColor: "#177a55",
      buttonText: "Pagar",
      priceColor: "#136345"
    }
  });

  return new Promise((resolve, reject) => {
    window.culqi = () => {
      if (window.Culqi.token) {
        const token = window.Culqi.token;
        try {
          window.Culqi.close();
        } catch {
          /* ignore */
        }
        resolve({
          tokenId: token.id,
          email: token.email || ""
        });
        return;
      }
      const err = window.Culqi.error;
      reject(
        new Error(
          err?.user_message ||
            err?.merchant_message ||
            "El pago no se completó"
        )
      );
    };
    window.Culqi.open();
  });
};
