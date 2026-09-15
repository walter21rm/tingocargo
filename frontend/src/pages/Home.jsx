/**
 * Home.jsx — Página de inicio pública
 * Landing con hero verde, pasos y formulario de rastreo.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const Home = () => {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!code.trim()) return;
    navigate(`/seguimiento?code=${encodeURIComponent(code.trim())}`);
  };

  return (
    <div className="bg-white">
      {/* ── Hero ──────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #064e3b 0%, #0f5132 30%, #136345 60%, #177a55 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-20" style={{ background: "#34d399", filter: "blur(80px)" }} />
          <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full opacity-15" style={{ background: "#6ee7b7", filter: "blur(80px)" }} />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-28">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-200" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Seguimiento en tiempo real
            </span>

            <h1 className="mt-6 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
              Envíos seguros en{" "}
              <span className="text-emerald-300">Tingo María</span>
            </h1>
            <p className="mt-4 text-base text-white/70 sm:text-lg max-w-lg mx-auto">
              Conectamos distribuidoras con clientes, asegurando entregas rápidas
              con seguimiento en cada paso del camino.
            </p>

            {/* Formulario de rastreo */}
            <form onSubmit={handleSubmit} className="mt-8 mx-auto max-w-lg">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <svg viewBox="0 0 24 24" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ej: TM-2501-X9"
                    className="w-full rounded-xl bg-white py-4 pl-12 pr-4 text-sm text-slate-700 placeholder-slate-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl px-8 py-4 text-sm font-bold shadow-lg transition-all hover:shadow-xl whitespace-nowrap"
                  style={{ background: "#34d399", color: "#064e3b" }}
                >
                  Rastrear Paquete
                </button>
              </div>
            </form>
          </div>

          {/* Mini stats */}
          <div className="mt-14 grid grid-cols-3 gap-4 max-w-md mx-auto">
            {[
              { value: "24/7", label: "Monitoreo activo" },
              { value: "100%", label: "Transparencia" },
              { value: "Rápido", label: "Entrega segura" }
            ].map((item) => (
              <div key={item.label} className="text-center rounded-xl py-4 px-3" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-xl font-extrabold text-white sm:text-2xl">{item.value}</p>
                <p className="mt-1 text-[11px] text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ¿Cómo funciona? ───────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            ¿Cómo funciona?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Tres pasos simples para enviar y rastrear tus paquetes
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Registra tu envío",
              desc: "Ingresa los datos del destinatario, peso y sucursal de origen. El sistema genera un código de seguimiento único.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              )
            },
            {
              step: "02",
              title: "Seguimiento en vivo",
              desc: "Rastrea tu paquete en cualquier momento con el código de seguimiento. Ve cada cambio de estado al instante.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
              )
            },
            {
              step: "03",
              title: "Recibe tu paquete",
              desc: "El repartidor entrega en tu puerta. Paga con tarjeta, Yape o efectivo. Si no estás, reprograma la entrega.",
              icon: (
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12l2.5 2.5L16 9" />
                </svg>
              )
            }
          ].map((item) => (
            <div
              key={item.step}
              className="group relative rounded-2xl border border-slate-100 bg-white p-8 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-1"
            >
              <span className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-md">
                {item.step}
              </span>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                {item.icon}
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-12 text-center sm:px-16 sm:py-16"
          style={{ background: "linear-gradient(90deg, #136345, #177a55, #1d8f64)" }}
        >
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full opacity-20" style={{ background: "white", filter: "blur(60px)" }} />
          <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full opacity-20" style={{ background: "white", filter: "blur(60px)" }} />
          <div className="relative">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
              ¿Listo para enviar?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/80">
              Regístrate gratis y comienza a enviar paquetes con seguimiento en tiempo real.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/cliente/registro"
                className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-brand-700 shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
              >
                Crear cuenta gratis
              </Link>
              <Link
                to="/cliente/login"
                className="rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10"
                style={{ border: "2px solid rgba(255,255,255,0.3)" }}
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
