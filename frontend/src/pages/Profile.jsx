import { useState } from "react";
import { matchOffers } from "../services/api";
import {
  colors,
  typography,
  spacing,
  border,
  shadow,
  transition,
} from "../constants/theme";

const STACK_OPTIONS = ["JavaScript", "Python", "React", "Vue", "Node", "SQL", "Otros"];

const EXPERIENCE_OPTIONS = [
  { value: "1", label: "1 año" },
  { value: "2", label: "2 años" },
  { value: "3", label: "3 años" },
  { value: "4", label: "4 años" },
  { value: "5", label: "5 años" },
  { value: "6", label: "6 años" },
  { value: "7", label: "7 años" },
  { value: "8", label: "8 años" },
  { value: "9", label: "9 años" },
  { value: "10+", label: "10+ años" },
];

const ENGLISH_OPTIONS = [
  { value: "basico", label: "Básico" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
];

const RESULT_STYLES = {
  APLICA: { bg: "#dcfce7", border: "#22c55e", label: "APLICA" },
  QUIZÁ: { bg: "#fef9c3", border: "#eab308", label: "QUIZÁ" },
  NO_ENCAJA: { bg: "#fee2e2", border: "#ef4444", label: "NO ENCAJA" },
};

export default function Profile({ onBackClick }) {
  const [experience, setExperience] = useState("");
  const [stack, setStack] = useState([]);
  const [english, setEnglish] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("todos");

  function handleStackChange(tech) {
    setStack((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await matchOffers({ experience, stack, english });
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setExperience("");
    setStack([]);
    setEnglish("");
    setResults(null);
    setError(null);
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p style={{ fontSize: 16, color: "#444" }}>Analizando ofertas con IA...</p>
          <p style={{ fontSize: 13, color: "#888" }}>
            Esto puede tardar unos segundos
          </p>
        </div>
      </div>
    );
  }

  if (results) {
    // Separar por categoría PRIMERO
    const aplica = results.filter((r) => r.resultado === "APLICA");
    const quiza = results.filter((r) => r.resultado === "QUIZÁ");
    const noEncaja = results.filter((r) => r.resultado === "NO_ENCAJA");

    // Concatenar en orden: APLICA → QUIZÁ → NO_ENCAJA
    const sortedResults = [...aplica, ...quiza, ...noEncaja];

    // Filtrar según selección del usuario
    let filtered = sortedResults;
    if (filter === "aplica") filtered = aplica;
    else if (filter === "quiza") filtered = quiza;
    else if (filter === "no-encaja") filtered = noEncaja;

    // Mapear nivel inglés a texto legible
    const englishMap = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado" };
    const englishLabel = englishMap[english] || english;

    return (
      <div style={styles.resultsWrapper}>
        {/* Header del dashboard con perfil y botón */}
        <div style={styles.resultsHeader}>
          <div>
            <h2 style={styles.resultsTitle}>Resultados del análisis IA</h2>
            <p style={styles.profileSummary}>
              Analizando para: <strong>{experience} año{experience !== "1" ? "s" : ""}</strong> ·
              <strong> {stack.join(", ")}</strong> ·
              <strong> Inglés {englishLabel}</strong>
            </p>
          </div>
          <button style={styles.resetButton} onClick={handleReset}>
            + Nueva búsqueda
          </button>
        </div>

        {/* Contadores mejorados */}
        <div style={styles.summaryGrid}>
          <div style={{ ...styles.summaryCard, backgroundColor: "#dcfce7", borderColor: "#22c55e" }}>
            <div style={styles.summaryIcon}>✓</div>
            <div style={styles.summaryNumber}>{aplica.length}</div>
            <div style={styles.summaryLabel}>APLICA</div>
          </div>
          <div style={{ ...styles.summaryCard, backgroundColor: "#fef9c3", borderColor: "#eab308" }}>
            <div style={{ ...styles.summaryIcon, color: "#333" }}>△</div>
            <div style={styles.summaryNumber}>{quiza.length}</div>
            <div style={styles.summaryLabel}>QUIZÁ</div>
          </div>
          <div style={{ ...styles.summaryCard, backgroundColor: "#fee2e2", borderColor: "#ef4444" }}>
            <div style={styles.summaryIcon}>✗</div>
            <div style={styles.summaryNumber}>{noEncaja.length}</div>
            <div style={styles.summaryLabel}>NO ENCAJA</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={styles.filterContainer}>
          {[
            { value: "todos", label: "Todas" },
            { value: "aplica", label: "✓ APLICA" },
            { value: "quiza", label: "⚠ QUIZÁ" },
            { value: "no-encaja", label: "✗ NO ENCAJA" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                ...styles.filterButton,
                ...(filter === f.value ? styles.filterButtonActive : styles.filterButtonInactive),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tarjetas en grid */}
        <div style={styles.cardsGrid}>
          {filtered.length > 0 ? (
            filtered.map((offer, index) => {
              const rs = RESULT_STYLES[offer.resultado] || RESULT_STYLES.NO_ENCAJA;
              return (
                <div
                  key={offer.id}
                  className="job-card"
                  style={{
                    ...styles.card,
                    borderLeftColor: rs.border,
                    animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
                  }}
                >
                  <div style={styles.cardTop}>
                    <div style={{ flex: 1 }}>
                      <h3 style={styles.cardTitle}>{offer.titulo}</h3>
                      <p style={styles.cardMeta}>
                        {offer.empresa} · {offer.ubicacion}
                      </p>
                      <p style={styles.cardSalario}>
                        {offer.salario ? offer.salario : "Salario no especificado"}
                      </p>
                    </div>
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: rs.border,
                        color: rs.border === "#eab308" ? "#333" : "#fff",
                      }}
                    >
                      {rs.label}
                    </span>
                  </div>
                  <div style={styles.cardMotivoBlock}>
                    <p style={styles.cardMotivo}>{offer.motivo}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p style={styles.emptyState}>No hay ofertas en esta categoría</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.mainTitle}>JobMatch IA</h1>
        <p style={styles.subtitle}>
          Encuentra ofertas que realmente encajan con tu perfil
        </p>
      </div>

      {/* Form Card */}
      <div style={styles.formCard}>
        <h2 style={styles.formTitle}>Tu perfil profesional</h2>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Experience Field */}
          <div style={styles.field}>
            <label style={styles.label}>Años de experiencia</label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              required
              style={styles.select}
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Stack Field with Pills */}
          <div style={styles.field}>
            <label style={styles.label}>Stack tecnológico</label>
            <div style={styles.stackContainer}>
              {STACK_OPTIONS.map((tech) => (
                <button
                  key={tech}
                  type="button"
                  onClick={() => handleStackChange(tech)}
                  style={{
                    ...styles.stackPill,
                    ...(stack.includes(tech)
                      ? styles.stackPillActive
                      : styles.stackPillInactive),
                  }}
                >
                  {stack.includes(tech) && "✓ "}
                  {tech}
                </button>
              ))}
            </div>
          </div>

          {/* English Field */}
          <div style={styles.field}>
            <label style={styles.label}>Nivel de inglés</label>
            <select
              value={english}
              onChange={(e) => setEnglish(e.target.value)}
              required
              style={styles.select}
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {ENGLISH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <button type="submit" style={styles.submitButton}>
            Analizar ofertas
          </button>
        </form>

        {onBackClick && (
          <button
            type="button"
            onClick={onBackClick}
            style={styles.backButton}
          >
            ← Volver a inicio
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  // Page layout
  pageWrapper: {
    minHeight: "100vh",
    backgroundColor: colors.background.page,
    paddingTop: spacing.massive,
    paddingBottom: spacing.massive,
  },

  // Header section
  header: {
    maxWidth: 700,
    margin: "0 auto",
    paddingBottom: spacing.xxxl,
    textAlign: "center",
  },
  mainTitle: {
    margin: "0 0 12px",
    fontSize: 48,
    fontWeight: 700,
    color: colors.text.primary,
    fontFamily: typography.family,
    letterSpacing: "-1px",
  },
  subtitle: {
    margin: 0,
    fontSize: typography.sizes.normal,
    color: colors.text.secondary,
    fontFamily: typography.family,
    fontWeight: typography.weights.normal,
    lineHeight: 1.6,
  },

  // Form Card
  formCard: {
    maxWidth: 700,
    margin: "0 auto",
    padding: spacing.huge,
    backgroundColor: colors.background.white,
    borderRadius: border.radius.full,
    border: `1px solid ${colors.border.active}`,
    boxShadow: shadow.subtle,
    fontFamily: typography.family,
  },

  formTitle: {
    margin: `0 0 ${spacing.xxxl}px`,
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },

  // Form layout
  form: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.xl,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.sm,
  },

  label: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },

  select: {
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: typography.sizes.body,
    borderRadius: border.radius.md,
    border: `${border.width.medium} solid ${colors.border.inactive}`,
    backgroundColor: colors.background.white,
    fontFamily: "inherit",
    color: colors.text.primary,
    cursor: "pointer",
    transition: `border-color ${transition.fast}`,
  },

  // Stack pills container
  stackContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: spacing.md,
  },

  stackPill: {
    padding: `${spacing.sm}px ${spacing.lg}px`,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    border: `${border.width.medium} solid`,
    borderRadius: border.radius.full,
    cursor: "pointer",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
    whiteSpace: "nowrap",
  },

  stackPillActive: {
    backgroundColor: colors.primary,
    color: colors.background.white,
    borderColor: colors.primary,
  },

  stackPillInactive: {
    backgroundColor: colors.background.white,
    color: colors.text.secondary,
    borderColor: colors.border.inactive,
  },

  // Submit button
  submitButton: {
    marginTop: spacing.xxxl,
    padding: `${spacing.md}px ${spacing.xl}px`,
    fontSize: typography.sizes.normal,
    fontWeight: typography.weights.semibold,
    color: colors.background.white,
    backgroundColor: colors.primary,
    border: "none",
    borderRadius: border.radius.md,
    cursor: "pointer",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
    width: "100%",
  },

  // Back button
  backButton: {
    marginTop: spacing.md,
    padding: `${spacing.sm}px ${spacing.lg}px`,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    backgroundColor: "transparent",
    border: `1px solid ${colors.border.inactive}`,
    borderRadius: border.radius.md,
    cursor: "pointer",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
    width: "100%",
  },

  // Error message
  error: {
    padding: `${spacing.md}px ${spacing.lg}px`,
    backgroundColor: colors.error.bg,
    color: colors.error.text,
    borderRadius: border.radius.md,
    fontSize: typography.sizes.small,
    marginBottom: spacing.xl,
    border: `1px solid ${colors.error.border}`,
    fontFamily: typography.family,
  },

  // Loading state
  loading: {
    textAlign: "center",
    padding: `${spacing.massive}px 0`,
  },

  spinner: {
    width: 40,
    height: 40,
    border: `4px solid ${colors.border.active}`,
    borderTop: `4px solid ${colors.primary}`,
    borderRadius: border.radius.circle,
    margin: `0 auto ${spacing.xl}px`,
    animation: "spin 1s linear infinite",
  },

  // Results view styles
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: spacing.xl,
    marginBottom: spacing.xxxl,
  },

  summaryCard: {
    padding: spacing.xxl,
    borderRadius: border.radius.xl,
    border: `2px solid`,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.sm,
  },

  summaryIcon: {
    fontSize: 28,
    fontWeight: typography.weights.bold,
    color: "#22c55e",
    margin: "0 0 8px",
  },

  summaryNumber: {
    fontSize: 48,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    margin: 0,
    lineHeight: 1,
  },

  summaryLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.wide,
    margin: 0,
  },

  filterContainer: {
    display: "flex",
    gap: spacing.sm,
    marginBottom: spacing.xxxl,
    flexWrap: "wrap",
  },

  filterButton: {
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    border: `${border.width.medium} solid`,
    borderRadius: border.radius.md,
    cursor: "pointer",
    transition: `all ${transition.fast}`,
    backgroundColor: colors.background.white,
    fontFamily: typography.family,
  },

  filterButtonActive: {
    backgroundColor: colors.primary,
    color: colors.background.white,
    borderColor: colors.primary,
  },

  filterButtonInactive: {
    color: colors.text.disabled,
    borderColor: colors.border.inactive,
  },

  cardsContainer: {
    marginBottom: spacing.xxl,
  },

  card: {
    padding: spacing.xxl,
    borderRadius: border.radius.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.background.card,
    border: `1px solid ${colors.border.active}`,
    borderLeft: `4px solid`,
    cursor: "pointer",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.xl,
    marginBottom: spacing.md,
  },

  cardTitle: {
    margin: `0 0 ${spacing.sm}px`,
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },

  cardMeta: {
    fontSize: typography.sizes.small,
    color: colors.text.disabled,
    margin: `0 0 ${spacing.sm}px`,
  },

  cardSalario: {
    fontSize: typography.sizes.normal,
    fontWeight: typography.weights.bold,
    color: "#15803d",
    margin: `${spacing.md}px 0 0`,
  },

  badge: {
    fontSize: "11px",
    fontWeight: typography.weights.bold,
    padding: `6px 10px`,
    borderRadius: border.radius.sm,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    flexShrink: 0,
    display: "inline-block",
  },

  cardMotivo: {
    fontSize: typography.sizes.small,
    color: colors.text.tertiary,
    margin: 0,
    fontStyle: "italic",
    lineHeight: 1.5,
  },

  emptyState: {
    textAlign: "center",
    padding: `${spacing.massive}px ${spacing.xl}px`,
    color: colors.text.hint,
    fontSize: typography.sizes.normal,
  },

  container: {
    // Legacy: kept for compatibility
    maxWidth: 700,
    margin: "40px auto",
    padding: spacing.huge,
    fontFamily: typography.family,
    border: `1px solid ${colors.border.active}`,
    borderRadius: border.radius.full,
    backgroundColor: colors.background.white,
    textAlign: "left",
    boxShadow: shadow.subtle,
  },

  // Results view
  resultsWrapper: {
    maxWidth: 1000,
    margin: "0 auto",
    padding: spacing.huge,
    fontFamily: typography.family,
  },

  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xxxl,
    gap: spacing.xl,
  },

  resultsTitle: {
    margin: 0,
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },

  profileSummary: {
    margin: `${spacing.sm}px 0 0`,
    fontSize: typography.sizes.normal,
    color: colors.text.secondary,
    lineHeight: 1.6,
  },

  resetButton: {
    padding: `${spacing.md}px ${spacing.xl}px`,
    fontSize: typography.sizes.normal,
    fontWeight: typography.weights.semibold,
    color: colors.background.white,
    backgroundColor: colors.primary,
    border: "none",
    borderRadius: border.radius.md,
    cursor: "pointer",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
    whiteSpace: "nowrap",
  },

  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
    gap: spacing.xl,
    marginBottom: spacing.xxl,
  },

  cardMotivoBlock: {
    backgroundColor: "#f3f4f6",
    padding: spacing.md,
    borderRadius: border.radius.sm,
    marginTop: spacing.md,
  },
};

// Inyectar estilos dinámicos en el head
if (typeof document !== "undefined" && !document.getElementById("profile-animations")) {
  const style = document.createElement("style");
  style.id = "profile-animations";
  style.innerHTML = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    [style*="animation: fadeInUp"] {
      will-change: transform, opacity;
    }

    .job-card {
      transition: all 150ms ease-out;
    }

    .job-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
    }
  `;
  document.head.appendChild(style);
}
