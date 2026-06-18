// Reusable badge/pill primitive (inline styles, no UI libraries).
// tone: "neutral" | "aplica" | "quiza" | "no_encaja" | "info"
const TONES = {
  neutral: { fg: "#4338ca", bg: "#eef2ff", dmFg: "#c7d2fe", dmBg: "#1e293b" },
  aplica: { fg: "#047857", bg: "#d1fae5", dmFg: "#6ee7b7", dmBg: "#064e3b" },
  quiza: { fg: "#b45309", bg: "#fef3c7", dmFg: "#fcd34d", dmBg: "#451a03" },
  no_encaja: { fg: "#be123c", bg: "#ffe4e6", dmFg: "#fda4af", dmBg: "#4c0519" },
  info: { fg: "#2563eb", bg: "#dbeafe", dmFg: "#93c5fd", dmBg: "#172554" },
};

export default function Badge({ children, tone = "neutral", dm = false, style = {} }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 14,
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: "nowrap",
      color: dm ? t.dmFg : t.fg,
      background: dm ? t.dmBg : t.bg,
      ...style,
    }}>{children}</span>
  );
}
