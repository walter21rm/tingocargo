/**
 * AdminPackageDetail.jsx — Detalle de paquete
 * Muestra la información completa del paquete con un timeline del historial de estados.
 * Permite cambiar el estado del envío y registrar el pago.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Timeline from "../components/Timeline.jsx";
import {
  getPackageById,
  getUser,
  updatePackageStatus,
  reprogramarPackage,
  updatePackagePrecio,
  updatePackageOperador,
  updatePackageRepartidor,
  listOperators,
  listCouriers,
  registrarPagoDestino
} from "../services/api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";

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

const AdminPackageDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const roleName = user?.roleName;
  const canMarkSalida =
    roleName === "Administrador" || roleName === "Operador logístico";
  const canConfirmEntrega = canMarkSalida || roleName === "Repartidor";
  const canMarkFailed = canConfirmEntrega;
  const canCallOperator =
    roleName === "Administrador" || roleName === "Repartidor";
  const canCallCourier =
    roleName === "Administrador" || roleName === "Operador logístico";
  const [pkg, setPkg] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [failedAttemptModalOpen, setFailedAttemptModalOpen] = useState(false);
  const [failedAttemptObservacion, setFailedAttemptObservacion] = useState("");
  const [reprogramarModalOpen, setReprogramarModalOpen] = useState(false);
  const [reprogramarForm, setReprogramarForm] = useState({
    direccion: "",
    fecha: "",
    horaInicio: "09:00"
  });
  const [precioForm, setPrecioForm] = useState("");
  const [precioLoading, setPrecioLoading] = useState(false);
  const [operators, setOperators] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const canSetPrecio =
    (roleName === "Administrador" || roleName === "Operador logístico") &&
    pkg?.pesoKg > 2 &&
    (!pkg?.precioEnvio || pkg.precioEnvio <= 0);

  const loadPackage = async () => {
    try {
      const data = await getPackageById(id);
      setPkg(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar el paquete.");
    }
  };

  useEffect(() => {
    loadPackage();
  }, [id]);

  useEffect(() => {
    if (roleName === "Administrador" || roleName === "Operador logístico") {
      Promise.all([listOperators(), listCouriers()])
        .then(([ops, coups]) => {
          setOperators(ops);
          setCouriers(coups);
        })
        .catch(() => {});
    }
  }, [roleName]);

  useEffect(() => {
    if (pkg?.pesoKg > 2 && (!pkg?.precioEnvio || pkg.precioEnvio <= 0)) {
      setPrecioForm("");
    } else if (pkg?.precioEnvio) {
      setPrecioForm(String(pkg.precioEnvio));
    }
  }, [pkg?.pesoKg, pkg?.precioEnvio]);


  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleWhatsApp = () => {
    setNotice("");
    const phoneRaw =
      pkg?.destinatario?.telefono || pkg?.remitente?.telefono || "";
    const phone = phoneRaw.replace(/[^\d]/g, "");
    if (!phone) {
      setNotice("No hay teléfono registrado para WhatsApp.");
      return;
    }
    const nombre = pkg?.destinatario?.nombre || pkg?.remitente?.nombre || "cliente";
    const codigo = pkg?.codigoSeguimiento || "";
    const estado = pkg?.estadoActual || "En Almacén";
    let texto = "";
    if (estado === "En Almacén") {
      texto = `Hola ${nombre}, tu paquete con código ${codigo} se encuentra actualmente en nuestro almacén y pronto saldrá en camino. Puedes rastrear su estado en cualquier momento ingresando este código en nuestra página de seguimiento.`;
    } else if (estado === "En Tránsito") {
      texto = `Hola ${nombre}, tu paquete con código ${codigo} está en camino hacia ti. Puedes rastrear su estado en cualquier momento ingresando este código en nuestra página de seguimiento.`;
    } else if (estado === "Entregado") {
      texto = `Hola ${nombre}, tu paquete con código ${codigo} fue entregado correctamente. Gracias por confiar en nosotros.`;
    } else if (estado === "Intento fallido") {
      texto = `Hola ${nombre}, hubo un intento de entrega de tu paquete con código ${codigo}. Por favor contáctanos para reprogramar la entrega.`;
    } else {
      texto = `Hola ${nombre}, consulta sobre tu paquete con código ${codigo}. Puedes rastrear su estado ingresando este código en nuestra página de seguimiento.`;
    }
    const message = encodeURIComponent(texto);
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const dialPhone = (rawPhone) => {
    const phone = (rawPhone || "").replace(/[^\d+]/g, "");
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  const openWhatsApp = (rawPhone) => {
    const phone = (rawPhone || "").replace(/[^\d]/g, "");
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  const operatorPhone = pkg?.operador?.telefono || "";
  const courierPhone = pkg?.repartidor?.telefono || "";
  const clientPhone = pkg?.destinatario?.telefono || "";

  const handleAction = async () => {
    if (!pkg) return;
    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      if (pkg.estadoActual === "En Almacén") {
        await updatePackageStatus(pkg.id, {
          estado: "En Tránsito",
          observacion: "Salida registrada"
        });
        setNotice("Salida registrada");
      } else if (pkg.estadoActual === "En Tránsito") {
        await updatePackageStatus(pkg.id, {
          estado: "Entregado",
          observacion: "Entrega registrada"
        });
        setNotice("Entrega registrada");
      }
      await loadPackage();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (estado, observacionDefault) => {
    if (!pkg) return;
    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      await updatePackageStatus(pkg.id, {
        estado,
        observacion: observacionDefault || ""
      });
      setNotice(
        estado === "Entregado" ? "Entrega registrada" : "Intento fallido"
      );
      await loadPackage();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado.");
    } finally {
      setActionLoading(false);
    }
  };

  const openFailedAttemptModal = () => {
    setFailedAttemptObservacion("");
    setFailedAttemptModalOpen(true);
  };

  const closeFailedAttemptModal = () => {
    setFailedAttemptModalOpen(false);
    setFailedAttemptObservacion("");
  };

  const confirmFailedAttempt = async () => {
    await handleStatusChange(
      "Intento fallido",
      failedAttemptObservacion.trim() || ""
    );
    closeFailedAttemptModal();
  };

  const horaFinFromInicio = (horaInicio) => {
    const [h, m] = horaInicio.split(":").map(Number);
    const end = h + 3;
    return `${String(end).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const openReprogramarModal = () => {
    setReprogramarForm({
      direccion: pkg?.destinoTexto || "",
      fecha: "",
      horaInicio: "09:00"
    });
    setReprogramarModalOpen(true);
  };

  const closeReprogramarModal = () => {
    setReprogramarModalOpen(false);
  };

  const handleReprogramarChange = (e) => {
    const { name, value } = e.target;
    setReprogramarForm((prev) => ({ ...prev, [name]: value }));
  };

  const isOperadorDelPaquete =
    pkg?.operador?.id && String(pkg.operador.id) === String(user?.id);

  const handleAssignOperador = async (operadorId) => {
    setAssignLoading(true);
    setError("");
    setNotice("");
    try {
      await updatePackageOperador(pkg.id, operadorId || null);
      setNotice("Operador asignado.");
      await loadPackage();
    } catch (err) {
      setError(err.message || "No se pudo asignar.");
    } finally {
      setAssignLoading(false);
    }
  };

  const canRegistrarPago =
    (roleName === "Repartidor" ||
      roleName === "Operador logístico" ||
      roleName === "Administrador") &&
    !pkg?.pagado &&
    (pkg?.precioEnvio || 0) > 0 &&
    (roleName !== "Repartidor" ||
      String(pkg?.repartidor?.id) === String(user?.id));

  const [confirmAction, setConfirmAction] = useState({ open: false, type: "" });
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [pagoMetodo, setPagoMetodo] = useState(null);
  const [pagoLoading, setPagoLoading] = useState(false);

  const METODOS_PAGO = [
    { id: "tarjeta", label: "Tarjeta de crédito/débito", icon: "💳" },
    { id: "yape", label: "Yape", icon: "📱" },
    { id: "efectivo", label: "Efectivo", icon: "💵" }
  ];

  const handleConfirmarPago = async () => {
    if (!pagoMetodo) return;
    setPagoLoading(true);
    setError("");
    setNotice("");
    try {
      await registrarPagoDestino(pkg.id, pagoMetodo);
      setNotice(`Pago registrado (${pagoMetodo}).`);
      setPagoModalOpen(false);
      setPagoMetodo(null);
      await loadPackage();
    } catch (err) {
      setError(err.message || "No se pudo registrar el pago.");
    } finally {
      setPagoLoading(false);
    }
  };

  const handleAssignRepartidor = async (repartidorId) => {
    setAssignLoading(true);
    setError("");
    setNotice("");
    try {
      await updatePackageRepartidor(pkg.id, repartidorId || null);
      setNotice("Repartidor asignado.");
      await loadPackage();
    } catch (err) {
      setError(err.message || "No se pudo asignar.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleSetPrecio = async () => {
    const precio = parseFloat(precioForm);
    if (Number.isNaN(precio) || precio < 0) {
      setNotice("Ingresa un precio válido.");
      return;
    }
    setPrecioLoading(true);
    setError("");
    setNotice("");
    try {
      await updatePackagePrecio(pkg.id, precio);
      setNotice("Precio asignado correctamente.");
      await loadPackage();
    } catch (err) {
      setError(err.message || "No se pudo asignar el precio.");
    } finally {
      setPrecioLoading(false);
    }
  };

  const confirmReprogramar = async () => {
    const { direccion, fecha, horaInicio } = reprogramarForm;
    if (!fecha || !horaInicio) {
      setNotice("Ingresa la fecha y la hora.");
      return;
    }
    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      await reprogramarPackage(pkg.id, {
        fecha,
        horaInicio,
        horaFin: horaFinFromInicio(horaInicio),
        direccion: direccion?.trim() || null
      });
      setNotice("Envío reprogramado correctamente.");
      closeReprogramarModal();
      await loadPackage();
    } catch (err) {
      setError(err.message || "No se pudo reprogramar.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmitirBoleta = () => {
    if (!pkg) return;
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) {
      setNotice("No se pudo abrir la ventana. Permite las ventanas emergentes.");
      return;
    }
    const fecha = formatDate(pkg.creadoEn);
    const fechaPago = pkg.pagadoEn ? formatDate(pkg.pagadoEn) : fecha;
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Boleta - ${pkg.codigoSeguimiento}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; padding: 40px; background: #fff; }
  .boleta { max-width: 700px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #177a55; padding-bottom: 20px; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-icon { width: 48px; height: 48px; background: #177a55; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .brand-icon svg { width: 24px; height: 24px; stroke: white; fill: none; stroke-width: 2; }
  .brand-name { font-size: 22px; font-weight: 800; color: #177a55; }
  .brand-sub { font-size: 11px; color: #94a3b8; }
  .boleta-title { text-align: right; }
  .boleta-title h2 { font-size: 24px; font-weight: 800; color: #177a55; text-transform: uppercase; letter-spacing: 2px; }
  .boleta-title p { font-size: 12px; color: #64748b; margin-top: 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .info-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
  .info-box h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; margin-bottom: 8px; }
  .info-box p { font-size: 13px; color: #334155; line-height: 1.6; }
  .info-box .name { font-size: 15px; font-weight: 700; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; padding: 10px 16px; text-align: left; }
  thead th:first-child { border-radius: 8px 0 0 8px; }
  thead th:last-child { border-radius: 0 8px 8px 0; text-align: right; }
  tbody td { padding: 12px 16px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; }
  tbody td:last-child { text-align: right; font-weight: 600; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-box { width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #475569; }
  .totals-row.total { border-top: 2px solid #177a55; padding-top: 12px; margin-top: 4px; font-size: 16px; font-weight: 800; color: #177a55; }
  .payment-badge { display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; color: #177a55; border: 1px solid #a7f3d0; border-radius: 20px; padding: 6px 16px; font-size: 12px; font-weight: 700; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; }
  .footer p { font-size: 11px; color: #94a3b8; line-height: 1.8; }
  .footer .thanks { font-size: 14px; color: #177a55; font-weight: 700; margin-bottom: 8px; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="boleta">
  <div class="header">
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24"><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/></svg>
      </div>
      <div>
        <div class="brand-name">TingoCargo</div>
        <div class="brand-sub">Tingo María, Huánuco — RUC: 10000000001</div>
      </div>
    </div>
    <div class="boleta-title">
      <h2>Boleta de Venta</h2>
      <p><strong>${pkg.codigoSeguimiento}</strong></p>
      <p>Fecha: ${fechaPago}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h4>Remitente</h4>
      <p class="name">${pkg.remitente?.nombre || "—"}</p>
      <p>${pkg.remitente?.documento ? "Doc: " + pkg.remitente.documento : ""}</p>
      <p>${pkg.remitente?.telefono || ""}</p>
    </div>
    <div class="info-box">
      <h4>Destinatario</h4>
      <p class="name">${pkg.destinatario?.nombre || "—"}</p>
      <p>${pkg.destinatario?.direccion || ""}</p>
      <p>${pkg.destinatario?.telefono || ""}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Detalle</th>
        <th>Monto</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Servicio de envío</strong><br><span style="font-size:11px;color:#94a3b8">Código: ${pkg.codigoSeguimiento}</span></td>
        <td>${pkg.descripcion || "Paquete estándar"}${pkg.pesoKg ? "<br>Peso: " + pkg.pesoKg + " kg" : ""}</td>
        <td>S/ ${(pkg.precioEnvio || 0).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>S/ ${(pkg.precioEnvio || 0).toFixed(2)}</span>
      </div>
      <div class="totals-row">
        <span>IGV (incl.)</span>
        <span>S/ ${((pkg.precioEnvio || 0) * 0.18 / 1.18).toFixed(2)}</span>
      </div>
      <div class="totals-row total">
        <span>Total</span>
        <span>S/ ${(pkg.precioEnvio || 0).toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div style="margin-bottom:20px">
    <span class="payment-badge">✓ Pagado — ${pkg.metodoPago || "N/A"}</span>
    <span style="margin-left:8px;font-size:12px;color:#64748b">Paga: ${pkg.quienPaga === "remitente" ? "Remitente" : "Destinatario"}</span>
  </div>

  <div class="footer">
    <p class="thanks">¡Gracias por confiar en TingoCargo!</p>
    <p>Distribución segura — Tingo María, Perú</p>
    <p>Este documento es una representación impresa de la boleta electrónica.</p>
  </div>

  <div class="no-print" style="text-align:center;margin-top:30px">
    <button onclick="window.print()" style="background:#177a55;color:white;border:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
      Imprimir / Guardar PDF
    </button>
  </div>
</div>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
  };

  const handleOpenMap = () => {
    const rawAddress =
      pkg?.destinoTexto ||
      pkg?.destinatario?.direccion ||
      "";
    if (!rawAddress) {
      setNotice("No hay dirección registrada.");
      return;
    }
    const lower = rawAddress.toLowerCase();
    const alreadyHasCity =
      lower.includes("tingo") ||
      lower.includes("huánuco") ||
      lower.includes("huanuco") ||
      lower.includes("lima") ||
      lower.includes("perú") ||
      lower.includes("peru");

    let address = rawAddress;
    if (!alreadyHasCity) {
      const sucursalDir = pkg?.sucursalDestino?.direccion || pkg?.sucursalOrigen?.direccion || "";
      const sucursalNombre = pkg?.sucursalDestino?.nombre || pkg?.sucursalOrigen?.nombre || "";
      if (sucursalDir) {
        address = `${rawAddress}, ${sucursalDir}`;
      } else if (sucursalNombre) {
        address = `${rawAddress}, ${sucursalNombre}, Perú`;
      } else {
        address = `${rawAddress}, Perú`;
      }
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  if (!pkg && !error) {
    return <div className="text-slate-500">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 break-all">
            {pkg?.codigoSeguimiento}
          </h1>
          <p className="text-sm text-slate-500">
            Registrado el {formatDate(pkg?.creadoEn)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-4 py-1 text-sm font-semibold ${statusTone(
              pkg?.estadoActual
            )}`}
          >
            {pkg?.estadoActual}
          </span>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white"
          >
            Notificar WhatsApp
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="fixed right-4 left-4 top-4 sm:left-auto sm:right-6 sm:top-6 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          {notice}
        </div>
      )}

      {pkg && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                Remitente ({pkg.remitenteTipo || "Distribuidora"})
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {pkg.remitente?.nombre || "Sin remitente"}
              </p>
              {pkg.remitente?.documento && (
                <p className="mt-2 text-sm text-slate-500">
                  Documento: {pkg.remitente.documento}
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                Operador asignado
              </p>
              {roleName === "Administrador" ? (
                <div className="mt-2">
                  <select
                    value={pkg.operador?.id || ""}
                    onChange={(e) => handleAssignOperador(e.target.value || null)}
                    disabled={assignLoading}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <option value="">Sin asignar</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.nombre}
                      </option>
                    ))}
                  </select>
                  {pkg.operador && (
                    <p className="mt-2 text-xs text-slate-500">
                      {pkg.operador.telefono || ""} {pkg.operador.email || ""}
                    </p>
                  )}
                </div>
              ) : roleName === "Operador logístico" && !pkg.operador?.id ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => handleAssignOperador(user.id)}
                    disabled={assignLoading}
                    className="w-full rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                  >
                    {assignLoading ? "Asignando..." : "Asignarme a este paquete"}
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {pkg.operador?.nombre || "Sin asignar"}
                  </p>
                  <div className="mt-3 text-sm text-slate-500">
                    <p>{pkg.operador?.telefono || "Teléfono no registrado"}</p>
                    {pkg.operador?.email && <p>{pkg.operador.email}</p>}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                Repartidor asignado
              </p>
              {(roleName === "Administrador" || (roleName === "Operador logístico" && isOperadorDelPaquete)) ? (
                <div className="mt-2">
                  <select
                    value={pkg.repartidor?.id || ""}
                    onChange={(e) => handleAssignRepartidor(e.target.value || null)}
                    disabled={assignLoading}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <option value="">Sin asignar</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  {pkg.repartidor && (
                    <p className="mt-2 text-xs text-slate-500">
                      {pkg.repartidor.telefono || ""} {pkg.repartidor.email || ""}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {pkg.repartidor?.nombre || "Sin asignar"}
                  </p>
                  <div className="mt-3 text-sm text-slate-500">
                    <p>{pkg.repartidor?.telefono || "Teléfono no registrado"}</p>
                    {pkg.repartidor?.email && <p>{pkg.repartidor.email}</p>}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                Cliente destino
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {pkg.destinatario?.nombre || "Sin destinatario"}
              </p>
              <div className="mt-3 text-sm text-slate-500">
                <p>{pkg.destinatario?.direccion || "Dirección no registrada"}</p>
                <p>{pkg.destinatario?.telefono || "Teléfono no registrado"}</p>
                {pkg.destinoTexto && (
                  <p>Destino: {pkg.destinoTexto}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleOpenMap}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Ver ubicación en mapa
              </button>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Detalles</p>
              {(pkg.pesoKg || 0) > 0 && (
                <p className="mt-2 text-sm text-slate-600">
                  Peso: {pkg.pesoKg} kg • Precio: {pkg.precioEnvio ?? 0} soles
                  {pkg.quienPaga && (
                    <span className="text-slate-500"> • Paga: {pkg.quienPaga === "remitente" ? "Remitente" : "Destinatario"}</span>
                  )}
                  {pkg.pagado && <span className="text-brand-600 font-semibold"> • Pagado</span>}
                </p>
              )}
              <p className="mt-3 text-sm text-slate-500">Descripción</p>
              <p className="text-slate-800">
                {pkg.descripcion || "Sin descripción"}
              </p>
              {pkg.reprogramacionFecha && (
                <div className="mt-4 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
                  <p className="text-xs font-semibold text-brand-700">Próxima entrega programada</p>
                  <p className="mt-1 text-sm text-slate-800">
                    {new Date(pkg.reprogramacionFecha + "T12:00:00").toLocaleDateString("es-PE", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}{" "}
                    • {pkg.reprogramacionHoraInicio} — {pkg.reprogramacionHoraFin}
                  </p>
                  {pkg.reprogramacionDireccion && (
                    <p className="mt-1 text-xs text-slate-600">{pkg.reprogramacionDireccion}</p>
                  )}
                </div>
              )}
              <p className="mt-3 text-sm text-slate-500">Observaciones</p>
              <p className="text-slate-800">
                {pkg.historial?.[pkg.historial.length - 1]?.observacion ||
                  "Sin observaciones"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {canSetPrecio && (
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Asignar precio (paquete &gt; 2 kg)</p>
                <p className="mt-1 text-xs text-slate-500">
                  El operador debe asignar el precio antes de que el cliente pueda pagar.
                </p>
                <div className="mt-4 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precioForm}
                    onChange={(e) => setPrecioForm(e.target.value)}
                    placeholder="Precio en soles"
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSetPrecio}
                    disabled={precioLoading}
                    className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {precioLoading ? "Guardando..." : "Asignar"}
                  </button>
                </div>
              </div>
            )}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 text-center">
              <p className="text-sm font-semibold text-slate-700">Acciones</p>
              <div className="mt-4 flex flex-col gap-2">
                {[
                  { label: "Operador", phone: operatorPhone, nombre: pkg?.operador?.nombre },
                  { label: "Repartidor", phone: courierPhone, nombre: pkg?.repartidor?.nombre },
                  { label: "Cliente", phone: clientPhone, nombre: pkg?.destinatario?.nombre }
                ].map((c) => {
                  const cleanPhone = (c.phone || "").replace(/[^\d]/g, "");
                  const hasPhone = !!cleanPhone;
                  return (
                    <div key={c.label} className={`rounded-xl border p-3 ${hasPhone ? "border-slate-200" : "border-slate-100"}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <p className={`text-xs font-semibold ${hasPhone ? "text-slate-500" : "text-slate-300"}`}>{c.label}</p>
                          <p className={`text-sm font-bold ${hasPhone ? "text-slate-800" : "text-slate-300"}`}>
                            {hasPhone ? c.phone : "Sin teléfono"}
                          </p>
                        </div>
                        {hasPhone && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openWhatsApp(c.phone)}
                              title={`WhatsApp a ${c.nombre || c.label}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.546 4.093 1.503 5.818L.037 24l6.327-1.437C8.006 23.453 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.82 0-3.545-.47-5.047-1.297l-.362-.214-3.75.852.893-3.653-.235-.374A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                              </svg>
                            </button>
                            <a
                              href={`tel:${cleanPhone}`}
                              title={`Llamar a ${c.nombre || c.label}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors hover:bg-brand-100"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                              </svg>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(c.phone).then(() => setNotice(`Número ${c.phone} copiado.`)).catch(() => setNotice(`Número: ${c.phone}`));
                              }}
                              title="Copiar número"
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {pkg.estadoActual === "En Almacén" && canMarkSalida && (
                <button
                  type="button"
                  onClick={() => setConfirmAction({ open: true, type: "salida" })}
                  disabled={actionLoading}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7h11v10H3z" />
                    <path d="M14 10h4l3 3v4h-7z" />
                    <circle cx="7" cy="19" r="1.5" />
                    <circle cx="18" cy="19" r="1.5" />
                  </svg>
                  {actionLoading ? "Procesando..." : "Marcar Salida"}
                </button>
              )}
              {pkg?.pagado && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-semibold text-center">
                    Pagado{pkg?.metodoPago ? ` (${pkg.metodoPago})` : ""} — {pkg?.precioEnvio || 0} soles
                  </div>
                  <button
                    type="button"
                    onClick={handleEmitirBoleta}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Emitir Boleta
                  </button>
                </div>
              )}
              {canRegistrarPago && (
                <button
                  type="button"
                  onClick={() => { setPagoMetodo(null); setPagoModalOpen(true); }}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border-2 border-dashed border-brand-300 bg-brand-50 px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                >
                  💰 Registrar pago ({pkg?.precioEnvio || 0} soles)
                </button>
              )}
              {pkg.estadoActual === "En Tránsito" && canConfirmEntrega && (
                <button
                  type="button"
                  onClick={() => setConfirmAction({ open: true, type: "entrega" })}
                  disabled={actionLoading}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12l2.5 2.5L16 9" />
                  </svg>
                  {actionLoading ? "Procesando..." : "Confirmar Entrega"}
                </button>
              )}}
              {pkg.estadoActual === "En Tránsito" && canMarkFailed && (
                <button
                  type="button"
                  onClick={openFailedAttemptModal}
                  disabled={actionLoading}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-red-200 px-6 py-3 text-sm font-semibold text-red-600"
                >
                  Registrar intento fallido
                </button>
              )}
              {pkg.estadoActual === "Entregado" && (
                <div className="mt-6 flex flex-col items-center gap-3 text-brand-700">
                  <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12l2.5 2.5L16 9" />
                  </svg>
                  <p className="font-semibold">Paquete Entregado</p>
                </div>
              )}
              {pkg.estadoActual === "Intento fallido" && canConfirmEntrega && (
                <button
                  type="button"
                  onClick={openReprogramarModal}
                  disabled={actionLoading}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  Reprogramar envío
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/admin/paquetes")}
                className="mt-6 w-full rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
              >
                Volver a paquetes
              </button>
            </div>

            <Timeline items={pkg.historial || []} title="Línea de tiempo" />
          </div>
        </div>
      )}

      {reprogramarModalOpen && (
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
                  <p className="text-sm text-white/90">Define la nueva fecha y horario de entrega</p>
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
                disabled={actionLoading}
                className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
              >
                {actionLoading ? "Guardando..." : "Reprogramar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {failedAttemptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-red-600">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </span>
              <h3 className="text-lg font-semibold text-slate-900">
                Registrar intento fallido
              </h3>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Indica el motivo del intento fallido (opcional). El cliente podrá ver esta información en el historial.
            </p>
            <textarea
              value={failedAttemptObservacion}
              onChange={(e) => setFailedAttemptObservacion(e.target.value)}
              placeholder="Ej: Cliente no se encontraba, dirección incorrecta..."
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeFailedAttemptModal}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmFailedAttempt}
                disabled={actionLoading}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {actionLoading ? "Guardando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmAction.open && confirmAction.type === "salida"}
        title="¿Marcar salida del paquete?"
        message={`El paquete ${pkg?.codigoSeguimiento} cambiará a estado "En Tránsito". Esta acción no se puede deshacer.`}
        confirmText="Sí, marcar salida"
        onConfirm={() => { setConfirmAction({ open: false, type: "" }); handleAction(); }}
        onCancel={() => setConfirmAction({ open: false, type: "" })}
        loading={actionLoading}
      />

      <ConfirmModal
        open={confirmAction.open && confirmAction.type === "entrega"}
        title="¿Confirmar entrega del paquete?"
        message={`El paquete ${pkg?.codigoSeguimiento} se marcará como "Entregado". Verifica que el cliente haya recibido el paquete.`}
        confirmText="Sí, confirmar entrega"
        onConfirm={() => { setConfirmAction({ open: false, type: "" }); handleAction(); }}
        onCancel={() => setConfirmAction({ open: false, type: "" })}
        loading={actionLoading}
      />

      {pagoModalOpen && canRegistrarPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Registrar pago</h3>
              <p className="mt-1 text-sm text-slate-500">
                Monto: <strong>{pkg?.precioEnvio || 0} soles</strong>
                {pkg?.quienPaga && (
                  <span> — Paga: {pkg.quienPaga === "remitente" ? "Remitente" : "Destinatario"}</span>
                )}
              </p>
            </div>
            <div className="p-6">
              {!pagoMetodo ? (
                <div className="space-y-2">
                  {METODOS_PAGO.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPagoMetodo(m.id)}
                      className="flex w-full items-center gap-4 rounded-xl border border-slate-200 px-4 py-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
                    >
                      <span className="text-2xl">{m.icon}</span>
                      <span className="font-medium text-slate-800">{m.label}</span>
                    </button>
                  ))}
                </div>
              ) : pagoMetodo === "tarjeta" ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Simulación de pago con tarjeta</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <span className="text-3xl">💳</span>
                    <p className="mt-2 text-sm text-slate-700">
                      Se registrará el pago de <strong>{pkg?.precioEnvio || 0} soles</strong> con tarjeta.
                    </p>
                  </div>
                </div>
              ) : pagoMetodo === "yape" ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8">
                    <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm">
                      📱
                    </div>
                    <p className="mt-4 text-center text-sm font-medium text-slate-700">
                      Abre Yape y escanea el código
                    </p>
                    <p className="mt-1 text-center text-xs text-slate-500">
                      Monto: {pkg?.precioEnvio || 0} soles
                    </p>
                  </div>
                  <p className="text-center text-xs text-slate-500">
                    Simulación: haz clic en confirmar para registrar el pago
                  </p>
                </div>
              ) : pagoMetodo === "efectivo" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700">
                      Se registrará el pago en efectivo por{" "}
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
                  if (pagoMetodo) setPagoMetodo(null);
                  else setPagoModalOpen(false);
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600"
              >
                {pagoMetodo ? "Volver" : "Cancelar"}
              </button>
              {pagoMetodo && (
                <button
                  type="button"
                  onClick={handleConfirmarPago}
                  disabled={pagoLoading}
                  className="flex-1 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pagoLoading ? "Procesando..." : "Confirmar pago"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPackageDetail;
