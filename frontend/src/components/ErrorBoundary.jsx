import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const dm = this.props.darkMode;
    const font = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

    return (
      <div style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        fontFamily: font,
      }}>
        <div style={{
          maxWidth: 480,
          width: "100%",
          background: dm ? "#1e293b" : "#fff",
          border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e8ecf1"}`,
          borderRadius: 20,
          padding: "40px 36px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{
            fontSize: 20, fontWeight: 700, marginBottom: 10,
            color: dm ? "#f1f5f9" : "#111827",
          }}>
            Algo ha fallado
          </h2>
          <p style={{
            fontSize: 14, color: dm ? "#94a3b8" : "#6b7280",
            marginBottom: 28, lineHeight: 1.6,
          }}>
            Se ha producido un error inesperado en esta sección. Puedes intentar recargar o volver al inicio.
          </p>
          {this.state.error?.message && (
            <pre style={{
              fontSize: 11, color: dm ? "#64748b" : "#9ca3af",
              background: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
              border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e8ecf1"}`,
              borderRadius: 8, padding: "10px 12px",
              marginBottom: 24, textAlign: "left",
              overflow: "auto", maxHeight: 100,
            }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: "10px 24px", borderRadius: 50,
                background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                color: "#fff", border: "none",
                fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: font,
              }}
            >
              Reintentar
            </button>
            <button
              onClick={() => { window.location.hash = "dashboard"; window.location.reload(); }}
              style={{
                padding: "10px 24px", borderRadius: 50,
                background: "none",
                color: dm ? "#94a3b8" : "#6b7280",
                border: `1px solid ${dm ? "rgba(255,255,255,0.12)" : "#d1d5db"}`,
                fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: font,
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
