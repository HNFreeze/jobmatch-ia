import { useState } from "react";
import { matchOffers } from "../services/api";
import {
  colors,
  typography,
  spacing,
  border,
  componentStyles,
  shadow,
  transition,
} from "../constants/theme";

const STACK_OPTIONS = ["JavaScript", "Python", "React", "Vue", "Node", "SQL", "Otros"];

const EXPERIENCE_OPTIONS = [
  { value: "1", label: "1 año" },
  { value: "2", label: "2 años" },
  { value: "3", label: "3 años" },
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
    const aplica = results.filter((r) => r.resultado === "APLICA");
    const quiza = results.filter((r) => r.resultado === "QUIZÁ");
    const noEncaja = results.filter((r) => r.resultado === "NO_ENCAJA");

    // Filtrar según selección
    let filtered = results;
    if (filter === "aplica") filtered = aplica;
    else if (filter === "quiza") filtered = quiza;
    else if (filter === "no-encaja") filtered = noEncaja;

    // Ordenar: APLICA, QUIZÁ, NO_ENCAJA
    filtered.sort((a, b) => {
      const order = { APLICA: 0, QUIZÁ: 1, NO_ENCAJA: 2 };
      return (order[a.resultado] || 3) - (order[b.resultado] || 3);
    });

    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Resultados del análisis IA</h2>

        {/* Header con contadores */}
        <div style={styles.summaryGrid}>
          <div style={{ ...styles.summaryCard, borderLeftColor: "#22c55e" }}>
            <div style={styles.summaryNumber}>{aplica.length}</div>
            <div style={styles.summaryLabel}>APLICA</div>
            <div style={styles.summaryColor} style={{ backgroundColor: "#22c55e" }}></div>
          </div>
          <div style={{ ...styles.summaryCard, borderLeftColor: "#eab308" }}>
            <div style={styles.summaryNumber}>{quiza.length}</div>
            <div style={styles.summaryLabel}>QUIZÁ</div>
            <div style={styles.summaryColor} style={{ backgroundColor: "#eab308" }}></div>
          </div>
          <div style={{ ...styles.summaryCard, borderLeftColor: "#ef4444" }}>
            <div style={styles.summaryNumber}>{noEncaja.length}</div>
            <div style={styles.summaryLabel}>NO ENCAJA</div>
            <div style={styles.summaryColor} style={{ backgroundColor: "#ef4444" }}></div>
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

        {/* Tarjetas */}
        <div style={styles.cardsContainer}>
          {filtered.length > 0 ? (
            filtered.map((offer) => {
              const rs = RESULT_STYLES[offer.resultado] || RESULT_STYLES.NO_ENCAJA;
              return (
                <div
                  key={offer.id}
                  style={{
                    ...styles.card,
                    borderLeftColor: rs.border,
                  }}
                >
                  <div style={styles.cardTop}>
                    <div>
                      <h3 style={styles.cardTitle}>{offer.titulo}</h3>
                      <p style={styles.cardMeta}>
                        {offer.empresa} · {offer.ubicacion}
                      </p>
                      <p style={styles.cardSalario}>{offer.salario}</p>
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
                  <p style={styles.cardMotivo}>"{offer.motivo}"</p>
                </div>
              );
            })
          ) : (
            <p style={styles.emptyState}>No hay ofertas en esta categoría</p>
          )}
        </div>

        <button style={styles.button} onClick={handleReset}>
          ← Nueva búsqueda
        </button>
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
    backgroundColor: colors.background.card,
    border: `1px solid ${colors.border.active}`,
    borderLeft: `4px solid`,
    position: "relative",
    overflow: "hidden",
  },

  summaryNumber: {
    fontSize: 36,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    margin: "0 0 4px",
  },

  summaryLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.disabled,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.wide,
  },

  summaryColor: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 3,
    height: 3,
    borderRadius: border.radius.circle,
    opacity: 0.2,
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
    transition: `all ${transition.fast}`,
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
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.success,
    margin: `${spacing.sm}px 0 0`,
  },

  badge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: border.radius.sm,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.wide,
    flexShrink: 0,
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
};
