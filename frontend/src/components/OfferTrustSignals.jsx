import { typography } from "../constants/theme";
import { getOfferTrustDetail, getOfferTrustSignals } from "../utils/jobTrust";

const TONE_STYLES = {
  positive: {
    light: { background: "#ecfdf5", border: "#bbf7d0", color: "#15803d" },
    dark: { background: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.22)", color: "#6ee7b7" },
  },
  info: {
    light: { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    dark: { background: "rgba(37,99,235,0.12)", border: "rgba(37,99,235,0.22)", color: "#93c5fd" },
  },
  warning: {
    light: { background: "#fffbeb", border: "#fde68a", color: "#b45309" },
    dark: { background: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.22)", color: "#fbbf24" },
  },
  danger: {
    light: { background: "#fef2f2", border: "#fecaca", color: "#dc2626" },
    dark: { background: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.22)", color: "#fca5a5" },
  },
  neutral: {
    light: { background: "#f8fafc", border: "#e2e8f0", color: "#475569" },
    dark: { background: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.18)", color: "#cbd5e1" },
  },
};

function getChipPalette(tone, darkMode) {
  const palette = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return darkMode ? palette.dark : palette.light;
}

export default function OfferTrustSignals({
  offer,
  darkMode,
  compact = false,
  maxSignals = 3,
  showDetail = false,
  style = null,
}) {
  const signals = getOfferTrustSignals(offer, maxSignals);
  const detail = showDetail ? getOfferTrustDetail(offer) : "";

  if (!signals.length && !detail) return null;

  return (
    <div style={style || undefined}>
      {signals.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? 6 : 8 }}>
          {signals.map((signal) => {
            const palette = getChipPalette(signal.tone, darkMode);
            return (
              <span
                key={signal.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: compact ? "4px 9px" : "5px 11px",
                  borderRadius: 999,
                  fontSize: compact ? 10 : 11,
                  fontWeight: 700,
                  backgroundColor: palette.background,
                  color: palette.color,
                  border: `1px solid ${palette.border}`,
                  fontFamily: typography.family,
                  whiteSpace: "nowrap",
                }}
              >
                {signal.label}
              </span>
            );
          })}
        </div>
      )}
      {detail && (
        <p
          style={{
            margin: signals.length > 0 ? "8px 0 0" : 0,
            fontSize: compact ? 11 : 12,
            lineHeight: 1.6,
            color: darkMode ? "#94a3b8" : "#64748b",
            fontFamily: typography.family,
          }}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
