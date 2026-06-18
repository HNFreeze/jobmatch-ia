import { useState } from "react";
import { palette, focusRing } from "../../constants/theme";

// Reusable button primitive (inline styles, no UI libraries).
// variant: "primary" | "secondary" | "success" | "danger" | "ghost"
// size: "sm" | "md"
export default function Button({
  children, onClick, variant = "primary", size = "md", block = false, disabled = false,
  dm = false, type = "button", style = {}, ...rest
}) {
  const t = palette(dm);
  const [focused, setFocused] = useState(false);
  const pad = size === "sm" ? "7px 14px" : "10px 18px";
  const base = {
    padding: pad,
    borderRadius: 10,
    fontSize: size === "sm" ? 13 : 14,
    fontWeight: 700,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    cursor: disabled ? "default" : "pointer",
    border: "1px solid transparent",
    transition: "filter 0.18s ease, opacity 0.18s ease, background 0.18s ease",
    opacity: disabled ? 0.55 : 1,
    display: block ? "flex" : "inline-flex",
    width: block ? "100%" : undefined,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    boxShadow: focused ? focusRing : "none",
    outline: "none",
  };
  const variants = {
    primary: { background: t.primary, color: t.primaryText },
    success: { background: t.positive, color: "#fff" },
    danger: { background: t.danger, color: "#fff" },
    secondary: { background: t.surface, color: t.textSecondary, borderColor: t.borderStrong },
    ghost: { background: "transparent", color: t.textMuted },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
