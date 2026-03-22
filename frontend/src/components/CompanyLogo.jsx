import { useEffect, useState } from "react";

function getInitials(name) {
  return (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

function getHue(name) {
  return (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
}

export default function CompanyLogo({ name, logoUrl, size = 48, darkMode = false }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl, name]);

  const initials = getInitials(name);
  const hue = getHue(name);
  const radius = Math.max(10, Math.round(size * 0.24));
  const frameBg = darkMode ? `hsla(${hue}, 28%, 18%, 1)` : `hsl(${hue}, 42%, 94%)`;
  const frameBorder = darkMode ? `hsla(${hue}, 30%, 42%, 0.35)` : `hsl(${hue}, 40%, 84%)`;
  const textColor = darkMode ? "#f8fafc" : `hsl(${hue}, 48%, 32%)`;
  const shouldShowImage = Boolean(logoUrl) && !imgFailed;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: frameBg,
        border: `1.5px solid ${frameBorder}`,
        boxShadow: darkMode ? "inset 0 1px 2px rgba(255,255,255,0.04)" : "inset 0 1px 2px rgba(255,255,255,0.8)",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: textColor,
          fontSize: Math.max(14, size * 0.32),
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        {initials || "?"}
      </div>

      {logoUrl && (
        <div
          style={{
            position: "absolute",
            inset: Math.max(6, Math.round(size * 0.16)),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: Math.max(8, Math.round(size * 0.2)),
            backgroundColor: darkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.92)",
            opacity: shouldShowImage ? 1 : 0,
            transition: "opacity 0.18s ease",
          }}
        >
          <img
            src={logoUrl}
            alt={name || "Empresa"}
            loading="lazy"
            onError={() => setImgFailed(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      )}
    </div>
  );
}
