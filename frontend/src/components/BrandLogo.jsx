import { useId } from "react";
import { typography } from "../constants/theme";

const TEAL = "#007A8A";

export function BrandMark({ size = 36, style = {} }) {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{
        display: "block",
        flexShrink: 0,
        filter: "drop-shadow(0 10px 18px rgba(0,122,138,0.18))",
        ...style,
      }}
    >
      <rect width="64" height="64" rx="18" fill="#0F172A" />
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${gradientId})`} />
      <path
        d="M19 18H29V37C29 45.3 23.8 49 17.5 49"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35 47V18L43 31L51 18V47"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="14" r="4" fill="#67E8F9" />
      <defs>
        <linearGradient id={gradientId} x1="8" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="0.5" stopColor="#0B4A5A" />
          <stop offset="1" stopColor={TEAL} />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function BrandLogo({
  size = 36,
  showWordmark = true,
  tone = "gradient",
  gap = 12,
  wordmarkSize = 22,
  style = {},
}) {
  const textColor =
    tone === "light" ? "#F8FAFC" :
    tone === "dark" ? "#0F172A" :
    undefined;

  const accentColor =
    tone === "light" ? "#99F6E4" :
    tone === "dark" ? TEAL :
    undefined;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        ...style,
      }}
    >
      <BrandMark size={size} />

      {showWordmark && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 4,
            fontFamily: typography.family,
            fontWeight: 900,
            fontSize: wordmarkSize,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          <span
            style={
              tone === "gradient"
                ? {
                    background: "linear-gradient(135deg, #0F172A 0%, #007A8A 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }
                : { color: textColor }
            }
          >
            JobMatch
          </span>
          <span
            style={
              tone === "gradient"
                ? {
                    color: "rgba(15,23,42,0.56)",
                  }
                : { color: accentColor }
            }
          >
            IA
          </span>
        </span>
      )}
    </div>
  );
}
