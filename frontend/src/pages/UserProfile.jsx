import { useState, useEffect, useMemo, useRef } from "react";
import {
  getUserProfile, updateUserProfile, changePassword, deleteAccount,
} from "../services/api";
import { pageTokens } from "../constants/theme";

const DELETE_ACCOUNT_CONFIRMATION = "ELIMINAR";

/* ---------------------------------------------------------------------------
 * Tokens
 * ------------------------------------------------------------------------- */
function useTokens(darkMode, density) {
  return useMemo(() => pageTokens(darkMode, density), [darkMode, density]);
}

function useHover() {
  const [h, s] = useState(false);
  return [h, { onMouseEnter: () => s(true), onMouseLeave: () => s(false) }];
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */
function getLangCode(name) {
  const n = (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("ingl"))                       return "EN";
  if (n.includes("espa") || n.includes("cast")) return "ES";
  if (n.includes("franc"))                      return "FR";
  if (n.includes("alem"))                       return "DE";
  if (n.includes("ital"))                       return "IT";
  if (n.includes("port"))                       return "PT";
  if (n.includes("chin") || n.includes("mand")) return "ZH";
  if (n.includes("japon"))                      return "JA";
  if (n.includes("arab"))                       return "AR";
  if (n.includes("rus"))                        return "RU";
  return (name || "??").slice(0, 2).toUpperCase();
}

function computeCompletion(p) {
  if (!p) return 0;
  return Math.round(
    [
      (p.stack || []).length > 0,
      p.anos_experiencia != null && p.anos_experiencia !== "",
      (p.idiomas || []).filter(l => l.idioma?.trim()).length > 0,
      (p.ubicaciones || []).length > 0,
      (p.modalidad || []).length > 0,
    ].filter(Boolean).length / 5 * 100
  );
}

/* ---------------------------------------------------------------------------
 * Iconos SVG
 * ------------------------------------------------------------------------- */
const Icon = ({ name, size = 16 }) => {
  const c = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "block", flexShrink: 0 },
  };
  switch (name) {
    case "user":      return <svg {...c}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case "code":      return <svg {...c}><path d="M8 6L2 12l6 6M16 6l6 6-6 6"/></svg>;
    case "briefcase": return <svg {...c}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>;
    case "sliders":   return <svg {...c}><path d="M4 6h12M4 12h6M4 18h10M19 4v4M14 10v4M17 16v4"/></svg>;
    case "bell":      return <svg {...c}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>;
    case "shield":    return <svg {...c}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>;
    case "pin":       return <svg {...c}><path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "mail":      return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
    case "edit":      return <svg {...c}><path d="M14 4l6 6L10 20H4v-6L14 4z"/></svg>;
    case "check":     return <svg {...c}><path d="M5 12l5 5 9-11"/></svg>;
    case "plus":      return <svg {...c}><path d="M12 5v14M5 12h14"/></svg>;
    case "x":         return <svg {...c}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case "search":    return <svg {...c}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>;
    case "sparkle":   return <svg {...c}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M18.5 5.5l-2.8 2.8M8.3 15.7l-2.8 2.8"/></svg>;
    case "home":      return <svg {...c}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z"/></svg>;
    case "building":  return <svg {...c}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>;
    case "laptop":    return <svg {...c}><rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M2 21h20"/></svg>;
    case "globe":     return <svg {...c}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case "chevron":   return <svg {...c}><path d="M6 9l6 6 6-6"/></svg>;
    case "arrow":     return <svg {...c}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "eye":       return <svg {...c}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "eye-off":   return <svg {...c}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
    case "trash":     return <svg {...c}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>;
    default: return null;
  }
};

/* ---------------------------------------------------------------------------
 * Sidebar
 * ------------------------------------------------------------------------- */
const SIDEBAR_ITEMS = [
  { id: "info",     label: "Información personal",    icon: "user" },
  { id: "stack",    label: "Stack Tecnológico",       icon: "code" },
  { id: "exp",      label: "Experiencia e Idiomas",   icon: "briefcase" },
  { id: "prefs",    label: "Preferencias de Trabajo", icon: "sliders" },
  { id: "security", label: "Seguridad",               icon: "shield" },
];

function Sidebar({ t, active, onSelect }) {
  return (
    <nav style={{
      position: "sticky", top: 76, alignSelf: "start",
      display: "flex", flexDirection: "column", gap: 2,
      padding: 8, background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: t.radius, fontFamily: t.font,
    }}>
      {SIDEBAR_ITEMS.map(it => (
        <SidebarItem key={it.id} t={t} item={it} active={active === it.id}
          onClick={() => onSelect(it.id)}/>
      ))}
    </nav>
  );
}

function SidebarItem({ t, item, active, onClick }) {
  const [hover, hp] = useHover();
  return (
    <button type="button" onClick={onClick} {...hp} style={{
      all: "unset", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 11px", borderRadius: 8,
      fontSize: 13, fontWeight: active ? 700 : 500,
      color: active ? t.teal : (hover ? t.text : t.textSub),
      background: active ? t.tealSoft : (hover ? t.surface2 : "transparent"),
      transition: "background .12s, color .12s", fontFamily: t.font,
    }}>
      <Icon name={item.icon} size={15}/>
      <span style={{ flex: 1 }}>{item.label}</span>
      {active && <span style={{ width: 4, height: 4, borderRadius: 999, background: t.teal }}/>}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * ProfileHeader
 * ------------------------------------------------------------------------- */
function ProfileHeader({ t, profile }) {
  const initial = (profile.alias || "?").slice(0, 1).toUpperCase();
  const completion = profile.completion ?? 0;
  return (
    <section style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius,
      padding: t.padLg, display: "flex", flexDirection: "column", gap: 18, fontFamily: t.font,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 999, flexShrink: 0,
          background: "linear-gradient(135deg,#00758A 0%,#7c3aed 100%)",
          color: "#fff", fontSize: 28, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: "-0.01em" }}>
            {profile.alias}
          </h2>
          {profile.role && (
            <div style={{ marginTop: 4, fontSize: 13, color: t.textSub, fontWeight: 600 }}>
              {profile.role}
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: t.textMute, fontWeight: 500 }}>
            {profile.location && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="pin" size={12}/>{profile.location}
              </span>
            )}
            {profile.email && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="mail" size={12}/>{profile.email}
              </span>
            )}
          </div>
        </div>
      </div>
      <div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 11, fontWeight: 700, marginBottom: 6,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <span style={{ color: t.textMute }}>Perfil completado</span>
          <span style={{ color: completion >= 100 ? t.green : t.teal }}>{completion}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: t.border, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${completion}%`,
            background: completion >= 100 ? t.green : t.teal,
            borderRadius: 999, transition: "width .4s ease",
          }}/>
        </div>
        {completion >= 100 && (
          <div style={{ marginTop: 10, fontSize: 12, color: t.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="check" size={13}/> Perfil completo — el análisis IA será más preciso.
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * SectionCard (anchorable)
 * ------------------------------------------------------------------------- */
function SectionCard({ t, id, title, eyebrow, action, children, anchor }) {
  return (
    <section ref={anchor} id={id} style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius,
      padding: t.padLg, fontFamily: t.font, scrollMarginTop: 80,
    }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, marginBottom: 16,
      }}>
        <div>
          {eyebrow && <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            color: t.textMute, textTransform: "uppercase", marginBottom: 4,
          }}>{eyebrow}</div>}
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 800, color: t.text,
            letterSpacing: "-0.005em", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 3, height: 14, borderRadius: 2, background: t.teal }}/>
            {title}
          </h3>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * StackChip
 * ------------------------------------------------------------------------- */
function StackChip({ t, name, onRemove }) {
  const [hover, hp] = useHover();
  return (
    <span {...hp} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 5px 5px 11px", borderRadius: 999,
      background: hover ? t.tealSoft : (t._dm ? "rgba(0,117,138,0.12)" : "#eaf6f8"),
      border: `1px solid ${hover ? t.tealLine : (t._dm ? "rgba(0,117,138,0.22)" : "#cce6ec")}`,
      fontSize: 12, fontWeight: 700, color: t.teal,
      transition: "background .15s, border-color .15s",
    }}>
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} style={{
          all: "unset", cursor: "pointer", width: 18, height: 18, borderRadius: 999,
          color: t.teal, opacity: 0.7,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}><Icon name="x" size={11}/></button>
      )}
    </span>
  );
}

function SuggestChip({ t, name, selected, onClick }) {
  const [hover, hp] = useHover();
  return (
    <button type="button" onClick={onClick} {...hp} style={{
      all: "unset", cursor: "pointer",
      padding: "5px 11px", borderRadius: 999,
      background: selected ? t.tealSoft : (hover ? t.surface2 : "transparent"),
      border: `1px solid ${selected ? t.tealLine : t.border}`,
      fontSize: 12, fontWeight: selected ? 700 : 600,
      color: selected ? t.teal : t.text,
      transition: "background .12s, border-color .12s",
    }}>{name}</button>
  );
}

/* ---------------------------------------------------------------------------
 * ModalityCard
 * ------------------------------------------------------------------------- */
function ModalityCard({ t, icon, label, selected, onClick }) {
  const [hover, hp] = useHover();
  return (
    <button type="button" onClick={onClick} {...hp} style={{
      all: "unset", cursor: "pointer", flex: 1, minWidth: 140,
      padding: "20px 16px", borderRadius: t.radius, textAlign: "center",
      background: selected ? t.teal : (hover ? t.surface2 : t.surface),
      border: `1.5px solid ${selected ? t.teal : t.border}`,
      color: selected ? "#fff" : t.text,
      transition: "background .15s, border-color .15s, transform .15s",
      transform: hover && !selected ? "translateY(-1px)" : "none",
      fontFamily: t.font, display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
    }}>
      <Icon name={icon} size={20}/>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
      {selected && (
        <div style={{
          fontSize: 10, fontWeight: 700, opacity: 0.85, letterSpacing: "0.06em",
          textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <Icon name="check" size={11}/> Seleccionado
        </div>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * LocationPill
 * ------------------------------------------------------------------------- */
function LocationPill({ t, name, selected, onClick }) {
  const [hover, hp] = useHover();
  return (
    <button type="button" onClick={onClick} {...hp} style={{
      all: "unset", cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "6px 12px", borderRadius: 999,
      background: selected ? t.tealSoft : (hover ? t.surface2 : t.surface),
      border: `1px solid ${selected ? t.tealLine : t.border}`,
      fontSize: 12, fontWeight: selected ? 700 : 600,
      color: selected ? t.teal : t.text,
      transition: "background .12s, border-color .12s", fontFamily: t.font,
    }}>
      <Icon name="pin" size={11}/>{name}
      {selected && <Icon name="check" size={11}/>}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * PasswordField
 * ------------------------------------------------------------------------- */
function PasswordField({ t, placeholder, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "10px 40px 10px 12px", boxSizing: "border-box",
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: 8, fontSize: 13, color: t.text, fontWeight: 500,
          outline: "none", fontFamily: t.font,
        }}
      />
      <button type="button" onClick={() => setShow(s => !s)} style={{
        all: "unset", cursor: "pointer", position: "absolute", right: 10, top: "50%",
        transform: "translateY(-50%)", color: t.textMute, display: "flex",
      }}>
        <Icon name={show ? "eye-off" : "eye"} size={14}/>
      </button>
    </div>
  );
}

/* ===========================================================================
 * MAIN — UserProfile (MiPerfil)
 * ========================================================================= */
export default function UserProfile({
  onProfileSaved,
  onAccountDeleted,
  onSkip,
  addToast = () => {},
  darkMode = false,
  density = "normal",
}) {
  const t = useTokens(darkMode, density);

  // ── Loading ────────────────────────────────────────────────────────────────
  const [pageLoading, setPageLoading] = useState(true);

  // ── Core profile fields (match API format exactly) ─────────────────────────
  const [email,      setEmail]      = useState("");
  const [alias,      setAlias]      = useState("");
  const [stack,      setStack]      = useState([]);
  const [stackYears, setStackYears] = useState({});
  const [experience, setExperience] = useState(0);
  const [idiomas,    setIdiomas]    = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [modalidad,  setModalidad]  = useState([]);
  const [saving,     setSaving]     = useState(false);

  // ── Stack search ──────────────────────────────────────────────────────────
  const [stackQuery, setStackQuery] = useState("");

  // ── Password change ────────────────────────────────────────────────────────
  const [pwOpen,      setPwOpen]      = useState(false);
  const [currentPw,   setCurrentPw]   = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [pwLoading,   setPwLoading]   = useState(false);
  const [pwError,     setPwError]     = useState(null);

  // ── Account deletion ──────────────────────────────────────────────────────
  const [deleteOpen,        setDeleteOpen]        = useState(false);
  const [deleteCurrentPw,   setDeleteCurrentPw]   = useState("");
  const [deleteConfirm,     setDeleteConfirm]     = useState("");
  const [deleteLoading,     setDeleteLoading]     = useState(false);
  const [deleteError,       setDeleteError]       = useState(null);

  // ── Sidebar scroll tracking ───────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState("info");
  const refs = {
    info:     useRef(null),
    stack:    useRef(null),
    exp:      useRef(null),
    prefs:    useRef(null),
    security: useRef(null),
  };

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [data] = await Promise.allSettled([
          getUserProfile(),
        ]);
        if (cancelled) return;
        if (data.status === "fulfilled") {
          const d = data.value;
          setEmail(d.email || "");
          setAlias(d.alias || d.email?.split("@")[0] || "");
          if (d.stack?.length)       setStack(d.stack);
          if (d.stack_years)         setStackYears(d.stack_years);
          if (d.anos_experiencia != null) setExperience(Number(d.anos_experiencia) || 0);
          if (d.idiomas?.length)     setIdiomas(d.idiomas);
          if (d.ubicaciones?.length) setUbicaciones(d.ubicaciones);
          if (d.modalidad?.length)   setModalidad(d.modalidad);
        }
      } catch { /* keep defaults */ }
      finally {
        if (!cancelled) setPageLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Scroll tracking ───────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY + 120;
      const order = ["security", "prefs", "exp", "stack", "info"];
      for (const id of order) {
        const el = refs[id].current;
        if (el && el.offsetTop <= y) { setActiveSection(id); break; }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(id) {
    setActiveSection(id);
    const el = refs[id].current;
    if (el) window.scrollTo({ top: el.offsetTop - 76, behavior: "smooth" });
  }

  // ── Derived profile data ──────────────────────────────────────────────────
  const completion = useMemo(() => computeCompletion({
    stack, anos_experiencia: experience || null,
    idiomas, ubicaciones, modalidad,
  }), [stack, experience, idiomas, ubicaciones, modalidad]);

  const profileHeader = {
    alias,
    email,
    role: stack.slice(0, 3).join(" · ") || "",
    location: ubicaciones[0] ? `${ubicaciones[0]}, España` : "España",
    completion,
  };

  // ── Modalidad helpers ─────────────────────────────────────────────────────
  const modality = {
    presencial: modalidad.some(m => m.toLowerCase() === "presencial"),
    hibrido:    modalidad.some(m => ["híbrido","hibrido"].includes(m.toLowerCase())),
    remoto:     modalidad.some(m => m.toLowerCase() === "remoto"),
  };

  function toggleModality(key) {
    const labels = { presencial: "Presencial", hibrido: "Híbrido", remoto: "Remoto" };
    const label = labels[key];
    if (modalidad.some(m => m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"") === label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""))) {
      setModalidad(prev => prev.filter(m => m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"") !== label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")));
    } else {
      setModalidad(prev => [...prev, label]);
    }
  }

  // ── Stack helpers ─────────────────────────────────────────────────────────
  const SUGGESTIONS = [
    "JavaScript","TypeScript","Python","React","Vue","Angular","Node.js",
    "Express","FastAPI","Django","Flask","PostgreSQL","MongoDB","Redis",
    "Docker","Kubernetes","AWS","Azure","GCP","Git","GraphQL","REST APIs",
    "Java","C#","PHP","Ruby","Swift","Kotlin","Rust","Go","SQL","Power BI",
  ];
  const filteredSugg = useMemo(() => {
    const q = stackQuery.toLowerCase();
    return SUGGESTIONS.filter(s => !stack.includes(s) && (q === "" || s.toLowerCase().includes(q)));
  }, [stackQuery, stack]);

  function toggleStack(name) {
    const has = stack.includes(name);
    if (has) {
      setStack(prev => prev.filter(s => s !== name));
      setStackYears(prev => { const n = { ...prev }; delete n[name]; return n; });
    } else {
      setStack(prev => [...prev, name]);
      setStackYears(prev => prev[name] != null ? prev : { ...prev, [name]: 1 });
    }
  }

  function setStackYear(name, v) {
    setStackYears(prev => ({ ...prev, [name]: Number(v) }));
  }

  // ── Idiomas helpers ────────────────────────────────────────────────────────
  const languages = useMemo(() => idiomas.map(l => ({
    code:  getLangCode(l.idioma),
    name:  l.idioma,
    level: (l.nivel || "intermedio").toUpperCase(),
    raw:   l,
  })), [idiomas]);

  function addLanguage() {
    setIdiomas(prev => [...prev, { idioma: "Inglés", nivel: "intermedio" }]);
  }

  function removeLanguage(i) {
    setIdiomas(prev => prev.filter((_, j) => j !== i));
  }

  // ── Locations ─────────────────────────────────────────────────────────────
  const ALL_LOCATIONS = [
    "Madrid","Barcelona","Valencia","Sevilla","Bilbao",
    "Málaga","Zaragoza","Murcia","Alicante","Valladolid","A Coruña","Granada",
  ];
  const SPAIN = "Toda España";

  function toggleLocation(loc) {
    if (loc === SPAIN) {
      setUbicaciones(prev => prev.includes(SPAIN) ? [] : [SPAIN]);
      return;
    }
    setUbicaciones(prev =>
      prev.includes(loc)
        ? prev.filter(x => x !== loc)
        : [...prev.filter(x => x !== SPAIN), loc]
    );
  }

  // ── Save profile ──────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      await updateUserProfile({
        stack,
        anos_experiencia: String(experience),
        idiomas: idiomas.filter(l => l.idioma?.trim()),
        ubicaciones,
        modalidad,
        stack_years: stackYears,
      });
      addToast?.("Perfil actualizado correctamente", "success");
      setTimeout(() => onProfileSaved?.(), 900);
    } catch (err) {
      addToast?.(err.message || "Error al guardar el perfil", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError(null);
    if (newPw.length < 8)      { setPwError("Mínimo 8 caracteres"); return; }
    if (newPw !== confirmPw)   { setPwError("Las contraseñas no coinciden"); return; }
    if (newPw === currentPw)   { setPwError("La nueva contraseña debe ser diferente"); return; }
    setPwLoading(true);
    try {
      await changePassword(currentPw, newPw);
      addToast?.("Contraseña actualizada correctamente", "success");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwOpen(false);
    } catch (err) {
      setPwError(err.message || "Error al cambiar contraseña");
    } finally {
      setPwLoading(false);
    }
  }

  // ── Delete account ────────────────────────────────────────────────────────
  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleteError(null);
    if (!deleteCurrentPw.trim()) {
      setDeleteError("Introduce tu contraseña actual para confirmar");
      return;
    }
    if (deleteConfirm.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION) {
      setDeleteError(`Escribe '${DELETE_ACCOUNT_CONFIRMATION}' para confirmar`);
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteAccount(deleteCurrentPw, deleteConfirm.trim());
      addToast?.("Cuenta eliminada correctamente", "success");
      setTimeout(() => onAccountDeleted?.(), 700);
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar la cuenta");
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div style={{
        minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: t.bg, fontFamily: t.font,
      }}>
        <style>{`@keyframes jm-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `3px solid ${t.border}`, borderTopColor: t.teal,
            animation: "jm-spin 0.8s linear infinite", margin: "0 auto 16px",
          }}/>
          <p style={{ fontSize: 13, color: t.textSub, margin: 0 }}>Cargando perfil…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: t.bg, color: t.text,
      fontFamily: t.font,
      WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale",
    }}>
      <main style={{
        maxWidth: 1280, margin: "0 auto",
        padding: `${density === "compacta" ? 24 : 36}px 28px ${density === "compacta" ? 36 : 64}px`,
      }}>
        {/* HERO */}
        <section style={{ marginBottom: density === "compacta" ? 20 : 28 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: t.text, lineHeight: 1.15 }}>
            Mi perfil
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: t.textSub, fontWeight: 500 }}>
            Configura tu stack, experiencia y preferencias para que el matching sea más preciso.
          </p>
        </section>

        {/* Estado del perfil — completitud + impacto en el matching */}
        {(() => {
          const checks = [
            { ok: stack.length > 0, label: "Stack tecnológico", impact: "El matching compara tus skills con las que pide cada oferta." },
            { ok: Number(experience) > 0, label: "Años de experiencia", impact: "Ajusta el encaje al seniority que pide la oferta." },
            { ok: (idiomas || []).filter(l => l.idioma?.trim()).length > 0, label: "Idiomas", impact: "Detecta requisitos de idioma como cumplidos o bloqueantes." },
            { ok: (ubicaciones || []).length > 0, label: "Ubicaciones", impact: "Prioriza ofertas en tus zonas y permite filtrar por ubicación." },
            { ok: (modalidad || []).length > 0, label: "Modalidad", impact: "Alinea remoto / híbrido / presencial con lo que ofrece la empresa." },
          ];
          const done = checks.filter(c => c.ok).length;
          const pct = Math.round((done / checks.length) * 100);
          const missing = checks.filter(c => !c.ok);
          return (
            <section style={{
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius,
              padding: t.padLg, marginBottom: t.gapLg,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Estado de tu perfil</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? t.green : t.teal }}>{pct}% completo</div>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: t.border, overflow: "hidden", margin: "10px 0 14px" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? t.green : t.teal, borderRadius: 999, transition: "width .4s ease" }} />
              </div>
              {missing.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>
                  Tu perfil está completo. El matching usa toda esta información para puntuar y explicar cada oferta.
                </p>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.textMute, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Te falta por completar
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {missing.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span aria-hidden="true" style={{ color: t.teal, fontWeight: 800, marginTop: 1 }}>+</span>
                        <div>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{c.label}</span>
                          <span style={{ fontSize: 13, color: t.textSub }}> — {c.impact}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })()}

        {/* GRID: sidebar + contenido */}
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: t.gapLg, alignItems: "start" }}>
          <Sidebar t={t} active={activeSection} onSelect={scrollTo}/>

          <div style={{ display: "flex", flexDirection: "column", gap: t.gapLg }}>

            {/* ── Información personal ───────────────────────────────── */}
            <div ref={refs.info} id="info" style={{ scrollMarginTop: 80 }}>
              <ProfileHeader t={t} profile={profileHeader}/>
            </div>

            {/* ── Stack Tecnológico ───────────────────────────────────── */}
            <SectionCard t={t} title="Stack Tecnológico" eyebrow="Skills &amp; tools"
              anchor={refs.stack}
              action={<span style={{
                fontSize: 11, color: t.textMute, fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>{stack.length} tecnologías</span>}>

              {/* Current stack chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {stack.map(s => (
                  <StackChip key={s} t={t} name={s} onRemove={() => toggleStack(s)}/>
                ))}
                {stack.length === 0 && (
                  <span style={{
                    fontSize: 12, color: t.textMute, fontStyle: "italic",
                  }}>Añade tecnologías usando los chips de abajo</span>
                )}
              </div>

              {/* Search suggestions */}
              <div style={{ position: "relative", marginBottom: 12 }}>
                <span style={{
                  position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                  color: t.textMute, display: "flex",
                }}><Icon name="search" size={14}/></span>
                <input type="search" value={stackQuery} onChange={(e) => setStackQuery(e.target.value)}
                  placeholder="Busca React, Python, Node…"
                  style={{
                    width: "100%", padding: "10px 12px 10px 34px", boxSizing: "border-box",
                    background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8,
                    fontSize: 13, color: t.text, fontWeight: 500, outline: "none", fontFamily: t.font,
                  }}/>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {filteredSugg.slice(0, 24).map(s => (
                  <SuggestChip key={s} t={t} name={s}
                    selected={stack.includes(s)} onClick={() => toggleStack(s)}/>
                ))}
                {stackQuery.trim() &&
                  !stack.includes(stackQuery.trim()) &&
                  !SUGGESTIONS.some(s => s.toLowerCase() === stackQuery.trim().toLowerCase()) && (
                  <button
                    onClick={() => { toggleStack(stackQuery.trim()); setStackQuery(""); }}
                    style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: `1.5px dashed ${t.teal}`, background: "transparent", color: t.teal,
                      cursor: "pointer", fontFamily: t.font, transition: "all 0.15s ease",
                    }}
                  >
                    + Añadir "{stackQuery.trim()}"
                  </button>
                )}
              </div>

              {/* IA suggestion (purple) */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 14px", background: t.purpleSoft,
                border: `1px solid ${t._dm ? "rgba(124,58,237,0.30)" : "rgba(124,58,237,0.18)"}`,
                borderRadius: t.radiusSm, fontSize: 12, color: t.text, lineHeight: 1.5,
              }}>
                <span style={{ color: "#7c3aed", marginTop: 1, display: "flex" }}>
                  <Icon name="sparkle" size={14}/>
                </span>
                <div>
                  <strong style={{ color: "#7c3aed", fontWeight: 800 }}>Sugerencia IA · </strong>
                  Añade habilidades complementarias a tu stack para mejorar tu compatibilidad con más ofertas.
                </div>
              </div>
            </SectionCard>

            {/* ── Experiencia + Idiomas (2 cols) ───────────────────────── */}
            <div ref={refs.exp} id="exp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: t.gapLg, scrollMarginTop: 80 }}>

              {/* Años de experiencia */}
              <SectionCard t={t} title="Años de experiencia"
                action={<span style={{
                  fontSize: 11, color: t.textMute, fontWeight: 700,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}>Total + por stack</span>}>

                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                  <div style={{
                    fontSize: 48, fontWeight: 800, color: t.teal,
                    letterSpacing: "-0.04em", lineHeight: 1,
                  }}>{experience}</div>
                  <div style={{
                    fontSize: 12, color: t.textMute, fontWeight: 700,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>{experience === 1 ? "año total" : "años totales"}</div>
                </div>
                <input type="range" min="0" max="20" value={experience}
                  onChange={(e) => setExperience(Number(e.target.value))}
                  style={{ width: "100%", accentColor: t.teal }}/>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  marginTop: 6, fontSize: 11, color: t.textMute, fontWeight: 600,
                }}>
                  <span>0</span><span>10</span><span>20+</span>
                </div>

                {/* Por tecnología */}
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px dashed ${t.border}` }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 10,
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                      color: t.textMute, textTransform: "uppercase",
                    }}>Por tecnología</div>
                    <div style={{ fontSize: 11, color: t.textMute, fontWeight: 600 }}>
                      {stack.length} en tu stack
                    </div>
                  </div>
                  {stack.length === 0 ? (
                    <div style={{ fontSize: 12, color: t.textMute, fontStyle: "italic", padding: "10px 0" }}>
                      Añade tecnologías al Stack para indicar tu experiencia con cada una.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
                      {stack.map(name => {
                        const v = (stackYears[name] ?? 0);
                        return (
                          <div key={name} style={{
                            display: "grid", gridTemplateColumns: "90px 1fr 50px", gap: 10,
                            alignItems: "center", padding: "6px 10px",
                            background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8,
                          }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: t.text,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>{name}</span>
                            <input type="range" min="0" max="20" value={v}
                              onChange={(e) => setStackYear(name, e.target.value)}
                              style={{ width: "100%", accentColor: t.teal }}/>
                            <span style={{
                              fontSize: 12, fontWeight: 800, color: t.teal,
                              textAlign: "right", fontVariantNumeric: "tabular-nums",
                            }}>{v}{v >= 20 ? "+" : ""} {v === 1 ? "año" : "años"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Idiomas */}
              <SectionCard t={t} title="Idiomas"
                action={
                  <button type="button" onClick={addLanguage} style={{
                    all: "unset", cursor: "pointer", fontSize: 11, fontWeight: 700,
                    color: t.teal, letterSpacing: "0.04em", textTransform: "uppercase",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}><Icon name="plus" size={12}/>Añadir</button>
                }>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {languages.map((lang, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 12px", background: t.surface2,
                      border: `1px solid ${t.border}`, borderRadius: 8,
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: t.textMute,
                        letterSpacing: "0.06em", minWidth: 18,
                      }}>{lang.code}</span>
                      <select
                        value={lang.name}
                        onChange={(e) => {
                          setIdiomas(prev => prev.map((l, j) => j === i ? { ...l, idioma: e.target.value } : l));
                        }}
                        style={{
                          flex: 1, background: "transparent", border: "none", outline: "none",
                          fontSize: 13, fontWeight: 700, color: t.text, fontFamily: t.font, cursor: "pointer",
                        }}
                      >
                        {["Español","Inglés","Francés","Alemán","Italiano","Portugués","Chino","Japonés","Árabe","Ruso"].map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <select
                        value={lang.raw.nivel}
                        onChange={(e) => {
                          setIdiomas(prev => prev.map((l, j) => j === i ? { ...l, nivel: e.target.value } : l));
                        }}
                        style={{
                          background: t.tealSoft, border: `1px solid ${t.tealLine}`, borderRadius: 999,
                          padding: "3px 8px", fontSize: 10, fontWeight: 800, color: t.teal,
                          fontFamily: t.font, outline: "none", cursor: "pointer", letterSpacing: "0.04em",
                        }}
                      >
                        {[["basico","BÁSICO"],["intermedio","INTERMEDIO"],["avanzado","AVANZADO"],["nativo","NATIVO"]].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeLanguage(i)} style={{
                        all: "unset", cursor: "pointer", color: t.textMute, padding: 2, display: "inline-flex",
                      }}><Icon name="x" size={12}/></button>
                    </div>
                  ))}
                  {languages.length === 0 && (
                    <div style={{ fontSize: 12, color: t.textMute, fontStyle: "italic" }}>
                      Pulsa "Añadir" para incluir tus idiomas.
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* ── Preferencias de Trabajo ─────────────────────────────── */}
            <SectionCard t={t} title="Preferencias de Trabajo" anchor={refs.prefs}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                color: t.textMute, textTransform: "uppercase", marginBottom: 10,
              }}>Modalidad de contrato</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
                <ModalityCard t={t} icon="building" label="Presencial"
                  selected={modality.presencial} onClick={() => toggleModality("presencial")}/>
                <ModalityCard t={t} icon="laptop" label="Híbrido"
                  selected={modality.hibrido} onClick={() => toggleModality("hibrido")}/>
                <ModalityCard t={t} icon="home" label="Remoto"
                  selected={modality.remoto} onClick={() => toggleModality("remoto")}/>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.textMute, textTransform: "uppercase" }}>
                  Ubicación preferida
                </span>
                <button type="button" onClick={() => setUbicaciones([])} style={{
                  all: "unset", cursor: "pointer", fontSize: 11, fontWeight: 700,
                  color: t.teal, letterSpacing: "0.04em", textTransform: "uppercase",
                }}>Limpiar</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALL_LOCATIONS.map(loc => (
                  <LocationPill key={loc} t={t} name={loc}
                    selected={ubicaciones.includes(loc)}
                    onClick={() => toggleLocation(loc)}/>
                ))}
                <span style={{ width: 1, alignSelf: "stretch", background: t.border, margin: "0 4px" }}/>
                <LocationPill t={t} name="Toda España"
                  selected={ubicaciones.includes(SPAIN)}
                  onClick={() => toggleLocation(SPAIN)}/>
              </div>
            </SectionCard>

            {/* ── Seguridad ────────────────────────────────────────────── */}
            <SectionCard t={t} title="Seguridad" anchor={refs.security}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Cambiar contraseña */}
                <div style={{
                  border: `1px solid ${t.border}`, borderRadius: t.radius, overflow: "hidden",
                }}>
                  <button type="button" onClick={() => setPwOpen(o => !o)} style={{
                    all: "unset", cursor: "pointer", width: "100%",
                    padding: "14px 18px", display: "flex", alignItems: "center",
                    justifyContent: "space-between", boxSizing: "border-box", fontFamily: t.font,
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: t.text }}>
                      <Icon name="shield" size={15}/>Cambiar contraseña
                    </span>
                    <span style={{ color: t.textMute, transform: pwOpen ? "rotate(180deg)" : "none", transition: "transform .2s", display: "inline-flex" }}>
                      <Icon name="chevron" size={14}/>
                    </span>
                  </button>
                  {pwOpen && (
                    <form onSubmit={handleChangePassword} style={{ padding: "0 18px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                        <PasswordField t={t} placeholder="Contraseña actual" value={currentPw} onChange={setCurrentPw}/>
                        <PasswordField t={t} placeholder="Nueva contraseña" value={newPw} onChange={setNewPw}/>
                        <PasswordField t={t} placeholder="Confirmar contraseña" value={confirmPw} onChange={setConfirmPw}/>
                        {pwError && (
                          <p style={{ margin: 0, fontSize: 12, color: t.red, fontWeight: 600 }}>{pwError}</p>
                        )}
                        <button type="submit" disabled={pwLoading} style={{
                          all: "unset", cursor: pwLoading ? "default" : "pointer",
                          alignSelf: "flex-start", marginTop: 4,
                          padding: "8px 16px", borderRadius: 8,
                          background: pwLoading ? t.border : t.teal, color: pwLoading ? t.textMute : "#fff",
                          fontSize: 12, fontWeight: 700, fontFamily: t.font,
                        }}>
                          {pwLoading ? "Actualizando…" : "Actualizar contraseña"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Eliminar cuenta */}
                <div style={{
                  border: `1px solid ${t._dm ? "rgba(239,68,68,0.30)" : "#fecaca"}`,
                  borderRadius: t.radius, background: t.redSoft, overflow: "hidden",
                }}>
                  <button type="button" onClick={() => setDeleteOpen(o => !o)} style={{
                    all: "unset", cursor: "pointer", width: "100%",
                    padding: "14px 18px", display: "flex", alignItems: "center",
                    justifyContent: "space-between", boxSizing: "border-box", fontFamily: t.font,
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: t.red }}>
                      <Icon name="trash" size={15}/>Eliminar cuenta
                    </span>
                    <span style={{ color: t.red, transform: deleteOpen ? "rotate(180deg)" : "none", transition: "transform .2s", display: "inline-flex" }}>
                      <Icon name="chevron" size={14}/>
                    </span>
                  </button>
                  {deleteOpen && (
                    <form onSubmit={handleDeleteAccount} style={{ padding: "0 18px 16px", fontSize: 12, color: t.textSub, lineHeight: 1.55 }}>
                      <p style={{ margin: "6px 0 12px" }}>
                        Esta acción elimina tu cuenta y también tus favoritos, historial y candidaturas.{" "}
                        <strong style={{ color: t.text }}>No se puede deshacer.</strong>
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <PasswordField t={t} placeholder="Contraseña actual" value={deleteCurrentPw} onChange={setDeleteCurrentPw}/>
                        <input
                          type="text"
                          placeholder={`Escribe ${DELETE_ACCOUNT_CONFIRMATION} para confirmar`}
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          style={{
                            padding: "10px 12px", background: t.surface, border: `1px solid ${t.border}`,
                            borderRadius: 8, fontSize: 13, color: t.text, fontWeight: 500,
                            outline: "none", fontFamily: t.font,
                          }}
                        />
                        {deleteError && (
                          <p style={{ margin: 0, fontSize: 12, color: t.red, fontWeight: 600 }}>{deleteError}</p>
                        )}
                        <button type="submit" disabled={deleteLoading} style={{
                          all: "unset", cursor: deleteLoading ? "default" : "pointer",
                          alignSelf: "flex-start",
                          padding: "8px 16px", borderRadius: 8,
                          background: deleteLoading ? t.border : t.red, color: deleteLoading ? t.textMute : "#fff",
                          fontSize: 12, fontWeight: 700, fontFamily: t.font,
                        }}>
                          {deleteLoading ? "Eliminando…" : "Eliminar mi cuenta"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* ── Footer actions ────────────────────────────────────────── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "4px 4px 12px",
            }}>
              <button type="button" onClick={() => onSkip?.() || (window.location.hash = "dashboard")} style={{
                all: "unset", cursor: "pointer", fontSize: 12, fontWeight: 600, color: t.textSub,
              }}>← Volver al inicio</button>
              <button type="button" onClick={handleSave} disabled={saving} style={{
                all: "unset", cursor: saving ? "default" : "pointer",
                padding: "12px 24px", borderRadius: 8,
                background: saving ? t.border : t.teal, color: saving ? t.textMute : "#fff",
                fontSize: 13, fontWeight: 700, fontFamily: t.font,
                display: "inline-flex", alignItems: "center", gap: 6,
                transition: "background .15s",
              }}>
                {saving ? "Guardando…" : "Guardar perfil"} {!saving && <Icon name="arrow" size={13}/>}
              </button>
            </div>

          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 900px) {
          .profile-sidebar-col { display: none !important; }
          .profile-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .exp-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
