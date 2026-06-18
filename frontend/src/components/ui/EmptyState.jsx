import { palette } from "../../constants/theme";

// Neutral empty state — a title, a guiding description and an optional action.
// No decorative illustrations; the guidance itself is the content.
export default function EmptyState({ title, description, action, dm = false, compact = false }) {
  const t = palette(dm);
  return (
    <div style={{
      textAlign: "center",
      padding: compact ? "24px 16px" : "48px 24px",
      border: `1px dashed ${t.borderStrong}`,
      borderRadius: 12,
      background: t.surfaceMuted,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</div>
      {description && (
        <p style={{ fontSize: 14, color: t.textMuted, margin: "8px auto 0", maxWidth: 420, lineHeight: 1.5 }}>{description}</p>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
