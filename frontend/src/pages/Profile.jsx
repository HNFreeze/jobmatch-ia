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

function hasProfile(profile) {
  return profile && ((profile.stack && profile.stack.length > 0) || profile.anos_experiencia);
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

function sortByRelevance(offers) {
  const order = { APLICA: 0, "QUIZÁ": 1, NO_ENCAJA: 2 };
  return offers.slice().sort((a, b) => {
    const aOrder = order[a.resultado] ?? 2;
    const bOrder = order[b.resultado] ?? 2;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if ((b.puntuacion || 0) !== (a.puntuacion || 0)) return (b.puntuacion || 0) - (a.puntuacion || 0);
    if ((getBlockers(a).length) !== (getBlockers(b).length)) return getBlockers(a).length - getBlockers(b).length;
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
        anos_experiencia: profileObj.anos_experiencia || "",
        ubicaciones:      profileObj.ubicaciones || [],
        modalidad:        profileObj.modalidad || [],
        num_aplica:       offersData.filter(r => r.resultado === "APLICA").length,
        num_quiza:        offersData.filter(r => r.resultado === "QUIZÁ").length,
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
    const currentExperience = profile?.anos_experiencia || item.anos_experiencia || "";
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

    if (!currentExperience) {
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
    setSortBy("relevancia");
  }

  function handleShare() {
    if (!results) return;
    const aplica   = results.filter(r => r.resultado === "APLICA").length;
    const quiza    = results.filter(r => r.resultado === "QUIZÁ").length;
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
          anos_experiencia: profile.anos_experiencia || null,
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
      <div style={S.centeredContainer}>
        <div style={S.spinner} />
      </div>
    );
  }

  // ── Analyzing — skeleton loader ────────────────────────────────────────────────
  if (loading) {
    const phase = LOADING_PHASES[loadingPhase];
    return (
      <div style={{ ...S.resultsPage, ...(darkMode ? S.dmPage : {}) }}>
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
    const quiza    = visible.filter(r => r.resultado === "QUIZÁ");
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
    if (sortBy === "fecha") {
      filtered.sort((a, b) => new Date(b.fecha_publicacion || 0) - new Date(a.fecha_publicacion || 0));
    } else if (sortBy === "salario") {
      filtered.sort((a, b) => (parseSalaryValue(b.salario) || 0) - (parseSalaryValue(a.salario) || 0));
    } else if (sortBy === "puntuacion") {
      filtered.sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));
    }

    const dm = darkMode;
    const userStack = profile?.stack || [];

    return (
      <div style={{ ...S.resultsPage, ...(dm ? S.dmPage : {}) }}>
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
                <label style={{ ...S.filterLabel, color: dm ? "#94a3b8" : "#6b7280" }}>🏠 Modalidad</label>
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

              {/* Apply button */}
              <button
                style={{
                  width: "100%", padding: "10px 16px", fontSize: 14, fontWeight: 600,
                  color: "#fff", backgroundColor: TEAL, border: "none", borderRadius: 10,
                  cursor: "pointer", fontFamily: typography.family, marginTop: 8,
                  boxShadow: "0 2px 6px rgba(0,117,138,0.2)",
                }}
                onClick={() => { /* filters applied reactively */ }}
              >
                Aplicar Filtros
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

            {/* ── Offer Cards (list layout) ─────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {filtered.length > 0 ? (
                filtered.map((offer, index) => {
                  const rs    = RESULT_STYLES[offer.resultado] || RESULT_STYLES.NO_ENCAJA;
                  const isFav = offer.adzuna_id && favorites.has(offer.adzuna_id);
                  const tags  = extractTechTags(offer, profile?.stack);
                  const isNew = isNewOffer(offer.fecha_publicacion);
                  return (
                    <div
                      key={offer.id}
                      className="job-card"
                      onClick={() => setSelectedOffer(offer)}
                      style={{
                        ...S.offerCard,
                        borderLeftColor: rs.border,
                        animation: `fadeInUp 0.4s ease-out ${index * 0.04}s both`,
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
                      {getDecisionReason(offer) && (
                        <div style={{
                          margin: "16px 0 0",
                          padding: "14px 18px",
                          borderRadius: 12,
                          backgroundColor: dm ? "rgba(0,117,138,0.08)" : "rgba(0,117,138,0.04)",
                          border: `1px solid ${dm ? "rgba(0,117,138,0.15)" : "rgba(0,117,138,0.1)"}`,
                        }}>
                          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: dm ? "#94a3b8" : "#4b5563", fontFamily: typography.family }}>
                            <strong style={{ color: dm ? "#5eead4" : TEAL, fontWeight: 700 }}>IA Insight: </strong>
                            {getDecisionReason(offer)}
                          </p>
                          {(offer.skills_match?.length > 0 || offer.skills_missing?.length > 0 || getStrengths(offer).length > 0 || getGaps(offer).length > 0 || getBlockers(offer).length > 0) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                              {getStrengths(offer).length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                  {getStrengths(offer).slice(0, 2).map(s => (
                                    <span key={`strength-${s}`} style={{
                                      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                      backgroundColor: dm ? "rgba(16,185,129,0.12)" : "#dcfce7",
                                      color: dm ? "#34d399" : "#15803d",
                                      border: `1px solid ${dm ? "rgba(16,185,129,0.25)" : "#bbf7d0"}`,
                                    }}>✓ {s}</span>
                                  ))}
                                </div>
                              )}
                              {getGaps(offer).length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                  {getGaps(offer).slice(0, 2).map(s => (
                                    <span key={`gap-${s}`} style={{
                                      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                      backgroundColor: dm ? "rgba(245,158,11,0.12)" : "#fef3c7",
                                      color: dm ? "#fbbf24" : "#b45309",
                                      border: `1px solid ${dm ? "rgba(245,158,11,0.22)" : "#fde68a"}`,
                                    }}>△ {s}</span>
                                  ))}
                                </div>
                              )}
                              {getBlockers(offer).length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                  {getBlockers(offer).slice(0, 1).map(s => (
                                    <span key={`blocker-${s}`} style={{
                                      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                                      backgroundColor: dm ? "rgba(239,68,68,0.12)" : "#fee2e2",
                                      color: dm ? "#f87171" : "#dc2626",
                                      border: `1px solid ${dm ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
                                    }}>✕ {s}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {(offer.skills_match?.length > 0 || offer.skills_missing?.length > 0) && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                              {(offer.skills_match || []).map(s => (
                                <span key={s} style={{
                                  padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                  backgroundColor: dm ? "rgba(16,185,129,0.12)" : "#dcfce7",
                                  color: dm ? "#34d399" : "#15803d",
                                  border: `1px solid ${dm ? "rgba(16,185,129,0.25)" : "#bbf7d0"}`,
                                }}>✓ {s}</span>
                              ))}
                              {(offer.skills_missing || []).map(s => (
                                <span key={s} style={{
                                  padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                  backgroundColor: dm ? "rgba(239,68,68,0.12)" : "#fee2e2",
                                  color: dm ? "#f87171" : "#dc2626",
                                  border: `1px solid ${dm ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
                                }}>– {s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

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
              <button onClick={handleShare} style={{ ...S.btnOutline, ...(dm ? { color: "#94a3b8", borderColor: "rgba(255,255,255,0.12)" } : {}) }}>
                Compartir
              </button>
              <button onClick={handleReset} style={S.btnPrimary}>
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

        {/* ── Offer Detail Modal ───────────────────────────────────── */}
        {selectedOffer && (() => {
          const rs = RESULT_STYLES[selectedOffer.resultado] || RESULT_STYLES.NO_ENCAJA;
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
                            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 13 }}>📍</span> {selectedOffer.ubicacion}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <CompanyLogo name={selectedOffer.empresa} logoUrl={selectedOffer.company_logo_url} size={56} darkMode={dm} />
                          <div style={{ fontSize: 11, color: dm ? "#64748b" : "#9ca3af", fontFamily: typography.family, textAlign: "center", maxWidth: 120, lineHeight: 1.2 }}>
                            Logo reutilizado cuando ya existe un dominio fiable en cache
                          </div>
                          {selectedOffer.company_logo_domain && (
                            <div style={{ fontSize: 10, color: dm ? "#94a3b8" : "#64748b", fontFamily: typography.family, textAlign: "center", maxWidth: 140, lineHeight: 1.35 }}>
                              Dominio detectado: {selectedOffer.company_logo_domain}
                            </div>
                          )}
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
                              Abrimos fuentes externas donde puede haber valoraciones y reseñas sobre la empresa. No mostramos opiniones embebidas todavia.
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
                    {(selectedOffer.skills_match?.length > 0 || selectedOffer.skills_missing?.length > 0 || getStrengths(selectedOffer).length > 0 || getGaps(selectedOffer).length > 0 || getBlockers(selectedOffer).length > 0) && (
                      <div style={{
                        backgroundColor: dm ? "#1e293b" : "#fff",
                        borderRadius: 14, padding: "18px 20px",
                        border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e5e7eb"}`,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                            backgroundColor: dm ? "rgba(0,117,138,0.15)" : "#e0f2f1",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 15,
                          }}>📊</div>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827" }}>Claves del match</h3>
                        </div>
                        {getStrengths(selectedOffer).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: dm ? "#34d399" : "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Puntos fuertes
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                              {getStrengths(selectedOffer).map(s => (
                                <span key={`strength-${s}`} style={{
                                  padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                                  backgroundColor: dm ? "rgba(16,185,129,0.12)" : "#dcfce7",
                                  color: dm ? "#34d399" : "#15803d",
                                  border: `1px solid ${dm ? "rgba(16,185,129,0.25)" : "#bbf7d0"}`,
                                }}>✓ {s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {getGaps(selectedOffer).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: dm ? "#fbbf24" : "#b45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Gaps relevantes
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                              {getGaps(selectedOffer).map(s => (
                                <span key={`gap-${s}`} style={{
                                  padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                                  backgroundColor: dm ? "rgba(245,158,11,0.12)" : "#fef3c7",
                                  color: dm ? "#fbbf24" : "#b45309",
                                  border: `1px solid ${dm ? "rgba(245,158,11,0.22)" : "#fde68a"}`,
                                }}>△ {s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {getBlockers(selectedOffer).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: dm ? "#f87171" : "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Bloqueadores
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                              {getBlockers(selectedOffer).map(s => (
                                <span key={`blocker-${s}`} style={{
                                  padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                                  backgroundColor: dm ? "rgba(239,68,68,0.12)" : "#fee2e2",
                                  color: dm ? "#f87171" : "#dc2626",
                                  border: `1px solid ${dm ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
                                }}>✕ {s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedOffer.skills_match?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: dm ? "#34d399" : "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Cumples
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                              {selectedOffer.skills_match.map(s => (
                                <span key={s} style={{
                                  padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                                  backgroundColor: dm ? "rgba(16,185,129,0.12)" : "#dcfce7",
                                  color: dm ? "#34d399" : "#15803d",
                                  border: `1px solid ${dm ? "rgba(16,185,129,0.25)" : "#bbf7d0"}`,
                                }}>✓ {s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedOffer.skills_missing?.length > 0 && (
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: dm ? "#f87171" : "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Te falta
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                              {selectedOffer.skills_missing.map(s => (
                                <span key={s} style={{
                                  padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                                  backgroundColor: dm ? "rgba(239,68,68,0.12)" : "#fee2e2",
                                  color: dm ? "#f87171" : "#dc2626",
                                  border: `1px solid ${dm ? "rgba(239,68,68,0.25)" : "#fecaca"}`,
                                }}>– {s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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
                          <div style={{ padding: "8px 10px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 12, border: "1px solid #fecaca" }}>{coverLetterError}</div>
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
                      {selectedOffer.empresa} · {selectedOffer.ubicacion}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
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
      <div style={{ ...S.prePage, ...(dm ? S.dmPage : {}) }}>
        <div style={{ ...S.preCard, ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)" } : {}), textAlign: "center", padding: "48px 32px" }}>
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
    <div style={{ ...S.prePage, ...(dm ? S.dmPage : {}) }}>
      <div style={{ ...S.preCard, ...(dm ? { backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.06)" } : {}) }}>
        <h2 style={{ margin: "0 0 24px", fontSize: 26, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", letterSpacing: "-0.02em", fontFamily: typography.family }}>
          Buscar ofertas
        </h2>

        {error && <div style={S.errorBox}>{error}</div>}
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
              profile.anos_experiencia ? `${profile.anos_experiencia} año${profile.anos_experiencia !== "1" ? "s" : ""} de experiencia` : null,
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
                    {item.anos_experiencia ? `${item.anos_experiencia} años exp.` : "Experiencia no indicada"}
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
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: dm ? "#94a3b8" : "#6b7280", lineHeight: 1.5, fontFamily: typography.family }}>
                    Se volverá a analizar con tu perfil actual y el contexto de esta búsqueda.
                  </p>
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
    animation: "spin 1s linear infinite",
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
    padding: "5px 12px", borderRadius: 6,
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
    backgroundColor: TEAL,
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: typography.family,
    boxShadow: "0 2px 6px rgba(0,117,138,0.2)",
    whiteSpace: "nowrap",
    background: TEAL,
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
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: typography.family,
    boxShadow: "0 2px 6px rgba(0,117,138,0.2)",
  },
  btnAnalyze: {
    width: "100%",
    padding: "14px 20px",
    fontSize: 18, fontWeight: 800,
    color: "#fff",
    backgroundColor: TEAL,
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
    backgroundColor: "rgba(0,0,0,0.5)",
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
    .summary-number-anim {
      animation: countPop 0.5s ease-out both;
    }
    /* ── Responsive metrics ──────────────────────────────────── */
    @media (max-width: 900px) {
      .metrics-row-responsive {
        grid-template-columns: repeat(2, 1fr) !important;
      }
    }
    @media (max-width: 500px) {
      .metrics-row-responsive {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}
