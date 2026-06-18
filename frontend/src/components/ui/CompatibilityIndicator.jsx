import { palette, compatTier } from "../../constants/theme";

// Compatibility shown as a labelled bar — never a bare percentage. Communicates
// the tier (alta/media/baja) with both color AND text, so it does not rely on
// color alone (accessibility).
export default function CompatibilityIndicator({ score, dm = false, showBar = true, size = "md" }) {
  const t = palette(dm);
  const tier = compatTier(score);
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const small = size === "sm";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: small ? 13 : 15, fontWeight: 800, color: tier.color }}>{pct}%</span>
        <span style={{ fontSize: small ? 11 : 12, fontWeight: 600, color: t.textSecondary }}>{tier.label}</span>
      </div>
      {showBar && (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${tier.label}: ${pct}%`}
          style={{ marginTop: 5, height: 6, borderRadius: 4, background: t.border, overflow: "hidden" }}
        >
          <div style={{ width: `${pct}%`, height: "100%", background: tier.color, borderRadius: 4 }} />
        </div>
      )}
    </div>
  );
}
