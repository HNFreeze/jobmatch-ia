import { palette } from "../../constants/theme";

// Accessible loading indicator. Respects prefers-reduced-motion (the spinner
// stops animating) and announces itself via role="status" + aria-live.
export default function LoadingState({ label = "Cargando…", dm = false }) {
  const t = palette(dm);
  return (
    <div role="status" aria-live="polite" style={{
      display: "flex", alignItems: "center", gap: 10, color: t.textMuted, fontSize: 14, padding: "12px 0",
    }}>
      <style>{`
        @keyframes jm-load-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .jm-spinner { animation: none !important; } }
      `}</style>
      <span
        className="jm-spinner"
        style={{
          width: 16, height: 16, borderRadius: "50%",
          border: `2px solid ${t.border}`, borderTopColor: t.primary,
          display: "inline-block", animation: "jm-load-spin 0.7s linear infinite",
        }}
      />
      <span>{label}</span>
    </div>
  );
}
