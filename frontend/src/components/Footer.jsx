/**
 * Footer.jsx — Pie de página profesional
 * Footer completo con columnas de información, enlaces y contacto.
 */
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7h11v10H3z" />
                  <path d="M14 10h4l3 3v4h-7z" />
                  <circle cx="7" cy="19" r="1.5" />
                  <circle cx="18" cy="19" r="1.5" />
                </svg>
              </span>
              <span className="text-lg font-extrabold">TingoCargo</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Distribución segura en Tingo María. Conectamos distribuidoras con clientes con seguimiento en tiempo real.
            </p>
          </div>

          {/* Servicios */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Servicios
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li>Envío de paquetes</li>
              <li>Rastreo en tiempo real</li>
              <li>Distribución empresarial</li>
              <li>Gestión de almacén</li>
            </ul>
          </div>

          {/* Enlaces */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Accesos
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/" className="text-slate-400 hover:text-brand-400 transition-colors">
                  Rastrear paquete
                </Link>
              </li>
              <li>
                <Link to="/cliente/login" className="text-slate-400 hover:text-brand-400 transition-colors">
                  Portal de cliente
                </Link>
              </li>
              <li>
                <Link to="/cliente/registro" className="text-slate-400 hover:text-brand-400 transition-colors">
                  Crear cuenta
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="text-slate-400 hover:text-brand-400 transition-colors">
                  Panel administrativo
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Contacto
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                Tingo María, Huánuco
              </li>
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
                <a href="tel:+51930911812" className="hover:text-white transition-colors">
                  +51 930 911 812
                </a>
              </li>
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <path d="M22 6l-10 7L2 6" />
                </svg>
                info@tingocargo.com
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} TingoCargo. Todos los derechos reservados.
          </p>
          <p className="text-xs text-slate-500">
            Distribución segura · Tingo María, Perú
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
