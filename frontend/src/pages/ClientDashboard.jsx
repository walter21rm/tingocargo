/**
 * ClientDashboard.jsx — Panel principal del cliente
 * Página de inicio del portal de clientes con accesos directos a las
 * funcionalidades principales: crear envíos, ver paquetes y rastrear.
 */
import { Link } from "react-router-dom";

const ClientDashboard = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bienvenido</h1>
        <p className="mt-1 text-slate-600">
          Gestiona tus envíos, rastrea paquetes y realiza pagos desde aquí.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/cliente/enviar"
          className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-md"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h11v10H3z" />
              <path d="M14 10h4l3 3v4h-7z" />
              <circle cx="7" cy="19" r="1.5" />
              <circle cx="18" cy="19" r="1.5" />
            </svg>
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Enviar paquete</h2>
          <p className="mt-2 text-sm text-slate-500">
            Ingresa los datos del destinatario y el peso. Tarifa estándar: 10 soles por paquete hasta 2 kg.
          </p>
        </Link>

        <Link
          to="/cliente/rastrear"
          className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-md"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Rastrear</h2>
          <p className="mt-2 text-sm text-slate-500">
            Ingresa el código de seguimiento para ver el estado de tu envío en tiempo real.
          </p>
        </Link>

        <Link
          to="/cliente/envios"
          className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-md"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Mis envíos</h2>
          <p className="mt-2 text-sm text-slate-500">
            Revisa todos tus paquetes enviados y recibidos, y realiza el pago cuando corresponda.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default ClientDashboard;
