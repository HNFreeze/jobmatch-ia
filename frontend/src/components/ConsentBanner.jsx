import { useState } from "react";
import { typography } from "../constants/theme";

export default function ConsentBanner({ onAccept, onReject, darkMode }) {
  const [deciding, setDeciding] = useState(false);
  const dm = darkMode;

  async function handle(accepted) {
    setDeciding(true);
    await (accepted ? onAccept() : onReject());
    setDeciding(false);
  }

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      padding: "16px clamp(16px, 5vw, 40px)",
      background: dm ? "#1e293b" : "#fff",
      borderTop: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
      boxShadow: "0 -4px 24px rgba(0,0,0,0.10)",
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      fontFamily: typography.family,
    }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: dm ? "#f1f5f9" : "#111827" }}>
          Análisis de uso
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: dm ? "#94a3b8" : "#6b7280", lineHeight: 1.5 }}>
          Usamos Microsoft Clarity para entender cómo se usa la app (clics, navegación).
          Los datos son anónimos y no se comparten con terceros. Puedes cambiar esto desde tu perfil.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => handle(false)}
          disabled={deciding}
          style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            borderRadius: 8, border: `1px solid ${dm ? "rgba(255,255,255,0.12)" : "#d1d5db"}`,
            background: "transparent", color: dm ? "#94a3b8" : "#6b7280",
            fontFamily: typography.family, opacity: deciding ? 0.6 : 1,
          }}
        >
          Rechazar
        </button>
        <button
          onClick={() => handle(true)}
          disabled={deciding}
          style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            borderRadius: 8, border: "none",
            background: "linear-gradient(135deg, #2563eb 0%, #00758A 100%)",
            color: "#fff", fontFamily: typography.family,
            boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
            opacity: deciding ? 0.6 : 1,
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
