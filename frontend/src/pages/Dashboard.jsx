import { useState, useEffect, useMemo } from "react";
import {
  getUserProfile, getFavorites, getApplications, getHistory, getAiQuota,
  getMarketAnalysis, getSkillsRoadmap, submitSearchSatisfaction,
} from "../services/api";
import { pageTokens } from "../constants/theme";

/* ---------------------------------------------------------------------------
 * Tokens — único sitio donde se calculan colores y espacios reactivos
 * ------------------------------------------------------------------------- */
function useTokens(darkMode, density) {
  return useMemo(() => pageTokens(darkMode, density), [darkMode, density]);
}

function useHover() {
  const [hover, setHover] = useState(false);
  return [hover, {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  }];
}

/* ---------------------------------------------------------------------------
 * Iconos SVG (1.6px stroke, currentColor)
 * ------------------------------------------------------------------------- */
const Icon = ({ name, size = 16, color = "currentColor" }) => {
  const c = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: 1.6,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "block", flexShrink: 0 },
  };
  switch (name) {
    case "star":    return <svg {...c}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/></svg>;
    case "clip":    return <svg {...c}><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4v2h6V4M8 10h8M8 14h6"/></svg>;
    case "search":  return <svg {...c}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>;
    case "sparkle": return <svg {...c}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M18.5 5.5l-2.8 2.8M8.3 15.7l-2.8 2.8"/></svg>;
    case "doc":     return <svg {...c}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>;
    case "bell":    return <svg {...c}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>;
    case "user":    return <svg {...c}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case "arrow":   return <svg {...c}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "chart":   return <svg {...c}><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>;
    case "plus":    return <svg {...c}><path d="M12 5v14M5 12h14"/></svg>;
    case "bulb":    return <svg {...c}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>;
    case "check":   return <svg {...c}><path d="M5 12l5 5 9-11"/></svg>;
    case "mic":     return <svg {...c}><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10a7 7 0 0 1-14 0M12 19v3M9 22h6"/></svg>;
    default:        return null;
  }
};

/* ---------------------------------------------------------------------------
 * MetricCard
 * ------------------------------------------------------------------------- */
function MetricCard({ t, value, label, sub, icon, accent = "teal", onClick }) {
  const [hover, hoverProps] = useHover();
  const accentColor = t[accent] || t.teal;
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      style={{
        all: "unset", cursor: onClick ? "pointer" : "default",
        display: "block",
        background: t.surface,
        border: `1px solid ${hover ? t.borderSt : t.border}`,
        borderRadius: t.radius,
        padding: t.pad,
        transition: "border-color .15s, transform .15s, box-shadow .15s",
        boxShadow: hover ? t.shadow : "none",
        transform: hover ? "translateY(-1px)" : "none",
        fontFamily: t.font,
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: t.pad, right: t.pad,
        width: 28, height: 28, borderRadius: 6,
        background: accent === "purple" ? t.purpleSoft : t.tealSoft,
        color: accentColor,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={14} color={accentColor}/>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, color: t.text,
        letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 12,
      }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: t.textMute, fontWeight: 500 }}>{sub}</div>
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * SkillChip — skill faltante con botón "añadir al perfil" (purple = IA)
 * ------------------------------------------------------------------------- */
function SkillChip({ t, name, pct, onAdd }) {
  const [hover, hoverProps] = useHover();
  return (
    <span {...hoverProps} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "5px 5px 5px 11px", borderRadius: 999,
      background: hover ? t.purpleSoft : (t._dm ? "rgba(124,58,237,0.10)" : "#faf7ff"),
      border: `1px solid ${hover ? "rgba(124,58,237,0.35)" : (t._dm ? "rgba(124,58,237,0.25)" : "#ede4ff")}`,
      fontSize: 12, fontWeight: 600, color: t.text,
      transition: "background .15s, border-color .15s",
    }}>
      <span>{name}</span>
      <span style={{ color: t.textSub, fontWeight: 500 }}>{pct}%</span>
      <button type="button" onClick={onAdd} style={{
        all: "unset", cursor: "pointer",
        width: 20, height: 20, borderRadius: 999,
        background: t.purple, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="plus" size={11} color="#fff"/>
      </button>
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * SkillBar — barra horizontal de demanda de skills
 * ------------------------------------------------------------------------- */
function SkillBar({ t, name, pct, owned }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "90px 1fr 40px",
      alignItems: "center", gap: 12, padding: "6px 0",
    }}>
      <div style={{
        fontSize: 13, fontWeight: owned ? 700 : 500,
        color: owned ? t.teal : t.textSub,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {owned && (
          <span style={{
            width: 14, height: 14, borderRadius: 999,
            background: t.tealSoft, color: t.teal,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 9,
          }}>✓</span>
        )}
        {name}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: t.border, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: owned ? t.teal : (t._dm ? "#334155" : "#cbd5e1"),
          borderRadius: 999, transition: "width .4s ease",
        }}/>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.textSub, textAlign: "right" }}>{pct}%</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * QuickAction — fila de acción rápida
 * ------------------------------------------------------------------------- */
function QuickAction({ t, icon, title, sub, onClick, accent = "teal" }) {
  const [hover, hoverProps] = useHover();
  const accentColor = accent === "purple" ? t.purple : t.teal;
  const accentSoft  = accent === "purple" ? t.purpleSoft : t.tealSoft;
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      style={{
        all: "unset", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        padding: t.pad - 4,
        background: t.surface,
        border: `1px solid ${hover ? t.borderSt : t.border}`,
        borderRadius: t.radius,
        transition: "border-color .15s, background .15s, transform .15s",
        transform: hover ? "translateX(2px)" : "none",
        fontFamily: t.font,
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: accentSoft, color: accentColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon name={icon} size={16} color={accentColor}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>{title}</div>
        <div style={{
          fontSize: 11, color: t.textMute, fontWeight: 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{sub}</div>
      </div>
      <div style={{
        color: hover ? accentColor : t.textMute,
        transition: "color .15s, transform .15s",
        transform: hover ? "translateX(2px)" : "none",
      }}>
        <Icon name="arrow" size={14}/>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * SearchHistoryRow — fila de últimas búsquedas
 * ------------------------------------------------------------------------- */
function SearchHistoryRow({ t, item, onClick }) {
  const [hover, hoverProps] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      style={{
        all: "unset", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "14px 16px",
        background: hover ? t.surface2 : "transparent",
        borderTop: `1px solid ${t.border}`,
        transition: "background .12s",
        fontFamily: t.font,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 2 }}>{item.title}</div>
        <div style={{ fontSize: 11, color: t.textMute, fontWeight: 500 }}>{item.date}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {item.aplica > 0 && <Pill t={t} variant="green">{item.aplica} aplica</Pill>}
        {item.quiza  > 0 && <Pill t={t} variant="amber">{item.quiza} quizá</Pill>}
        {item.no     > 0 && <Pill t={t} variant="red">{item.no} no encaja</Pill>}
      </div>
    </button>
  );
}

function Pill({ t, variant, children }) {
  const map = {
    green: { bg: t.greenSoft, fg: "#047857" },
    amber: { bg: t.amberSoft, fg: "#b45309" },
    red:   { bg: t.redSoft,   fg: "#b91c1c" },
  };
  const c = map[variant] || map.green;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 999,
      background: c.bg, color: t._dm ? "#fff" : c.fg,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.01em",
    }}>{children}</span>
  );
}

/* ---------------------------------------------------------------------------
 * Section — card con título y borde
 * ------------------------------------------------------------------------- */
function Section({ t, title, eyebrow, action, children, padding = true }) {
  return (
    <section style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: t.radius,
      overflow: "hidden",
    }}>
      {(title || eyebrow) && (
        <header style={{
          padding: `${t.pad}px ${t.padLg}px`,
          borderBottom: padding ? `1px solid ${t.border}` : "none",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            {eyebrow && <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              color: t.textMute, textTransform: "uppercase", marginBottom: 4,
            }}>{eyebrow}</div>}
            {title && <div style={{
              fontSize: 15, fontWeight: 800, color: t.text, letterSpacing: "-0.005em",
            }}>{title}</div>}
          </div>
          {action}
        </header>
      )}
      <div style={padding ? { padding: t.padLg } : null}>{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * InterviewBanner — card destacada de la feature de entrevista
 * ------------------------------------------------------------------------- */
function InterviewBanner({ t, onClick }) {
  const [hover, hoverProps] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      style={{
        all: "unset", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 20,
        padding: `${t.pad}px ${t.padLg}px`,
        marginBottom: t.gapLg,
        borderRadius: t.radius,
        background: t._dm
          ? `linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(109,40,217,0.12) 100%)`
          : `linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)`,
        border: `1px solid ${hover
          ? (t._dm ? "rgba(124,58,237,0.55)" : "rgba(124,58,237,0.40)")
          : (t._dm ? "rgba(124,58,237,0.30)" : "rgba(124,58,237,0.22)")}`,
        boxShadow: hover
          ? (t._dm ? "0 4px 24px rgba(124,58,237,0.18)" : "0 4px 20px rgba(124,58,237,0.12)")
          : "none",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
        transform: hover ? "translateY(-1px)" : "none",
        fontFamily: t.font,
        textAlign: "left",
        width: "100%", boxSizing: "border-box",
      }}
    >
      {/* Icono */}
      <div style={{
        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
        background: t._dm ? "rgba(124,58,237,0.25)" : "rgba(124,58,237,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="mic" size={22} color={t.purple}/>
      </div>

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: t._dm ? "#c4b5fd" : "#5b21b6" }}>
            Simula tu entrevista con IA
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
            padding: "2px 7px", borderRadius: 999,
            background: t.purple, color: "#fff",
          }}>NUEVO</span>
        </div>
        <div style={{ fontSize: 12, color: t._dm ? "#a78bfa" : "#7c3aed", fontWeight: 500, opacity: 0.85 }}>
          Practica con un entrevistador IA personalizado para cada candidatura. Responde en voz o texto y recibe feedback real.
        </div>
      </div>

      {/* Flecha */}
      <div style={{
        color: hover ? t.purple : t.textMute,
        transition: "color .15s, transform .15s",
        transform: hover ? "translateX(3px)" : "none",
        flexShrink: 0,
      }}>
        <Icon name="arrow" size={16}/>
      </div>
    </button>
  );
}

/* ===========================================================================
 * MAIN — Dashboard
 * ========================================================================= */
export default function Dashboard({ darkMode = false, addToast = () => {}, onNavigate = () => {}, onRepeatSearch = null, density = "normal" }) {
  const t = useTokens(darkMode, density);

  const [profile,      setProfile]      = useState(null);
  const [favorites,    setFavorites]    = useState([]);
  const [applications, setApplications] = useState([]);
  const [history,      setHistory]      = useState([]);
  const [quota,        setQuota]        = useState(null);
  const [market,       setMarket]       = useState(null);
  const [marketError,  setMarketError]  = useState(false);
  const [roadmap,      setRoadmap]      = useState(null);
  const [survey,       setSurvey]       = useState({ visible: false, rating: 0, sent: false });
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    // Datos esenciales del Inicio: en cuanto llegan, mostramos la pantalla.
    Promise.allSettled([
      getUserProfile(),
      getFavorites(),
      getApplications(),
      getHistory(),
      getAiQuota(),
    ]).then(([p, f, a, h, q]) => {
      if (p.status === "fulfilled") setProfile(p.value);
      if (f.status === "fulfilled") setFavorites(f.value || []);
      if (a.status === "fulfilled") setApplications(a.value || []);
      if (h.status === "fulfilled") setHistory(h.value || []);
      if (q.status === "fulfilled") setQuota(q.value);
      setLoading(false);
    });
    // Análisis de mercado: es más pesado; se carga aparte para no bloquear el Inicio.
    getMarketAnalysis()
      .then(data => setMarket(data))
      .catch(() => setMarketError(true));
  }, []);

  // Roadmap: carga lazy tras datos del perfil (llama a Claude, puede tardar)
  useEffect(() => {
    if (loading) return;
    getSkillsRoadmap().then(data => {
      if (data?.steps?.length > 0) setRoadmap(data);
    }).catch(() => null);
  }, [loading]);

  // Mostrar encuesta si tiene historial de búsquedas y no la ha enviado antes en esta sesión
  useEffect(() => {
    if (!loading && history.length >= 2 && !survey.sent) {
      const shownAt = sessionStorage.getItem("survey_shown_at");
      if (!shownAt || Date.now() - Number(shownAt) > 24 * 60 * 60 * 1000) {
        setTimeout(() => setSurvey(s => ({ ...s, visible: true })), 3000);
        sessionStorage.setItem("survey_shown_at", String(Date.now()));
      }
    }
  }, [loading, history.length]);

  const stack = profile?.stack || [];
  const userStackLower = Array.isArray(stack) ? stack.map(s => s.toLowerCase()) : [];

  const completion = useMemo(() => {
    const fields = [
      Array.isArray(stack) ? stack.length > 0 : false,
      profile?.anos_experiencia != null && profile.anos_experiencia !== "",
      (profile?.idiomas || []).filter(l => l.idioma?.trim()).length > 0,
      (profile?.ubicaciones || []).length > 0,
      (profile?.modalidad || []).length > 0,
    ];
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
  }, [profile, stack]);

  // Map real market data → design format
  const marketData = useMemo(() => {
    if (!market) return null;
    return {
      totalOfertas: market.total_offers || 0,
      missing: (market.skill_gaps || []).map(g => ({ name: g.skill, pct: g.pct })),
      demand:  (market.skills_demand || []).slice(0, 8).map(s => ({
        name:  s.skill,
        pct:   s.pct,
        owned: userStackLower.some(u =>
          s.skill.toLowerCase().includes(u) || u.includes(s.skill.toLowerCase())
        ),
      })),
    };
  }, [market, userStackLower]);

  // Map real history → design format
  const historyItems = useMemo(() => history.slice(0, 5).map(h => {
    const st = (() => { try { return JSON.parse(h.stack || "[]"); } catch { return []; } })();
    const date = h.created_at
      ? new Date(h.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      : "";
    return {
      id:    h.id,
      title: st.slice(0, 3).join(" · ") || "Búsqueda general",
      date,
      aplica: h.num_aplica || 0,
      quiza:  h.num_quiza  || 0,
      no:     h.num_no_encaja || 0,
    };
  }), [history]);

  // Follow-up reminders (next 7 days + overdue)
  const upcomingFollowUps = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return applications
      .filter(a => a.follow_up_date)
      .map(a => {
        const d = new Date(a.follow_up_date + "T00:00:00");
        const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
        return { ...a, diff };
      })
      .filter(a => a.diff <= 7)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 5);
  }, [applications]);

  const metrics = {
    favoritos:     favorites.length,
    candidaturas:  applications.length,
    busquedas:     history.length,
    restantes:     quota?.remaining ?? 0,
    cuota:         quota?.daily_limit ?? 0,
  };

  if (loading) {
    const sk = { background: t._dm ? "rgba(255,255,255,0.06)" : "#e8ecf1", borderRadius: 8 };
    return (
      <div style={{ minHeight: "100vh", background: t.bg, fontFamily: t.font }}>
        <style>{`@keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
        <main style={{
          maxWidth: 1280, margin: "0 auto",
          padding: `${density === "compacta" ? 24 : 36}px 28px 64px`,
          animation: "sk-pulse 1.6s ease-in-out infinite",
        }}>
          {/* Hero skeleton */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ ...sk, width: 260, height: 32, marginBottom: 12 }}/>
            <div style={{ ...sk, width: 380, height: 16 }}/>
          </div>
          {/* Metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: t.gap, marginBottom: t.gapLg }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{
                ...sk, borderRadius: t.radius, height: 110,
                background: t._dm ? "rgba(255,255,255,0.05)" : "#f1f5f9",
              }}/>
            ))}
          </div>
          {/* Two-column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: t.gap }}>
            <div style={{ display: "flex", flexDirection: "column", gap: t.gap }}>
              {[140, 100, 160].map((h, i) => (
                <div key={i} style={{
                  ...sk, borderRadius: t.radius, height: h,
                  background: t._dm ? "rgba(255,255,255,0.05)" : "#f1f5f9",
                }}/>
              ))}
            </div>
            <div style={{
              ...sk, borderRadius: t.radius, height: 360,
              background: t._dm ? "rgba(255,255,255,0.05)" : "#f1f5f9",
            }}/>
          </div>
        </main>
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
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em",
            color: t.text, lineHeight: 1.15,
          }}>Hola{profile?.alias ? `, ${profile.alias}` : ""}</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: t.textSub, fontWeight: 500 }}>
            Resumen de tu actividad en JobMatch IA
            {" · "}{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </section>

        {/* Perfil incompleto */}
        {completion < 100 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "14px 18px", marginBottom: t.gapLg,
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: t.radius, fontFamily: t.font,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                Completa tu perfil — {completion}%
              </div>
              <div style={{ height: 5, borderRadius: 999, background: t.border, overflow: "hidden" }}>
                <div style={{
                  width: `${completion}%`, height: "100%",
                  background: t.teal, borderRadius: 999, transition: "width .5s ease",
                }}/>
              </div>
            </div>
            <button onClick={() => onNavigate?.("user-profile")} style={{
              all: "unset", cursor: "pointer",
              padding: "7px 14px", borderRadius: 7,
              border: `1px solid ${t.tealLine}`, color: t.teal,
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>Completar →</button>
          </div>
        )}

        {/* MÉTRICAS */}
        <section className="dash-metrics" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: t.gap, marginBottom: t.gapLg,
        }}>
          <MetricCard t={t} value={metrics.favoritos}
            label="Favoritos" sub="Ofertas guardadas" icon="star"
            onClick={() => onNavigate?.("favoritos")}/>
          <MetricCard t={t} value={metrics.candidaturas}
            label="Candidaturas" sub="Procesos activos" icon="clip"
            onClick={() => onNavigate?.("candidaturas")}/>
          <MetricCard t={t} value={metrics.busquedas}
            label="Búsquedas" sub="Análisis realizados" icon="search"
            onClick={() => onNavigate?.("buscar")}/>
          <MetricCard t={t} value={metrics.restantes}
            label="Análisis restantes"
            sub={metrics.cuota > 0 ? `${metrics.cuota - metrics.restantes}/${metrics.cuota} usados hoy` : "Sin límite"}
            icon="sparkle" accent="purple"/>
        </section>

        {/* BANNER — Entrevista IA */}
        <InterviewBanner t={t} onClick={() => onNavigate?.("candidaturas")}/>

        {/* GRID PRINCIPAL: izquierda + sidebar derecho */}
        <div className="dash-grid" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 340px",
          gap: t.gapLg, alignItems: "start",
        }}>
          {/* ---- COLUMNA IZQUIERDA ---- */}
          <div style={{ display: "flex", flexDirection: "column", gap: t.gapLg }}>

            {/* Análisis del mercado — cargando (se carga aparte del resto del Inicio) */}
            {!marketData && !marketError && (
              <Section t={t} eyebrow="Análisis del mercado" title={null} padding>
                <style>{`@keyframes mkt-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", color: t.textSub, fontSize: 13, animation: "mkt-pulse 1.4s ease-in-out infinite" }}>
                  <span style={{ fontSize: 16 }}>📊</span>
                  Analizando el mercado laboral…
                </div>
              </Section>
            )}

            {/* Análisis del mercado — error state */}
            {!marketData && marketError && (
              <Section t={t} eyebrow="Análisis del mercado" title={null} padding>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", color: t.textSub, fontSize: 13 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  No se pudo cargar el análisis de mercado. Inténtalo de nuevo más tarde.
                </div>
              </Section>
            )}

            {/* Análisis del mercado */}
            {marketData && (
              <Section
                t={t}
                eyebrow="Mercado laboral"
                title="Análisis del mercado"
                action={<span style={{ fontSize: 11, color: t.textMute, fontWeight: 600 }}>
                  Basado en {marketData.totalOfertas.toLocaleString()} ofertas activas
                </span>}
              >
                {marketData.missing.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                      color: t.textMute, textTransform: "uppercase", marginBottom: 10,
                    }}>Skills con alta demanda que no tienes</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {marketData.missing.map(s => (
                        <SkillChip key={s.name} t={t} name={s.name} pct={s.pct}
                          onAdd={() => {
                            addToast?.(`Añade ${s.name} desde Mi perfil`, "info");
                            onNavigate?.("user-profile");
                          }}/>
                      ))}
                    </div>
                    <div style={{
                      marginTop: 12,
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 12px",
                      background: t.purpleSoft,
                      border: `1px solid ${t._dm ? "rgba(124,58,237,0.25)" : "rgba(124,58,237,0.15)"}`,
                      borderRadius: t.radiusSm,
                      fontSize: 12, color: t.text, fontWeight: 500,
                    }}>
                      <span style={{ color: t.purple, display: "flex" }}><Icon name="bulb" size={14} color={t.purple}/></span>
                      Añadir estas skills a tu perfil podría abrirte un{" "}
                      <strong style={{ fontWeight: 700, color: t.purple }}>
                        {marketData.missing.reduce((max, s) => Math.max(max, s.pct), 0)}%
                      </strong>{" "}más de ofertas.
                    </div>
                  </div>
                )}

                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                  color: t.textMute, textTransform: "uppercase", marginBottom: 8,
                }}>Demanda de skills en el mercado</div>
                <div>
                  {marketData.demand.map(s => <SkillBar key={s.name} t={t} {...s}/>)}
                </div>
              </Section>
            )}

            {/* Skills Roadmap */}
            {roadmap && roadmap.steps.length > 0 && (
              <Section t={t} eyebrow="Tu roadmap de aprendizaje" title={null} padding>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>
                    Basado en tu stack y las skills más demandadas en el mercado ahora mismo.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {roadmap.steps.map((step, i) => (
                      <div key={i} style={{
                        display: "flex", gap: 14, padding: "12px 14px",
                        background: t._dm ? "rgba(255,255,255,0.03)" : "#fafafa",
                        border: `1px solid ${t.border}`, borderRadius: t.radiusSm,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: t.tealSoft, color: t.teal,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800,
                        }}>{step.paso || i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>
                            {step.skill}
                            {step.tiempo_semanas && (
                              <span style={{ fontSize: 11, fontWeight: 500, color: t.textMute, marginLeft: 8 }}>
                                ~{step.tiempo_semanas} sem
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>{step.accion}</div>
                          {(step.recursos || []).length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                              {step.recursos.map((r, j) => (
                                <span key={j} style={{
                                  fontSize: 11, padding: "2px 8px", borderRadius: 999,
                                  background: t.tealSoft, color: t.teal, fontWeight: 600,
                                }}>{r}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {/* Recordatorios próximos */}
            {upcomingFollowUps.length > 0 && (
              <Section t={t} eyebrow="Recordatorios" title={null} padding={true}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {upcomingFollowUps.map(a => {
                    const overdue = a.diff < 0;
                    const today   = a.diff === 0;
                    const color   = overdue ? t.red : today ? t.amber : t.teal;
                    const bg      = overdue ? t.redSoft : today ? t.amberSoft : t.tealSoft;
                    return (
                      <button
                        key={a.id} type="button"
                        onClick={() => onNavigate?.("candidaturas")}
                        style={{
                          all: "unset", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: 12, padding: "10px 14px", borderRadius: t.radiusSm,
                          background: bg, border: `1px solid ${color}22`,
                          fontFamily: t.font,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.text,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.titulo || "Candidatura"}
                          </span>
                          <span style={{ fontSize: 11, color: t.textSub }}>{a.empresa || ""}</span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: "3px 10px",
                          borderRadius: 999, background: color, color: "#fff",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}>
                          {overdue ? `Vencido ${Math.abs(a.diff)}d` : today ? "Hoy" : `En ${a.diff}d`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Últimas búsquedas */}
            {historyItems.length === 0 && !loading && (
              <Section t={t} eyebrow="Últimas búsquedas" title={null} padding>
                <div style={{ textAlign: "center", padding: "28px 16px" }}>
                  <Icon name="search" size={28} color={t.textMute}/>
                  <p style={{ margin: "10px 0 16px", fontSize: 13, fontWeight: 600, color: t.textSub, lineHeight: 1.5 }}>
                    Aún no has realizado ninguna búsqueda
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate?.("buscar")}
                    style={{
                      padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: t.teal, color: "#fff", fontSize: 13, fontWeight: 700,
                      fontFamily: t.font,
                    }}
                  >
                    Buscar ofertas →
                  </button>
                </div>
              </Section>
            )}
            {historyItems.length > 0 && (
              <Section t={t} eyebrow="Últimas búsquedas" title={null} padding={false}>
                <div>
                  {historyItems.map(h => (
                    <SearchHistoryRow key={h.id} t={t} item={h}
                      onClick={() => onRepeatSearch ? onRepeatSearch() : onNavigate?.("buscar")}/>
                  ))}
                </div>
                {/* Mini trend: aplica evolution */}
                {historyItems.length >= 2 && (
                  <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: t.radiusSm,
                    background: t.surface2, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute,
                      textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                      Evolución de encajes
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 40 }}>
                      {[...historyItems].reverse().map((h) => {
                        const total = (h.aplica + h.quiza + h.no) || 1;
                        const pct = Math.round((h.aplica / total) * 100);
                        return (
                          <div key={h.id} style={{ flex: 1, display: "flex", flexDirection: "column",
                            alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: 9, color: t.textMute, fontWeight: 600 }}>{pct}%</span>
                            <div style={{ width: "100%", borderRadius: 3, overflow: "hidden",
                              height: 24, background: t.border, position: "relative" }}>
                              <div style={{
                                position: "absolute", bottom: 0, width: "100%",
                                height: `${Math.max(8, pct)}%`,
                                background: pct >= 50 ? t.green : pct >= 25 ? t.amber : t.red,
                                borderRadius: 3, transition: "height .4s ease",
                              }}/>
                            </div>
                            <span style={{ fontSize: 9, color: t.textMute }}>{h.date}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: t.textMute, marginTop: 6 }}>
                      % de ofertas "Aplica" por búsqueda (últimas {historyItems.length})
                    </div>
                  </div>
                )}
              </Section>
            )}

          </div>

          {/* ---- COLUMNA DERECHA ---- */}
          <aside style={{ display: "flex", flexDirection: "column", gap: t.gap, position: "sticky", top: 76 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              color: t.textMute, textTransform: "uppercase", padding: "0 4px",
            }}>Acciones rápidas</div>

            <QuickAction t={t} icon="search" title="Buscar por perfil"
              sub="Según tu perfil y stack" onClick={() => onNavigate?.("buscar")}/>
            <QuickAction t={t} icon="doc" title="Buscar subiendo CV"
              sub="Extracción automática + matching" accent="purple"
              onClick={() => onNavigate?.("cv-buscar")}/>
            <QuickAction t={t} icon="star" title="Mis favoritos"
              sub={`${metrics.favoritos} ${metrics.favoritos === 1 ? "oferta guardada" : "ofertas guardadas"}`}
              onClick={() => onNavigate?.("favoritos")}/>
            <QuickAction t={t} icon="clip" title="Mis candidaturas"
              sub="Ver pipeline de estados" onClick={() => onNavigate?.("candidaturas")}/>
            <QuickAction t={t} icon="mic" title="Simular entrevista IA"
              sub="Practica para una candidatura real" accent="purple"
              onClick={() => onNavigate?.("candidaturas")}/>
            <QuickAction t={t} icon="user" title="Mi perfil"
              sub={`Completado ${completion}%`} onClick={() => onNavigate?.("user-profile")}/>

            {/* Tip card */}
            <div style={{
              marginTop: 4, padding: t.pad, borderRadius: t.radius,
              background: t.tealSoft, border: `1px solid ${t.tealLine}`,
              fontFamily: t.font,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
                color: t.teal, textTransform: "uppercase", marginBottom: 8,
              }}>
                <Icon name="bulb" size={13} color={t.teal}/> Tip
              </div>
              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5, fontWeight: 500 }}>
                Combina la búsqueda por CV + perfil manual para conseguir los mejores resultados del motor IA.
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Encuesta de satisfacción flotante */}
      {survey.visible && !survey.sent && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9000,
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: t.radius, padding: 20, width: 300,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          fontFamily: t.font, animation: "slideUp 0.3s ease",
        }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <button
            onClick={() => setSurvey(s => ({ ...s, visible: false }))}
            style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", cursor: "pointer", fontSize: 16, color: t.textMute }}
          >✕</button>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: t.text, paddingRight: 20 }}>
            ¿Qué tal tus resultados?
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: t.textSub, lineHeight: 1.4 }}>
            Tu valoración mejora el motor para todos los usuarios.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "center" }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setSurvey(s => ({ ...s, rating: n }))}
                style={{
                  fontSize: 22, background: "none", border: "none", cursor: "pointer",
                  opacity: survey.rating === 0 || survey.rating >= n ? 1 : 0.3,
                  transform: survey.rating >= n ? "scale(1.15)" : "scale(1)",
                  transition: "all 0.15s",
                }}
              >⭐</button>
            ))}
          </div>
          {survey.rating > 0 && (
            <button
              onClick={async () => {
                try {
                  await submitSearchSatisfaction({ rating: survey.rating });
                  setSurvey(s => ({ ...s, sent: true, visible: false }));
                  addToast?.("¡Gracias por tu valoración!", "success");
                } catch {
                  setSurvey(s => ({ ...s, visible: false }));
                }
              }}
              style={{
                width: "100%", padding: "8px 0", borderRadius: 8, border: "none",
                background: t.teal, color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: t.font,
              }}
            >
              Enviar valoración ({survey.rating}/5)
            </button>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .dash-metrics { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
