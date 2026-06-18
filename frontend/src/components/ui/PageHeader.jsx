import { palette } from "../../constants/theme";

// Page-level header: eyebrow + title + subtitle, with optional right-side actions.
export default function PageHeader({ eyebrow, title, subtitle, actions, dm = false }) {
  const t = palette(dm);
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: t.textMuted, marginBottom: 6 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: t.textMuted, fontSize: 14.5, margin: "6px 0 0", maxWidth: 620, lineHeight: 1.5 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </header>
  );
}
