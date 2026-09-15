/**
 * Timeline.jsx — Línea de tiempo de estados del paquete
 * Línea de tiempo visual que muestra los estados del paquete.
 * Incluye fechas y observaciones para cada estado.
 */
const statusMeta = {
  "En Almacén": {
    color: "bg-warning-50 text-warning-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
      </svg>
    )
  },
  "En Tránsito": {
    color: "bg-accent-50 text-accent-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7h11v10H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="19" r="1.5" />
        <circle cx="18" cy="19" r="1.5" />
      </svg>
    )
  },
  Entregado: {
    color: "bg-brand-50 text-brand-700",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l2.5 2.5L16 9" />
      </svg>
    )
  },
  "Intento fallido": {
    color: "bg-red-50 text-red-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6" />
        <path d="M12 16h.01" />
      </svg>
    )
  }
};

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

const Timeline = ({ items, title = "Historial de seguimiento" }) => {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <ol className="mt-5 space-y-6">
        {items.map((item, index) => {
          const meta = statusMeta[item.estado] || statusMeta["En Almacén"];
          return (
            <li key={`${item.estado}-${index}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl ${meta.color}`}
                >
                  {meta.icon}
                </span>
                {index !== items.length - 1 && (
                  <span className="h-full w-px bg-slate-200" />
                )}
              </div>
              <div className="pb-2">
                <p className="font-semibold text-slate-800">{item.estado}</p>
                <p className="text-sm text-slate-500">{formatDate(item.fechaHora)}</p>
                {item.observacion && (
                  <p className="text-sm text-slate-600">{item.observacion}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default Timeline;
