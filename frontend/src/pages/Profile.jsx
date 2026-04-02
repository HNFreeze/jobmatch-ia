import { useState, useEffect, useRef } from "react";
import {
  matchOffers, getUserProfile,
  getFavorites, addFavorite, removeFavorite,
  saveHistory, getHistory, generateCoverLetter, createApplication, getApplications, deleteApplication, getAiQuota,
} from "../services/api";
import {
  gradients,
  typography,
  transition,
} from "../constants/theme";
import CompanyLogo from "../components/CompanyLogo";
import OfferTrustSignals from "../components/OfferTrustSignals";
import {
  getOfferQualityCounts,
  hasVisibleSalary,
  isAggregatorOffer,
  isDirectSourceOffer,
  isVerifiedOffer,
  isJuniorFriendlyOffer,
} from "../utils/jobTrust";

// ── Constants ────────────────────────────────────────────────────────────────────

const TEAL = "#00758A";

const RESULT_STYLES = {
  APLICA:    { bg: "#ecfdf5", border: "#10b981", label: "APLICA",     icon: "✓", iconBg: "#d1fae5", iconColor: "#10b981" },
  QUIZÁ:     { bg: "#f1f5f9", border: "#64748b", label: "QUIZÁ",      icon: "?", iconBg: "#f1f5f9", iconColor: "#64748b" },
  NO_ENCAJA: { bg: "#fff1f2", border: "#ef4444", label: "NO ENCAJA",  icon: "✗", iconBg: "#fee2e2", iconColor: "#ef4444" },
};

const MARKET_DATA = {
  "JavaScript": 1240, "Python": 980, "Java": 870, "React": 760,
  "SQL": 720, "TypeScript": 640, "Node.js": 520, "Docker": 480,
  "AWS": 410, "C#": 390, "PHP": 340, "Angular": 310,
  "Vue": 270, "Go": 195, "Kotlin": 160, "Swift": 120,
  "Django": 110, "Spring": 290, "Laravel": 180, "MongoDB": 200,
  "PostgreSQL": 350, "Redis": 180, "Kubernetes": 220, "Git": 890,
  ".NET": 380, "Azure": 320, "GCP": 190, "Flutter": 140,
  "React Native": 210, "GraphQL": 155, "Rust": 95, "Scala": 85,
};

const LOADING_PHASES = [
  { icon: "🔍", text: "Buscando ofertas en España..." },
  { icon: "🤖", text: "Analizando compatibilidad con IA..." },
  { icon: "📊", text: "Calculando puntuaciones..." },
];

const TAG_COLORS = [
  { bg: "#ede9fe", color: "#7c3aed", border: "#ddd6fe" },
  { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  { bg: "#ffe4e6", color: "#be123c", border: "#fecdd3" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────────

function getTechTagColor(tech) {
  const idx = tech.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}

function avgScore(arr) {
  const withScore = arr.filter(r => r.puntuacion != null);
  if (!withScore.length) return null;
  return Math.round(withScore.reduce((s, r) => s + r.puntuacion, 0) / withScore.length);
}

function getEnglishForMatch(idiomas) {
  if (!idiomas || idiomas.length === 0) return "";
  const eng = idiomas.find((i) => i.idioma.toLowerCase().includes("ingl"));
  if (!eng) return "";
  return eng.nivel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeResultValue(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

  if (normalized === "QUIZA" || normalized === "QUIZ?") return "QUIZÁ";
  return String(value || "").trim();
}

function hasExperienceValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function hasProfile(profile) {
  return profile && ((profile.stack && profile.stack.length > 0) || hasExperienceValue(profile.anos_experiencia));
}

function formatSearchDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return `${date} · ${time}`;
  } catch {
    return "";
  }
}

function parseSalaryValue(str) {
  if (!str) return null;
  const kMatch = str.match(/(\d+)\s*k/gi);
  if (kMatch) {
    const vals = kMatch.map(m => parseInt(m));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const cleaned = str.replace(/[€$£]/g, " ").replace(/\./g, "");
  const nums = cleaned.match(/\d{4,}/g);
  if (!nums) return null;
  const values = nums.map(Number);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return avg / 1000;
}

function detectContract(offer) {
  const text = ((offer.titulo || "") + " " + (offer.descripcion || "")).toLowerCase();
  if (/freelance|autónom|autónom|self.employ/.test(text)) return "freelance";
  if (/temporal|prácticas|becario|intern|sustitución/.test(text)) return "temporal";
  return "indefinido";
}

function detectWorkMode(offer) {
  const mode = String(offer?.signals_summary?.work_mode || "").toLowerCase();
  if (mode === "remote") return "remoto";
  if (mode === "hybrid") return "hibrido";
  if (mode === "onsite") return "presencial";

  const text = `${offer?.titulo || ""} ${offer?.descripcion || ""} ${offer?.ubicacion || ""}`.toLowerCase();
  if (/remote|remoto|teletrabajo/.test(text)) return "remoto";
  if (/hybrid|hibrid|híbrido|hibrido|mixto/.test(text)) return "hibrido";
  if (/presencial|onsite/.test(text)) return "presencial";
  return "no_indicado";
}

function extractTechTags(offer, userStack) {
  if (!userStack?.length) return [];
  const text = ((offer.titulo || "") + " " + (offer.descripcion || "")).toLowerCase();
  return userStack.filter(tech => text.includes(tech.toLowerCase())).slice(0, 5);
}

function getDecisionReason(offer) {
  return offer?.decision_reason || offer?.motivo || "";
}

function getStrengths(offer) {
  return Array.isArray(offer?.strengths) ? offer.strengths : [];
}

function getGaps(offer) {
  return Array.isArray(offer?.gaps) ? offer.gaps : [];
}

function getBlockers(offer) {
  return Array.isArray(offer?.blockers) ? offer.blockers : [];
}

function getCriticalGaps(offer) {
  return Array.isArray(offer?.critical_gaps) ? offer.critical_gaps : getBlockers(offer);
}

function getOfferCompareKey(offer) {
  return String(offer?.adzuna_id || offer?.id || "");
}

function normalizeInsightText(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function dedupeTextList(items, limit = 6) {
  const seen = new Set();
  const deduped = [];
  for (const item of items || []) {
    const text = String(item || "").trim();
    if (!text) continue;
    const key = normalizeInsightText(text);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(text);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

function truncateText(text, max = 120) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function getOfferFocusStrengths(offer, limit = 4) {
  return dedupeTextList([...(offer?.skills_match || []), ...getStrengths(offer)], limit);
}

function getOfferFocusRisks(offer, limit = 4) {
  return dedupeTextList([...(offer?.skills_missing || []), ...getGaps(offer), ...getBlockers(offer)], limit);
}

function getOfferHeadline(offer) {
  if (!offer) return "Lectura rápida del encaje";
  if (getBlockers(offer).length > 0) return "Hay incompatibilidades claras que conviene revisar antes de aplicar";
  if (offer.resultado === "APLICA") return "Tu perfil encaja bien con esta oferta y merece prioridad";
  if (normalizeResultValue(offer.resultado) === "QUIZÁ") return "Puede convertirse en una buena candidatura si ajustas el CV";
  return "El encaje es parcial y conviene decidir si compensa invertir tiempo aquí";
}

function getOfferNextSteps(offer) {
  if (!offer) return [];

  const actions = [];
  const missingSkills = dedupeTextList(offer?.skills_missing || [], 3);
  const blockersText = normalizeInsightText(getBlockers(offer).join(" "));
  const gapsText = normalizeInsightText(getGaps(offer).join(" "));

  if (normalizeResultValue(offer.resultado) === "APLICA") {
    actions.push("Personaliza el resumen del CV con las skills que ya encajan y aplica pronto.");
  } else if (normalizeResultValue(offer.resultado) === "QUIZÁ") {
    actions.push("Adapta el CV a esta oferta antes de aplicar para intentar moverla a 'Aplica'.");
  } else {
    actions.push("No la priorizaría ahora salvo que quieras practicar candidatura o cambiar de perfil objetivo.");
  }

  if (missingSkills.length > 0) {
    actions.push(`Refuerza o evidencia ${missingSkills.join(", ")} con proyectos, logros o formación visible en tu CV.`);
  }

  if (blockersText.includes("idioma")) {
    actions.push("Ajusta el filtro de idioma o prepara una versión del CV que haga más visible tu nivel.");
  }

  if (blockersText.includes("ubicacion") || blockersText.includes("modalidad") || blockersText.includes("presencial")) {
    actions.push("Filtra mejor por ubicación o modalidad para no perder tiempo en ofertas inviables.");
  }

  if (blockersText.includes("anos") || blockersText.includes("senior") || blockersText.includes("experiencia") || gapsText.includes("experiencia")) {
    actions.push("Si eres junior, compensa la experiencia con proyectos, prácticas, TFG o freelance en el CV.");
  }

  if (actions.length === 1 && getGaps(offer).length > 0) {
    actions.push("Reordena tu CV para que lo más alineado con la oferta aparezca arriba del todo.");
  }

  return dedupeTextList(actions, 3);
}

function getAnalysisCoach({ visible, aplica, quiza, noEncaja, skillsGap }) {
  const items = [];
  const topSkill = skillsGap?.recommended_skills?.[0];

  if (aplica.length > 0) {
    items.push({
      tone: "positive",
      label: "Prioriza",
      text: `Tienes ${aplica.length} oferta${aplica.length !== 1 ? "s" : ""} con buen encaje. Empezaría por ellas antes de gastar tiempo en el resto.`,
    });
  }

  if (quiza.length > 0) {
    items.push({
      tone: "warning",
      label: "Convierte",
      text: `${quiza.length} oferta${quiza.length !== 1 ? "s" : ""} podrían subir de nivel si adaptas el CV y destacas mejor tu experiencia o tus proyectos.`,
    });
  }

  if (topSkill?.name) {
    items.push({
      tone: "info",
      label: "Mejora",
      text: `La palanca de mejora más repetida ahora mismo es ${topSkill.name}. ${truncateText(topSkill.reason, 95)}`,
    });
  } else if (noEncaja.length > 0) {
    items.push({
      tone: "danger",
      label: "Evita",
      text: `Hay ${noEncaja.length} oferta${noEncaja.length !== 1 ? "s" : ""} con bloqueadores claros. Mejor descártalas rápido y centra energía en las viables.`,
    });
  }

  if (!items.length) return null;

  return {
    title: "Qué haría ahora",
    summary: `Has analizado ${visible.length} oferta${visible.length !== 1 ? "s" : ""}. Esta sería mi lectura práctica para avanzar más rápido.`,
    items,
  };
}

function getWorkModeLabel(offer) {
  const workMode = offer?.signals_summary?.work_mode;
  if (workMode === "remote") return "Remoto";
  if (workMode === "hybrid") return "Híbrido";
  if (workMode === "onsite") return "Presencial";
  return "No indicada";
}

function getSeniorityLabel(offer) {
  const seniority = offer?.signals_summary?.seniority_level;
  if (!seniority) return "No indicado";
  if (seniority === "junior") return "Junior";
  if (seniority === "mid") return "Mid";
  if (seniority === "senior") return "Senior";
  if (seniority === "lead") return "Lead";
  return seniority;
}

function getCompareStrengths(offer) {
  return Array.from(new Set([...(offer?.skills_match || []), ...getStrengths(offer)])).slice(0, 6);
}

function getCompareGaps(offer) {
  return Array.from(new Set([...(offer?.skills_missing || []), ...getGaps(offer)])).slice(0, 6);
}

function sortByRelevance(offers) {
  const order = { APLICA: 0, "QUIZÁ": 1, NO_ENCAJA: 2 };
  return offers.slice().sort((a, b) => {
    const aOrder = order[normalizeResultValue(a.resultado)] ?? 2;
    const bOrder = order[normalizeResultValue(b.resultado)] ?? 2;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if ((b.ranking_score || 0) !== (a.ranking_score || 0)) return (b.ranking_score || 0) - (a.ranking_score || 0);
    if ((b.puntuacion || 0) !== (a.puntuacion || 0)) return (b.puntuacion || 0) - (a.puntuacion || 0);
    if ((getBlockers(a).length) !== (getBlockers(b).length)) return getBlockers(a).length - getBlockers(b).length;
    if ((b.source_confidence || 0) !== (a.source_confidence || 0)) return (b.source_confidence || 0) - (a.source_confidence || 0);
    return (b.skills_match?.length || 0) - (a.skills_match?.length || 0);
  });
}

function isNewOffer(dateStr) {
  if (!dateStr) return false;
  try {
    return (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24) < 3;
  } catch { return false; }
}

// ── Sub-components ───────────────────────────────────────────────────────────────

function ScoreCircle({ score, color, size = 60 }) {
  const r = size * 0.38;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score ?? 0));
  const offset = circumference * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.1} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={size * 0.1}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.22} fontWeight="700" fill={color}>
        {score != null ? score : "?"}
      </text>
    </svg>
  );
}

function SkeletonCard({ darkMode }) {
  return (
    <div style={{
      padding: "24px 28px", borderRadius: 16,
      backgroundColor: darkMode ? "#1e293b" : "#fff",
      border: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "#e8ecf1"}`,
      animation: "skeletonPulse 1.5s ease-in-out infinite",
    }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: darkMode ? "#334155" : "#e8ecf1" }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 18, backgroundColor: darkMode ? "#334155" : "#e8ecf1", borderRadius: 8, marginBottom: 10, width: "65%" }} />
          <div style={{ height: 14, backgroundColor: darkMode ? "#2d3b4f" : "#f1f3f5", borderRadius: 6, width: "40%" }} />
        </div>
        <div style={{ width: 90, height: 28, borderRadius: 20, backgroundColor: darkMode ? "#334155" : "#e8ecf1" }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[80, 70, 60].map((w, i) => (
          <div key={i} style={{ height: 26, width: w, backgroundColor: darkMode ? "#2d3b4f" : "#f1f3f5", borderRadius: 20 }} />
        ))}
      </div>
      <div style={{ height: 60, backgroundColor: darkMode ? "#2d3b4f" : "#f1f3f5", borderRadius: 10 }} />
    </div>
  );
}

function QuotaCard({ quota, darkMode, compact = false }) {
  const dm = darkMode;
  const used = quota?.used || 0;
  const limit = quota?.daily_limit || 0;
  const remaining = quota?.remaining || 0;
  const width = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div style={{
      marginBottom: compact ? 18 : 20,
      padding: compact ? "14px 16px" : "16px 18px",
      borderRadius: 12,
      backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#fff",
      border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e8ecf1"}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: dm ? "#5eead4" : TEAL, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: typography.family }}>
            Cuota diaria IA
          </p>
          <p style={{ margin: "4px 0 0", fontSize: compact ? 12 : 13, color: dm ? "#94a3b8" : "#6b7280", lineHeight: 1.5, fontFamily: typography.family }}>
            {remaining > 0 ? `Te quedan ${remaining} uso${remaining !== 1 ? "s" : ""} hoy.` : "Has agotado tu cuota diaria de IA."}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: compact ? 22 : 24, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", lineHeight: 1, fontFamily: typography.family }}>
            {used}/{limit}
          </div>
          <div style={{ fontSize: 11, color: dm ? "#64748b" : "#94a3af", marginTop: 4, fontFamily: typography.family }}>
            {quota?.date || ""}
          </div>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: dm ? "#334155" : "#eef2f7" }}>
        <div style={{
          width: `${width}%`,
          height: "100%",
          borderRadius: 999,
          background: width >= 85 ? "linear-gradient(90deg, #f97316, #ef4444)" : `linear-gradient(90deg, ${TEAL}, #2563eb)`,
          transition: "width 0.4s ease",
        }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: dm ? "#94a3b8" : "#64748b", fontFamily: typography.family }}>
        <span>Análisis: {quota?.match_count || 0}</span>
        <span>Cartas: {quota?.cover_letter_count || 0}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════════

function MatchInsightSummary({ offer, darkMode, compact = false }) {
  const dm = darkMode;
  const strengths = getOfferFocusStrengths(offer, compact ? 3 : 5);
  const risks = getOfferFocusRisks(offer, compact ? 3 : 5);
  const actions = getOfferNextSteps(offer);
  const blockerCount = getBlockers(offer).length;
  const reviewCount = dedupeTextList([...(offer?.skills_missing || []), ...getGaps(offer)], 8).length;

  const tonePalette = {
    positive: {
      bg: dm ? "rgba(16,185,129,0.12)" : "#ecfdf5",
      border: dm ? "rgba(16,185,129,0.24)" : "#bbf7d0",
      color: dm ? "#6ee7b7" : "#15803d",
    },
    warning: {
      bg: dm ? "rgba(245,158,11,0.12)" : "#fffbeb",
      border: dm ? "rgba(245,158,11,0.22)" : "#fde68a",
      color: dm ? "#fbbf24" : "#b45309",
    },
    danger: {
      bg: dm ? "rgba(239,68,68,0.12)" : "#fef2f2",
      border: dm ? "rgba(239,68,68,0.22)" : "#fecaca",
      color: dm ? "#fca5a5" : "#dc2626",
    },
  };

  const stats = [
    { label: "Encaje", value: offer?.skills_match?.length || 0, tone: "positive" },
    { label: "A revisar", value: reviewCount, tone: "warning" },
    { label: "Bloqueos", value: blockerCount, tone: "danger" },
  ];

  const shouldRender = getDecisionReason(offer) || strengths.length > 0 || risks.length > 0 || actions.length > 0;
  if (!shouldRender) return null;

  return (
    <div style={{
      marginTop: compact ? 16 : 0,
      padding: compact ? "16px 18px" : "18px 20px",
      borderRadius: 14,
      backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#fff",
      border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: dm ? "#5eead4" : TEAL, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: typography.family }}>
            Lectura rápida
          </p>
          <p style={{ margin: "6px 0 0", fontSize: compact ? 14 : 15, fontWeight: 700, color: dm ? "#f8fafc" : "#111827", lineHeight: 1.45, fontFamily: typography.family }}>
            {getOfferHeadline(offer)}
          </p>
        </div>
        {offer?.puntuacion != null && !compact && (
          <span style={{
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            backgroundColor: dm ? "rgba(0,117,138,0.12)" : "rgba(0,117,138,0.06)",
            color: dm ? "#5eead4" : TEAL,
            border: `1px solid ${dm ? "rgba(94,234,212,0.18)" : "rgba(0,117,138,0.12)"}`,
            fontFamily: typography.family,
          }}>
            {offer.puntuacion}% match
          </span>
        )}
      </div>

      {getDecisionReason(offer) && (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: dm ? "#94a3b8" : "#4b5563", fontFamily: typography.family }}>
          {getDecisionReason(offer)}
        </p>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
        marginTop: 14,
      }}>
        {stats.map((stat) => {
          const palette = tonePalette[stat.tone];
          return (
            <div key={stat.label} style={{
              padding: compact ? "10px 12px" : "12px 14px",
              borderRadius: 12,
              backgroundColor: palette.bg,
              border: `1px solid ${palette.border}`,
              minWidth: 0,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: palette.color, fontFamily: typography.family }}>
                {stat.label}
              </div>
              <div style={{ marginTop: 6, fontSize: compact ? 20 : 24, fontWeight: 800, color: dm ? "#f8fafc" : "#111827", lineHeight: 1, fontFamily: typography.family }}>
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
        marginTop: 14,
      }}>
        {strengths.length > 0 && (
          <div style={{
            padding: compact ? "12px 14px" : "14px 16px",
            borderRadius: 12,
            backgroundColor: dm ? "rgba(16,185,129,0.08)" : "#f0fdf4",
            border: `1px solid ${dm ? "rgba(16,185,129,0.16)" : "#dcfce7"}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: dm ? "#6ee7b7" : "#15803d", fontFamily: typography.family }}>
              A tu favor
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {strengths.map((item) => (
                <span key={`pro-${item}`} style={{
                  padding: "4px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: dm ? "rgba(16,185,129,0.12)" : "#dcfce7",
                  color: dm ? "#6ee7b7" : "#15803d",
                  border: `1px solid ${dm ? "rgba(16,185,129,0.2)" : "#bbf7d0"}`,
                  fontFamily: typography.family,
                }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {risks.length > 0 && (
          <div style={{
            padding: compact ? "12px 14px" : "14px 16px",
            borderRadius: 12,
            backgroundColor: dm ? "rgba(245,158,11,0.08)" : "#fffbeb",
            border: `1px solid ${dm ? "rgba(245,158,11,0.16)" : "#fde68a"}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: dm ? "#fbbf24" : "#b45309", fontFamily: typography.family }}>
              Conviene revisar
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {risks.map((item) => (
                <span key={`risk-${item}`} style={{
                  padding: "4px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: dm ? "rgba(245,158,11,0.12)" : "#fef3c7",
                  color: dm ? "#fbbf24" : "#b45309",
                  border: `1px solid ${dm ? "rgba(245,158,11,0.2)" : "#fde68a"}`,
                  fontFamily: typography.family,
                }}>
                  {truncateText(item, compact ? 70 : 90)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {actions.length > 0 && (
        <div style={{
          marginTop: 14,
          padding: compact ? "12px 14px" : "14px 16px",
          borderRadius: 12,
          backgroundColor: dm ? "rgba(37,99,235,0.08)" : "#eff6ff",
          border: `1px solid ${dm ? "rgba(37,99,235,0.16)" : "#bfdbfe"}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: dm ? "#93c5fd" : "#1d4ed8", fontFamily: typography.family }}>
            Qué haría ahora
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
            {actions.map((action) => (
              <div key={action} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: dm ? "#93c5fd" : "#2563eb", fontSize: 12, lineHeight: 1.6 }}>?</span>
                <span style={{ fontSize: 12, lineHeight: 1.6, color: dm ? "#dbeafe" : "#1e3a8a", fontFamily: typography.family }}>
                  {action}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile({ analysisResults, setAnalysisResults, addToast, darkMode, forceAnalyze, onAnalyzeStarted }) {
  const analyzeBtnRef = useRef(null);
  const [profile,             setProfile]             = useState(null);
  const [profileLoading,      setProfileLoading]      = useState(true);
  const [loading,             setLoading]             = useState(false);
  const [loadingPhase,        setLoadingPhase]        = useState(0);
  const [results,             setResults]             = useState(() => {
    if (!analysisResults) return null;
    return Array.isArray(analysisResults) ? analysisResults : (analysisResults.offers || null);
  });
  const [error,               setError]               = useState(null);
  const [filter,              setFilter]              = useState("todos");
  const [selectedOffer,       setSelectedOffer]       = useState(null);
  const [compareSelection,    setCompareSelection]    = useState([]);
  const [showCompareModal,    setShowCompareModal]    = useState(false);
  const [favorites,           setFavorites]           = useState(new Set());
  const [tracked,             setTracked]             = useState(new Map()); // adzuna_id → app_id
  const [discarded,           setDiscarded]           = useState(new Set());
  const [searchHistory,       setSearchHistory]       = useState([]);
  const [rerunningHistoryId,  setRerunningHistoryId]  = useState(null);
  const [coverLetter,         setCoverLetter]         = useState(null);
  const [coverLetterLoading,  setCoverLetterLoading]  = useState(false);
  const [coverLetterError,    setCoverLetterError]    = useState(null);
  const [showCoverLetter,     setShowCoverLetter]     = useState(false);
  const [analysisTime,        setAnalysisTime]        = useState(null);
  const [aiQuota,             setAiQuota]             = useState(null);
  const [,                     setAiQuotaLoading]      = useState(true);
  const [skillsGap,           setSkillsGap]           = useState(() => {
    if (!analysisResults || Array.isArray(analysisResults)) return null;
    return analysisResults.skills_gap || null;
  });
  // Sidebar filters
  const [keywordFilter,       setKeywordFilter]       = useState("");
  const [locationFilter,      setLocationFilter]      = useState("");
  const [salaryMin,           setSalaryMin]           = useState("");
  const [salaryMax,           setSalaryMax]           = useState("");
  const [contractFilter,      setContractFilter]      = useState("todos");
  const [workModeFilter,      setWorkModeFilter]      = useState("todos");
  const [onlyVerified,        setOnlyVerified]        = useState(false);
  const [onlyDirectSources,   setOnlyDirectSources]   = useState(false);
  const [hideAggregators,     setHideAggregators]     = useState(false);
  const [onlySalaryVisible,   setOnlySalaryVisible]   = useState(false);
  const [onlyJuniorFriendly,  setOnlyJuniorFriendly]  = useState(false);
  const [sortBy,              setSortBy]              = useState("relevancia");
  const [showMobileFilters,   setShowMobileFilters]   = useState(false);
  const [isMobile,            setIsMobile]            = useState(() => typeof window !== "undefined" && window.innerWidth < 900);

  async function refreshAiQuota() {
    try {
      const quota = await getAiQuota();
      setAiQuota(quota);
    } catch {
      // ignore
    } finally {
      setAiQuotaLoading(false);
    }
  }

  useEffect(() => {
    getUserProfile()
      .then(setProfile)
      .catch(() => setProfile({}))
      .finally(() => setProfileLoading(false));
    getFavorites()
      .then(list => setFavorites(new Set(list.map(f => f.adzuna_id))))
      .catch(() => {});
    getApplications()
      .then(list => setTracked(new Map(list.map(a => [a.adzuna_id, a.id]))))
      .catch(() => {});
    getHistory()
      .then(setSearchHistory)
      .catch(() => {});
    refreshAiQuota();
  }, []);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    setCoverLetter(null);
    setCoverLetterLoading(false);
    setCoverLetterError(null);
    setShowCoverLetter(false);
  }, [selectedOffer]);

  useEffect(() => {
    if (!results?.length) {
      setCompareSelection([]);
      setShowCompareModal(false);
      return;
    }
    const available = new Set(results.map(getOfferCompareKey));
    setCompareSelection(prev => prev.filter(id => available.has(id)));
  }, [results]);

  useEffect(() => {
    if (forceAnalyze && profile && Object.keys(profile).length > 0 && !loading) {
      if (onAnalyzeStarted) onAnalyzeStarted();
      setTimeout(() => {
        handleAnalyzeWith(profile);
      }, 0);
    }
  }, [forceAnalyze, profile, loading]);

  function calculateDaysAgo(dateString) {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const diffDays = Math.ceil(Math.abs(new Date() - date) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Hoy";
      if (diffDays === 1) return "Hace 1 día";
      return `Hace ${diffDays} días`;
    } catch {
      return "";
    }
  }

  async function toggleFavorite(offer) {
    if (!offer.adzuna_id) return;
    const isFav = favorites.has(offer.adzuna_id);
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(offer.adzuna_id);
      else next.add(offer.adzuna_id);
      return next;
    });
    try {
      if (isFav) {
        await removeFavorite(offer.adzuna_id);
        addToast?.("Oferta eliminada de favoritos", "info");
      } else {
        await addFavorite({
          adzuna_id:    offer.adzuna_id,
          titulo:       offer.titulo,
          empresa:      offer.empresa,
          url:          offer.redirect_url,
          resultado_ia: offer.resultado,
        });
        addToast?.("Oferta guardada en favoritos", "success");
      }
    } catch {
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(offer.adzuna_id);
        else next.delete(offer.adzuna_id);
        return next;
      });
    }
  }

  async function handleTrackOffer(offer) {
    const aid = offer.adzuna_id || offer.id;
    if (!aid) return;
    if (tracked.has(aid)) {
      // Dejar de seguir
      const appId = tracked.get(aid);
      setTracked(prev => { const next = new Map(prev); next.delete(aid); return next; });
      try {
        await deleteApplication(appId);
        addToast?.("Dejaste de seguir esta oferta", "info");
      } catch {
        setTracked(prev => new Map(prev).set(aid, appId));
        addToast?.("Error al dejar de seguir", "error");
      }
      return;
    }
    // Empezar a seguir (optimista)
    setTracked(prev => new Map(prev).set(aid, null));
    try {
      const created = await createApplication({
        adzuna_id: aid,
        titulo:    offer.titulo,
        empresa:   offer.empresa,
        url:       offer.redirect_url || offer.url,
      });
      setTracked(prev => new Map(prev).set(aid, created.id));
      addToast?.("Candidatura añadida al seguimiento", "success");
    } catch {
      setTracked(prev => { const next = new Map(prev); next.delete(aid); return next; });
      addToast?.("Error al añadir candidatura", "error");
    }
  }

  async function handleDiscardOffer(offer) {
    const aid = offer.adzuna_id || offer.id;
    if (!aid) return;
    setDiscarded(prev => new Set([...prev, aid]));
    // Si estaba en candidaturas, eliminarla también
    if (tracked.has(aid)) {
      const appId = tracked.get(aid);
      setTracked(prev => { const next = new Map(prev); next.delete(aid); return next; });
      if (appId) {
        try { await deleteApplication(appId); } catch { /* silent */ }
      }
    }
    addToast?.("Oferta descartada", "info");
  }

  function toggleCompareSelection(offer) {
    const offerKey = getOfferCompareKey(offer);
    if (!offerKey) return;
    setCompareSelection(prev => {
      if (prev.includes(offerKey)) {
        return prev.filter(id => id !== offerKey);
      }
      if (prev.length >= 3) {
        addToast?.("Puedes comparar un máximo de 3 ofertas", "info");
        return prev;
      }
      return [...prev, offerKey];
    });
  }

  function openCompareModal() {
    if (compareSelection.length < 2) {
      addToast?.("Selecciona al menos 2 ofertas para comparar", "info");
      return;
    }
    setShowCompareModal(true);
  }

  async function handleAnalyzeWith(profileObj, options = {}) {
    const { historyId = null } = options;
    if (historyId != null) setRerunningHistoryId(historyId);
    setLoading(true);
    setError(null);
    setResults(null);
    setSkillsGap(null);
    setAnalysisTime(null);
    setLoadingPhase(0);
    const startTime = Date.now();
    const phaseInterval = setInterval(() => {
      setLoadingPhase(p => (p + 1) % LOADING_PHASES.length);
    }, 3000);
    try {
      const data = await matchOffers({
        experience:  profileObj.anos_experiencia,
        stack:       profileObj.stack,
        english:     getEnglishForMatch(profileObj.idiomas),
        ubicaciones: profileObj.ubicaciones || [],
        modalidad:   profileObj.modalidad || [],
        idiomas:     profileObj.idiomas || [],
      });
      const offersData = Array.isArray(data) ? data : (data.offers || []);
      const skillsGapData = Array.isArray(data) ? null : (data.skills_gap || null);
      setResults(offersData);
      setSkillsGap(skillsGapData);
      setAnalysisResults(data);
      setAnalysisTime(Math.round((Date.now() - startTime) / 1000));
      saveHistory({
        stack:            profileObj.stack || [],
        anos_experiencia: hasExperienceValue(profileObj.anos_experiencia) ? String(profileObj.anos_experiencia) : "",
        ubicaciones:      profileObj.ubicaciones || [],
        modalidad:        profileObj.modalidad || [],
        num_aplica:       offersData.filter(r => r.resultado === "APLICA").length,
        num_quiza:        offersData.filter(r => normalizeResultValue(r.resultado) === "QUIZÁ").length,
        num_no_encaja:    offersData.filter(r => r.resultado === "NO_ENCAJA").length,
      })
        .then(() => getHistory().then(setSearchHistory).catch(() => {}))
        .catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(phaseInterval);
      setLoading(false);
      if (historyId != null) setRerunningHistoryId(null);
      refreshAiQuota();
    }
  }

  function handleAnalyze() { return handleAnalyzeWith(profile); }

  function buildRerunProfile(item) {
    const currentStack = Array.isArray(profile?.stack) && profile.stack.length > 0
      ? profile.stack
      : (item.stack || []);
    const currentExperience = hasExperienceValue(profile?.anos_experiencia)
      ? String(profile.anos_experiencia)
      : (hasExperienceValue(item.anos_experiencia) ? String(item.anos_experiencia) : "");
    const currentIdiomas = Array.isArray(profile?.idiomas) ? profile.idiomas : [];
    const rerunLocations = Array.isArray(item.ubicaciones) && item.ubicaciones.length > 0
      ? item.ubicaciones
      : (profile?.ubicaciones || []);
    const rerunModalidad = Array.isArray(item.modalidad) && item.modalidad.length > 0
      ? item.modalidad
      : (profile?.modalidad || []);

    if (!currentStack.length) {
      addToast?.("No se puede re-ejecutar: falta stack tecnológico en tu perfil actual o en la búsqueda histórica", "warning");
      return null;
    }

    if (!hasExperienceValue(currentExperience)) {
      addToast?.("No se puede re-ejecutar: falta experiencia en tu perfil actual o en la búsqueda histórica", "warning");
      return null;
    }

    return {
      anos_experiencia: currentExperience,
      stack: currentStack,
      idiomas: currentIdiomas,
      ubicaciones: rerunLocations,
      modalidad: rerunModalidad,
    };
  }

  function handleRepeat(item) {
    const rerunProfile = buildRerunProfile(item);
    if (!rerunProfile) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    return handleAnalyzeWith(rerunProfile, { historyId: item.id });
  }

  function handleReset() {
    setResults(null);
    setSkillsGap(null);
    setError(null);
    setFilter("todos");
    setKeywordFilter("");
    setLocationFilter("");
    setSalaryMin("");
    setSalaryMax("");
    setContractFilter("todos");
    setWorkModeFilter("todos");
    setOnlyVerified(false);
    setOnlyDirectSources(false);
    setHideAggregators(false);
    setOnlySalaryVisible(false);
    setOnlyJuniorFriendly(false);
    setSortBy("relevancia");
  }

  function handleShare() {
    if (!results) return;
    const aplica   = results.filter(r => r.resultado === "APLICA").length;
    const quiza    = results.filter(r => normalizeResultValue(r.resultado) === "QUIZÁ").length;
    const noEncaja = results.filter(r => r.resultado === "NO_ENCAJA").length;
    const stack    = profile?.stack?.slice(0, 4).join(", ") || "";
    const text = `Mi análisis JobMatch.IA 🤖\n✓ APLICA: ${aplica}  △ QUIZÁ: ${quiza}  ✗ NO ENCAJA: ${noEncaja}\nStack: ${stack}${analysisTime != null ? `\n⚡ Analizado en ${analysisTime}s` : ""}`;
    navigator.clipboard.writeText(text).then(() => addToast?.("Resultados copiados", "success")).catch(() => {});
  }

  async function handleGenerateCoverLetter() {
    if (!selectedOffer || !profile) return;
    setShowCoverLetter(true);
    setCoverLetterLoading(true);
    setCoverLetterError(null);
    setCoverLetter(null);
    try {
      const result = await generateCoverLetter(
        {
          titulo:      selectedOffer.titulo || "",
          empresa:     selectedOffer.empresa || "",
          descripcion: selectedOffer.descripcion || "",
        },
        {
          stack:            profile.stack || [],
          anos_experiencia: hasExperienceValue(profile.anos_experiencia) ? String(profile.anos_experiencia) : null,
          email:            profile.email || null,
        }
      );
      setCoverLetter(result.carta);
    } catch (err) {
      setCoverLetterError(err.message || "Error al generar la carta");
    } finally {
      setCoverLetterLoading(false);
      refreshAiQuota();
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div style={{ ...S.centeredContainer, ...(darkMode ? { background: "#0f172a", minHeight: "100vh" } : {}) }}>
        <div style={{ ...S.spinner, ...(darkMode ? { borderColor: "rgba(255,255,255,0.1)", borderTopColor: TEAL } : {}) }} />
      </div>
    );
  }

  // ── Analyzing — skeleton loader ────────────────────────────────────────────────
  if (loading) {
    const phase = LOADING_PHASES[loadingPhase];
    return (
      <div className="profile-results-page" style={{ ...S.resultsPage, ...(darkMode ? S.dmPage : {}) }}>
        <div style={{ textAlign: "center", marginBottom: 48, paddingTop: 24 }}>
          <div style={{ fontSize: 56, marginBottom: 20, display: "inline-block", animation: "floatBounce 2s ease-in-out infinite" }}>
            {phase.icon}
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: darkMode ? "#f1f5f9" : "#111827", margin: "0 0 8px" }}>
            {phase.text}
          </p>
          <p style={{ fontSize: 14, color: darkMode ? "#64748b" : "#9ca3af", margin: 0 }}>
            Esto puede tardar unos segundos...
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
            {LOADING_PHASES.map((_, i) => (
              <div key={i} style={{
                width: i === loadingPhase ? 28 : 8, height: 8,
                borderRadius: 4, transition: "all 0.3s ease",
                backgroundColor: i === loadingPhase ? TEAL : (darkMode ? "#334155" : "#e5e7eb"),
              }} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900, margin: "0 auto" }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} darkMode={darkMode} />)}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RESULTS VIEW
  // ══════════════════════════════════════════════════════════════════════════════
  if (results) {
    const allSorted = sortByRelevance(results);
    const visible  = allSorted.filter(r => !discarded.has(r.adzuna_id || r.id));
    const aplica   = visible.filter(r => r.resultado === "APLICA");
    const quiza    = visible.filter(r => normalizeResultValue(r.resultado) === "QUIZÁ");
    const noEncaja = visible.filter(r => r.resultado === "NO_ENCAJA");
    const favCount = visible.filter(r => r.adzuna_id && favorites.has(r.adzuna_id)).length;

    let filtered = visible.slice();
    if (filter === "aplica")         filtered = aplica.slice();
    else if (filter === "quiza")     filtered = quiza.slice();
    else if (filter === "no-encaja") filtered = noEncaja.slice();
    else if (filter === "favoritas") filtered = visible.filter(r => r.adzuna_id && favorites.has(r.adzuna_id));

    // Keyword filter
    if (keywordFilter.trim()) {
      const kw = keywordFilter.toLowerCase().trim();
      filtered = filtered.filter(offer =>
        (offer.titulo || "").toLowerCase().includes(kw) ||
        (offer.empresa || "").toLowerCase().includes(kw) ||
        (offer.descripcion || "").toLowerCase().includes(kw)
      );
    }
    // Location filter
    if (locationFilter.trim()) {
      const loc = locationFilter.toLowerCase().trim();
      filtered = filtered.filter(offer =>
        (offer.ubicacion || "").toLowerCase().includes(loc)
      );
    }
    // Salary filter
    if (salaryMin !== "" || salaryMax !== "") {
      filtered = filtered.filter(offer => {
        const sal = parseSalaryValue(offer.salario);
        if (sal == null) return salaryMin === "";
        const min = salaryMin !== "" ? Number(salaryMin) : 0;
        const max = salaryMax !== "" ? Number(salaryMax) : 999;
        return sal >= min && sal <= max;
      });
    }
    if (contractFilter !== "todos") {
      filtered = filtered.filter(offer => detectContract(offer) === contractFilter);
    }
    if (workModeFilter !== "todos") {
      filtered = filtered.filter(offer => detectWorkMode(offer) === workModeFilter);
    }
    if (onlyVerified) {
      filtered = filtered.filter(isVerifiedOffer);
    }
    if (onlyDirectSources) {
      filtered = filtered.filter(isDirectSourceOffer);
    }
    if (hideAggregators) {
      filtered = filtered.filter(offer => !isAggregatorOffer(offer));
    }
    if (onlySalaryVisible) {
      filtered = filtered.filter(hasVisibleSalary);
    }
    if (onlyJuniorFriendly) {
      filtered = filtered.filter(isJuniorFriendlyOffer);
    }
    if (sortBy === "fecha") {
      filtered.sort((a, b) => new Date(b.fecha_publicacion || 0) - new Date(a.fecha_publicacion || 0));
    } else if (sortBy === "salario") {
      filtered.sort((a, b) => (parseSalaryValue(b.salario) || 0) - (parseSalaryValue(a.salario) || 0));
    } else if (sortBy === "puntuacion") {
      filtered.sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));
    } else if (sortBy === "confianza") {
      filtered.sort((a, b) => (b.source_confidence || 0) - (a.source_confidence || 0));
    }

    const compareOffers = compareSelection
      .map(id => visible.find(offer => getOfferCompareKey(offer) === id))
      .filter(Boolean);
    const bestCompareKey = compareOffers.length
      ? sortByRelevance(compareOffers)[0] && getOfferCompareKey(sortByRelevance(compareOffers)[0])
      : null;
    const dm = darkMode;
    const userStack = profile?.stack || [];
    const coach = getAnalysisCoach({ visible, aplica, quiza, noEncaja, skillsGap });
    const qualityCounts = getOfferQualityCounts(visible);

    return (
      <div className="profile-results-page" style={{ ...S.resultsPage, ...(dm ? S.dmPage : {}) }}>
        {aiQuota && (
          <div style={{ maxWidth: isMobile ? "100%" : 320, marginBottom: 18 }}>
            <QuotaCard quota={aiQuota} darkMode={dm} compact />
          </div>
        )}

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div style={S.twoCol}>

          {/* LEFT — Filter Panel */}
          {!isMobile && (
            <div style={{ ...S.filterPanel, ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)" } : {}) }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", fontFamily: typography.family }}>
                  Filtros Avanzados
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: dm ? "#475569" : "#9ca3af", fontFamily: typography.family }}>
                  Refina tu búsqueda IA
                </p>
              </div>

              {/* Keyword */}
              <div style={S.filterGroup}>
                <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>🔍 Palabra clave</label>
                <input
                  type="text"
                  placeholder="Ej: React, Node, UX..."
                  value={keywordFilter}
                  onChange={e => setKeywordFilter(e.target.value)}
                  style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}) }}
                />
              </div>

              {/* Location */}
              <div style={S.filterGroup}>
                <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>📍 Ubicación</label>
                <input
                  type="text"
                  placeholder="Madrid, Barcelona..."
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}) }}
                />
              </div>

              {/* Contract (as Modalidad) */}
              <div style={S.filterGroup}>
                <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>📄 Contrato</label>
                <select
                  value={contractFilter}
                  onChange={e => setContractFilter(e.target.value)}
                  style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), cursor: "pointer" }}
                >
                  <option value="todos">Cualquiera</option>
                  <option value="indefinido">Indefinido</option>
                  <option value="temporal">Temporal / Prácticas</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
              <div style={S.filterGroup}>
                <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>🏡 Modo de trabajo</label>
                <select
                  value={workModeFilter}
                  onChange={e => setWorkModeFilter(e.target.value)}
                  style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), cursor: "pointer" }}
                >
                  <option value="todos">Cualquiera</option>
                  <option value="remoto">Remoto</option>
                  <option value="hibrido">Hibrido</option>
                  <option value="presencial">Presencial</option>
                </select>
              </div>

              {/* Sort (as Experiencia) */}
              <div style={S.filterGroup}>
                <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>📊 Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), cursor: "pointer" }}
                >
                  <option value="relevancia">Relevancia</option>
                  <option value="puntuacion">Puntuación</option>
                  <option value="confianza">Confianza de la fuente</option>
                  <option value="fecha">Más recientes</option>
                  <option value="salario">Mayor salario</option>
                </select>
              </div>

              {/* Salary */}
              <div style={S.filterGroup}>
                <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>💰 Salario</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={salaryMin}
                    onChange={e => setSalaryMin(e.target.value)}
                    style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), flex: 1 }}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={salaryMax}
                    onChange={e => setSalaryMax(e.target.value)}
                    style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), flex: 1 }}
                  />
                </div>
              </div>

              <div style={S.filterGroup}>
                <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>✨ Calidad de la oferta</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { checked: onlyVerified, onChange: setOnlyVerified, label: "Solo verificadas recientemente" },
                    { checked: onlyDirectSources, onChange: setOnlyDirectSources, label: "Solo fuentes directas u oficiales" },
                    { checked: hideAggregators, onChange: setHideAggregators, label: "Ocultar agregadas" },
                    { checked: onlySalaryVisible, onChange: setOnlySalaryVisible, label: "Con salario visible" },
                    { checked: onlyJuniorFriendly, onChange: setOnlyJuniorFriendly, label: "Junior o primer empleo" },
                  ].map((item) => (
                    <label
                      key={item.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        color: dm ? "#cbd5e1" : "#374151",
                        fontFamily: typography.family,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.onChange(e.target.checked)}
                        style={{ accentColor: TEAL, cursor: "pointer" }}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tech Stack chips */}
              {userStack.length > 0 && (
                <div style={S.filterGroup}>
                  <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>&lt;/&gt; Tech Stack</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {userStack.slice(0, 8).map(tech => (
                      <span key={tech} style={{
                        padding: "4px 12px", borderRadius: 20,
                        fontSize: 12, fontWeight: 500,
                        backgroundColor: dm ? "rgba(0,117,138,0.12)" : "rgba(0,117,138,0.06)",
                        color: TEAL,
                        border: `1px solid ${dm ? "rgba(0,117,138,0.25)" : "rgba(0,117,138,0.2)"}`,
                        whiteSpace: "nowrap",
                      }}>
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear filters button */}
              <button
                style={{
                  width: "100%", padding: "10px 16px", fontSize: 14, fontWeight: 600,
                  color: dm ? "#94a3b8" : "#6b7280",
                  backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
                  border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                  borderRadius: 10,
                  cursor: "pointer", fontFamily: typography.family, marginTop: 8,
                }}
                onClick={() => {
                  setKeywordFilter("");
                  setLocationFilter("");
                  setSalaryMin("");
                  setSalaryMax("");
                  setContractFilter("todos");
                  setWorkModeFilter("todos");
                  setOnlyVerified(false);
                  setOnlyDirectSources(false);
                  setHideAggregators(false);
                  setOnlySalaryVisible(false);
                  setOnlyJuniorFriendly(false);
                  setSortBy("relevancia");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* RIGHT — Content */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* ── Header ──────────────────────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", letterSpacing: "-0.01em", fontFamily: typography.family }}>
                Explora tus coincidencias
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: dm ? "#64748b" : "#6b7280", fontFamily: typography.family, lineHeight: 1.5 }}>
                Análisis en tiempo real impulsado por IA basado en tu stack tecnológico
                {analysisTime != null && <span style={{ marginLeft: 12, color: dm ? "#475569" : "#9ca3af" }}>· {analysisTime}s</span>}
              </p>
            </div>

            {/* ── Metrics Row ─────────────────────────────────────────── */}
            <div style={S.metricsRow} className="metrics-row-responsive">
              {[
                { label: "TOTAL ANALIZADAS", value: visible.length, accent: TEAL,      iconBg: "#e0f2f4", iconColor: TEAL,      icon: "📊" },
                { label: "APLICA",           value: aplica.length,  accent: "#10b981", iconBg: "#d1fae5", iconColor: "#10b981", icon: "✓" },
                { label: "QUIZÁ",            value: quiza.length,   accent: "#64748b", iconBg: "#f1f5f9", iconColor: "#64748b", icon: "?" },
                { label: "NO ENCAJA",        value: noEncaja.length, accent: "#ef4444", iconBg: "#fee2e2", iconColor: "#ef4444", icon: "✗" },
              ].map((m, i) => (
                <div key={i} style={{
                  ...S.metricCard,
                  borderLeft: `3px solid ${m.accent}`,
                  ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)", borderLeftColor: m.accent } : {}),
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "50%",
                    backgroundColor: dm ? "rgba(255,255,255,0.06)" : m.iconBg,
                    color: m.iconColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 700, flexShrink: 0,
                  }}>
                    {m.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: dm ? "#64748b" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: typography.family }}>
                      {m.label}
                    </div>
                    <div className="summary-number-anim" style={{ fontSize: 28, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", lineHeight: 1, marginTop: 4, fontFamily: typography.family }}>
                      {m.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginBottom: 18,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}>
              {[
                { label: "Verificadas", value: qualityCounts.verified, tone: dm ? "rgba(16,185,129,0.15)" : "#ecfdf5", color: dm ? "#6ee7b7" : "#15803d", border: dm ? "rgba(16,185,129,0.22)" : "#bbf7d0" },
                { label: "Directas", value: qualityCounts.direct, tone: dm ? "rgba(37,99,235,0.15)" : "#eff6ff", color: dm ? "#93c5fd" : "#1d4ed8", border: dm ? "rgba(37,99,235,0.22)" : "#bfdbfe" },
                { label: "Oficiales", value: qualityCounts.official, tone: dm ? "rgba(14,165,233,0.15)" : "#ecfeff", color: dm ? "#67e8f9" : "#0f766e", border: dm ? "rgba(103,232,249,0.22)" : "#a5f3fc" },
                { label: "Con salario", value: qualityCounts.salaryVisible, tone: dm ? "rgba(245,158,11,0.15)" : "#fffbeb", color: dm ? "#fbbf24" : "#b45309", border: dm ? "rgba(245,158,11,0.22)" : "#fde68a" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    backgroundColor: item.tone,
                    color: item.color,
                    border: `1px solid ${item.border}`,
                    minWidth: 120,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: typography.family }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, lineHeight: 1, fontFamily: typography.family }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {coach && (
              <div style={{
                marginBottom: 20,
                padding: "18px 20px",
                borderRadius: 16,
                background: dm
                  ? "linear-gradient(135deg, rgba(15,118,110,0.14), rgba(37,99,235,0.10))"
                  : "linear-gradient(135deg, rgba(0,117,138,0.06), rgba(37,99,235,0.05))",
                border: `1px solid ${dm ? "rgba(94,234,212,0.18)" : "rgba(0,117,138,0.10)"}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: dm ? "#5eead4" : TEAL, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: typography.family }}>
                    Guía rápida
                  </p>
                  <h2 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 800, color: dm ? "#f8fafc" : "#111827", fontFamily: typography.family }}>
                    {coach.title}
                  </h2>
                  <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: dm ? "#cbd5e1" : "#475569", fontFamily: typography.family }}>
                    {coach.summary}
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {coach.items.map((item) => {
                    const toneMap = {
                      positive: { bg: dm ? "rgba(16,185,129,0.12)" : "#ecfdf5", border: dm ? "rgba(16,185,129,0.2)" : "#bbf7d0", color: dm ? "#6ee7b7" : "#15803d" },
                      warning: { bg: dm ? "rgba(245,158,11,0.12)" : "#fffbeb", border: dm ? "rgba(245,158,11,0.2)" : "#fde68a", color: dm ? "#fbbf24" : "#b45309" },
                      info: { bg: dm ? "rgba(37,99,235,0.12)" : "#eff6ff", border: dm ? "rgba(37,99,235,0.2)" : "#bfdbfe", color: dm ? "#93c5fd" : "#1d4ed8" },
                      danger: { bg: dm ? "rgba(239,68,68,0.12)" : "#fef2f2", border: dm ? "rgba(239,68,68,0.2)" : "#fecaca", color: dm ? "#fca5a5" : "#dc2626" },
                    };
                    const tone = toneMap[item.tone] || toneMap.info;
                    return (
                      <div key={`${item.label}-${item.text}`} style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        backgroundColor: tone.bg,
                        border: `1px solid ${tone.border}`,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: tone.color, fontFamily: typography.family }}>
                          {item.label}
                        </div>
                        <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: dm ? "#f8fafc" : "#1f2937", fontFamily: typography.family }}>
                          {item.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile filters toggle */}
            {isMobile && (
              <div style={{ marginBottom: 12 }}>
                <button
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
                    backgroundColor: dm ? "#1e293b" : "white", color: dm ? "#f1f5f9" : "#374151",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                    fontFamily: typography.family,
                  }}
                  onClick={() => setShowMobileFilters(f => !f)}
                >
                  Filtros
                  <span style={{ fontSize: 10 }}>{showMobileFilters ? "▲" : "▼"}</span>
                </button>
              </div>
            )}

            {isMobile && showMobileFilters && (
              <div style={{
                marginBottom: 16,
                padding: "14px 14px 12px",
                borderRadius: 14,
                backgroundColor: dm ? "#1e293b" : "#fff",
                border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
                display: "grid",
                gap: 12,
              }}>
                <input
                  type="text"
                  placeholder="Palabra clave"
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}) }}
                />
                <input
                  type="text"
                  placeholder="Ubicacion"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}) }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <select value={contractFilter} onChange={(e) => setContractFilter(e.target.value)} style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), cursor: "pointer" }}>
                    <option value="todos">Contrato</option>
                    <option value="indefinido">Indefinido</option>
                    <option value="temporal">Temporal / practicas</option>
                    <option value="freelance">Freelance</option>
                  </select>
                  <select value={workModeFilter} onChange={(e) => setWorkModeFilter(e.target.value)} style={{ ...S.filterInput, ...(dm ? S.filterInputDm : {}), cursor: "pointer" }}>
                    <option value="todos">Modo de trabajo</option>
                    <option value="remoto">Remoto</option>
                    <option value="hibrido">Hibrido</option>
                    <option value="presencial">Presencial</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { active: onlyVerified, toggle: setOnlyVerified, label: "Verificadas" },
                    { active: onlyDirectSources, toggle: setOnlyDirectSources, label: "Directas" },
                    { active: hideAggregators, toggle: setHideAggregators, label: "Sin agregadas" },
                    { active: onlySalaryVisible, toggle: setOnlySalaryVisible, label: "Con salario" },
                    { active: onlyJuniorFriendly, toggle: setOnlyJuniorFriendly, label: "Junior" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => item.toggle(!item.active)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 999,
                        border: `1px solid ${item.active ? "transparent" : (dm ? "rgba(255,255,255,0.1)" : "#d1d5db")}`,
                        backgroundColor: item.active ? TEAL : (dm ? "rgba(255,255,255,0.04)" : "#f8fafc"),
                        color: item.active ? "#fff" : (dm ? "#cbd5e1" : "#374151"),
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: typography.family,
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tab filters */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { value: "todos",      label: `Todas (${visible.length})` },
                { value: "aplica",     label: `Aplica (${aplica.length})` },
                { value: "quiza",      label: `Quizá (${quiza.length})` },
                { value: "no-encaja",  label: `No encaja (${noEncaja.length})` },
                { value: "favoritas",  label: `Favoritas${favCount > 0 ? ` (${favCount})` : ""}` },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  style={{
                    padding: "7px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                    border: `1px solid ${filter === f.value ? "transparent" : (dm ? "rgba(255,255,255,0.1)" : "#e2e8f0")}`,
                    cursor: "pointer", fontFamily: typography.family,
                    transition: `all ${transition.fast}`,
                    ...(filter === f.value
                      ? { backgroundColor: TEAL, color: "#fff", boxShadow: "0 2px 6px rgba(0,117,138,0.25)" }
                      : { backgroundColor: dm ? "#1e293b" : "#fff", color: dm ? "#94a3b8" : "#6b7280" }),
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{
              marginBottom: 20,
              padding: "16px 18px",
              borderRadius: 14,
              backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#fff",
              border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: dm ? "#5eead4" : TEAL, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: typography.family }}>
                    Comparador de ofertas
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: dm ? "#94a3b8" : "#64748b", lineHeight: 1.6, fontFamily: typography.family }}>
                    Selecciona 2 o 3 ofertas para compararlas lado a lado y ver rápidamente en cuál encajas mejor.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{
                    padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                    backgroundColor: dm ? "rgba(15,118,110,0.18)" : "rgba(0,117,138,0.08)",
                    color: dm ? "#5eead4" : TEAL,
                    border: `1px solid ${dm ? "rgba(94,234,212,0.22)" : "rgba(0,117,138,0.12)"}`,
                    fontFamily: typography.family,
                  }}>
                    {compareSelection.length}/3 seleccionadas
                  </span>
                  <button
                    onClick={() => setCompareSelection([])}
                    disabled={compareSelection.length === 0}
                    style={{
                      ...S.btnOutline,
                      padding: "8px 14px",
                      fontSize: 12,
                      opacity: compareSelection.length === 0 ? 0.55 : 1,
                      cursor: compareSelection.length === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={openCompareModal}
                    disabled={compareSelection.length < 2}
                    style={{
                      ...S.btnPrimary,
                      padding: "8px 16px",
                      fontSize: 12,
                      opacity: compareSelection.length < 2 ? 0.55 : 1,
                      cursor: compareSelection.length < 2 ? "not-allowed" : "pointer",
                    }}
                  >
                    Comparar ahora
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {compareOffers.length > 0 ? compareOffers.map(offer => (
                  <span key={getOfferCompareKey(offer)} style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    backgroundColor: dm ? "rgba(255,255,255,0.05)" : "#f8fafc",
                    color: dm ? "#e2e8f0" : "#1f2937",
                    border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
                    fontFamily: typography.family,
                  }}>
                    {offer.titulo}
                    <button
                      onClick={() => toggleCompareSelection(offer)}
                      style={{ background: "none", border: "none", color: dm ? "#94a3b8" : "#6b7280", cursor: "pointer", fontSize: 13, padding: 0 }}
                    >
                      ✕
                    </button>
                  </span>
                )) : (
                  <span style={{ fontSize: 12, color: dm ? "#64748b" : "#94a3af", fontFamily: typography.family }}>
                    Aún no has seleccionado ofertas para comparar.
                  </span>
                )}
              </div>
            </div>

            {/* ── Offer Cards (list layout) ─────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {filtered.length > 0 ? (
                filtered.map((offer, index) => {
                  const rs    = RESULT_STYLES[normalizeResultValue(offer.resultado)] || RESULT_STYLES.NO_ENCAJA;
                  const isFav = offer.adzuna_id && favorites.has(offer.adzuna_id);
                  const tags  = extractTechTags(offer, profile?.stack);
                  const isNew = isNewOffer(offer.fecha_publicacion);
                  const isCompared = compareSelection.includes(getOfferCompareKey(offer));
                  return (
                    <div
                      key={offer.id}
                      className="job-card"
                      onClick={() => setSelectedOffer(offer)}
                      style={{
                        ...S.offerCard,
                        borderLeftColor: rs.border,
                        animation: `fadeInUp 0.4s ease-out ${index * 0.04}s both`,
                        boxShadow: isCompared
                          ? (dm ? "0 0 0 2px rgba(94,234,212,0.22), 0 10px 24px rgba(0,0,0,0.14)" : "0 0 0 2px rgba(0,117,138,0.16), 0 8px 24px rgba(0,117,138,0.10)")
                          : undefined,
                        ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)", borderLeftColor: rs.border } : {}),
                      }}
                    >
                      {/* Row 1: Logo + Title/Company + Badge + Salary */}
                      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <CompanyLogo
                          name={offer.empresa}
                          logoUrl={offer.company_logo_url}
                          size={52}
                          darkMode={dm}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", lineHeight: 1.35, fontFamily: typography.family }}>
                            {offer.titulo}
                          </h3>
                          <p style={{ margin: "5px 0 0", fontSize: 14, color: dm ? "#5eead4" : TEAL, fontWeight: 500, fontFamily: typography.family, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13 }}>🏢</span> {offer.empresa}
                          </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                            backgroundColor: dm ? `${rs.border}18` : rs.bg,
                            color: rs.border, border: `1px solid ${dm ? `${rs.border}40` : `${rs.border}30`}`,
                            whiteSpace: "nowrap",
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: rs.border, display: "inline-block" }} />
                            {rs.label}{offer.puntuacion != null ? ` - ${offer.puntuacion}% Match` : ""}
                          </span>
                          {offer.salario && offer.salario !== "Salario no especificado" && (
                            <span style={{ fontSize: 17, fontWeight: 700, color: dm ? "#f1f5f9" : "#1e293b", whiteSpace: "nowrap", fontFamily: typography.family }}>
                              {offer.salario}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Context chips */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 0" }}>
                        <OfferTrustSignals offer={offer} darkMode={dm} compact maxSignals={2} />
                        {offer.ubicacion && (
                          <span style={{ ...S.chip, ...(dm ? S.chipDm : {}) }}>
                            <span style={{ fontSize: 11, opacity: 0.6 }}>📍</span> {offer.ubicacion}
                          </span>
                        )}
                        {isNew && (
                          <span style={{ ...S.chip, ...(dm ? S.chipDm : {}), backgroundColor: dm ? "rgba(245,158,11,0.12)" : "#fef3c7", color: "#92400e", borderColor: dm ? "rgba(245,158,11,0.25)" : "#fde68a" }}>
                            🔥 Nueva
                          </span>
                        )}
                        {tags.slice(0, 3).map(tag => (
                          <span key={tag} style={{ ...S.chip, ...(dm ? S.chipDm : {}) }}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Row 3: IA Insight */}
                      <MatchInsightSummary offer={offer} darkMode={dm} compact />


                      {/* Row 4: Actions */}
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 18, gap: 12 }}>
                        <button
                          style={{ ...S.starBtn, color: isFav ? "#f59e0b" : (dm ? "#475569" : "#d1d5db"), marginRight: "auto" }}
                          onClick={e => { e.stopPropagation(); toggleFavorite(offer); }}
                          title={isFav ? "Quitar de favoritas" : "Añadir a favoritas"}
                        >
                          {isFav ? "★" : "☆"}
                        </button>
                        <span style={{ fontSize: 11, color: dm ? "#475569" : "#9ca3af", fontFamily: typography.family }}>
                          {calculateDaysAgo(offer.fecha_publicacion)}
                        </span>
                        <button
                          className="btn-card-ghost"
                          style={{
                            background: "none", border: "none",
                            fontSize: 13, fontWeight: 600,
                            color: isCompared ? (dm ? "#5eead4" : TEAL) : (dm ? "#64748b" : "#6b7280"),
                            cursor: "pointer", fontFamily: typography.family,
                            padding: "6px 12px",
                          }}
                          onClick={e => { e.stopPropagation(); toggleCompareSelection(offer); }}
                        >
                          {isCompared ? "✓ En comparador" : "Comparar"}
                        </button>
                        <button
                          className="btn-card-ghost btn-card-ghost-danger"
                          style={{
                            background: "none", border: "none",
                            fontSize: 13, fontWeight: 500,
                            color: dm ? "#64748b" : "#6b7280",
                            cursor: "pointer", fontFamily: typography.family,
                            padding: "6px 12px",
                          }}
                          onClick={e => { e.stopPropagation(); handleDiscardOffer(offer); }}
                        >
                          Descartar
                        </button>
                        {(() => {
                          const aid = offer.adzuna_id || offer.id;
                          const isTracked = tracked.has(aid);
                          return (
                            <button
                              className="btn-card-ghost"
                              style={{
                                background: "none", border: "none",
                                fontSize: 13, fontWeight: 500,
                                color: isTracked ? (dm ? "#34d399" : "#059669") : (dm ? "#5eead4" : TEAL),
                                cursor: isTracked ? "default" : "pointer",
                                fontFamily: typography.family,
                                padding: "6px 12px",
                                opacity: isTracked ? 0.8 : 1,
                              }}
                              onClick={e => { e.stopPropagation(); handleTrackOffer(offer); }}
                            >
                              {isTracked ? "✓ Siguiendo" : "Seguir"}
                            </button>
                          );
                        })()}
                        <button
                          className="btn-card-detail"
                          onClick={e => { e.stopPropagation(); setSelectedOffer(offer); }}
                          style={S.btnDetail}
                        >
                          Ver detalle
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={S.emptyState}>
                  {filter === "favoritas" ? (
                    <>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
                      <p style={{ ...S.emptyTitle, color: dm ? "#f1f5f9" : "#374151" }}>Aún no has guardado ninguna oferta</p>
                      <p style={{ ...S.emptySub, color: dm ? "#64748b" : "#9ca3af" }}>Marca las ofertas que más te interesen con la estrella</p>
                    </>
                  ) : visible.length === 0 ? (
                    <>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>👀</div>
                      <p style={{ ...S.emptyTitle, color: dm ? "#f1f5f9" : "#374151" }}>Has descartado todas las ofertas</p>
                      <p style={{ ...S.emptySub, color: dm ? "#64748b" : "#9ca3af" }}>Haz una nueva búsqueda para ver más coincidencias</p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                      <p style={{ ...S.emptyTitle, color: dm ? "#f1f5f9" : "#374151" }}>No hay ofertas con estos filtros</p>
                      <p style={{ ...S.emptySub, color: dm ? "#64748b" : "#9ca3af" }}>Prueba a ajustar los filtros o el tipo de contrato</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Action buttons row ─────────────────────────────────── */}
            <div style={{ display: "flex", gap: 10, marginTop: 28, justifyContent: "flex-end" }}>
              <button className="btn-action-outline" onClick={handleShare} style={{ ...S.btnOutline, ...(dm ? { color: "#94a3b8", borderColor: "rgba(255,255,255,0.12)" } : {}) }}>
                Compartir
              </button>
              <button className="btn-action-primary" onClick={handleReset} style={S.btnPrimary}>
                + Nueva búsqueda
              </button>
            </div>
          </div>
        </div>

        {/* ── Skills Gap Section ───────────────────────────────────── */}
        {skillsGap?.recommended_skills?.length > 0 && (() => {
          const CAT = {
            tecnica:     { label: "Técnica",     bg: "#ede9fe", color: "#7c3aed", bgDm: "rgba(124,58,237,0.15)", colorDm: "#a78bfa" },
            idioma:      { label: "Idioma",      bg: "#dbeafe", color: "#1d4ed8", bgDm: "rgba(37,99,235,0.15)",  colorDm: "#93c5fd" },
            experiencia: { label: "Experiencia", bg: "#fef3c7", color: "#92400e", bgDm: "rgba(245,158,11,0.15)", colorDm: "#fbbf24" },
            modalidad:   { label: "Modalidad",   bg: "#dcfce7", color: "#15803d", bgDm: "rgba(16,185,129,0.15)", colorDm: "#6ee7b7" },
          };
          return (
            <div style={{
              marginTop: 36, borderRadius: 16, overflow: "hidden",
              backgroundColor: dm ? "#1e293b" : "#fff",
              border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e8ecf1"}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                padding: "24px 28px 20px",
                background: dm
                  ? "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(37,99,235,0.12) 100%)"
                  : "linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(37,99,235,0.06) 100%)",
                borderBottom: `1px solid ${dm ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>🎯</span>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", fontFamily: typography.family }}>
                    {skillsGap.title || "Tu plan de mejora"}
                  </h3>
                </div>
                {skillsGap.summary && (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: dm ? "#94a3b8" : "#64748b", maxWidth: 700, fontFamily: typography.family }}>
                    {skillsGap.summary}
                  </p>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, padding: "20px 24px 24px" }}>
                {skillsGap.recommended_skills.map((skill, idx) => {
                  const cat = CAT[skill.category] || CAT.tecnica;
                  return (
                    <div key={idx} className="job-card" style={{
                      padding: "16px 18px", borderRadius: 12,
                      backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
                      border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e2e8f0"}`,
                      cursor: "default",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: dm ? "#f1f5f9" : "#1e293b", flex: 1, fontFamily: typography.family }}>{skill.name}</span>
                        <span style={{
                          padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
                          backgroundColor: dm ? cat.bgDm : cat.bg, color: dm ? cat.colorDm : cat.color, whiteSpace: "nowrap",
                        }}>{cat.label}</span>
                      </div>
                      <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.55, color: dm ? "#94a3b8" : "#64748b", fontFamily: typography.family }}>{skill.reason}</p>
                      {skill.demand_count > 0 && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6,
                          backgroundColor: dm ? "rgba(0,117,138,0.12)" : "rgba(0,117,138,0.06)",
                          fontSize: 11, fontWeight: 600, color: dm ? "#5eead4" : TEAL,
                        }}>
                          Detectada en {skill.demand_count} oferta{skill.demand_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Compare Modal ────────────────────────────────────────── */}
        {showCompareModal && (
          <div style={S.modalOverlay} onClick={() => setShowCompareModal(false)}>
            <div
              style={{
                backgroundColor: dm ? "#111827" : "#fff",
                borderRadius: 22,
                width: "min(1240px, 96vw)",
                maxHeight: "92vh",
                overflow: "hidden",
                boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
                display: "flex",
                flexDirection: "column",
                fontFamily: typography.family,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                padding: "18px 22px",
                borderBottom: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: dm ? "#f8fafc" : "#111827", letterSpacing: "-0.02em" }}>
                    Comparador de ofertas
                  </h2>
                  <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: dm ? "#94a3b8" : "#64748b" }}>
                    Compara lado a lado salario, modalidad, afinidad y el bloque de “Cumples / Te falta” para decidir mejor.
                  </p>
                </div>
                <button style={S.modalCloseX} onClick={() => setShowCompareModal(false)}>✕</button>
              </div>

              <div style={{ padding: "20px 22px 24px", overflowY: "auto" }}>
                {compareOffers.length === 0 ? (
                  <div style={{
                    padding: "40px 20px",
                    borderRadius: 18,
                    textAlign: "center",
                    backgroundColor: dm ? "rgba(255,255,255,0.03)" : "#f8fafc",
                    border: `1px dashed ${dm ? "rgba(255,255,255,0.12)" : "#cbd5e1"}`,
                  }}>
                    <div style={{ fontSize: 42, marginBottom: 14 }}>🧭</div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: dm ? "#f8fafc" : "#111827" }}>
                      Selecciona ofertas para comparar
                    </h3>
                    <p style={{ margin: "8px auto 0", maxWidth: 520, fontSize: 14, color: dm ? "#94a3b8" : "#64748b", lineHeight: 1.7 }}>
                      Elige 2 o 3 ofertas desde el listado y vuelve aquí para ver rápidamente en cuál encajas más y qué te falta en cada una.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${compareOffers.length}, minmax(280px, 1fr))`,
                    gap: 18,
                    alignItems: "stretch",
                    gridAutoRows: "1fr",
                    minWidth: compareOffers.length >= 3 ? 960 : "auto",
                  }}>
                    {compareOffers.map(offer => {
                      const rs = RESULT_STYLES[normalizeResultValue(offer.resultado)] || RESULT_STYLES.NO_ENCAJA;
                      const compareStrengths = getCompareStrengths(offer);
                      const compareGaps = getCompareGaps(offer);
                      const compareCritical = getCriticalGaps(offer);
                      const isBest = bestCompareKey && bestCompareKey === getOfferCompareKey(offer);
                      return (
                        <div key={getOfferCompareKey(offer)} style={{
                          backgroundColor: dm ? "#1f2937" : "#fff",
                          borderRadius: 18,
                          border: `1px solid ${isBest ? rs.border : (dm ? "rgba(255,255,255,0.08)" : "#e5e7eb")}`,
                          boxShadow: isBest ? (dm ? `0 0 0 1px ${rs.border}40, 0 14px 34px rgba(0,0,0,0.22)` : `0 0 0 1px ${rs.border}22, 0 14px 34px rgba(15,23,42,0.08)`) : "0 6px 18px rgba(15,23,42,0.06)",
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                          height: "100%",
                        }}>
                          <div style={{
                            padding: "18px 18px 16px",
                            borderBottom: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#eef2f7"}`,
                            background: dm ? "linear-gradient(135deg, rgba(0,117,138,0.10), rgba(37,99,235,0.08))" : "linear-gradient(135deg, rgba(0,117,138,0.05), rgba(37,99,235,0.04))",
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                              <CompanyLogo name={offer.empresa} logoUrl={offer.company_logo_url} size={46} darkMode={dm} />
                              <button
                                onClick={() => toggleCompareSelection(offer)}
                                style={{ background: "none", border: "none", color: dm ? "#94a3b8" : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0 }}
                              >
                                Quitar
                              </button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                                  backgroundColor: dm ? `${rs.border}20` : rs.bg,
                                  color: rs.border, border: `1px solid ${rs.border}30`,
                                }}>
                                  {rs.label}
                                </span>
                                {isBest && (
                                  <span style={{
                                    padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                                    backgroundColor: dm ? "rgba(251,191,36,0.16)" : "#fef3c7",
                                    color: dm ? "#fbbf24" : "#b45309",
                                    border: `1px solid ${dm ? "rgba(251,191,36,0.25)" : "#fde68a"}`,
                                  }}>
                                    Mejor afinidad
                                  </span>
                                )}
                              </div>
                              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.3, color: dm ? "#f8fafc" : "#111827" }}>
                                {offer.titulo}
                              </h3>
                              <p style={{ margin: 0, fontSize: 14, color: dm ? "#5eead4" : TEAL, fontWeight: 600 }}>
                                {offer.empresa}
                              </p>
                            </div>
                          </div>

                          <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                              {[
                                { label: "Match", value: `${offer.match_score ?? offer.puntuacion ?? "?"}%` },
                                { label: "Modalidad", value: getWorkModeLabel(offer) },
                                { label: "Ubicación", value: offer.ubicacion || "No indicada" },
                                { label: "Seniority", value: getSeniorityLabel(offer) },
                                { label: "Contrato", value: detectContract(offer) === "temporal" ? "Temporal / Prácticas" : detectContract(offer) === "freelance" ? "Freelance" : "Jornada completa" },
                                { label: "Salario", value: offer.salario && offer.salario !== "Salario no especificado" ? offer.salario : "No indicado" },
                              ].map(item => (
                                <div key={`${offer.id}-${item.label}`} style={{
                                  padding: "10px 12px",
                                  borderRadius: 12,
                                  backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
                                  border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                                }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: dm ? "#94a3b8" : "#6b7280", marginBottom: 5 }}>
                                    {item.label}
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: dm ? "#f8fafc" : "#111827", lineHeight: 1.4 }}>
                                    {item.value}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div style={{
                              padding: "14px 16px",
                              borderRadius: 14,
                              backgroundColor: dm ? "rgba(0,117,138,0.10)" : "rgba(0,117,138,0.04)",
                              border: `1px solid ${dm ? "rgba(0,117,138,0.18)" : "rgba(0,117,138,0.10)"}`,
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: dm ? "#5eead4" : TEAL, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                                Resumen
                              </div>
                              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: dm ? "#cbd5e1" : "#475569" }}>
                                {getDecisionReason(offer) || "No hay explicación adicional para esta oferta."}
                              </p>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: dm ? "#34d399" : "#15803d", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                                Cumples
                              </div>
                              {compareStrengths.length > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {compareStrengths.map(item => (
                                    <span key={`${offer.id}-ok-${item}`} style={{
                                      padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                                      backgroundColor: dm ? "rgba(16,185,129,0.12)" : "#dcfce7",
                                      color: dm ? "#34d399" : "#15803d",
                                      border: `1px solid ${dm ? "rgba(16,185,129,0.22)" : "#bbf7d0"}`,
                                    }}>
                                      ✓ {item}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ margin: 0, fontSize: 12, color: dm ? "#64748b" : "#94a3af", lineHeight: 1.6 }}>
                                  No hay señales suficientes para destacar requisitos cumplidos.
                                </p>
                              )}
                            </div>

                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: dm ? "#f87171" : "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                  Te falta
                                </div>
                                {compareCritical.length > 0 && (
                                  <span style={{ fontSize: 10, fontWeight: 800, color: dm ? "#fbbf24" : "#b45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Carencia importante
                                  </span>
                                )}
                              </div>
                              {compareGaps.length > 0 || compareCritical.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {compareCritical.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {compareCritical.map(item => (
                                        <span key={`${offer.id}-critical-${item}`} style={{
                                          padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                                          backgroundColor: dm ? "rgba(239,68,68,0.14)" : "#fee2e2",
                                          color: dm ? "#f87171" : "#dc2626",
                                          border: `1px solid ${dm ? "rgba(239,68,68,0.24)" : "#fecaca"}`,
                                        }}>
                                          ✕ {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {compareGaps.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {compareGaps.filter(item => !compareCritical.includes(item)).map(item => (
                                        <span key={`${offer.id}-gap-${item}`} style={{
                                          padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                                          backgroundColor: dm ? "rgba(245,158,11,0.12)" : "#fef3c7",
                                          color: dm ? "#fbbf24" : "#b45309",
                                          border: `1px solid ${dm ? "rgba(245,158,11,0.22)" : "#fde68a"}`,
                                        }}>
                                          △ {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p style={{ margin: 0, fontSize: 12, color: dm ? "#64748b" : "#94a3af", lineHeight: 1.6 }}>
                                  No se detectan carencias relevantes con la información disponible.
                                </p>
                              )}
                            </div>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: "auto", paddingTop: 4 }}>
                              <button
                                onClick={() => {
                                  setShowCompareModal(false);
                                  setSelectedOffer(offer);
                                }}
                                style={{ ...S.btnDetail, flex: 1, minWidth: 140 }}
                              >
                                Ver detalle completo
                              </button>
                              {offer.redirect_url && (
                                <a
                                  href={offer.redirect_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    ...S.btnOutline,
                                    flex: 1,
                                    minWidth: 140,
                                    textDecoration: "none",
                                    textAlign: "center",
                                  }}
                                >
                                  Abrir oferta
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Offer Detail Modal ───────────────────────────────────── */}
        {selectedOffer && (() => {
          const rs = RESULT_STYLES[normalizeResultValue(selectedOffer.resultado)] || RESULT_STYLES.NO_ENCAJA;
          const isFavModal = selectedOffer.adzuna_id && favorites.has(selectedOffer.adzuna_id);
          const aidModal = selectedOffer.adzuna_id || selectedOffer.id;
          const isTrackedModal = tracked.has(aidModal);
          const contractType = detectContract(selectedOffer);
          return (
            <div style={S.modalOverlay} onClick={() => setSelectedOffer(null)}>
              <div style={{
                backgroundColor: dm ? "#1e293b" : "#fff",
                borderRadius: 20,
                maxWidth: 1100, width: "100%",
                maxHeight: "92vh",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
                fontFamily: typography.family,
              }} onClick={e => e.stopPropagation()}>

                {/* ── Top bar ─────────────────────────────────────── */}
                <div style={{
                  padding: "13px 24px", flexShrink: 0,
                  borderBottom: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e5e7eb"}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  backgroundColor: dm ? "#1e293b" : "#fff",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      backgroundColor: dm ? `${rs.border}18` : rs.bg,
                      color: rs.border,
                      border: `1px solid ${rs.border}30`,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: rs.border, display: "inline-block" }} />
                      {rs.label}{selectedOffer.puntuacion != null ? ` · ${selectedOffer.puntuacion}%` : ""}
                    </span>
                    <span style={{ fontSize: 12, color: dm ? "#475569" : "#9ca3af" }}>
                      {calculateDaysAgo(selectedOffer.fecha_publicacion)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      style={{ ...S.starBtn, fontSize: 20, color: isFavModal ? "#f59e0b" : (dm ? "#475569" : "#d1d5db") }}
                      onClick={() => toggleFavorite(selectedOffer)}
                      title={isFavModal ? "Quitar de favoritas" : "Guardar en favoritas"}
                    >
                      {isFavModal ? "★" : "☆"}
                    </button>
                    <button style={S.modalCloseX} onClick={() => setSelectedOffer(null)}>✕</button>
                  </div>
                </div>

                {/* ── Body: two columns ────────────────────────────── */}
                <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

                  {/* LEFT: description */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", minWidth: 0 }}>

                    {/* Job header card */}
                    <div style={{
                      backgroundColor: dm ? "rgba(255,255,255,0.03)" : "#fff",
                      border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                      borderRadius: 16, padding: "24px 28px", marginBottom: 28,
                      boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                          <h1 style={{
                            margin: "0 0 12px", fontSize: 28, fontWeight: 800,
                            color: dm ? "#f1f5f9" : "#111827",
                            letterSpacing: "-0.025em", lineHeight: 1.15,
                          }}>
                            {selectedOffer.titulo}
                          </h1>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14, color: dm ? "#94a3b8" : "#64748b", fontWeight: 500 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 13 }}>🏢</span> {selectedOffer.empresa}
                            </span>
                            {selectedOffer.ubicacion && (
                              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ fontSize: 13 }}>📍</span> {selectedOffer.ubicacion}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <CompanyLogo name={selectedOffer.empresa} logoUrl={selectedOffer.company_logo_url} size={56} darkMode={dm} />
                        </div>
                      </div>

                      {/* Tag pills */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span style={{
                          padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: "0.04em",
                          backgroundColor: dm ? `${rs.border}15` : rs.bg, color: rs.border,
                          border: `1px solid ${rs.border}25`,
                        }}>{rs.label}</span>
                        <span style={{
                          padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                          backgroundColor: dm ? "rgba(99,102,241,0.12)" : "#eef2ff", color: dm ? "#a5b4fc" : "#4f46e5",
                          border: `1px solid ${dm ? "rgba(99,102,241,0.25)" : "#c7d2fe"}`,
                        }}>
                          {contractType === "temporal" ? "Temporal / Prácticas" : contractType === "freelance" ? "Freelance" : "Jornada completa"}
                        </span>
                        {selectedOffer.salario && selectedOffer.salario !== "Salario no especificado" && (
                          <span style={{
                            padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                            backgroundColor: dm ? "rgba(16,185,129,0.12)" : "#f0fdf4", color: dm ? "#34d399" : "#15803d",
                            border: `1px solid ${dm ? "rgba(16,185,129,0.25)" : "#bbf7d0"}`,
                          }}>
                            💰 {selectedOffer.salario}
                          </span>
                        )}
                      </div>

                      <OfferTrustSignals
                        offer={selectedOffer}
                        darkMode={dm}
                        showDetail
                        style={{ marginTop: 14 }}
                      />

                      {(selectedOffer.offer_requirements?.critical?.length > 0 ||
                        selectedOffer.offer_requirements?.required_skill_years?.length > 0 ||
                        selectedOffer.offer_requirements?.hard_constraints?.length > 0) && (
                        <div style={{
                          marginTop: 16,
                          padding: "16px 18px",
                          borderRadius: 14,
                          backgroundColor: dm ? "rgba(255,255,255,0.03)" : "#f8fafc",
                          border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e2e8f0"}`,
                          display: "grid",
                          gap: 12,
                        }}>
                          <div>
                            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 800, color: dm ? "#e2e8f0" : "#111827", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Requisitos detectados en la descripción
                            </p>
                            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: dm ? "#94a3b8" : "#64748b" }}>
                              El motor ha leído la oferta para separar señales obligatorias, experiencia por tecnología y condiciones duras.
                            </p>
                          </div>
                          {selectedOffer.offer_requirements?.critical?.length > 0 && (
                            <div>
                              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#b45309" }}>Críticos</p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {selectedOffer.offer_requirements.critical.map((item) => (
                                  <span key={item} style={{
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    backgroundColor: dm ? "rgba(245,158,11,0.12)" : "#fffbeb",
                                    color: dm ? "#fbbf24" : "#b45309",
                                    border: `1px solid ${dm ? "rgba(245,158,11,0.2)" : "#fde68a"}`,
                                  }}>
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedOffer.offer_requirements?.required_skill_years?.length > 0 && (
                            <div>
                              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#2563eb" }}>Experiencia por tecnología</p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {selectedOffer.offer_requirements.required_skill_years.map((item, index) => (
                                  <span key={`${item.skill}-${index}`} style={{
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    backgroundColor: dm ? "rgba(37,99,235,0.12)" : "#eff6ff",
                                    color: dm ? "#93c5fd" : "#1d4ed8",
                                    border: `1px solid ${dm ? "rgba(37,99,235,0.2)" : "#bfdbfe"}`,
                                  }}>
                                    {item.skill}: {item.years}+ años
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedOffer.offer_requirements?.hard_constraints?.length > 0 && (
                            <div>
                              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#dc2626" }}>Condiciones a revisar</p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {selectedOffer.offer_requirements.hard_constraints.map((item) => (
                                  <div key={item} style={{ fontSize: 12, color: dm ? "#fca5a5" : "#b91c1c", lineHeight: 1.6 }}>
                                    • {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedOffer.company_review_sources?.length > 0 && (
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          marginTop: 10,
                          padding: "16px 18px",
                          borderRadius: 14,
                          backgroundColor: dm ? "rgba(255,255,255,0.03)" : "#f8fafc",
                          border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e2e8f0"}`,
                        }}>
                          <div>
                            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: dm ? "#e2e8f0" : "#111827", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Opiniones externas
                            </p>
                            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: dm ? "#94a3b8" : "#64748b" }}>
                              Consulta valoraciones y reseñas externas sobre esta empresa. Las opiniones no se muestran embebidas aún.
                            </p>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                            {selectedOffer.company_review_sources.map((source) => (
                              <a
                                key={source.key}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "10px 14px",
                                  borderRadius: 999,
                                  textDecoration: "none",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: dm ? "#f8fafc" : "#0f172a",
                                  backgroundColor: dm ? "rgba(0,122,138,0.16)" : "#ecfeff",
                                  border: `1px solid ${dm ? "rgba(0,122,138,0.32)" : "#a5f3fc"}`,
                                  fontFamily: typography.family,
                                }}
                              >
                                {source.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", letterSpacing: "-0.01em" }}>
                        Descripción del puesto
                      </h2>
                      <p style={{
                        fontSize: 14, lineHeight: 1.85, margin: 0,
                        color: dm ? "#94a3b8" : "#4b5563",
                        whiteSpace: "pre-wrap", wordWrap: "break-word",
                      }}>
                        {selectedOffer.descripcion}
                      </p>
                    </div>
                  </div>

                  {/* RIGHT SIDEBAR: AI insights */}
                  <div style={{
                    width: 300, flexShrink: 0,
                    borderLeft: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e5e7eb"}`,
                    overflowY: "auto", padding: "24px 18px",
                    display: "flex", flexDirection: "column", gap: 14,
                    backgroundColor: dm ? "rgba(0,0,0,0.12)" : "#f8fafc",
                  }}>

                    {/* Match card */}
                    {selectedOffer.puntuacion != null && (
                      <div style={{
                        backgroundColor: dm ? "#1e293b" : "#fff",
                        borderRadius: 14, padding: "20px",
                        border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e5e7eb"}`,
                        borderLeft: `4px solid ${rs.border}`,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: rs.border, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Análisis IA
                          </span>
                          <span style={{ fontSize: 16 }}>✦</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                          <span style={{ fontSize: 52, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", letterSpacing: "-0.03em", lineHeight: 1 }}>
                            {selectedOffer.puntuacion}%
                          </span>
                          <span style={{ fontSize: 15, color: dm ? "#64748b" : "#6b7280", fontWeight: 500 }}>Match</span>
                        </div>
                        <div style={{
                          height: 8, borderRadius: 999, overflow: "hidden",
                          backgroundColor: dm ? "#334155" : "#f1f5f9", marginBottom: 14,
                        }}>
                          <div style={{
                            height: "100%", borderRadius: 999,
                            width: `${selectedOffer.puntuacion}%`,
                            backgroundColor: rs.border,
                            transition: "width 1s ease",
                          }} />
                        </div>
                        {getDecisionReason(selectedOffer) && (
                          <p style={{ margin: 0, fontSize: 13, color: dm ? "#94a3b8" : "#4b5563", lineHeight: 1.65 }}>
                            {getDecisionReason(selectedOffer)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Match insights card */}
                    <MatchInsightSummary offer={selectedOffer} darkMode={dm} />


                    {/* Cover letter card */}
                    {showCoverLetter && (
                      <div style={{
                        backgroundColor: dm ? "#1e293b" : "#fff",
                        borderRadius: 14, padding: "18px 20px",
                        border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e5e7eb"}`,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                            backgroundColor: dm ? "rgba(124,58,237,0.15)" : "#ede9fe",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 15,
                          }}>✉️</div>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827" }}>Carta de presentación</h3>
                        </div>
                        {coverLetterLoading ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={S.spinner} />
                            <span style={{ fontSize: 13, color: dm ? "#94a3b8" : "#6b7280" }}>Generando...</span>
                          </div>
                        ) : coverLetterError ? (
                          <div style={{ padding: "8px 10px", borderRadius: 8, fontSize: 12, backgroundColor: dm ? "rgba(239,68,68,0.08)" : "#fee2e2", color: dm ? "#f87171" : "#991b1b", border: `1px solid ${dm ? "rgba(239,68,68,0.2)" : "#fecaca"}` }}>{coverLetterError}</div>
                        ) : coverLetter ? (
                          <>
                            <textarea
                              style={{
                                width: "100%", minHeight: 200, padding: 12, fontSize: 13,
                                fontFamily: "Georgia, 'Times New Roman', serif",
                                lineHeight: 1.7, color: dm ? "#f1f5f9" : "#111827",
                                border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#d1d5db"}`,
                                borderRadius: 8, resize: "vertical", boxSizing: "border-box", outline: "none",
                                backgroundColor: dm ? "#0f172a" : "#fff",
                              }}
                              value={coverLetter}
                              onChange={e => setCoverLetter(e.target.value)}
                            />
                            <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                              <button style={{ ...S.btnOutline, fontSize: 12, padding: "6px 12px" }} onClick={() => { navigator.clipboard.writeText(coverLetter); addToast?.("Carta copiada", "success"); }}>
                                Copiar
                              </button>
                              <button style={{ ...S.btnPrimary, fontSize: 12, padding: "6px 12px" }} onClick={handleGenerateCoverLetter}>Regenerar</button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Bottom action bar ────────────────────────────── */}
                <div style={{
                  padding: "13px 24px", flexShrink: 0,
                  borderTop: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
                  backgroundColor: dm ? "#1e293b" : "#fff",
                  boxShadow: "0 -4px 20px rgba(0,0,0,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: 10,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320 }}>
                      {selectedOffer.titulo}
                    </div>
                    <div style={{ fontSize: 12, color: dm ? "#475569" : "#9ca3af", marginTop: 1 }}>
                      {selectedOffer.empresa}{selectedOffer.ubicacion ? ` · ${selectedOffer.ubicacion}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn-modal-outline"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        backgroundColor: dm ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                        color: isFavModal ? "#f59e0b" : (dm ? "#94a3b8" : "#374151"),
                        border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                        cursor: "pointer", fontFamily: typography.family,
                      }}
                      onClick={() => toggleFavorite(selectedOffer)}
                    >
                      {isFavModal ? "★ Guardado" : "☆ Guardar"}
                    </button>
                    <button
                      className="btn-modal-outline"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        backgroundColor: dm ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                        color: isTrackedModal ? (dm ? "#34d399" : "#059669") : (dm ? "#94a3b8" : "#374151"),
                        border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                        cursor: "pointer", fontFamily: typography.family,
                      }}
                      onClick={() => handleTrackOffer(selectedOffer)}
                    >
                      {isTrackedModal ? "✓ Siguiendo" : "Seguir oferta"}
                    </button>
                    <button
                      className="btn-modal-outline"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        backgroundColor: compareSelection.includes(getOfferCompareKey(selectedOffer)) ? (dm ? "rgba(15,118,110,0.18)" : "rgba(0,117,138,0.08)") : (dm ? "rgba(255,255,255,0.06)" : "#f1f5f9"),
                        color: compareSelection.includes(getOfferCompareKey(selectedOffer)) ? (dm ? "#5eead4" : TEAL) : (dm ? "#94a3b8" : "#374151"),
                        border: `1px solid ${compareSelection.includes(getOfferCompareKey(selectedOffer)) ? (dm ? "rgba(94,234,212,0.22)" : "rgba(0,117,138,0.12)") : (dm ? "rgba(255,255,255,0.1)" : "#e2e8f0")}`,
                        cursor: "pointer", fontFamily: typography.family,
                      }}
                      onClick={() => toggleCompareSelection(selectedOffer)}
                    >
                      {compareSelection.includes(getOfferCompareKey(selectedOffer)) ? "✓ En comparador" : "Comparar"}
                    </button>
                    <button
                      className="btn-modal-cover"
                      style={{
                        padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                        color: "#fff", border: "none", cursor: "pointer", fontFamily: typography.family,
                        boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
                      }}
                      onClick={handleGenerateCoverLetter}
                    >
                      ✉ Generar carta
                    </button>
                    {selectedOffer.redirect_url && (
                      <a
                        className="btn-modal-adzuna"
                        href={selectedOffer.redirect_url}
                        target="_blank" rel="noopener noreferrer"
                        style={{
                          padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                          backgroundColor: TEAL, color: "#fff",
                          textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                          boxShadow: "0 2px 8px rgba(0,117,138,0.3)",
                        }}
                      >
                        Ver en Adzuna →
                      </a>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // NO PROFILE STATE
  // ══════════════════════════════════════════════════════════════════════════════
  if (!hasProfile(profile)) {
    const dm = darkMode;
    return (
      <div className="profile-pre-page" style={{ ...S.prePage, ...(dm ? S.dmPage : {}) }}>
        <div style={{ ...S.preCard, ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)" } : {}), textAlign: "center", padding: "clamp(24px, 6vw, 48px) clamp(16px, 5vw, 32px)" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>👤</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", margin: "0 0 12px", fontFamily: typography.family }}>Completa tu perfil primero</h2>
          <p style={{ color: dm ? "#94a3b8" : "#6b7280", marginBottom: 28, lineHeight: 1.6, fontSize: 15, fontFamily: typography.family }}>
            Para analizar ofertas necesitamos conocer tu stack tecnológico y experiencia.
          </p>
          <button style={S.btnPrimary} onClick={() => { window.location.hash = "user-profile"; }}>
            Completar mi perfil →
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PRE-ANALYSIS VIEW
  // ══════════════════════════════════════════════════════════════════════════════
  const dm = darkMode;
  const englishEntryReady = profile.idiomas?.find(i => i.idioma.toLowerCase().includes("ingl"));
  const stackPreview =
    profile.stack?.slice(0, 5).join(", ") +
    (profile.stack?.length > 5 ? ` +${profile.stack.length - 5} más` : "");

  const chartData = profile.stack
    ?.filter(t => MARKET_DATA[t] != null)
    .sort((a, b) => (MARKET_DATA[b] || 0) - (MARKET_DATA[a] || 0))
    .slice(0, 6) || [];
  const maxVal = chartData.length ? Math.max(...chartData.map(t => MARKET_DATA[t] || 0)) : 1;
  const totalEstimated = chartData.reduce((s, t) => s + (MARKET_DATA[t] || 0), 0);

  return (
    <div className="profile-pre-page" style={{ ...S.prePage, ...(dm ? S.dmPage : {}) }}>
      <div style={{ ...S.preCard, ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)" } : {}), padding: "clamp(20px, 4vw, 32px)" }}>
        <h2 style={{ margin: "0 0 24px", fontSize: 26, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", letterSpacing: "-0.02em", fontFamily: typography.family }}>
          Buscar ofertas
        </h2>

        {error && <div style={{ ...S.errorBox, ...(dm ? { backgroundColor: "rgba(239,68,68,0.08)", color: "#f87171", borderColor: "rgba(239,68,68,0.2)" } : {}) }}>{error}</div>}
        {aiQuota && <QuotaCard quota={aiQuota} darkMode={dm} />}

        {/* Profile summary */}
        <div style={{
          backgroundColor: dm ? "rgba(0,117,138,0.1)" : "rgba(0,117,138,0.04)",
          border: `1px solid ${dm ? "rgba(0,117,138,0.2)" : "rgba(0,117,138,0.15)"}`,
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: TEAL, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px", fontFamily: typography.family }}>
            Analizando ofertas para:
          </p>
          <p style={{ margin: 0, fontSize: 14, color: dm ? "#f1f5f9" : "#111827", lineHeight: 1.6, fontFamily: typography.family }}>
            {[
              hasExperienceValue(profile.anos_experiencia) ? `${profile.anos_experiencia} año${String(profile.anos_experiencia) !== "1" ? "s" : ""} de experiencia` : null,
              profile.stack?.length > 0 ? `Stack: ${stackPreview}` : null,
              englishEntryReady ? `Inglés: ${englishEntryReady.nivel}` : null,
              `📍 ${profile.ubicaciones?.length > 0 ? profile.ubicaciones.join(", ") : "Toda España"}`,
              `💼 ${profile.modalidad?.length > 0 ? profile.modalidad.join(", ") : "Cualquier modalidad"}`,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>

        {/* Market chart */}
        {chartData.length > 0 && (
          <div style={{
            backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#f8faff",
            border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e0e7ff"}`,
            borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: typography.family }}>
              📈 Tu stack en el mercado español
            </p>
            <p style={{ fontSize: 11, color: dm ? "#64748b" : "#6b7280", margin: "0 0 14px" }}>
              Estimación de ofertas activas en España
            </p>
            {chartData.map(tech => (
              <div key={tech} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: dm ? "#cbd5e1" : "#374151" }}>{tech}</span>
                  <span style={{ fontSize: 11, color: dm ? "#64748b" : "#9ca3af" }}>{MARKET_DATA[tech]}+ ofertas</span>
                </div>
                <div style={{ height: 6, backgroundColor: dm ? "#334155" : "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(MARKET_DATA[tech] / maxVal) * 100}%`, background: `linear-gradient(90deg, ${TEAL}, #2563eb)`, borderRadius: 3, transition: "width 1s ease" }} />
                </div>
              </div>
            ))}
            {totalEstimated > 0 && (
              <p style={{ fontSize: 12, color: TEAL, fontWeight: 700, margin: "14px 0 0", textAlign: "center", padding: 8, backgroundColor: "rgba(0,117,138,0.06)", borderRadius: 8 }}>
                💼 Con tu perfil hay ~{totalEstimated.toLocaleString()}+ ofertas activas
              </p>
            )}
          </div>
        )}

        {/* Search history */}
        {searchHistory.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: dm ? "#64748b" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px", fontFamily: typography.family }}>
              Últimas búsquedas
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {searchHistory.slice(0, 3).map(item => (
                <div key={item.id} style={{
                  flex: "1 1 220px", padding: 14,
                  backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#fff",
                  borderRadius: 12, border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e8ecf1"}`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 4,
                }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: dm ? "#f1f5f9" : "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: typography.family }}>
                    {item.stack.slice(0, 3).join(", ")}{item.stack.length > 3 ? "…" : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: dm ? "#94a3b8" : "#6b7280", fontFamily: typography.family }}>
                    {hasExperienceValue(item.anos_experiencia) ? `${item.anos_experiencia} años exp.` : "Experiencia no indicada"}
                  </p>
                  {(item.ubicaciones?.length > 0 || item.modalidad?.length > 0) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      {(item.ubicaciones || []).slice(0, 2).map((ubicacion) => (
                        <span key={ubicacion} style={{
                          padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                          backgroundColor: dm ? "rgba(94,234,212,0.08)" : "#ecfeff",
                          color: dm ? "#5eead4" : TEAL,
                          border: `1px solid ${dm ? "rgba(94,234,212,0.18)" : "#bae6fd"}`,
                          fontFamily: typography.family,
                        }}>
                          📍 {ubicacion}
                        </span>
                      ))}
                      {(item.modalidad || []).slice(0, 1).map((modo) => (
                        <span key={modo} style={{
                          padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                          backgroundColor: dm ? "rgba(255,255,255,0.06)" : "#f8fafc",
                          color: dm ? "#cbd5e1" : "#475569",
                          border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
                          fontFamily: typography.family,
                        }}>
                          {modo}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: "#16a34a" }}>✓ {item.num_aplica}</span>
                    <span style={{ color: "#64748b" }}>△ {item.num_quiza}</span>
                    <span style={{ color: "#dc2626" }}>✗ {item.num_no_encaja}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: dm ? "#64748b" : "#94a3af", fontFamily: typography.family }}>
                    {item.num_total || (item.num_aplica + item.num_quiza + item.num_no_encaja)} resultados en la última ejecución
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{formatSearchDate(item.created_at)}</p>
                  <button
                    onClick={() => handleRepeat(item)}
                    disabled={loading}
                    style={{
                      marginTop: 6, padding: "7px 12px", fontSize: 11, fontWeight: 700, color: "#fff",
                      backgroundColor: rerunningHistoryId === item.id ? "#0f766e" : TEAL,
                      border: "none", borderRadius: 20, cursor: loading ? "not-allowed" : "pointer",
                      fontFamily: typography.family, alignSelf: "flex-start",
                      opacity: loading ? 0.8 : 1,
                      boxShadow: rerunningHistoryId === item.id ? "0 4px 12px rgba(15,118,110,0.22)" : "0 4px 12px rgba(0,117,138,0.18)",
                    }}
                  >
                    {rerunningHistoryId === item.id ? "Reanalizando..." : "Volver a analizar →"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primary CTA */}
        <button
          ref={analyzeBtnRef}
          className="analyze-ripple-btn"
          style={{ ...S.btnAnalyze, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          disabled={loading}
          onClick={(e) => {
            if (loading) return;
            const btn = analyzeBtnRef.current;
            if (btn) {
              btn.classList.remove("rippling");
              void btn.offsetWidth;
              btn.classList.add("rippling");
              setTimeout(() => btn.classList.remove("rippling"), 600);
            }
            handleAnalyze(e);
          }}
        >
          {loading ? "🤖 La IA está trabajando..." : "Analizar ofertas"}
        </button>

        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button style={{ background: "none", border: "none", color: dm ? "#64748b" : "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: typography.family, textDecoration: "underline", padding: 0 }}
            onClick={() => { window.location.hash = "user-profile"; }}>
            Modificar perfil →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════════

const S = {
  dmPage: { background: "#0f172a" },

  centeredContainer: {
    minHeight: "60vh",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    fontFamily: typography.family,
  },
  spinner: {
    width: 36, height: 36,
    border: `3px solid #e5e7eb`,
    borderTop: `3px solid ${TEAL}`,
    borderRadius: "50%",
    animation: "spin 0.75s linear infinite",
  },

  // ── Results page ───────────────────────────────────────────────────────────
  resultsPage: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "28px 24px",
    fontFamily: typography.family,
    minHeight: "100vh",
    background: "#f8f9fc",
  },

  // ── Pre-analysis page ──────────────────────────────────────────────────────
  prePage: {
    minHeight: "100vh",
    background: "#f8f9fc",
    paddingTop: 40,
    paddingBottom: 40,
  },
  preCard: {
    maxWidth: 700,
    margin: "0 auto",
    padding: 32,
    backgroundColor: "#fff",
    borderRadius: 16,
    border: "1px solid #e8ecf1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    fontFamily: typography.family,
  },

  // ── Metrics ────────────────────────────────────────────────────────────────
  metricsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 14,
    marginBottom: 24,
  },
  metricCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 18px",
    borderRadius: 12,
    border: "1px solid #e8ecf1",
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },

  // ── Two column ────────────────────────────────────────────────────────────
  twoCol: {
    display: "flex",
    gap: 24,
    alignItems: "flex-start",
  },

  // ── Filter panel ──────────────────────────────────────────────────────────
  filterPanel: {
    width: 260,
    flexShrink: 0,
    position: "sticky",
    top: 80,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: "20px 20px 24px",
    border: "1px solid #e8ecf1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  filterGroup: {
    marginBottom: 18,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: typography.family,
    marginBottom: 6,
    display: "block",
  },
  filterInput: {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    fontFamily: typography.family,
    color: "#374151",
    outline: "none",
    boxSizing: "border-box",
    transition: `border-color ${transition.fast}`,
  },
  filterInputDm: {
    backgroundColor: "#0f172a",
    borderColor: "rgba(255,255,255,0.1)",
    color: "#e2e8f0",
  },

  // ── Offer card ────────────────────────────────────────────────────────────
  offerCard: {
    padding: "24px 28px",
    borderRadius: 16,
    backgroundColor: "#fff",
    border: "1px solid #e8ecf1",
    borderLeft: "4px solid",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    cursor: "pointer",
  },

  // ── Chip ──────────────────────────────────────────────────────────────────
  chip: {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "4px 12px", borderRadius: 20,
    fontSize: 12, fontWeight: 500,
    backgroundColor: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    fontFamily: typography.family,
  },
  chipDm: {
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#94a3b8",
    borderColor: "rgba(255,255,255,0.1)",
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  btnPrimary: {
    padding: "9px 20px",
    fontSize: 14, fontWeight: 600,
    color: "#fff",
    background: TEAL,
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: typography.family,
    boxShadow: "0 2px 6px rgba(0,117,138,0.2)",
    whiteSpace: "nowrap",
    transition: "transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease",
  },
  btnOutline: {
    padding: "9px 20px",
    fontSize: 14, fontWeight: 600,
    color: "#374151",
    backgroundColor: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: typography.family,
    whiteSpace: "nowrap",
  },
  btnDetail: {
    padding: "8px 20px",
    fontSize: 13, fontWeight: 600,
    color: "#fff",
    backgroundColor: TEAL,
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: typography.family,
    boxShadow: "0 2px 6px rgba(0,117,138,0.2)",
    transition: "transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease",
  },
  btnAnalyze: {
    width: "100%",
    padding: "14px 20px",
    fontSize: 18, fontWeight: 800,
    color: "#fff",
    background: TEAL,
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: typography.family,
    letterSpacing: "-0.02em",
    boxShadow: "0 4px 16px rgba(0,117,138,0.3)",
    position: "relative",
    overflow: "hidden",
  },
  starBtn: {
    background: "none", border: "none",
    fontSize: 20, cursor: "pointer",
    padding: 4, lineHeight: 1,
    transition: "color 0.2s ease",
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    textAlign: "center",
    padding: "48px 20px",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  emptyTitle: {
    margin: 0, fontSize: 16, fontWeight: 600,
    fontFamily: typography.family,
  },
  emptySub: {
    margin: "6px 0 0", fontSize: 13,
    fontFamily: typography.family,
  },

  // ── Error ─────────────────────────────────────────────────────────────────
  errorBox: {
    padding: "10px 14px",
    backgroundColor: "#fee2e2", color: "#991b1b",
    borderRadius: 8, fontSize: 13, marginBottom: 16,
    border: "1px solid #fecaca",
    fontFamily: typography.family,
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(15,23,42,0.62)",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    maxWidth: 640, width: "100%",
    maxHeight: "90vh", overflow: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
  },
  modalCloseX: {
    width: 36, height: 36,
    border: "none", backgroundColor: "#f1f5f9",
    borderRadius: "50%", fontSize: 18,
    cursor: "pointer", color: "#6b7280",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: typography.family, flexShrink: 0,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════════
// CSS ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════════════

if (typeof document !== "undefined" && !document.getElementById("profile-animations")) {
  const style = document.createElement("style");
  style.id = "profile-animations";
  style.innerHTML = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes skeletonPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.5; }
    }
    @keyframes floatBounce {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-10px); }
    }
    @keyframes rippleEffect {
      0%   { transform: scale(0); opacity: 0.5; }
      100% { transform: scale(3); opacity: 0; }
    }
    @keyframes countPop {
      0%   { opacity: 0; transform: scale(0.4); }
      70%  { transform: scale(1.1); }
      100% { opacity: 1; transform: scale(1); }
    }
    .job-card {
      transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1);
    }
    .job-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.07) !important;
    }
    /* ── Card action ghost buttons (Comparar, Descartar, Seguir) ─── */
    .btn-card-ghost {
      transition: background 0.14s ease, color 0.14s ease, transform 0.14s ease;
      border-radius: 8px;
    }
    .btn-card-ghost:hover {
      background: rgba(0,117,138,0.07) !important;
      color: #00758A !important;
      transform: translateY(-1px);
    }
    .btn-card-ghost-danger:hover {
      background: rgba(239,68,68,0.07) !important;
      color: #ef4444 !important;
    }
    /* ── Card primary button (Ver detalle) ───────────────────────── */
    .btn-card-detail {
      transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
    }
    .btn-card-detail:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 16px rgba(0,117,138,0.38) !important;
      filter: brightness(1.06);
    }
    /* ── Modal outline buttons (Guardar, Seguir oferta, Comparar) ── */
    .btn-modal-outline {
      transition: background 0.14s ease, border-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease;
    }
    .btn-modal-outline:hover {
      background: rgba(0,117,138,0.06) !important;
      border-color: rgba(0,117,138,0.3) !important;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.07) !important;
    }
    /* ── Modal cover-letter gradient button ─────────────────────── */
    .btn-modal-cover {
      transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
    }
    .btn-modal-cover:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 18px rgba(124,58,237,0.42) !important;
      filter: brightness(1.08);
    }
    /* ── Modal Adzuna link ───────────────────────────────────────── */
    .btn-modal-adzuna {
      transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
    }
    .btn-modal-adzuna:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 18px rgba(0,117,138,0.4) !important;
      filter: brightness(1.06);
    }
    .analyze-ripple-btn::after {
      content: '';
      position: absolute;
      width: 80px; height: 80px;
      top: 50%; left: 50%;
      margin: -40px 0 0 -40px;
      background: rgba(255,255,255,0.35);
      border-radius: 50%;
      transform: scale(0);
      pointer-events: none;
    }
    .analyze-ripple-btn.rippling::after {
      animation: rippleEffect 0.6s linear;
    }
    .analyze-ripple-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,117,138,0.35) !important;
    }
    .btn-action-primary { transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease; }
    .btn-action-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,117,138,0.38) !important; filter: brightness(1.08); }
    .btn-action-outline { transition: background 0.14s ease, border-color 0.14s ease, transform 0.14s ease; }
    .btn-action-outline:hover { background: rgba(0,117,138,0.05) !important; border-color: rgba(0,117,138,0.28) !important; transform: translateY(-1px); }
    .summary-number-anim {
      animation: countPop 0.5s ease-out both;
    }
    /* ── Responsive metrics ──────────────────────────────────── */
    @media (max-width: 900px) {
      .metrics-row-responsive {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      .profile-results-page {
        padding: 20px 16px !important;
      }
      .profile-pre-page {
        padding-top: 24px !important;
        padding-left: 16px !important;
        padding-right: 16px !important;
        padding-bottom: 24px !important;
      }
    }
    @media (max-width: 500px) {
      .metrics-row-responsive {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      .profile-results-page {
        padding: 14px 12px !important;
      }
    }
    @media (max-width: 380px) {
      .metrics-row-responsive {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}
