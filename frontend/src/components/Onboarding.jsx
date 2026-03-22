import { useState } from "react";

const STEPS = [
  { icon: "👋", title: "Completa tu perfil", desc: "Añade tu stack tecnológico, años de experiencia e idiomas para que la IA te conozca bien." },
  { icon: "🔍", title: "Analiza ofertas", desc: "Pulsa 'Analizar ofertas' y la IA buscará en Adzuna las mejores para tu perfil." },
  { icon: "⭐", title: "Guarda las mejores", desc: "Marca con ⭐ las ofertas que más te gusten para no perderlas en Favoritos." },
];

export default function Onboarding({ onDismiss, darkMode }) {
  const [step, setStep] = useState(0);

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      onDismiss();
    }
  }

  const current = STEPS[step];

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.card, ...(darkMode ? { background: "#1e293b" } : {}) }}>
        {/* Progress dots */}
        <div style={styles.dots}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ ...styles.dot, ...(i === step ? styles.dotActive : {}), ...(darkMode && i !== step ? { background: "#475569" } : {}) }} />
          ))}
        </div>

        {/* Step content */}
        <div style={styles.iconWrap}>{current.icon}</div>
        <h2 style={{ ...styles.title, ...(darkMode ? { color: "#f1f5f9" } : {}) }}>{current.title}</h2>
        <p style={{ ...styles.desc, ...(darkMode ? { color: "#94a3b8" } : {}) }}>{current.desc}</p>

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.skip} onClick={onDismiss}>Saltar</button>
          <button style={styles.next} onClick={handleNext}>
            {step < STEPS.length - 1 ? "Siguiente →" : "¡Empezar!"}
          </button>
        </div>

        {/* Step counter */}
        <p style={styles.counter}>{step + 1} / {STEPS.length}</p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9000,
    padding: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "36px 32px",
    maxWidth: 400,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
    animation: "toastIn 0.3s ease",
  },
  dots: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#d1d5db",
    transition: "background 0.3s",
  },
  dotActive: {
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    width: 24,
    borderRadius: 4,
  },
  iconWrap: {
    fontSize: 52,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
    margin: "0 0 10px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  desc: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 1.6,
    margin: "0 0 28px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
  },
  skip: {
    padding: "10px 20px",
    background: "none",
    border: "1px solid #d1d5db",
    borderRadius: 50,
    fontSize: 14,
    color: "#6b7280",
    cursor: "pointer",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  next: {
    padding: "10px 24px",
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    border: "none",
    borderRadius: 50,
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
  },
  counter: {
    marginTop: 20,
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
};
