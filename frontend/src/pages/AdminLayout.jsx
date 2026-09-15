/**
 * AdminLayout.jsx — Layout del panel administrativo
 * Sidebar con iconos SVG por cada sección, diseño más moderno con gradientes
 * y mejor separación visual. Responsive con menú lateral deslizante.
 */
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken, getUser } from "../services/api.js";
import HelpGuide from "../components/HelpGuide.jsx";

const iconMap = {
  dashboard: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  paquetes: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  sucursales: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
    </svg>
  ),
  distribuidoras: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7h11v10H3z" />
      <path d="M14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="19" r="1.5" />
      <circle cx="18" cy="19" r="1.5" />
    </svg>
  ),
  clientes: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  usuarios: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 15a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      <circle cx="12" cy="9" r="4" />
      <path d="M20 8v4M22 10h-4" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
};

const navClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
    isActive
      ? "bg-brand-600 text-white shadow-md"
      : "text-slate-500 hover:bg-brand-50 hover:text-brand-700"
  }`;

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const user = getUser();
  const roleName = user?.roleName;
  const isAdmin = roleName === "Administrador";
  const canSeeDistributors =
    roleName === "Administrador" || roleName === "Operador logístico";
  const canSeeClients =
    roleName === "Administrador" || roleName === "Operador logístico";
  const canSeeDashboard =
    roleName === "Administrador" || roleName === "Operador logístico";
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const navItems = [
    canSeeDashboard && { to: "/admin", label: "Dashboard", icon: iconMap.dashboard, end: true },
    { to: "/admin/paquetes", label: "Paquetes", icon: iconMap.paquetes },
    isAdmin && { to: "/admin/sucursales", label: "Sucursales", icon: iconMap.sucursales },
    canSeeDistributors && { to: "/admin/distribuidoras", label: "Distribuidoras", icon: iconMap.distribuidoras },
    canSeeClients && { to: "/admin/clientes", label: "Clientes", icon: iconMap.clientes },
    isAdmin && { to: "/admin/usuarios", label: "Usuarios", icon: iconMap.usuarios },
    isAdmin && { to: "/admin/actividad", label: "Actividad", icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ) }
  ].filter(Boolean);

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h11v10H3z" />
            <path d="M14 10h4l3 3v4h-7z" />
            <circle cx="7" cy="19" r="1.5" />
            <circle cx="18" cy="19" r="1.5" />
          </svg>
        </span>
        <div>
          <p className="text-lg font-extrabold text-slate-900 tracking-tight">TingoCargo</p>
          <p className="text-[11px] font-medium text-slate-400">Panel de control</p>
        </div>
      </div>

      <div className="mt-6 px-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
          Navegación
        </p>
      </div>
      <nav className="mt-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={navClass}
            end={item.end}
            onClick={() => setMobileOpen(false)}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/50 p-4 ring-1 ring-brand-200/50">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {(user?.nombre || roleName || "A").charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {user?.nombre || roleName || "Administrador"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {user?.email || "admin"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-xs font-semibold text-brand-700 transition-all hover:bg-brand-600 hover:text-white hover:border-brand-600"
          >
            {iconMap.logout}
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-md px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h11v10H3z" />
              <path d="M14 10h4l3 3v4h-7z" />
            </svg>
          </span>
          <span className="text-lg font-extrabold text-slate-900 tracking-tight">TingoCargo</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white px-5 py-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex">
        <aside className="hidden w-64 min-h-screen flex-col border-r border-slate-100 bg-white px-5 py-6 lg:flex">
          {sidebarContent}
        </aside>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children || <Outlet />}
        </main>
      </div>
      <HelpGuide />
    </div>
  );
};

export default AdminLayout;
