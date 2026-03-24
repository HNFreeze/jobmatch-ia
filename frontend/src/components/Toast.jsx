import { useEffect } from "react";

const ICONS = {
  success: "✓",
  info: "ℹ",
  warning: "⚠",
};

export default function Toast({ toasts, onRemove }) {
  useEffect(() => {
    if (!document.getElementById("toast-kf")) {
      const s = document.createElement("style");
      s.id = "toast-kf";
      s.textContent = `
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastOut {
          from { opacity: 1; }
          to   { opacity: 0; transform: translateY(8px) scale(0.95); }
        }
      `;
      document.head.appendChild(s);
    }
  }, []);

  // Auto-remove after 3s
  useEffect(() => {
    if (toasts.length === 0) return;
    const last = toasts[toasts.length - 1];
    const timer = setTimeout(() => onRemove(last.id), 3000);
    return () => clearTimeout(timer);
  }, [toasts, onRemove]);

  if (toasts.length === 0) return null;

  return (
    <div style={styles.container}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            ...styles.toast,
            background: t.type === "success" ? "#059669"
                      : t.type === "error"   ? "#dc2626"
                      : t.type === "warning" ? "#d97706"
                      : "#1f2937",
          }}
        >
          <span style={styles.icon}>{ICONS[t.type] || "ℹ"}</span>
          <span style={styles.msg}>{t.message}</span>
          <button style={styles.close} onClick={() => onRemove(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    pointerEvents: "none",
    minWidth: 260,
  },
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 18px",
    color: "#fff",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)",
    animation: "toastIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
    maxWidth: 340,
    pointerEvents: "auto",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    letterSpacing: "-0.01em",
  },
  icon: { fontSize: 16 },
  msg: { flex: 1 },
  close: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontSize: 12,
    padding: 0,
    lineHeight: 1,
  },
};
