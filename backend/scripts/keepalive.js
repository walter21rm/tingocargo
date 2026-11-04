/**
 * Mantiene despierta la API y registra una muestra de disponibilidad.
 * Pensado para un cron cada 10 minutos. Si el servicio no responde, el
 * hueco queda como caída al calcular el 99% del horario 08:00–20:00.
 */
const healthUrl =
  process.env.HEALTH_URL || "http://127.0.0.1:4000/api/health";
const pingUrl =
  process.env.AVAILABILITY_URL ||
  healthUrl.replace(/\/api\/health$/, "/api/health/ping");

const response = await fetch(healthUrl, { signal: AbortSignal.timeout(8000) });
if (!response.ok) {
  console.error(`Health ${response.status}`);
  process.exit(1);
}
await fetch(pingUrl, { method: "POST", signal: AbortSignal.timeout(8000) });
console.log("keepalive ok", healthUrl);
