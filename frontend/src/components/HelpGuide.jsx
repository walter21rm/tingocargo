/**
 * HelpGuide.jsx — CI4: Guía de ayuda interactiva
 * Botón flotante con panel desplegable que muestra guías rápidas
 * para que usuarios nuevos aprendan a usar el sistema.
 */
import { useState } from "react";

const guides = [
  {
    title: "Crear un paquete",
    icon: "📦",
    steps: [
      "Ve a Paquetes → Nuevo Paquete",
      "Selecciona remitente (distribuidora o cliente)",
      "Ingresa los datos del destinatario",
      "Elige sucursal de origen y destino",
      "El sistema calcula el precio automáticamente",
      "Haz clic en Registrar Paquete"
    ]
  },
  {
    title: "Rastrear un envío",
    icon: "🔍",
    steps: [
      "Copia el código de seguimiento (ej: TM-2026-1234)",
      "Ve a la página de inicio",
      "Pega el código en el buscador",
      "Haz clic en Rastrear Paquete",
      "Verás el estado actual y la línea de tiempo"
    ]
  },
  {
    title: "Cambiar estado de un paquete",
    icon: "🔄",
    steps: [
      "Abre el detalle del paquete",
      "En la sección Acciones, haz clic en el botón correspondiente",
      "Marcar Salida: cambia de 'En Almacén' a 'En Tránsito'",
      "Confirmar Entrega: cambia de 'En Tránsito' a 'Entregado'",
      "El sistema pedirá confirmación antes de ejecutar"
    ]
  },
  {
    title: "Registrar un pago",
    icon: "💰",
    steps: [
      "Abre el detalle del paquete",
      "El botón 'Registrar pago' aparece cuando hay precio asignado",
      "Elige el método de pago (tarjeta, Yape o efectivo)",
      "Confirma el pago",
      "Una vez pagado, podrás emitir la boleta"
    ]
  },
  {
    title: "Generar reportes",
    icon: "📊",
    steps: [
      "Ve a Paquetes y filtra por estado si lo necesitas",
      "Haz clic en Exportar (CSV o Excel)",
      "El reporte incluye todos los paquetes con sus datos",
      "Se descargará automáticamente"
    ]
  },
  {
    title: "Contactar personas",
    icon: "📞",
    steps: [
      "En el detalle de un paquete, verás los contactos",
      "Haz clic en el ícono de WhatsApp (💬) para enviar mensaje",
      "Haz clic en el ícono de teléfono (📞) para llamar",
      "Haz clic en copiar (📋) para copiar el número"
    ]
  }
];

const HelpGuide = () => {
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl hover:scale-105"
        title="Ayuda"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 animate-slide-up">
          <div className="bg-brand-600 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
                <h3 className="text-base font-bold">Guía de Ayuda</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-white/60 hover:text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-xs text-white/70">¿Cómo usar TingoCargo? Haz clic en un tema.</p>
          </div>
          <div className="overflow-y-auto max-h-[calc(70vh-80px)] p-3 space-y-2">
            {guides.map((guide, i) => (
              <div key={guide.title} className="rounded-xl border border-slate-100 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xl">{guide.icon}</span>
                  <span className="flex-1 text-sm font-semibold text-slate-800">{guide.title}</span>
                  <svg viewBox="0 0 24 24" className={`h-4 w-4 text-slate-400 transition-transform ${expandedIndex === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {expandedIndex === i && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                    <ol className="space-y-2">
                      {guide.steps.map((step, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                            {j + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default HelpGuide;
