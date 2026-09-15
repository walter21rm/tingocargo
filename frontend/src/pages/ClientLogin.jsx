/**
 * ClientLogin.jsx — Inicio de sesión de clientes
 * Página profesional de autenticación con diseño visual mejorado.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, login, setToken, setUser } from "../services/api.js";

const ClientLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login({ usuario: email, password });
      if (data.user?.roleName !== "Cliente") {
        setError("Esta cuenta es de personal. Use el acceso de administración.");
        setLoading(false);
        return;
      }
      setToken(data.token);
      setUser(data.user);
      navigate("/cliente");
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (getToken()) {
      const user = JSON.parse(localStorage.getItem("adminUser") || "{}");
      if (user?.roleName === "Cliente") {
        navigate("/cliente", { replace: true });
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 py-4">
        <div className="mx-auto max-w-xl px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:text-brand-500 transition-colors">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900 tracking-tight">
              Portal de Cliente
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Accede a tus envíos y seguimiento
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-card">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Email</label>
                <div className="mt-2 relative">
                  <svg viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 pl-11 pr-4 py-3 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    placeholder="correo@ejemplo.com"
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
                    required
                    className="w-full rounded-xl border border-slate-200 pl-11 pr-4 py-3 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    placeholder="••••••••"
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
                ) : "Ingresar a mi cuenta"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            ¿No tienes cuenta?{" "}
            <Link to="/cliente/registro" className="font-bold text-brand-600 hover:text-brand-500 transition-colors">
              Regístrate gratis
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ClientLogin;
