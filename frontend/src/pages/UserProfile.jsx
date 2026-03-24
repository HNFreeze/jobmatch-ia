import { useState, useEffect } from "react";
import { getUserProfile, updateUserProfile, changePassword, deleteAccount } from "../services/api";
import { typography, transition } from "../constants/theme";

const TEAL = "#00758A";
const DELETE_ACCOUNT_CONFIRMATION = "ELIMINAR";

// ── SVG Icons ────────────────────────────────────────────────────────────────
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const TerminalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);
const BriefcaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const SlidersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
    <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
  </svg>
);
const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const PinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ── Constants ────────────────────────────────────────────────────────────────
const CITY_OPTIONS = [
  "Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao",
  "Málaga", "Zaragoza", "Murcia", "Alicante", "Valladolid",
  "A Coruña", "Granada", "Toda España",
];

const MODALIDAD_OPTIONS = [
  { value: "Presencial", emoji: "🏢", color: "#06b6d4" },
  { value: "Híbrido",    emoji: "💻", color: "#3b82f6" },
  { value: "Remoto",     emoji: "🏠", color: "#22c55e" },
];

const LANGUAGE_PRESETS = [
  "Español", "Inglés", "Francés", "Alemán", "Italiano",
  "Portugués", "Chino", "Japonés", "Árabe", "Ruso",
];

const TECH_OPTIONS = [
  "JavaScript", "TypeScript", "Python", "React", "Vue", "Angular", "Node.js",
  "Express", "FastAPI", "Django", "Flask", "SQL", "PostgreSQL", "MongoDB",
  "Redis", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git", "GraphQL",
  "REST APIs", "Java", "C#", "PHP", "Ruby", "Swift", "Kotlin", "Rust", "Go",
];

const LEVEL_OPTIONS = [
  { value: "basico",     label: "Básico" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado",   label: "Avanzado" },
  { value: "nativo",     label: "Nativo" },
];

const SIDEBAR_ITEMS = [
  { key: "info",        label: "Información personal",   Icon: UserIcon },
  { key: "stack",       label: "Stack Tecnológico",      Icon: TerminalIcon },
  { key: "experience",  label: "Experiencia e Idiomas",  Icon: BriefcaseIcon },
  { key: "preferences", label: "Preferencias de Trabajo", Icon: SlidersIcon },
  { key: "security",    label: "Seguridad",              Icon: ShieldIcon },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getLangFlag(name) {
  const n = (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("ingl"))                      return "🇬🇧";
  if (n.includes("espa") || n.includes("cast")) return "🇪🇸";
  if (n.includes("franc"))                     return "🇫🇷";
  if (n.includes("alem"))                      return "🇩🇪";
  if (n.includes("ital"))                      return "🇮🇹";
  if (n.includes("port"))                      return "🇵🇹";
  if (n.includes("chin") || n.includes("mand")) return "🇨🇳";
  if (n.includes("japon"))                     return "🇯🇵";
  if (n.includes("arab"))                      return "🇸🇦";
  if (n.includes("ruso") || n.includes("rus")) return "🇷🇺";
  return "🌐";
}

function expToNum(val) {
  if (!val) return null;
  if (val === "10+") return 10;
  return parseInt(val, 10) || null;
}

function expFromNum(n) {
  return n >= 10 ? "10+" : String(n);
}

function getLevelLabel(val) {
  const opt = LEVEL_OPTIONS.find(o => o.value === val);
  return opt ? opt.label.toUpperCase() : val?.toUpperCase() || "";
}

// ── Global CSS ───────────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("user-profile-styles")) {
  const s = document.createElement("style");
  s.id = "user-profile-styles";
  s.innerHTML = `
    @keyframes upSpin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .up-spinner { animation: upSpin 0.8s linear infinite; }
    .tech-chip { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
    .tech-chip:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .location-pill { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
    .location-pill:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .modality-card { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
    .modality-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    .sidebar-item { transition: all 0.2s ease; }
    .sidebar-item:hover { background: #fff !important; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .profile-card-hover { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
    .section-card-hover { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
    .section-card-hover:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.06) !important; }
    .save-btn-main { transition: all 0.25s ease; }
    .save-btn-main:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); box-shadow: 0 8px 24px ${TEAL}50 !important; }
    .save-btn-main:disabled { opacity: 0.6; cursor: not-allowed; }
    .skip-link:hover { color: ${TEAL} !important; }
    .lang-entry { transition: all 0.2s ease; }
    .lang-entry:hover { background: #f8fafc !important; }
    input[type=range] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${TEAL};
      cursor: pointer;
      box-shadow: 0 2px 8px ${TEAL}60;
      border: 3px solid #fff;
      transition: box-shadow 0.2s ease, transform 0.2s ease;
    }
    input[type=range]::-webkit-slider-thumb:hover { box-shadow: 0 4px 14px ${TEAL}80; transform: scale(1.1); }
    input[type=range]::-moz-range-thumb {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${TEAL};
      cursor: pointer;
      box-shadow: 0 2px 8px ${TEAL}60;
      border: 3px solid #fff;
    }
    @media (max-width: 768px) {
      .profile-sidebar { display: none !important; }
      .profile-layout { padding: 20px 16px !important; gap: 0 !important; }
    }
    @media (max-width: 480px) {
      .profile-layout { padding: 16px 12px !important; }
    }
    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
  `;
  document.head.appendChild(s);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function UserProfile({ onProfileSaved, onSkip, onAccountDeleted, addToast, darkMode }) {
  const [email,      setEmail]      = useState("");
  const [alias,      setAlias]      = useState("");
  const [stack,      setStack]      = useState([]);
  const [experience, setExperience] = useState("");
  const [idiomas,    setIdiomas]    = useState([{ idioma: "Inglés", nivel: "intermedio" }]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [modalidad,  setModalidad]  = useState([]);
  const [search,     setSearch]     = useState("");
  const [customTech, setCustomTech] = useState("");
  const [animatingTech, setAnimatingTech] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const [success,    setSuccess]    = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSection, setActiveSection] = useState("info");

  // Password state
  const [pwOpen,       setPwOpen]       = useState(false);
  const [currentPw,    setCurrentPw]    = useState("");
  const [newPw,        setNewPw]        = useState("");
  const [confirmPw,    setConfirmPw]    = useState("");
  const [pwLoading,    setPwLoading]    = useState(false);
  const [pwError,      setPwError]      = useState(null);
  const [pwSuccess,    setPwSuccess]    = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw,     setShowNewPw]     = useState(false);

  // Account deletion state
  const [deleteOpen,           setDeleteOpen]           = useState(false);
  const [deleteCurrentPw,      setDeleteCurrentPw]      = useState("");
  const [deleteConfirmation,   setDeleteConfirmation]   = useState("");
  const [deleteLoading,        setDeleteLoading]        = useState(false);
  const [deleteError,          setDeleteError]          = useState(null);
  const [deleteSuccess,        setDeleteSuccess]        = useState(false);

  const initial = (alias || email).charAt(0).toUpperCase() || "?";

  // Load profile
  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const data = await getUserProfile();
        if (cancelled) return;
        setEmail(data.email || "");
        setAlias(data.alias || data.email?.split("@")[0] || "");
        if (data.stack?.length)       setStack(data.stack);
        if (data.anos_experiencia)    setExperience(data.anos_experiencia);
        if (data.idiomas?.length)     setIdiomas(data.idiomas);
        if (data.ubicaciones?.length) setUbicaciones(data.ubicaciones);
        if (data.modalidad?.length)   setModalidad(data.modalidad);
      } catch {
        // new user — keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, []);

  // Track active section on scroll
  useEffect(() => {
    function handleScroll() {
      const keys = ["info", "stack", "experience", "preferences", "security"];
      let active = "info";
      for (const key of keys) {
        const el = document.getElementById(`section-${key}`);
        if (el && el.getBoundingClientRect().top <= 120) active = key;
      }
      setActiveSection(prev => prev === active ? prev : active);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Completion
  const completionFields = [
    { done: stack.length > 0,                              label: "Stack tecnológico" },
    { done: experience !== "",                             label: "Años de experiencia" },
    { done: idiomas.filter(l => l.idioma.trim()).length > 0, label: "Idiomas" },
    { done: ubicaciones.length > 0,                        label: "Ubicaciones" },
    { done: modalidad.length > 0,                          label: "Modalidad" },
  ];
  const completion = Math.round(completionFields.filter(f => f.done).length / completionFields.length * 100);
  const missingFields = completionFields.filter(f => !f.done);

  // Handlers
  function toggleTech(tech) {
    setAnimatingTech(tech);
    setStack(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]);
    setHasChanges(true);
    setTimeout(() => setAnimatingTech(null), 300);
  }

  function toggleCiudad(city) {
    setUbicaciones(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]);
    setHasChanges(true);
  }

  function toggleModalidad(mod) {
    setModalidad(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
    setHasChanges(true);
  }

  function addCustomTech() {
    const t = customTech.trim();
    if (t && !stack.includes(t)) {
      setAnimatingTech(t);
      setStack(prev => [...prev, t]);
      setHasChanges(true);
      setTimeout(() => setAnimatingTech(null), 300);
    }
    setCustomTech("");
  }

  function addIdioma() {
    setIdiomas(prev => [...prev, { idioma: "", nivel: "intermedio" }]);
    setHasChanges(true);
  }

  function updateIdioma(index, field, value) {
    setIdiomas(prev => prev.map((lang, i) => i === index ? { ...lang, [field]: value } : lang));
    setHasChanges(true);
  }

  function removeIdioma(index) {
    setIdiomas(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError(null);
    if (newPw.length < 8) { setPwError("La nueva contraseña debe tener al menos 8 caracteres"); return; }
    if (newPw !== confirmPw) { setPwError("Las contraseñas no coinciden"); return; }
    if (newPw === currentPw) { setPwError("La nueva contraseña debe ser diferente a la actual"); return; }
    setPwLoading(true);
    try {
      await changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      addToast?.("Contraseña actualizada correctamente", "success");
      setTimeout(() => { setPwSuccess(false); setPwOpen(false); }, 2500);
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      await updateUserProfile({
        stack,
        anos_experiencia: experience,
        idiomas: idiomas.filter(l => l.idioma.trim()),
        ubicaciones,
        modalidad,
      });
      setSuccess(true); setHasChanges(false);
      addToast?.("Perfil actualizado correctamente", "success");
      setTimeout(() => onProfileSaved(), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleteError(null);

    if (!deleteCurrentPw.trim()) {
      setDeleteError("Introduce tu contraseña actual para confirmar");
      return;
    }

    if (deleteConfirmation.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION) {
      setDeleteError(`Debes escribir '${DELETE_ACCOUNT_CONFIRMATION}' para confirmar`);
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteAccount(deleteCurrentPw, deleteConfirmation.trim());
      setDeleteSuccess(true);
      addToast?.("Cuenta eliminada correctamente", "success");
      setTimeout(() => onAccountDeleted?.(), 700);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  function scrollToSection(key) {
    setActiveSection(key);
    const el = document.getElementById(`section-${key}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  // Derived
  const filteredTechs   = TECH_OPTIONS.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const unselectedTechs = filteredTechs.filter(t => !stack.includes(t));
  const sliderNum       = expToNum(experience);
  const sliderPct       = sliderNum ? ((sliderNum - 1) / 9) * 100 : 0;
  const sliderBg        = `linear-gradient(to right, ${TEAL} ${sliderPct}%, #e5e7eb ${sliderPct}%)`;

  const dm = darkMode;
  const dmBg     = dm ? "#1e293b" : "#fff";
  const dmBorder = dm ? "rgba(255,255,255,0.06)" : "#e8ecf1";
  const dmText   = dm ? "#f1f5f9" : "#111827";
  const dmSub    = dm ? "#94a3b8" : "#6b7280";
  const dmHint   = dm ? "#64748b" : "#9ca3af";
  const dmInput  = dm ? "#0f172a" : "#fff";

  // Loading
  if (loading) {
    return (
      <div style={{ ...S.page, ...(dm ? { background: "#0f172a" } : {}), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="up-spinner" style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTop: `3px solid ${TEAL}`, borderRadius: "50%", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 15, color: dmSub, margin: 0, fontFamily: typography.family }}>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.page, ...(dm ? { background: "#0f172a" } : {}) }}>
      <div className="profile-layout" style={S.layout}>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="profile-sidebar" style={S.sidebar}>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {SIDEBAR_ITEMS.map(({ key, label, Icon }) => {
              const isActive = activeSection === key;
              return (
                <button
                  key={key}
                  className="sidebar-item"
                  onClick={() => scrollToSection(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12,
                    border: "1px solid transparent",
                    fontSize: 14, fontWeight: isActive ? 600 : 500,
                    cursor: "pointer", fontFamily: typography.family,
                    textAlign: "left", width: "100%",
                    background: isActive ? (dm ? "#1e293b" : "#fff") : "transparent",
                    color: isActive ? TEAL : (dm ? "#94a3b8" : "#6b7280"),
                    boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
                    borderColor: isActive ? (dm ? "rgba(255,255,255,0.06)" : "#e8ecf1") : "transparent",
                    borderLeft: isActive ? `4px solid ${TEAL}` : "4px solid transparent",
                  }}
                >
                  <Icon /> {label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <section className="custom-scrollbar" style={S.content}>

          {/* ── Profile Header Card ────────────────────────────────────────── */}
          <div
            id="section-info"
            className="profile-card-hover"
            style={{
              ...S.card,
              backgroundColor: dmBg, borderColor: dmBorder,
              padding: "28px 32px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 100, height: 100, borderRadius: "50%",
                  border: "4px solid #fed7aa",
                  background: dm ? "#44403c" : "#fff7ed",
                  color: dm ? "#fdba74" : "#ea580c",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 40, fontWeight: 800, fontFamily: typography.family,
                  userSelect: "none",
                }}>
                  {initial}
                </div>
                <button style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 30, height: 30, borderRadius: "50%",
                  background: TEAL, color: "#fff",
                  border: "2px solid #fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }} title="Editar avatar">
                  <EditIcon />
                </button>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: dmText, fontFamily: typography.family, letterSpacing: "-0.02em" }}>
                  {alias || email.split("@")[0]}
                </h1>
                {stack.length > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 600, color: TEAL, fontFamily: typography.family }}>
                    {stack.slice(0, 3).join(" · ")} Developer
                  </p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, fontSize: 14, fontWeight: 500, color: dmSub }}>
                  {ubicaciones.length > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: dmHint }}><PinIcon /></span>
                      {ubicaciones[0]}, España
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: dmHint }}><MailIcon /></span>
                    {email}
                  </span>
                </div>
              </div>
            </div>

            {/* Completion bar */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${dmBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 6, background: dm ? "#334155" : "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${completion}%`, background: TEAL, borderRadius: 3, transition: "width 0.5s ease" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEAL, whiteSpace: "nowrap", fontFamily: typography.family }}>
                  {completion}% completado
                </span>
              </div>
              {completion < 100 && missingFields.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {missingFields.map(f => (
                    <span key={f.label} style={{
                      fontSize: 11, fontWeight: 500, color: dmHint,
                      background: dm ? "#334155" : "#f1f5f9",
                      padding: "2px 10px", borderRadius: 10,
                    }}>
                      {f.label}
                    </span>
                  ))}
                </div>
              )}
              {completion === 100 && (
                <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 600, color: "#10b981", fontFamily: typography.family }}>
                  ✓ Perfil completo — el análisis IA será más preciso
                </p>
              )}
            </div>
          </div>

          {error   && <div style={{ ...S.feedbackBox, backgroundColor: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}>{error}</div>}
          {success && <div style={{ ...S.feedbackBox, backgroundColor: "#dcfce7", color: "#15803d", borderColor: "#22c55e" }}>✓ Perfil guardado — redirigiendo...</div>}

          {/* ── Stack Tecnológico ───────────────────────────────────────────── */}
          <div id="section-stack" style={{ marginTop: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
              <h2 style={{ ...S.sectionTitle, color: dmText }}>Stack Tecnológico</h2>
              <span style={{ fontSize: 11, fontWeight: 700, color: dmHint, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                SKILLS & TOOLS
              </span>
            </div>

            <div className="section-card-hover" style={{ ...S.card, backgroundColor: dmBg, borderColor: dmBorder, padding: 24 }}>
              {/* Selected chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                {stack.map(tech => (
                  <span
                    key={tech}
                    className="tech-chip"
                    onClick={() => toggleTech(tech)}
                    style={{
                      padding: "8px 16px", borderRadius: 50, fontSize: 13, fontWeight: 600,
                      background: dm ? "rgba(167,243,208,0.15)" : "rgba(167,243,208,0.4)",
                      color: dm ? "#34d399" : "#047857",
                      border: `1px solid ${dm ? "rgba(52,211,153,0.2)" : "rgba(52,211,153,0.3)"}`,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                      fontFamily: typography.family,
                    }}
                  >
                    {tech}
                    <span style={{ opacity: 0.6, fontSize: 16, lineHeight: 1 }}>×</span>
                  </span>
                ))}
                <button
                  onClick={() => document.getElementById("tech-search-input")?.focus()}
                  style={{
                    padding: "8px 16px", borderRadius: 50, fontSize: 13, fontWeight: 500,
                    background: "transparent",
                    border: `1.5px dashed ${dm ? "rgba(255,255,255,0.15)" : "#d1d5db"}`,
                    color: dmSub, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontFamily: typography.family,
                  }}
                >
                  + Añadir tecnología
                </button>
              </div>

              {/* Search */}
              <input
                id="tech-search-input"
                type="text"
                placeholder="Busca React, Python, Node..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...S.input, backgroundColor: dmInput, color: dmText, borderColor: dm ? "rgba(255,255,255,0.1)" : "#d1d5db" }}
              />

              {/* Available techs grid */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, maxHeight: 145, overflowY: "auto", padding: "4px 0" }}>
                {unselectedTechs.map(tech => (
                  <button
                    key={tech}
                    className="tech-chip"
                    onClick={() => toggleTech(tech)}
                    style={{
                      padding: "6px 14px", borderRadius: 50, fontSize: 13, fontWeight: 500,
                      background: dm ? "#1e293b" : "#fff",
                      border: `1.5px solid ${dm ? "rgba(255,255,255,0.1)" : "#d1d5db"}`,
                      color: dm ? "#94a3b8" : "#6b7280",
                      cursor: "pointer", fontFamily: typography.family,
                    }}
                  >
                    {tech}
                  </button>
                ))}
                {search && unselectedTechs.length === 0 && (
                  <span style={{ fontSize: 13, color: dmHint, fontStyle: "italic", padding: "6px 0" }}>No encontrado — añádelo abajo</span>
                )}
              </div>

              {/* Custom tech */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
                <input
                  type="text"
                  placeholder="Otra tecnología..."
                  value={customTech}
                  onChange={e => setCustomTech(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomTech(); } }}
                  style={{ ...S.input, flex: 1, marginBottom: 0, backgroundColor: dmInput, color: dmText, borderColor: dm ? "rgba(255,255,255,0.1)" : "#d1d5db" }}
                />
                <button onClick={addCustomTech} style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#fff",
                  background: TEAL, border: "none", borderRadius: 50,
                  cursor: "pointer", fontFamily: typography.family, whiteSpace: "nowrap",
                }}>
                  + Añadir
                </button>
              </div>

              {/* IA Suggestion */}
              {stack.length >= 2 && (
                <div style={{
                  background: dm ? "#0f172a" : "#f8fafc",
                  border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
                  borderRadius: 12, padding: 16, display: "flex", alignItems: "flex-start", gap: 12,
                }}>
                  <span style={{ color: TEAL, fontWeight: 700, whiteSpace: "nowrap", fontSize: 13, fontFamily: typography.family }}>IA Suggestion:</span>
                  <p style={{ margin: 0, fontSize: 13, color: dmSub, lineHeight: 1.5, fontFamily: typography.family }}>
                    Basado en tu perfil, considera añadir{" "}
                    <strong style={{ color: dmText }}>Docker</strong> o{" "}
                    <strong style={{ color: dmText }}>Kubernetes</strong>{" "}
                    para mejorar tu tasa de compatibilidad en un 15%.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Experience + Languages Grid ─────────────────────────────────── */}
          <div id="section-experience" style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            {/* Experience */}
            <div>
              <h2 style={{ ...S.sectionTitle, color: dmText, marginBottom: 16 }}>Años de Experiencia</h2>
              <div className="section-card-hover" style={{ ...S.card, backgroundColor: dmBg, borderColor: dmBorder, padding: 24, minHeight: 180, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, color: TEAL, lineHeight: 1, letterSpacing: "-2px", fontFamily: typography.family }}>
                    {sliderNum || "—"}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: dmSub, paddingBottom: 4, fontFamily: typography.family }}>
                    Años totales
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={sliderNum || 1}
                  onChange={e => { setExperience(expFromNum(Number(e.target.value))); setHasChanges(true); }}
                  style={{ display: "block", width: "100%", marginBottom: 8, background: sliderBg }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: dmHint, fontWeight: 500, fontFamily: typography.family }}>
                  <span>0</span>
                  <span>10+</span>
                </div>
              </div>
            </div>

            {/* Languages */}
            <div>
              <h2 style={{ ...S.sectionTitle, color: dmText, marginBottom: 16 }}>Idiomas</h2>
              <div className="section-card-hover" style={{ ...S.card, backgroundColor: dmBg, borderColor: dmBorder, padding: 24, minHeight: 180, display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {idiomas.map((lang, i) => (
                    <div
                      key={i}
                      className="lang-entry"
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: 12, borderRadius: 10,
                        background: dm ? "#0f172a" : "#f8fafc",
                        border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e8ecf1"}`,
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{getLangFlag(lang.idioma)}</span>
                      <select
                        value={LANGUAGE_PRESETS.includes(lang.idioma) ? lang.idioma : "Otro"}
                        onChange={e => {
                          const val = e.target.value;
                          updateIdioma(i, "idioma", val === "Otro" ? "" : val);
                        }}
                        style={{
                          flex: 1, padding: "4px 8px", fontSize: 14, fontWeight: 600,
                          border: "none", background: "transparent",
                          color: dmText, fontFamily: typography.family,
                          cursor: "pointer", outline: "none", minWidth: 0,
                        }}
                      >
                        {LANGUAGE_PRESETS.map(l => <option key={l} value={l}>{l}</option>)}
                        <option value="Otro">Otro…</option>
                      </select>
                      {!LANGUAGE_PRESETS.includes(lang.idioma) && (
                        <input
                          type="text"
                          placeholder="Nombre"
                          value={lang.idioma}
                          onChange={e => updateIdioma(i, "idioma", e.target.value)}
                          style={{
                            flex: 1, padding: "4px 8px", fontSize: 13,
                            border: "none", borderBottom: `1.5px solid ${dm ? "rgba(255,255,255,0.1)" : "#d1d5db"}`,
                            background: "transparent", color: dmText, fontFamily: "inherit", outline: "none",
                          }}
                        />
                      )}
                      <select
                        value={lang.nivel}
                        onChange={e => updateIdioma(i, "nivel", e.target.value)}
                        style={{
                          padding: "4px 10px", fontSize: 11, fontWeight: 700,
                          borderRadius: 6, border: "none",
                          background: dm ? "rgba(186,230,253,0.1)" : "rgba(186,230,253,0.4)",
                          color: dm ? "#7dd3fc" : "#0369a1",
                          fontFamily: typography.family, cursor: "pointer",
                          letterSpacing: "0.03em", textTransform: "uppercase",
                        }}
                      >
                        {LEVEL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {idiomas.length > 1 && (
                        <button
                          onClick={() => removeIdioma(i)}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: dm ? "#334155" : "#e5e7eb",
                            color: dm ? "#94a3b8" : "#6b7280",
                            border: "none", cursor: "pointer",
                            fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addIdioma}
                  style={{
                    width: "100%", marginTop: 12, padding: "10px 0",
                    background: "transparent", border: "none",
                    color: TEAL, fontSize: 13, fontWeight: 700,
                    letterSpacing: "0.05em", cursor: "pointer",
                    fontFamily: typography.family,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    borderRadius: 8,
                  }}
                  className="skip-link"
                >
                  + AÑADIR IDIOMA
                </button>
              </div>
            </div>
          </div>

          {/* ── Preferencias de Trabajo ─────────────────────────────────────── */}
          <div id="section-preferences" style={{ marginTop: 32 }}>
            <h2 style={{ ...S.sectionTitle, color: dmText, marginBottom: 16 }}>Preferencias de Trabajo</h2>

            <div className="section-card-hover" style={{ ...S.card, backgroundColor: dmBg, borderColor: dmBorder, padding: "28px 28px 32px" }}>
              {/* Modality */}
              <h3 style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: dmHint, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: typography.family }}>
                Modalidad de Contrato
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
                {MODALIDAD_OPTIONS.map(({ value, emoji, color }) => {
                  const isOn = modalidad.includes(value);
                  return (
                    <div
                      key={value}
                      className="modality-card"
                      onClick={() => toggleModalidad(value)}
                      style={{
                        padding: "20px 16px", borderRadius: 12,
                        border: `2px solid ${isOn ? TEAL : (dm ? "rgba(255,255,255,0.06)" : "#e8ecf1")}`,
                        background: isOn ? TEAL : (dm ? "#0f172a" : "#fff"),
                        color: isOn ? "#fff" : (dm ? "#94a3b8" : "#6b7280"),
                        cursor: "pointer", textAlign: "center",
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", gap: 10, minHeight: 120,
                        boxShadow: isOn ? `0 4px 16px ${TEAL}40` : "none",
                      }}
                    >
                      <span style={{ fontSize: 32 }}>{emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: 15, fontFamily: typography.family }}>{value}</span>
                      {isOn && (
                        <span style={{ fontSize: 11, opacity: 0.8, fontFamily: typography.family }}>✓ Seleccionado</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Location */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: dmHint, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: typography.family }}>
                  Ubicación Preferida
                </h3>
                {ubicaciones.length > 0 && (
                  <button
                    onClick={() => { setUbicaciones([]); setHasChanges(true); }}
                    style={{ fontSize: 12, color: "#ef4444", fontWeight: 500, background: "none", border: "none", cursor: "pointer", fontFamily: typography.family }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CITY_OPTIONS.map(city => {
                  const isOn = ubicaciones.includes(city);
                  return (
                    <button
                      key={city}
                      className="location-pill"
                      onClick={() => toggleCiudad(city)}
                      style={{
                        padding: "8px 16px", borderRadius: 50,
                        fontSize: 13, fontWeight: 500,
                        border: `1.5px solid ${isOn ? TEAL : (dm ? "rgba(255,255,255,0.1)" : "#d1d5db")}`,
                        background: isOn ? TEAL : (dm ? "#0f172a" : "#fff"),
                        color: isOn ? "#fff" : (dm ? "#94a3b8" : "#374151"),
                        cursor: "pointer", fontFamily: typography.family,
                        display: "inline-flex", alignItems: "center", gap: 6,
                        boxShadow: isOn ? `0 2px 8px ${TEAL}30` : "none",
                      }}
                    >
                      <span style={{ color: isOn ? "rgba(255,255,255,0.7)" : (city === "Toda España" ? undefined : "#ef4444"), fontSize: 13 }}>
                        {city === "Toda España" ? "🇪🇸" : "📍"}
                      </span>
                      {city}
                      {isOn && <span style={{ marginLeft: 2, fontSize: 11 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Seguridad ──────────────────────────────────────────────────── */}
          <div id="section-security" style={{ marginTop: 32 }}>
            <h2 style={{ ...S.sectionTitle, color: dmText, marginBottom: 16 }}>Seguridad</h2>

            <div className="section-card-hover" style={{ ...S.card, backgroundColor: dmBg, borderColor: dmBorder, padding: 24 }}>
              <button
                type="button"
                onClick={() => { setPwOpen(o => !o); setPwError(null); setPwSuccess(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", background: "none", border: "none",
                  cursor: "pointer", padding: 0, textAlign: "left",
                }}
              >
                <span style={{ color: TEAL }}><ShieldIcon /></span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: dmText, fontFamily: typography.family }}>
                  Cambiar contraseña
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: dmHint,
                  transform: pwOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.25s ease", display: "inline-block",
                }}>▼</span>
              </button>

              {pwOpen && (
                <form onSubmit={handleChangePassword} style={{ marginTop: 20 }}>
                  {pwError && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, marginBottom: 14,
                      backgroundColor: dm ? "#3b1515" : "#ffe4e6",
                      border: `1px solid ${dm ? "#7f1d1d" : "#fecdd3"}`,
                      color: dm ? "#fca5a5" : "#be123c", fontSize: 13, fontWeight: 500,
                    }}>
                      {pwError}
                    </div>
                  )}
                  {pwSuccess && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, marginBottom: 14,
                      backgroundColor: dm ? "#052e16" : "#d1fae5",
                      border: `1px solid ${dm ? "#166534" : "#6ee7b7"}`,
                      color: dm ? "#86efac" : "#065f46", fontSize: 13, fontWeight: 600,
                    }}>
                      ✓ Contraseña actualizada correctamente
                    </div>
                  )}

                  {/* Current password */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: dmHint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontFamily: typography.family }}>
                      Contraseña actual
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPw}
                        onChange={e => setCurrentPw(e.target.value)}
                        placeholder="Tu contraseña actual"
                        required
                        autoComplete="current-password"
                        style={{ ...S.input, marginBottom: 0, paddingRight: 44, backgroundColor: dmInput, color: dmText, borderColor: dm ? "rgba(255,255,255,0.1)" : "#d1d5db" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(v => !v)}
                        style={{
                          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 16, color: dmHint, padding: 0,
                        }}
                      >
                        {showCurrentPw ? "🙈" : "👁"}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: dmHint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontFamily: typography.family }}>
                      Nueva contraseña
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        required
                        autoComplete="new-password"
                        style={{ ...S.input, marginBottom: 0, paddingRight: 44, backgroundColor: dmInput, color: dmText, borderColor: dm ? "rgba(255,255,255,0.1)" : "#d1d5db" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(v => !v)}
                        style={{
                          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 16, color: dmHint, padding: 0,
                        }}
                      >
                        {showNewPw ? "🙈" : "👁"}
                      </button>
                    </div>
                    {newPw.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: dm ? "#334155" : "#e5e7eb", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 2, transition: "width 0.3s ease, background 0.3s ease",
                            width: newPw.length >= 12 ? "100%" : newPw.length >= 8 ? "60%" : "30%",
                            backgroundColor: newPw.length >= 12 ? "#10b981" : newPw.length >= 8 ? "#f59e0b" : "#f43f5e",
                          }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: newPw.length >= 12 ? "#10b981" : newPw.length >= 8 ? "#d97706" : "#e11d48" }}>
                          {newPw.length >= 12 ? "Fuerte" : newPw.length >= 8 ? "Aceptable" : "Débil"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: dmHint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontFamily: typography.family }}>
                      Confirmar nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      required
                      autoComplete="new-password"
                      style={{
                        ...S.input, marginBottom: 0,
                        backgroundColor: dmInput, color: dmText,
                        borderColor: confirmPw.length > 0
                          ? (confirmPw === newPw ? "#10b981" : "#f43f5e")
                          : (dm ? "rgba(255,255,255,0.1)" : "#d1d5db"),
                      }}
                    />
                    {confirmPw.length > 0 && confirmPw !== newPw && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#e11d48" }}>Las contraseñas no coinciden</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={pwLoading || pwSuccess}
                    style={{
                      width: "100%", padding: "12px 0", borderRadius: 10,
                      border: "none", color: "#fff", fontSize: 14, fontWeight: 700,
                      background: pwSuccess ? "#10b981" : TEAL,
                      cursor: pwLoading || pwSuccess ? "not-allowed" : "pointer",
                      opacity: pwLoading ? 0.7 : 1, transition: "all 0.25s ease",
                      fontFamily: typography.family,
                    }}
                  >
                    {pwLoading ? "Actualizando..." : pwSuccess ? "✓ Actualizada" : "Actualizar contraseña"}
                  </button>
                </form>
              )}
            </div>

            <div
              className="section-card-hover"
              style={{
                ...S.card,
                marginTop: 18,
                padding: 24,
                backgroundColor: dm ? "rgba(127,29,29,0.16)" : "#fff7f7",
                borderColor: dm ? "rgba(248,113,113,0.28)" : "#fecaca",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(o => !o);
                  setDeleteError(null);
                  setDeleteSuccess(false);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", background: "none", border: "none",
                  cursor: "pointer", padding: 0, textAlign: "left",
                }}
              >
                <span style={{ color: "#dc2626" }}><ShieldIcon /></span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: dm ? "#fecaca" : "#991b1b", fontFamily: typography.family }}>
                  Eliminar cuenta
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: dm ? "#fca5a5" : "#b91c1c",
                  transform: deleteOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.25s ease", display: "inline-block",
                }}>▼</span>
              </button>

              <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: dm ? "#fca5a5" : "#7f1d1d", fontFamily: typography.family }}>
                Esta acción elimina tu cuenta y también tus favoritas, historial y candidaturas guardadas. No se puede deshacer.
              </p>

              {deleteOpen && (
                <form onSubmit={handleDeleteAccount} style={{ marginTop: 18 }}>
                  <div style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    marginBottom: 14,
                    backgroundColor: dm ? "rgba(15,23,42,0.45)" : "#fff",
                    border: `1px solid ${dm ? "rgba(248,113,113,0.18)" : "#fecaca"}`,
                  }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: dm ? "#fecaca" : "#991b1b", letterSpacing: "0.03em", textTransform: "uppercase", fontFamily: typography.family }}>
                      Confirmación requerida
                    </p>
                    <p style={{ margin: "0 0 6px", fontSize: 13, color: dm ? "#fca5a5" : "#7f1d1d", fontFamily: typography.family }}>
                      1. Escribe tu contraseña actual.
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: dm ? "#fca5a5" : "#7f1d1d", fontFamily: typography.family }}>
                      2. Escribe <strong>{DELETE_ACCOUNT_CONFIRMATION}</strong> para confirmar la eliminación.
                    </p>
                  </div>

                  {deleteError && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, marginBottom: 14,
                      backgroundColor: dm ? "#3b1515" : "#ffe4e6",
                      border: `1px solid ${dm ? "#7f1d1d" : "#fecdd3"}`,
                      color: dm ? "#fca5a5" : "#be123c", fontSize: 13, fontWeight: 500,
                    }}>
                      {deleteError}
                    </div>
                  )}

                  {deleteSuccess && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, marginBottom: 14,
                      backgroundColor: dm ? "#052e16" : "#d1fae5",
                      border: `1px solid ${dm ? "#166534" : "#6ee7b7"}`,
                      color: dm ? "#86efac" : "#065f46", fontSize: 13, fontWeight: 600,
                    }}>
                      ✓ Cuenta eliminada. Cerrando sesión...
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: dmHint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontFamily: typography.family }}>
                      Contraseña actual
                    </label>
                    <input
                      type="password"
                      value={deleteCurrentPw}
                      onChange={e => setDeleteCurrentPw(e.target.value)}
                      placeholder="Introduce tu contraseña"
                      autoComplete="current-password"
                      style={{
                        ...S.input, marginBottom: 0,
                        backgroundColor: dmInput, color: dmText,
                        borderColor: dm ? "rgba(255,255,255,0.1)" : "#d1d5db",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: dmHint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontFamily: typography.family }}>
                      Escribe {DELETE_ACCOUNT_CONFIRMATION}
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={e => setDeleteConfirmation(e.target.value.toUpperCase())}
                      placeholder={DELETE_ACCOUNT_CONFIRMATION}
                      style={{
                        ...S.input, marginBottom: 0,
                        backgroundColor: dmInput, color: dmText,
                        borderColor: deleteConfirmation.length > 0
                          ? (deleteConfirmation === DELETE_ACCOUNT_CONFIRMATION ? "#dc2626" : "#f59e0b")
                          : (dm ? "rgba(255,255,255,0.1)" : "#d1d5db"),
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={deleteLoading || deleteSuccess}
                    style={{
                      width: "100%", padding: "12px 0", borderRadius: 10,
                      border: "none", color: "#fff", fontSize: 14, fontWeight: 700,
                      background: deleteSuccess ? "#10b981" : "#dc2626",
                      cursor: deleteLoading || deleteSuccess ? "not-allowed" : "pointer",
                      opacity: deleteLoading ? 0.75 : 1, transition: "all 0.25s ease",
                      fontFamily: typography.family,
                      boxShadow: deleteSuccess ? "none" : "0 10px 24px rgba(220,38,38,0.24)",
                    }}
                  >
                    {deleteLoading ? "Eliminando cuenta..." : deleteSuccess ? "Cuenta eliminada" : "Eliminar mi cuenta"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ── Actions ────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingBottom: 80 }}>
            <button
              onClick={onSkip}
              className="skip-link"
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 14, color: dmSub, fontFamily: typography.family,
                fontWeight: 500, padding: 0,
              }}
            >
              Completar después →
            </button>
            <button
              className="save-btn-main"
              onClick={handleSave}
              disabled={saving || success}
              style={{
                padding: "14px 40px", fontSize: 15, fontWeight: 700,
                color: "#fff", background: TEAL,
                border: "none", borderRadius: 12,
                cursor: "pointer", fontFamily: typography.family,
                boxShadow: `0 4px 14px ${TEAL}40`,
                minWidth: 180,
              }}
            >
              {saving ? "Guardando..." : success ? "✓ Guardado" : "Guardar perfil"}
            </button>
          </div>

        </section>
      </div>

      {/* ── Floating save bar ────────────────────────────────────────────── */}
      {hasChanges && !success && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          backgroundColor: dm ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${dmBorder}`,
          borderRadius: 14, padding: "10px 24px",
          display: "flex", alignItems: "center", gap: 16,
          zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", whiteSpace: "nowrap",
        }}>
          <span style={{ fontSize: 13, color: "#d97706", fontWeight: 600, fontFamily: typography.family }}>
            ● Cambios sin guardar
          </span>
          <button
            className="save-btn-main"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 28px", fontSize: 14, fontWeight: 700,
              color: "#fff", background: TEAL,
              border: "none", borderRadius: 50,
              cursor: "pointer", fontFamily: typography.family,
              boxShadow: `0 2px 10px ${TEAL}40`,
            }}
          >
            Guardar perfil
          </button>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#f8f9fc",
    fontFamily: typography.family,
  },
  layout: {
    display: "flex",
    gap: 32,
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px",
    alignItems: "flex-start",
  },
  sidebar: {
    width: 260,
    flexShrink: 0,
    position: "sticky",
    top: 80,
    alignSelf: "flex-start",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    border: "1px solid #e8ecf1",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    padding: 24,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    borderLeft: `4px solid ${TEAL}`,
    paddingLeft: 12,
    fontFamily: typography.family,
    letterSpacing: "-0.01em",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 14px",
    fontSize: 14,
    borderRadius: 10,
    border: "1.5px solid #d1d5db",
    backgroundColor: "#fff",
    fontFamily: "inherit",
    color: "#111827",
    outline: "none",
    marginBottom: 12,
    transition: `border-color ${transition.fast}`,
  },
  feedbackBox: {
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 16,
    border: "1px solid",
    fontFamily: typography.family,
  },
};
