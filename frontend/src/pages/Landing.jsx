import {
  colors,
  typography,
  spacing,
  border,
  shadow,
  transition,
} from "../constants/theme";

// SVG Icons as components
const PersonIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2">
    <circle cx="16" cy="10" r="4" />
    <path d="M 8 24 Q 8 18 16 18 Q 24 18 24 24" />
  </svg>
);

const SearchIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2">
    <circle cx="14" cy="14" r="8" />
    <path d="M 20 20 L 26 26" />
  </svg>
);

const CheckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="3">
    <path d="M 6 16 L 12 22 L 26 8" />
  </svg>
);

export default function Landing({ onStartClick }) {
  return (
    <div style={styles.page}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navbarContent}>
          <h1 style={styles.navbarLogo}>JobMatch IA</h1>
          <button style={styles.navbarButton} onClick={onStartClick}>
            Empezar
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>
            Encuentra tu próximo trabajo como developer
          </h1>
          <p style={styles.heroSubtitle}>
            Deja que la IA analice las ofertas y te diga cuáles encajan realmente con tu perfil y experiencia
          </p>
          <button style={styles.heroCTAButton} onClick={onStartClick}>
            → Analizar mi perfil
          </button>
        </div>
      </section>

      {/* 3 Steps Section */}
      <section style={styles.stepsSection}>
        <h2 style={styles.stepsTitle}>Cómo funciona</h2>
        <div style={styles.stepsContainer}>
          {[
            {
              number: "1",
              title: "Crea tu perfil",
              description: "Cuéntanos tu experiencia, stack y nivel de inglés",
              Icon: PersonIcon,
            },
            {
              number: "2",
              title: "La IA analiza",
              description: "Analizamos 15+ ofertas reales del mercado español",
              Icon: SearchIcon,
            },
            {
              number: "3",
              title: "Aplica donde encajas",
              description: "Descubre solo las ofertas que son realistas para ti",
              Icon: CheckIcon,
            },
          ].map((step) => (
            <div key={step.number} style={styles.step}>
              <div style={styles.stepNumber}>
                <step.Icon />
              </div>
              <h3 style={styles.stepTitle}>{step.title}</h3>
              <p style={styles.stepDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem Section */}
      <section style={styles.problemSection}>
        <div style={styles.problemContent}>
          <h2 style={styles.problemTitle}>
            ¿Perdes tiempo analizando ofertas que no encajan?
          </h2>
          <p style={styles.problemImpact}>
            La mayoría de ofertas en el mercado tienen requisitos irreales o desalineados con tu perfil
          </p>
          <p style={styles.problemSubtext}>
            Encontramos las ofertas que realmente encajan con lo que sabes.
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={styles.bottomCtaSection}>
        <h2 style={styles.bottomCtaTitle}>¿Listo para encontrar tu oferta?</h2>
        <button style={styles.bottomCTAButton} onClick={onStartClick}>
          → Comenzar análisis
        </button>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          JobMatch IA • Análisis inteligente de ofertas de trabajo
        </p>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: colors.background.page,
    fontFamily: typography.family,
  },

  // Navbar
  navbar: {
    backgroundColor: colors.background.white,
    boxShadow: shadow.subtle,
    position: "sticky",
    top: 0,
    zIndex: 100,
  },

  navbarContent: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: `${spacing.lg}px ${spacing.xxl}px`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  navbarLogo: {
    margin: 0,
    fontSize: 24,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: "-0.5px",
  },

  navbarButton: {
    padding: `${spacing.sm}px ${spacing.lg}px`,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.background.white,
    backgroundColor: colors.primary,
    border: "none",
    borderRadius: border.radius.md,
    cursor: "pointer",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
  },

  // Hero Section
  hero: {
    background: `linear-gradient(135deg, #1e3a5f 0%, ${colors.primary} 100%)`,
    paddingTop: 120,
    paddingBottom: 120,
    paddingLeft: spacing.xxl,
    paddingRight: spacing.xxl,
  },

  heroContent: {
    maxWidth: 700,
    margin: "0 auto",
    textAlign: "center",
  },

  heroTitle: {
    margin: `0 0 ${spacing.xl}px`,
    fontSize: 64,
    fontWeight: 700,
    color: colors.background.white,
    letterSpacing: "-1.5px",
    lineHeight: 1.2,
  },

  heroSubtitle: {
    margin: `0 0 ${spacing.xxl}px`,
    fontSize: typography.sizes.normal,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 1.7,
    fontWeight: typography.weights.normal,
  },

  heroCTAButton: {
    padding: `${spacing.md}px ${spacing.xxl}px`,
    fontSize: typography.sizes.normal,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    backgroundColor: colors.background.white,
    border: "none",
    borderRadius: border.radius.md,
    cursor: "pointer",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
    display: "inline-block",
    minWidth: 220,
  },

  // Steps Section
  stepsSection: {
    padding: `${spacing.massive * 2}px ${spacing.xxl}px`,
    backgroundColor: colors.background.white,
  },

  stepsTitle: {
    textAlign: "center",
    margin: `0 0 ${spacing.massive * 2}px`,
    fontSize: 44,
    fontWeight: 700,
    color: colors.text.primary,
  },

  stepsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: spacing.xxl,
    maxWidth: 1100,
    margin: "0 auto",
  },

  step: {
    padding: spacing.xxl,
    textAlign: "center",
    backgroundColor: colors.background.card,
    borderRadius: border.radius.xl,
    border: `1px solid ${colors.border.active}`,
    transition: `all ${transition.fast}`,
    cursor: "pointer",
  },

  stepNumber: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: 80,
    backgroundColor: colors.primary,
    color: colors.background.white,
    borderRadius: border.radius.circle,
    marginBottom: spacing.xl,
    flexShrink: 0,
  },

  stepTitle: {
    margin: `0 0 ${spacing.sm}px`,
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },

  stepDescription: {
    margin: 0,
    fontSize: typography.sizes.small,
    color: colors.text.secondary,
    lineHeight: 1.6,
  },

  // Problem Section
  problemSection: {
    backgroundColor: "#f8fafc",
    padding: `${spacing.massive * 2}px ${spacing.xxl}px`,
  },

  problemContent: {
    maxWidth: 700,
    margin: "0 auto",
    textAlign: "center",
  },

  problemTitle: {
    margin: `0 0 ${spacing.xl}px`,
    fontSize: 44,
    fontWeight: 700,
    color: colors.text.primary,
    letterSpacing: "-0.5px",
  },

  problemImpact: {
    margin: `0 0 ${spacing.lg}px`,
    fontSize: 20,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    lineHeight: 1.6,
  },

  problemSubtext: {
    margin: 0,
    fontSize: typography.sizes.normal,
    color: colors.text.secondary,
    fontWeight: typography.weights.normal,
  },

  // Bottom CTA Section
  bottomCtaSection: {
    background: colors.primary,
    padding: `${spacing.massive * 2}px ${spacing.xxl}px`,
    textAlign: "center",
  },

  bottomCtaTitle: {
    margin: `0 0 ${spacing.xl}px`,
    fontSize: 44,
    fontWeight: 700,
    color: colors.background.white,
  },

  bottomCTAButton: {
    padding: `${spacing.md}px ${spacing.xxl}px`,
    fontSize: typography.sizes.normal,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    backgroundColor: colors.background.white,
    border: "none",
    borderRadius: border.radius.md,
    cursor: "pointer",
    transition: `all ${transition.fast}`,
    fontFamily: typography.family,
    display: "inline-block",
    minWidth: 220,
  },

  // Footer
  footer: {
    backgroundColor: colors.background.white,
    borderTop: `1px solid ${colors.border.active}`,
    padding: `${spacing.xxl}px`,
    textAlign: "center",
  },

  footerText: {
    margin: 0,
    fontSize: typography.sizes.small,
    color: colors.text.disabled,
  },
};
