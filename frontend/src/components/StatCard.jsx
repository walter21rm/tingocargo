/**
 * StatCard.jsx — Tarjeta de estadística mejorada
 * Tarjeta con fondo de color, ícono resaltado y animación hover.
 */
const toneConfig = {
  brand: {
    bg: "linear-gradient(135deg, #177a55, #1d8f64)",
    iconBg: "rgba(255,255,255,0.2)"
  },
  warning: {
    bg: "linear-gradient(135deg, #d97706, #f59e0b)",
    iconBg: "rgba(255,255,255,0.2)"
  },
  accent: {
    bg: "linear-gradient(135deg, #2563eb, #3b82f6)",
    iconBg: "rgba(255,255,255,0.2)"
  }
};

const StatCard = ({ label, value, icon, tone = "brand" }) => {
  const cfg = toneConfig[tone] || toneConfig.brand;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5"
      style={{ background: cfg.bg }}
    >
      <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-20" style={{ background: "white", filter: "blur(20px)" }} />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold text-white">
            {value}
          </p>
        </div>
        {icon && (
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
            style={{ background: cfg.iconBg }}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
