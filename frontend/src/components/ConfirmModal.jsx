/**
 * ConfirmModal.jsx — SA1/SA4: Modal de confirmación para acciones críticas
 * Muestra una advertencia antes de ejecutar acciones destructivas o irreversibles.
 */
const ConfirmModal = ({ open, title, message, confirmText, cancelText, onConfirm, onCancel, danger = false, loading = false }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${danger ? "bg-red-50" : "bg-amber-50"}`}>
            <svg viewBox="0 0 24 24" className={`h-7 w-7 ${danger ? "text-red-500" : "text-amber-500"}`} fill="none" stroke="currentColor" strokeWidth="2">
              {danger ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </>
              ) : (
                <>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <path d="M12 9v4M12 17h.01" />
                </>
              )}
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {cancelText || "Cancelar"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {loading ? "Procesando..." : confirmText || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
