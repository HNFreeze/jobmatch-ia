import {
  gradients,
  typography,
  transition,
} from "../constants/theme";

// Inject Landing-specific animations
if (typeof document !== "undefined" && !document.getElementById("landing-styles")) {
  const s = document.createElement("style");
  s.id = "landing-styles";
  s.innerHTML = `
    @keyframes floatA {
      0%, 100% { transform: translateY(0px) scale(1); }
      50%       { transform: translateY(-30px) scale(1.05); }
    }
    @keyframes floatB {
      0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); }
      50%       { transform: translateY(20px) scale(0.95) rotate(5deg); }
    }
    @keyframes floatC {
      0%, 100% { transform: translateY(-10px) scale(1); }
      50%       { transform: translateY(15px) scale(1.08); }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(32px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .landing-hero-title  { animation: fadeUp 0.8s ease-out 0.1s both; }
    .landing-hero-sub    { animation: fadeUp 0.8s ease-out 0.3s both; }
    .landing-hero-cta    { animation: fadeUp 0.8s ease-out 0.5s both; }
    .landing-step:hover  {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.08) !important;
    }
    .landing-cta-btn {
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      position: relative;
      overflow: hidden;
    }
    .landing-cta-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 32px rgba(37,99,235,0.35) !important;
    }
    .landing-navbar-btn {
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    }
    .landing-navbar-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(37,99,235,0.3) !important;
    }
  `;
  document.head.appendChild(s);
}

// SVG Icons
const PersonIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="16" cy="10" r="4" />
    <path d="M8 24 Q8 18 16 18 Q24 18 24 24" />
  </svg>
);
const SearchIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="14" cy="14" r="8" />
    <path d="M20 20 L26 26" />
  </svg>
);
const CheckIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
    <path d="M6 16 L12 22 L26 8" />
  </svg>
);

export default function Landing({ onStartClick }) {
  return (
    <div style={S.page}>
      {/* Navbar */}
      <nav style={S.navbar}>
        <div style={S.navbarContent}>
          <h1 style={S.navbarLogo}>
            <span style={S.logoGradient}>JobMatch</span>
            <span style={{ opacity: 0.7 }}> IA</span>
          </h1>
          <button
            className="landing-navbar-btn"
            style={S.navbarButton}
            onClick={onStartClick}
          >
            Empezar
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={S.hero}>
        <div style={{ ...S.circle, ...S.circleA }} />
        <div style={{ ...S.circle, ...S.circleB }} />
        <div style={{ ...S.circle, ...S.circleC }} />

        <div style={S.heroContent}>
          <div className="landing-hero-title">
            <span style={S.heroBadge}>Análisis con IA · 2026</span>
            <h1 style={S.heroTitle}>
              Encuentra tu próximo trabajo como developer
            </h1>
          </div>
          <p className="landing-hero-sub" style={S.heroSubtitle}>
            Deja que la IA analice las ofertas y te diga cuáles encajan realmente con tu perfil y experiencia
          </p>
          <div className="landing-hero-cta">
            <button
              className="landing-cta-btn"
              style={S.heroCTAButton}
              onClick={onStartClick}
            >
              Analizar mi perfil
            </button>
          </div>
        </div>
      </section>

      {/* 3 Steps Section */}
      <section style={S.stepsSection}>
        <p style={S.stepsEyebrow}>Cómo funciona</p>
        <h2 style={S.stepsTitle}>Tres pasos para tu próximo trabajo</h2>
        <div style={S.stepsContainer}>
          {[
            {
              title: "Crea tu perfil",
              description: "Cuéntanos tu experiencia, stack y nivel de inglés",
              Icon: PersonIcon,
              gradient: "linear-gradient(135deg, #2563eb, #7c3aed)",
            },
            {
              title: "La IA analiza",
              description: "Analizamos 15+ ofertas reales del mercado español",
              Icon: SearchIcon,
              gradient: "linear-gradient(135deg, #7c3aed, #ec4899)",
            },
            {
              title: "Aplica donde encajas",
              description: "Descubre solo las ofertas que son realistas para ti",
              Icon: CheckIcon,
              gradient: "linear-gradient(135deg, #10b981, #2563eb)",
            },
          ].map((step, i) => (
            <div key={i} className="landing-step" style={{ ...S.step, transition: `all ${transition.smooth}` }}>
              <div style={{ ...S.stepIcon, background: step.gradient }}>
                <step.Icon />
              </div>
              <h3 style={S.stepTitle}>{step.title}</h3>
              <p style={S.stepDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem Section */}
      <section style={S.problemSection}>
        <div style={S.problemContent}>
          <p style={S.problemEyebrow}>El problema</p>
          <h2 style={S.problemTitle}>
            ¿Pierdes tiempo analizando ofertas que no encajan?
          </h2>
          <p style={S.problemImpact}>
            La mayoría de ofertas tienen requisitos desalineados con tu perfil
          </p>
          <p style={S.problemSubtext}>
            Encontramos las ofertas que realmente encajan con lo que sabes.
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={S.bottomCtaSection}>
        <div style={{ ...S.circle, ...S.ctaCircleA }} />
        <div style={{ ...S.circle, ...S.ctaCircleB }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={S.bottomCtaTitle}>¿Listo para encontrar tu oferta?</h2>
          <p style={S.bottomCtaSubtitle}>Empieza gratis · Sin tarjeta de crédito</p>
          <button
            className="landing-cta-btn"
            style={S.bottomCTAButton}
            onClick={onStartClick}
          >
            Comenzar análisis
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={S.footer}>
        <p style={S.footerText}>
          JobMatch IA · Análisis inteligente de ofertas de trabajo
        </p>
      </footer>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f8f9fc",
    fontFamily: typography.family,
  },

  // Navbar
  navbar: {
    backgroundColor: "rgba(255,255,255,0.97)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid #e8ecf1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  navbarContent: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "14px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navbarLogo: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    display: "flex",
    alignItems: "center",
  },
  logoGradient: {
    background: gradients.text,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  navbarButton: {
    padding: "8px 20px",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    background: gradients.primary,
    border: "none",
    borderRadius: 50,
    cursor: "pointer",
    fontFamily: typography.family,
  },

  // Hero
  hero: {
    background: gradients.hero,
    paddingTop: 120,
    paddingBottom: 120,
    paddingLeft: 24,
    paddingRight: 24,
    position: "relative",
    overflow: "hidden",
  },
  circle: {
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(80px)",
    opacity: 0.25,
    pointerEvents: "none",
  },
  circleA: {
    width: 500,
    height: 500,
    background: "radial-gradient(circle, #7c3aed, transparent 70%)",
    top: -150,
    right: -100,
    animation: "floatA 8s ease-in-out infinite",
  },
  circleB: {
    width: 400,
    height: 400,
    background: "radial-gradient(circle, #2563eb, transparent 70%)",
    bottom: -100,
    left: -80,
    animation: "floatB 10s ease-in-out infinite",
  },
  circleC: {
    width: 300,
    height: 300,
    background: "radial-gradient(circle, #ec4899, transparent 70%)",
    top: "40%",
    left: "50%",
    animation: "floatC 12s ease-in-out infinite",
  },
  heroContent: {
    maxWidth: 720,
    margin: "0 auto",
    textAlign: "center",
    position: "relative",
    zIndex: 1,
  },
  heroBadge: {
    display: "inline-block",
    padding: "6px 16px",
    backgroundColor: "rgba(255,255,255,0.12)",
    backdropFilter: "blur(8px)",
    color: "rgba(255,255,255,0.9)",
    borderRadius: 50,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 20,
    border: "1px solid rgba(255,255,255,0.2)",
  },
  heroTitle: {
    margin: "0 0 20px",
    fontSize: 62,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.03em",
    lineHeight: 1.15,
  },
  heroSubtitle: {
    margin: "0 0 28px",
    fontSize: 18,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 1.75,
    fontWeight: 400,
    maxWidth: 560,
    marginLeft: "auto",
    marginRight: "auto",
  },
  heroCTAButton: {
    padding: "16px 48px",
    fontSize: 15,
    fontWeight: 700,
    color: "#2563eb",
    backgroundColor: "#fff",
    border: "none",
    borderRadius: 50,
    cursor: "pointer",
    fontFamily: typography.family,
    display: "inline-block",
    minWidth: 220,
    letterSpacing: "-0.01em",
  },

  // Steps
  stepsSection: {
    padding: "96px 24px",
    backgroundColor: "#fff",
  },
  stepsEyebrow: {
    textAlign: "center",
    margin: "0 0 10px",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    background: gradients.text,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  stepsTitle: {
    textAlign: "center",
    margin: "0 0 64px",
    fontSize: 42,
    fontWeight: 800,
    color: "#111827",
    letterSpacing: "-0.02em",
  },
  stepsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24,
    maxWidth: 1100,
    margin: "0 auto",
  },
  step: {
    padding: 32,
    textAlign: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    border: "1px solid #e8ecf1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    cursor: "pointer",
  },
  stepIcon: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: 80,
    borderRadius: "50%",
    marginBottom: 20,
    flexShrink: 0,
    boxShadow: "0 6px 20px rgba(37,99,235,0.2)",
  },
  stepTitle: {
    margin: "0 0 8px",
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
    letterSpacing: "-0.01em",
  },
  stepDescription: {
    margin: 0,
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 1.65,
  },

  // Problem section
  problemSection: {
    backgroundColor: "#f8f9fc",
    padding: "96px 24px",
  },
  problemContent: {
    maxWidth: 700,
    margin: "0 auto",
    textAlign: "center",
  },
  problemEyebrow: {
    margin: "0 0 10px",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    background: "linear-gradient(135deg, #7c3aed, #f43f5e)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  problemTitle: {
    margin: "0 0 20px",
    fontSize: 42,
    fontWeight: 800,
    color: "#111827",
    letterSpacing: "-0.02em",
  },
  problemImpact: {
    margin: "0 0 14px",
    fontSize: 20,
    fontWeight: 600,
    background: gradients.text,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    lineHeight: 1.6,
  },
  problemSubtext: {
    margin: 0,
    fontSize: 15,
    color: "#6b7280",
    fontWeight: 400,
  },

  // Bottom CTA
  bottomCtaSection: {
    background: gradients.hero,
    padding: "96px 24px",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
  },
  ctaCircleA: {
    width: 400,
    height: 400,
    background: "radial-gradient(circle, #7c3aed, transparent)",
    top: -100,
    left: -80,
    animation: "floatB 10s ease-in-out infinite",
  },
  ctaCircleB: {
    width: 350,
    height: 350,
    background: "radial-gradient(circle, #2563eb, transparent)",
    bottom: -80,
    right: -60,
    animation: "floatA 8s ease-in-out infinite",
  },
  bottomCtaTitle: {
    margin: "0 0 10px",
    fontSize: 44,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  bottomCtaSubtitle: {
    margin: "0 0 28px",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  bottomCTAButton: {
    padding: "16px 48px",
    fontSize: 15,
    fontWeight: 700,
    color: "#2563eb",
    backgroundColor: "#fff",
    border: "none",
    borderRadius: 50,
    cursor: "pointer",
    fontFamily: typography.family,
    display: "inline-block",
    minWidth: 220,
    letterSpacing: "-0.01em",
  },

  // Footer
  footer: {
    backgroundColor: "#fff",
    borderTop: "1px solid #e8ecf1",
    padding: 24,
    textAlign: "center",
  },
  footerText: {
    margin: 0,
    fontSize: 13,
    color: "#9ca3af",
  },
};
