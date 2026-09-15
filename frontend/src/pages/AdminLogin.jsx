/**
 * AdminLogin.jsx — Inicio de sesión del panel administrativo
 * Diseño profesional con panel lateral de imágenes y formulario centrado.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, login, setToken, setUser } from "../services/api.js";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isFading, setIsFading] = useState(false);

  const images = [
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1600&q=80"
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login({ usuario: username, password });
      setToken(data.token);
      setUser(
        data.user || {
          nombre: "Administrador Sistema",
          email: username,
          rolId: null,
          roleName: "Administrador"
        }
      );
      if (data.user?.roleName === "Cliente") {
        navigate("/cliente");
      } else {
        navigate("/admin");
      }
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (getToken()) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNextIndex((currentIndex + 1) % images.length);
      setIsFading(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, images.length]);

  useEffect(() => {
    if (!isFading) return undefined;
    const timer = setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIsFading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [isFading, nextIndex]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1.2fr]">
        {/* Formulario */}
        <div className="flex flex-col justify-center px-6 py-12 lg:px-16">
          <div className="mx-auto w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7h11v10H3z" />
                  <path d="M14 10h4l3 3v4h-7z" />
                  <circle cx="7" cy="19" r="1.5" />
                  <circle cx="18" cy="19" r="1.5" />
                </svg>
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">TingoCargo</h1>
                <p className="text-xs text-slate-400">Sistema de gestión de paquetes</p>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-slate-100 bg-white p-8 shadow-card">
              <h2 className="text-lg font-bold text-slate-900">Bienvenido de vuelta</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ingresa tus credenciales para acceder al panel
              </p>
              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-5"
                autoComplete="off"
              >
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Email</label>
                  <div className="mt-2 relative">
                    <svg viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="correo@empresa.com"
                      className="w-full rounded-xl border border-slate-200 pl-11 pr-4 py-3 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      autoComplete="new-email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Contraseña</label>
                  <div className="mt-2 relative">
                    <svg viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 pl-11 pr-4 py-3 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Ingresando...
                    </span>
                  ) : "Ingresar al panel"}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-sm text-slate-400">
              ¿Necesitas rastrear un paquete?{" "}
              <Link to="/" className="font-bold text-brand-600 hover:text-brand-500 transition-colors">
                Ir al portal
              </Link>
            </p>
          </div>
        </div>

        {/* Panel visual */}
        <div className="hidden items-center justify-center lg:flex relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
            style={{
              backgroundImage: `url('${images[currentIndex]}')`,
              opacity: isFading ? 0 : 1
            }}
          />
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
            style={{
              backgroundImage: `url('${images[nextIndex]}')`,
              opacity: isFading ? 1 : 0
            }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(6,78,59,0.85), rgba(15,81,50,0.75), rgba(23,122,85,0.65))" }} />

          <div className="relative z-10 px-12 py-16 max-w-lg">
            <div className="rounded-3xl bg-white/10 p-8 backdrop-blur-md ring-1 ring-white/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 7h11v10H3z" />
                  <path d="M14 10h4l3 3v4h-7z" />
                  <circle cx="7" cy="19" r="1.5" />
                  <circle cx="18" cy="19" r="1.5" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-white leading-tight">
                Distribución segura
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                Conectamos distribuidoras con clientes en Tingo María,
                asegurando entregas rápidas y seguimiento en tiempo real.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-white">24/7</p>
                  <p className="mt-1 text-[11px] text-white/60">Monitoreo</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-white">100%</p>
                  <p className="mt-1 text-[11px] text-white/60">Seguro</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-white">Rápido</p>
                  <p className="mt-1 text-[11px] text-white/60">Entregas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
