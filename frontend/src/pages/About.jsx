import { useState, useEffect } from "react";
import { typography } from "../constants/theme";
import BrandLogo from "../components/BrandLogo";
import { getHealthStatus } from "../services/api";

const TEAL = "#007A8A";
const NAVY = "#0F172A";
const GRAY = "#64748b";

const STEPS = [
  {
    num: "01",
    title: "Crea tu perfil técnico",
    desc: "Indica tu stack, años de experiencia, idiomas, ubicaciones y modalidad preferida. Cuanto más completo, mejor funciona el motor.",
    icon: "👤",
  },
  {
    num: "02",
    title: "El motor analiza el mercado",
    desc: "JobMatch IA cruza tu perfil con cientos de ofertas reales indexadas de múltiples fuentes (Adzuna, LinkedIn, portales oficiales de empresa).",
    icon: "🔍",
  },
  {
    num: "03",
    title: "Matching inteligente con Claude",
    desc: "Claude extrae señales de cada oferta (requisitos, stack técnico, modalidad, idioma) y las cruza con tu perfil usando un motor de scoring v8.",
    icon: "🤖",
  },
  {
    num: "04",
    title: "Recibe resultados categorizados",
    desc: "Cada oferta recibe una etiqueta APLICA / QUIZÁ / NO ENCAJA con puntuación, skills que coinciden y blockers que te frenan.",
    icon: "✅",
  },
  {
    num: "05",
    title: "Mejora tu CV con IA",
    desc: "Sube tu CV en PDF y Claude genera una versión optimizada para ATS con sugerencias de mejora por sección.",
    icon: "📄",
  },
  {
    num: "06",
    title: "Practica la entrevista",
    desc: "Un entrevistador IA (Alex) simula una entrevista real para el puesto que eliges y te da feedback detallado al terminar.",
    icon: "🎤",
  },
];

const TECH = [
  { label: "Backend", value: "FastAPI + PostgreSQL + Python 3.11" },
  { label: "Frontend", value: "React 19 (Create React App)" },
  { label: "IA", value: "Claude Haiku 4.5 (Anthropic)" },
  { label: "Motor matching", value: "v8_synonyms — heurístico + señales semánticas" },
  { label: "Fuentes de empleo", value: "Adzuna · JobSpy · JSearch · ATS públicos" },
  { label: "Deploy", value: "Render (backend) · Vercel (frontend)" },
  { label: "Auth", value: "JWT + bcrypt + email verification" },
  { label: "Protección", value: "Cloudflare Turnstile · rate limiting por IP" },
];

export default function About({ onStartClick }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealthStatus().then(setHealth).catch(() => null);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: typography.family, color: NAVY }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BrandLogo size={32} showWordmark gap={10} wordmarkSize={20} />
          {onStartClick && (
            <button onClick={onStartClick} style={{
              padding: "7px 20px", borderRadius: 50, fontSize: 13, fontWeight: 600,
              color: "#fff", background: TEAL, border: "none", cursor: "pointer",
            }}>
              Acceder
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px 48px", textAlign: "center" }}>
        <span style={{
          display: "inline-block", background: "#E0F2FE", color: "#0284c7",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
          padding: "5px 14px", borderRadius: 50, marginBottom: 24,
        }}>
          Trabajo de Fin de Máster — IA Aplicada
        </span>
        <h1 style={{ margin: "0 0 20px", fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          JobMatch IA
        </h1>
        <p style={{ margin: 0, fontSize: 18, color: GRAY, lineHeight: 1.7, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
          Plataforma de matching laboral inteligente que usa IA para conectar candidatos con ofertas de empleo tecnológico de forma precisa y personalizada.
        </p>

        {/* Estado del sistema en vivo */}
        {health && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: 28,
            padding: "8px 16px", borderRadius: 50,
            background: health.status === "ok" ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
            border: `1px solid ${health.status === "ok" ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
            fontSize: 13, fontWeight: 600,
            color: health.status === "ok" ? "#059669" : "#b45309",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: health.status === "ok" ? "#10b981" : "#f59e0b",
              display: "inline-block",
            }} />
            Sistema operativo · {health.active_offers?.toLocaleString() || "—"} ofertas activas en índice
          </div>
        )}
      </section>

      {/* Cómo funciona */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 72px" }}>
        <h2 style={{ textAlign: "center", fontSize: 30, fontWeight: 800, marginBottom: 48, letterSpacing: "-0.02em" }}>
          Cómo funciona
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {STEPS.map(step => (
            <div key={step.num} style={{
              background: "#fff", borderRadius: 16, padding: "28px 24px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 24 }}>{step.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: TEAL, letterSpacing: "0.1em" }}>{step.num}</span>
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>{step.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: GRAY, lineHeight: 1.6 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stack técnico */}
      <section style={{ background: "#fff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px" }}>
          <h2 style={{ textAlign: "center", fontSize: 30, fontWeight: 800, marginBottom: 40, letterSpacing: "-0.02em" }}>
            Stack técnico
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {TECH.map(t => (
              <div key={t.label} style={{
                padding: "14px 18px", borderRadius: 12,
                background: "#F8FAFC", border: "1px solid #e2e8f0",
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hipótesis de investigación */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 20, letterSpacing: "-0.02em" }}>Hipótesis de investigación</h2>
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", border: "1px solid #e2e8f0", borderLeft: `4px solid ${TEAL}` }}>
          <p style={{ margin: 0, fontSize: 16, color: GRAY, lineHeight: 1.8 }}>
            <strong style={{ color: NAVY }}>¿Puede un sistema de IA basado en LLMs mejorar la precisión del matching laboral
            frente a la búsqueda por keywords tradicional,</strong> reduciendo el tiempo que un candidato
            invierte en identificar ofertas relevantes para su perfil técnico?
          </p>
        </div>
        <p style={{ marginTop: 20, fontSize: 14, color: GRAY, lineHeight: 1.7 }}>
          El sistema fue evaluado con datos reales de búsqueda y feedback de usuarios. Los resultados
          indican que el motor de matching v8 supera en precisión a la búsqueda por keywords
          (baseline) en perfiles técnicos especializados.
        </p>
      </section>

      {/* CTA */}
      {onStartClick && (
        <section style={{ textAlign: "center", padding: "0 24px 80px" }}>
          <button onClick={onStartClick} style={{
            padding: "14px 36px", borderRadius: 50, fontSize: 16, fontWeight: 700,
            color: "#fff", background: TEAL, border: "none", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,117,138,0.3)",
          }}>
            Probar JobMatch IA
          </button>
          <p style={{ marginTop: 12, fontSize: 13, color: GRAY }}>
            Acceso gratuito · No se requiere tarjeta
          </p>
        </section>
      )}

      <footer style={{ borderTop: "1px solid #e2e8f0", padding: "24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, color: GRAY }}>
          JobMatch IA · TFM · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
