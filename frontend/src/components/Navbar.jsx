/**
 * Navbar.jsx — Barra de navegación superior
 * Barra con fondo verde sólido, logo y enlaces. Menú hamburguesa responsive.
 */
import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header style={{ background: "linear-gradient(90deg, #136345, #177a55, #1d8f64)" }} className="shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/30 transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h11v10H3z" />
              <path d="M14 10h4l3 3v4h-7z" />
              <circle cx="7" cy="19" r="1.5" />
              <circle cx="18" cy="19" r="1.5" />
            </svg>
          </span>
          <span>
            <span className="text-lg font-extrabold text-white tracking-tight">TingoCargo</span>
            <span className="block text-[11px] font-medium text-white/60">Tingo María</span>
          </span>
        </Link>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            to="/cliente/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/cliente/registro"
            className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-brand-700 shadow-sm transition-all hover:shadow-md"
          >
            Registrarse
          </Link>
          <Link
            to="/admin/login"
            className="ml-1 rounded-lg px-3 py-2 text-sm font-medium text-white/50 transition-colors hover:text-white/80 hover:bg-white/10"
          >
            Admin
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/10 sm:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 sm:hidden">
          <div className="flex flex-col gap-1 pt-3">
            <Link to="/cliente/login" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 transition-colors">
              Iniciar sesión
            </Link>
            <Link to="/cliente/registro" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10 transition-colors">
              Registrarse
            </Link>
            <Link to="/admin/login" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium text-white/60 hover:bg-white/10 transition-colors">
              Acceso Admin
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
