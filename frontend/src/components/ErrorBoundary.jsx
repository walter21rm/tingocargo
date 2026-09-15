/**
 * ErrorBoundary.jsx — FI3/FI4: Componente de tolerancia a fallos
 * Captura errores de renderizado en React y muestra una pantalla de recuperación
 * en lugar de que la app completa se rompa.
 */
import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary capturó un error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h1 className="mt-6 text-2xl font-extrabold text-slate-900">
              Algo salió mal
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Ocurrió un error inesperado. Puedes intentar recargar la página o volver al inicio.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700 transition-colors"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Ir al inicio
              </button>
            </div>
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                Detalles técnicos
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-red-600">
                {this.state.error?.toString()}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
