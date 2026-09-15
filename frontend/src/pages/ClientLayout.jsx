/**
 * ClientLayout.jsx — Layout del portal de clientes
 * Contenedor principal del portal con header profesional, tabs de navegación
 * y menú responsive. Diseño moderno con gradientes sutiles.
 */
import { useState } from "react";
import { Outlet, Link, useNavigate, NavLink } from "react-router-dom";
import { getUser, clearToken } from "../services/api.js";

const ClientLayout = () => {
  const user = getUser();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const tabClass = ({ isActive }) =>
    `flex items-center gap-2 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
      isActive
        ? "border-brand-600 text-brand-700"
        : "border-transparent text-slate-500 hover:text-brand-600 hover:border-brand-200"
    }`;

  const mobileNavClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
      isActive
        ? "bg-brand-600 text-white shadow-sm"
        : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
          <Link to="/cliente" className="flex items-center gap-3 group">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm transition-transform group-hover:scale-105">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7h11v10H3z" />
                <path d="M14 10h4l3 3v4h-7z" />
                <circle cx="7" cy="19" r="1.5" />
                <circle cx="18" cy="19" r="1.5" />
              </svg>
            </span>
            <span className="hidden sm:block">
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">TingoCargo</span>
              <span className="block text-[11px] font-medium text-slate-400">Mi cuenta</span>
            </span>
          </Link>

          <div className="hidden items-center gap-4 sm:flex">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {(user?.nombre || "U").charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">
                {user?.nombre || user?.email}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Salir
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-50 sm:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-100 px-4 pb-4 sm:hidden animate-fade-in">
            <div className="flex items-center gap-3 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {(user?.nombre || "U").charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-slate-700 truncate">{user?.nombre || user?.email}</span>
            </div>
            <div className="flex flex-col gap-1">
              <NavLink to="/cliente" end onClick={() => setMenuOpen(false)} className={mobileNavClass}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
                Inicio
              </NavLink>
              <NavLink to="/cliente/enviar" onClick={() => setMenuOpen(false)} className={mobileNavClass}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                Enviar paquete
              </NavLink>
              <NavLink to="/cliente/rastrear" onClick={() => setMenuOpen(false)} className={mobileNavClass}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                Rastrear
              </NavLink>
              <NavLink to="/cliente/envios" onClick={() => setMenuOpen(false)} className={mobileNavClass}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h11v10H3z" /><path d="M14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="1.5" /><circle cx="18" cy="19" r="1.5" /></svg>
                Mis envíos
              </NavLink>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}

        <nav className="mx-auto max-w-6xl px-4 sm:px-6 hidden sm:flex gap-6 border-t border-slate-100 overflow-x-auto">
          <NavLink to="/cliente" end className={tabClass}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
            Inicio
          </NavLink>
          <NavLink to="/cliente/enviar" className={tabClass}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            Enviar paquete
          </NavLink>
          <NavLink to="/cliente/rastrear" className={tabClass}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            Rastrear
          </NavLink>
          <NavLink to="/cliente/envios" className={tabClass}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h11v10H3z" /><path d="M14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="1.5" /><circle cx="18" cy="19" r="1.5" /></svg>
            Mis envíos
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default ClientLayout;
