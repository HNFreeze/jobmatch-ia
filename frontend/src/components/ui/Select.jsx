import * as RSelect from "@radix-ui/react-select";
import { palette } from "../../constants/theme";

// Accessible select built on Radix Select (headless): full keyboard support,
// typeahead, aria roles and focus management provided by Radix; styling is ours.
// options: [{ value, label }]
export default function Select({ value, onChange, options = [], ariaLabel, dm = false, size = "sm" }) {
  const t = palette(dm);
  const pad = size === "sm" ? "6px 10px" : "9px 12px";
  return (
    <RSelect.Root value={value} onValueChange={onChange}>
      <RSelect.Trigger
        aria-label={ariaLabel}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: pad,
          fontSize: 13, fontWeight: 600, fontFamily: "'Segoe UI', system-ui, sans-serif",
          background: t.surface, color: t.text, border: `1px solid ${t.borderStrong}`,
          borderRadius: 8, cursor: "pointer",
        }}
      >
        <RSelect.Value />
        <RSelect.Icon aria-hidden="true" style={{ color: t.textMuted }}>▾</RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          style={{
            background: t.surface, color: t.text, border: `1px solid ${t.border}`,
            borderRadius: 10, padding: 4, zIndex: 9999,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)", fontFamily: "'Segoe UI', system-ui, sans-serif",
            minWidth: "var(--radix-select-trigger-width)",
          }}
        >
          <RSelect.Viewport>
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                style={{
                  fontSize: 13, padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                  color: t.text, outline: "none", display: "flex", alignItems: "center", gap: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                <RSelect.ItemIndicator aria-hidden="true" style={{ marginLeft: "auto", color: t.primary }}>✓</RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
