import { typography } from "../constants/theme";
import BrandLogo from "../components/BrandLogo";

const TEAL = "#007A8A";
const TEAL_DARK = "#006673";
const NAVY = "#0F172A";
const GRAY_500 = "#64748b";
const GRAY_400 = "#94a3b8";
const GRAY_200 = "#e2e8f0";
const GRAY_100 = "#f1f5f9";
const BG = "#F8FAFC";

// ── Inject styles ─────────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("landing-v2-styles")) {
  const s = document.createElement("style");
  s.id = "landing-v2-styles";
  s.innerHTML = `
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes matchBounce {
      0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
      50%       { transform: translate(-50%, -50%) translateY(-10px); }
    }
    .lv2-fadein-1 { animation: fadeUp 0.7s ease-out 0.1s both; }
    .lv2-fadein-2 { animation: fadeUp 0.7s ease-out 0.25s both; }
    .lv2-fadein-3 { animation: fadeUp 0.7s ease-out 0.4s both; }
    .lv2-feature-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.08) !important;
    }
    .lv2-nav-link { transition: color 0.2s; }
    .lv2-nav-link:hover { color: #111827 !important; }
    .lv2-cta-primary:hover { background-color: ${TEAL_DARK} !important; }
    .lv2-cta-outline:hover { background-color: #f0fdfa !important; }
    .lv2-match-badge { animation: matchBounce 2.5s ease-in-out infinite; }
    .lv2-match-badge:hover { animation-play-state: paused; transform: translate(-50%, -50%) scale(1.04); }
    @media (max-width: 900px) {
      .lv2-hero-grid   { grid-template-columns: 1fr !important; }
      .lv2-pricing-grid { grid-template-columns: 1fr !important; }
      .lv2-features-grid { grid-template-columns: 1fr !important; }
      .lv2-nav-links   { display: none !important; }
      .lv2-nav-auth    { display: none !important; }
      .lv2-nav-mobile  { display: flex !important; }
      .lv2-hero-title  { font-size: 42px !important; }
      .lv2-mockup-wrap { display: none !important; }
    }
    @media (max-width: 600px) {
      .lv2-hero-title  { font-size: 30px !important; }
      .lv2-hero-section { padding: 44px 16px 56px !important; }
      .lv2-features-section { padding: 48px 16px !important; }
      .lv2-pricing-section { padding: 48px 16px !important; }
      .lv2-hero-subtitle { font-size: 15px !important; }
      .lv2-section-title { font-size: 26px !important; }
    }
  `;
  document.head.appendChild(s);
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
const BrainIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
    <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
    <path d="M6 18a4 4 0 0 1-1.967-.516"/>
    <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
  </svg>
);
const ZapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#064E3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);
const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const GrayCheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
export default function Landing({ onStartClick, onAboutClick }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG, fontFamily: typography.family }}>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        backgroundColor: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${GRAY_200}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "0 24px",
          height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Logo */}
          <BrandLogo size={34} showWordmark={true} gap={10} wordmarkSize={22} />

          {/* Desktop nav links */}
          <div className="lv2-nav-links" style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {[
              { label: "Cómo funciona", id: "como-funciona" },
              { label: "Características", id: "features" },
              { label: "Precios", id: "pricing" },
            ].map(l => (
              <button key={l.label} className="lv2-nav-link" onClick={() => document.getElementById(l.id)?.scrollIntoView({ behavior: "smooth" })} style={{
                fontSize: 14, fontWeight: 600, color: GRAY_500,
                background: "none", border: "none", cursor: "pointer",
                fontFamily: typography.family, padding: 0,
              }}>{l.label}</button>
            ))}
            {onAboutClick && (
              <button className="lv2-nav-link" onClick={onAboutClick} style={{
                fontSize: 14, fontWeight: 600, color: GRAY_500,
                background: "none", border: "none", cursor: "pointer",
                fontFamily: typography.family, padding: 0,
              }}>Sobre el proyecto</button>
            )}
          </div>

          {/* Desktop auth buttons */}
          <div className="lv2-nav-auth" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={onStartClick} className="lv2-cta-outline" style={{
              padding: "7px 20px", borderRadius: 50, fontSize: 13, fontWeight: 600,
              color: TEAL, backgroundColor: "transparent",
              border: `1.5px solid ${TEAL}`, cursor: "pointer",
              fontFamily: typography.family, transition: "background-color 0.2s",
            }}>
              Login
            </button>
            <button onClick={onStartClick} className="lv2-cta-primary" style={{
              padding: "7px 20px", borderRadius: 50, fontSize: 13, fontWeight: 600,
              color: "#fff", backgroundColor: TEAL,
              border: `1.5px solid ${TEAL}`, cursor: "pointer",
              fontFamily: typography.family, transition: "background-color 0.2s",
            }}>
              Registro
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="lv2-nav-mobile" onClick={onStartClick} style={{
            display: "none", background: "none", border: "none", cursor: "pointer", padding: 4,
          }}>
            <MenuIcon />
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section id="como-funciona" className="lv2-hero-section" style={{ padding: "80px 24px 96px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="lv2-hero-grid" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 64, alignItems: "center",
        }}>

          {/* Left */}
          <div>
            <div className="lv2-fadein-1">
              <span style={{
                display: "inline-block",
                backgroundColor: "#E0F2FE", color: "#0284C7",
                fontSize: 11, fontWeight: 700, padding: "6px 16px",
                borderRadius: 50, letterSpacing: "0.12em", textTransform: "uppercase",
                marginBottom: 28,
              }}>
                Inteligencia Artificial Aplicada
              </span>

              <h1 className="lv2-hero-title" style={{
                margin: "0 0 20px", fontSize: 62, fontWeight: 800,
                color: NAVY, letterSpacing: "-0.03em", lineHeight: 1.05, wordBreak: "break-word",
              }}>
                El match perfecto<br />
                para tu carrera,<br />
                impulsado por IA.
              </h1>
            </div>

            <p className="lv2-fadein-2 lv2-hero-subtitle" style={{
              margin: "0 0 36px", fontSize: 18, color: GRAY_500,
              lineHeight: 1.75, maxWidth: 480,
            }}>
              Analizamos ofertas en tiempo real para decirte dónde encajas mejor. Sin pérdida de tiempo, solo oportunidades reales.
            </p>

            <div className="lv2-fadein-3" style={{ display: "inline-block" }}>
              <div style={{
                border: `1.5px dashed ${TEAL}`, borderRadius: 50, padding: 4, display: "inline-block",
              }}>
                <button onClick={onStartClick} className="lv2-cta-primary" style={{
                  padding: "14px 36px", borderRadius: 50, fontSize: 17, fontWeight: 700,
                  color: "#fff", backgroundColor: TEAL, border: "none", cursor: "pointer",
                  fontFamily: typography.family, transition: "background-color 0.2s",
                  boxShadow: "0 4px 16px rgba(0,122,138,0.3)",
                }}>
                  Empieza gratis
                </button>
              </div>
            </div>
          </div>

          {/* Right — Mockup card */}
          <div className="lv2-mockup-wrap" style={{ position: "relative", maxWidth: 480, margin: "0 auto", width: "100%" }}>
            {/* Background tilt */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundColor: "#fff",
              borderRadius: 24, border: `1px solid ${GRAY_200}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
              transform: "rotate(3deg) scale(1.04)",
            }} />

            {/* Main card */}
            <div style={{
              position: "relative", zIndex: 1,
              backgroundColor: "#FAFAFA", borderRadius: 20,
              border: `1px solid ${GRAY_200}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              padding: "28px 32px",
              transform: "rotate(-1deg)",
              aspectRatio: "4/3",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              overflow: "hidden",
            }}>
              {/* Mock header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 10, width: 130, backgroundColor: "#d1d5db", borderRadius: 8 }} />
                  <div style={{ height: 8, width: 80, backgroundColor: "#e5e7eb", borderRadius: 8 }} />
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[1,2,3].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#d1d5db" }} />)}
                </div>
              </div>

              {/* Mock list */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, opacity: 0.55 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "#e5e7eb" }} />
                      <div style={{ height: 10, width: i % 2 === 0 ? 140 : 110, backgroundColor: "#e5e7eb", borderRadius: 8 }} />
                    </div>
                    <div style={{ height: 10, width: 48, backgroundColor: "#e5e7eb", borderRadius: 8 }} />
                  </div>
                ))}
              </div>

              {/* Bottom mock button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <div style={{ height: 32, width: 96, border: `1px solid ${GRAY_200}`, borderRadius: 10 }} />
              </div>

              {/* Floating badge */}
              <div className="lv2-match-badge" style={{
                position: "absolute", top: "48%", left: "50%",
                transform: "translate(-50%, -50%)",
                backgroundColor: "#75F0B0",
                boxShadow: "0 8px 32px rgba(16,185,129,0.35)",
                borderRadius: 14, padding: "12px 20px",
                display: "flex", alignItems: "center", gap: 10,
                whiteSpace: "nowrap", zIndex: 10, cursor: "default",
              }}>
                <CheckCircleIcon />
                <span style={{ fontWeight: 800, color: "#064E3B", fontSize: 17, letterSpacing: "-0.02em" }}>
                  98% Match Preciso
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ───────────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", paddingBottom: 64, paddingTop: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: GRAY_400,
          letterSpacing: "0.18em", textTransform: "uppercase", margin: 0,
        }}>
          <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
            {[
              { value: "5K+", label: "Ofertas analizadas" },
              { value: "IA", label: "Motor propio" },
              { value: "100%", label: "Gratuito" },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: TEAL, fontFamily: typography.family, letterSpacing: "-0.02em" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: GRAY_400, fontFamily: typography.family }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: GRAY_400, letterSpacing: "0.15em", textTransform: "uppercase" }}>Líderes tecnológicos confían en JobMatch IA</p>
        </div>
      </section>


      {/* ── Cómo funciona ────────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 24px",
        background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
        borderTop: `1px solid ${GRAY_200}`,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{
              display: "inline-block",
              backgroundColor: "#E0F2FE", color: "#0284C7",
              fontSize: 11, fontWeight: 700, padding: "5px 14px",
              borderRadius: 50, letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: 16,
            }}>
              Proceso
            </span>
            <h2 className="lv2-section-title" style={{
              margin: "0 0 14px", fontSize: 38, fontWeight: 800,
              color: NAVY, letterSpacing: "-0.025em",
            }}>
              Encuentra trabajo en 3 pasos
            </h2>
            <p style={{ margin: 0, fontSize: 17, color: GRAY_500, maxWidth: 500, marginInline: "auto", lineHeight: 1.7 }}>
              Sin configuraciones complejas, sin pérdida de tiempo. Empieza a encontrar ofertas reales en minutos.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              {
                num: "01",
                title: "Completa tu perfil técnico",
                desc: "Indica tu stack, años de experiencia, idiomas y preferencias de modalidad. Nuestro sistema de IA necesita esta información para crear tu scoring personalizado.",
                icon: "👤",
                accent: TEAL,
              },
              {
                num: "02",
                title: "La IA analiza miles de ofertas",
                desc: "Nuestro motor compara tu perfil contra miles de ofertas reales de toda España. Cada oferta recibe una puntuación APLICA / QUIZÁ / NO ENCAJA con explicación detallada.",
                icon: "🤖",
                accent: "#2563eb",
              },
              {
                num: "03",
                title: "Actúa y haz seguimiento",
                desc: "Guarda favoritos, registra tus candidaturas con estado y genera cartas de presentación personalizadas para cada oferta.",
                icon: "🚀",
                accent: "#7c3aed",
              },
            ].map((step, i) => (
              <div key={i} style={{
                display: "flex", gap: 28, alignItems: "flex-start",
                padding: "32px 0",
                borderBottom: i < 2 ? `1px solid ${GRAY_200}` : "none",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                  background: `${step.accent}15`,
                  border: `1.5px solid ${step.accent}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24,
                }}>
                  {step.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: step.accent,
                      letterSpacing: "0.12em", fontFamily: typography.family,
                    }}>
                      PASO {step.num}
                    </span>
                  </div>
                  <h3 style={{
                    margin: "0 0 8px", fontSize: 20, fontWeight: 700,
                    color: NAVY, letterSpacing: "-0.01em", fontFamily: typography.family,
                  }}>
                    {step.title}
                  </h3>
                  <p style={{
                    margin: 0, fontSize: 15, color: GRAY_500, lineHeight: 1.75,
                    fontFamily: typography.family, maxWidth: 560,
                  }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button onClick={onStartClick} style={{
              padding: "13px 32px", borderRadius: 50, fontSize: 15, fontWeight: 700,
              color: "#fff", backgroundColor: TEAL,
              border: "none", cursor: "pointer",
              fontFamily: typography.family,
              boxShadow: "0 4px 14px rgba(0,122,138,0.3)",
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = TEAL_DARK}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = TEAL}
            >
              Comenzar ahora — Es gratis →
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="lv2-features-section" style={{
        padding: "80px 24px", backgroundColor: "#fff",
        borderTop: `1px solid ${GRAY_200}`,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 className="lv2-section-title" style={{
              margin: "0 0 14px", fontSize: 38, fontWeight: 800,
              color: NAVY, letterSpacing: "-0.025em",
            }}>
              Potencia tu búsqueda con IA
            </h2>
            <p style={{ margin: 0, fontSize: 17, color: GRAY_500, maxWidth: 560, marginInline: "auto", lineHeight: 1.7 }}>
              Nuestra tecnología analiza miles de datos para ofrecerte la ventaja que necesitas en el mercado laboral.
            </p>
          </div>

          <div className="lv2-features-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28,
          }}>
            {[
              {
                icon: <BrainIcon />,
                iconBg: "#E0F2F1",
                title: "Análisis Profundo de Perfil",
                desc: "Nuestra IA lee entre líneas tu experiencia y habilidades para encontrar sinergias ocultas con las ofertas de trabajo.",
              },
              {
                icon: <ZapIcon />,
                iconBg: "#E0F0FF",
                title: "Match en Tiempo Real",
                desc: "No esperes días. Te conectamos instantáneamente con las empresas en el momento en que publican una vacante ideal para ti.",
              },
            ].map((f, i) => (
              <div key={i} className="lv2-feature-card" style={{
                padding: "32px 28px", borderRadius: 24,
                backgroundColor: BG, border: `1px solid ${GRAY_200}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
                cursor: "default",
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  backgroundColor: f.iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}>
                  {f.icon}
                </div>
                <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: NAVY, letterSpacing: "-0.01em" }}>
                  {f.title}
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: GRAY_500, lineHeight: 1.7 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="lv2-pricing-section" style={{
        padding: "80px 24px", backgroundColor: "#fff",
        borderTop: `1px solid ${GRAY_200}`,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 38, fontWeight: 800, color: NAVY, letterSpacing: "-0.025em" }}>
              Empieza sin coste. Mejora cuando quieras.
            </h2>
            <p style={{ margin: 0, fontSize: 17, color: GRAY_500, maxWidth: 560, marginInline: "auto", lineHeight: 1.7 }}>
              Nuestro plan principal es gratuito para siempre. Estamos preparando herramientas avanzadas para quienes quieran acelerar aún más su búsqueda.
            </p>
          </div>

          <div className="lv2-pricing-grid" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start",
          }}>

            {/* Free plan */}
            <div style={{
              backgroundColor: BG, borderRadius: 24, padding: "36px 32px",
              border: `2px solid ${TEAL}`,
              boxShadow: "0 2px 12px rgba(0,122,138,0.08)",
              position: "relative",
            }}>
              {/* Badge */}
              <div style={{
                position: "absolute", top: 0, right: 28,
                transform: "translateY(-50%)",
                backgroundColor: TEAL, color: "#fff",
                fontSize: 11, fontWeight: 700,
                padding: "4px 12px", borderRadius: 50,
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                Actual
              </div>

              <h3 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: NAVY }}>Básico</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 52, fontWeight: 800, color: NAVY, lineHeight: 1 }}>€0</span>
                <span style={{ fontSize: 15, color: GRAY_500, fontWeight: 500 }}>/para siempre</span>
              </div>
              <p style={{ margin: "0 0 28px", fontSize: 14, color: GRAY_500, lineHeight: 1.6, minHeight: 44 }}>
                Todas las herramientas esenciales para encontrar tu próximo empleo con IA.
              </p>

              <ul style={{ listStyle: "none", margin: "0 0 28px", padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  "Análisis de perfil con IA",
                  "Matching en tiempo real con ofertas",
                  "Plan de mejora de skills",
                  "Carta de presentación IA",
                  "Simulador de entrevista con IA",
                  "Historial de búsquedas",
                ].map(item => (
                  <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 500, color: "#374151" }}>
                    <CheckIcon /> {item}
                  </li>
                ))}
              </ul>

              <button onClick={onStartClick} style={{
                width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
                border: `2px dashed ${TEAL}`, color: TEAL, backgroundColor: "transparent",
                cursor: "pointer", fontFamily: typography.family,
                transition: "background-color 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0fdfa"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                Empieza gratis →
              </button>
            </div>

            {/* Pro plan (coming soon) */}
            <div style={{
              backgroundColor: "#fff", borderRadius: 24, padding: "36px 32px",
              border: `1px solid ${GRAY_200}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              position: "relative", overflow: "hidden",
            }}>
              {/* Badge */}
              <div style={{
                position: "absolute", top: 0, right: 28,
                transform: "translateY(-50%)",
                backgroundColor: GRAY_200, color: GRAY_500,
                fontSize: 11, fontWeight: 700,
                padding: "4px 12px", borderRadius: 50,
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                Próximamente
              </div>

              <h3 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#9ca3af" }}>Pro</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20, opacity: 0.45 }}>
                <span style={{ fontSize: 52, fontWeight: 800, color: "#9ca3af", lineHeight: 1 }}>€--</span>
                <span style={{ fontSize: 15, color: "#9ca3af", fontWeight: 500 }}>/mes</span>
              </div>
              <p style={{ margin: "0 0 28px", fontSize: 14, color: "#9ca3af", lineHeight: 1.6, minHeight: 44 }}>
                Funciones avanzadas para destacar y prepararte mejor.
              </p>

              <ul style={{ listStyle: "none", margin: "0 0 28px", padding: 0, display: "flex", flexDirection: "column", gap: 14, opacity: 0.5 }}>
                {[
                  "Simulador de entrevistas con IA",
                  "Subida de CV para autocompletar perfil",
                  "Simulador de entrevistas IA avanzado",
                  "Exportar candidaturas a PDF",
                  "Posicionamiento prioritario",
                ].map(item => (
                  <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 500, color: "#9ca3af" }}>
                    <GrayCheckIcon /> {item}
                  </li>
                ))}
              </ul>

              <button disabled style={{
                width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
                backgroundColor: GRAY_100, color: "#9ca3af",
                border: "none", cursor: "not-allowed", fontFamily: typography.family,
              }}>
                Apuntarse a la lista de espera
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1e3a5f 50%, #007A8A 100%)",
        padding: "80px 24px",
        textAlign: "center",
      }}>
        <h2 style={{
          margin: "0 0 12px", fontSize: 44, fontWeight: 800,
          color: "#fff", letterSpacing: "-0.025em",
        }}>
          ¿Listo para encontrar tu oferta?
        </h2>
        <p style={{
          margin: "0 0 32px", fontSize: 13, fontWeight: 600,
          color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Empieza gratis · Sin tarjeta de crédito
        </p>
        <div style={{ display: "inline-block", border: "1.5px dashed rgba(255,255,255,0.5)", borderRadius: 50, padding: 4 }}>
          <button onClick={onStartClick} className="lv2-cta-primary" style={{
            padding: "14px 40px", borderRadius: 50, fontSize: 16, fontWeight: 700,
            color: NAVY, backgroundColor: "#fff", border: "none", cursor: "pointer",
            fontFamily: typography.family, transition: "opacity 0.2s",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.92"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            Comenzar análisis
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{
        backgroundColor: "#fff", borderTop: `1px solid ${GRAY_200}`,
        padding: "24px", textAlign: "center",
      }}>
        <p style={{ margin: 0, fontSize: 13, color: GRAY_400, fontFamily: typography.family }}>
          JobMatch IA · Análisis inteligente de ofertas de trabajo · {new Date().getFullYear()}
        </p>
      </footer>

    </div>
  );
}
