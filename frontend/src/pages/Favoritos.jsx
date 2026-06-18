import { useState, useEffect, useMemo } from "react";
import { getFavorites, removeFavorite, createApplication } from "../services/api";
import { pageTokens } from "../constants/theme";

/* ---------------------------------------------------------------------------
 * Tokens — fuente única en theme.js (pageTokens)
 * ------------------------------------------------------------------------- */
function useTokens(darkMode, density) {
  return useMemo(() => pageTokens(darkMode, density), [darkMode, density]);
}

function useHover() {
  const [h, setH] = useState(false);
  return [h, { onMouseEnter: () => setH(true), onMouseLeave: () => setH(false) }];
}

/* ---------------------------------------------------------------------------
 * Iconos SVG
 * ------------------------------------------------------------------------- */
const Icon = ({ name, size = 16 }) => {
  const c = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 1.6,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "block", flexShrink: 0 },
  };
  switch (name) {
    case "star":      return <svg {...c}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/></svg>;
    case "star-fill": return <svg {...c} fill="currentColor" stroke="none"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/></svg>;
    case "pin":       return <svg {...c}><path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "briefcase": return <svg {...c}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>;
    case "clock":     return <svg {...c}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "arrow":     return <svg {...c}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "search":    return <svg {...c}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>;
    case "sort":      return <svg {...c}><path d="M7 3v18M7 21l-3-3M7 21l3-3M17 21V3M17 3l-3 3M17 3l3 3"/></svg>;
    case "trash":     return <svg {...c}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>;
    case "external":  return <svg {...c}><path d="M14 3h7v7M21 3l-9 9M19 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>;
    case "warn":      return <svg {...c}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>;
    default: return null;
  }
};

/* ---------------------------------------------------------------------------
 * Helpers — mapeo de datos de API al formato visual
 * ------------------------------------------------------------------------- */
function mapResultado(resultado) {
  const r = String(resultado || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().trim();
  if (r === "APLICA") return "APLICA";
  if (r === "QUIZA")  return "QUIZA";
  return "NO_ENCAJA";
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

function mapFavorite(f) {
  return {
    id:       f.adzuna_id,
    title:    f.titulo    || "Sin título",
    company:  f.empresa   || "Empresa desconocida",
    source:   f.empresa   || "JobMatch IA",
    location: f.ciudad    || "España",
    modality: f.modalidad || "No especificado",
    daysAgo:  daysSince(f.created_at),
    match:    f.score     || 0,
    status:   mapResultado(f.resultado),
    url:      f.url       || null,
    raw:      f,
  };
}

function stringToColor(s, dm) {
  const palette = dm
    ? ["#1f6feb","#7c3aed","#0891b2","#059669","#dc2626","#d97706","#7c2d12","#475569"]
    : ["#2563eb","#7c3aed","#0891b2","#059669","#dc2626","#d97706","#9333ea","#475569"];
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/* ---------------------------------------------------------------------------
 * StatusChip
 * ------------------------------------------------------------------------- */
function StatusChip({ t, status }) {
  const map = {
    APLICA:    { bg: t.greenSoft, fg: t.greenFg, dot: t.green },
    QUIZA:     { bg: t.amberSoft, fg: t.amberFg, dot: t.amber },
    NO_ENCAJA: { bg: t.redSoft,   fg: t.redFg,   dot: t.red   },
  };
  const c = map[status] || map.QUIZA;
  const label = status === "NO_ENCAJA" ? "NO ENCAJA" : (status === "QUIZA" ? "QUIZÁ" : "APLICA");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 9px 4px 7px", borderRadius: 999,
      background: c.bg, color: c.fg,
      fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, display: "inline-block" }}/>
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * JobCard
 * ------------------------------------------------------------------------- */
function JobCard({ t, offer, onRemove, onApply, onOpen }) {
  const [hover, hp] = useHover();
  return (
    <article {...hp} style={{
      background: t.surface,
      border: `1px solid ${hover ? t.borderSt : t.border}`,
      borderRadius: t.radius, padding: t.pad,
      display: "flex", flexDirection: "column", gap: 14,
      boxShadow: hover ? t.shadow : "none",
      transform: hover ? "translateY(-1px)" : "none",
      transition: "border-color .15s, transform .15s, box-shadow .15s",
      fontFamily: t.font, position: "relative",
    }}>
      {/* Company row + remove */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: stringToColor(offer.company, t._dm),
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 13,
          }}>{(offer.company || "·").slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: t.text,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{offer.company}</div>
            <div style={{ fontSize: 11, color: t.textMute, fontWeight: 500 }}>{offer.source}</div>
          </div>
        </div>
        <button type="button" onClick={() => onRemove?.(offer.id)} title="Quitar de favoritos" style={{
          all: "unset", cursor: "pointer", color: t.teal, padding: 4, borderRadius: 6,
          display: "inline-flex", flexShrink: 0,
        }}>
          <Icon name="star-fill" size={18}/>
        </button>
      </div>

      {/* Title */}
      <h3 style={{
        margin: 0, fontSize: 15, fontWeight: 800, color: t.text,
        lineHeight: 1.35, letterSpacing: "-0.005em",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{offer.title}</h3>

      {/* Meta */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: t.textSub, fontWeight: 500 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Icon name="pin" size={12}/>{offer.location}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Icon name="briefcase" size={12}/>{offer.modality}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Icon name="clock" size={12}/>
          {offer.daysAgo === 0 ? "hoy" : `hace ${offer.daysAgo}d`}
        </span>
      </div>

      {/* Match bar */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
            color: t.textMute, textTransform: "uppercase",
          }}>Match IA</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{offer.match}%</span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: t.border, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${offer.match}%`,
            background: offer.status === "APLICA" ? t.green
              : offer.status === "QUIZA" ? t.amber : t.red,
            borderRadius: 999, transition: "width .4s ease",
          }}/>
        </div>
      </div>

      {/* Status + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: "auto" }}>
        <StatusChip t={t} status={offer.status}/>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {offer.url && (
            <SecondaryBtn t={t} onClick={() => onOpen?.(offer)}>
              <Icon name="external" size={12}/> Ver
            </SecondaryBtn>
          )}
          {offer.status !== "NO_ENCAJA" && (
            <PrimaryBtn t={t} onClick={() => onApply?.(offer)}>Aplicar</PrimaryBtn>
          )}
        </div>
      </div>
    </article>
  );
}

function PrimaryBtn({ t, onClick, children }) {
  const [hover, hp] = useHover();
  return (
    <button type="button" onClick={onClick} {...hp} style={{
      all: "unset", cursor: "pointer",
      padding: "7px 14px", borderRadius: 7,
      background: hover ? "#005f72" : t.teal,
      color: "#fff", fontSize: 12, fontWeight: 700,
      transition: "background .15s", fontFamily: t.font,
    }}>{children}</button>
  );
}

function SecondaryBtn({ t, onClick, children }) {
  const [hover, hp] = useHover();
  return (
    <button type="button" onClick={onClick} {...hp} style={{
      all: "unset", cursor: "pointer",
      padding: "6px 10px", borderRadius: 7,
      background: hover ? t.surface2 : "transparent",
      color: t.textSub, fontSize: 12, fontWeight: 600,
      border: `1px solid ${t.border}`,
      display: "inline-flex", alignItems: "center", gap: 4,
      transition: "background .15s, color .15s", fontFamily: t.font,
    }}>{children}</button>
  );
}

/* ---------------------------------------------------------------------------
 * FilterBar
 * ------------------------------------------------------------------------- */
function FilterBar({ t, query, onQuery, tab, onTab, sort, onSort, counts }) {
  const tabs = [
    { id: "all",       label: "Todas",     count: counts.all },
    { id: "APLICA",    label: "Aplica",    count: counts.APLICA },
    { id: "QUIZA",     label: "Quizá",     count: counts.QUIZA },
    { id: "NO_ENCAJA", label: "No encaja", count: counts.NO_ENCAJA },
  ];
  const sortOptions = [
    { id: "match",   label: "Match" },
    { id: "date",    label: "Más recientes" },
    { id: "company", label: "Empresa" },
  ];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      padding: t.pad, background: t.surface,
      border: `1px solid ${t.border}`, borderRadius: t.radius,
    }}>
      {/* Búsqueda */}
      <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
        <span style={{
          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          color: t.textMute, display: "flex",
        }}><Icon name="search" size={14}/></span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar en favoritos…"
          style={{
            width: "100%", padding: "9px 12px 9px 34px",
            background: t.surface2, border: `1px solid ${t.border}`,
            borderRadius: 8, fontSize: 13, color: t.text, fontWeight: 500,
            outline: "none", fontFamily: t.font, boxSizing: "border-box",
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{
        display: "inline-flex", alignItems: "center",
        background: t.surface2, padding: 3, borderRadius: 8,
        border: `1px solid ${t.border}`,
      }}>
        {tabs.map(tb => {
          const active = tab === tb.id;
          return (
            <button key={tb.id} type="button" onClick={() => onTab(tb.id)} style={{
              all: "unset", cursor: "pointer",
              padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
              color: active ? t.text : t.textSub,
              background: active ? t.surface : "transparent",
              boxShadow: active && !t._dm ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
              transition: "background .12s, color .12s", fontFamily: t.font,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {tb.label}
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: "1px 6px", borderRadius: 999,
                background: active ? t.tealSoft : t.border,
                color: active ? t.teal : t.textMute,
              }}>{tb.count}</span>
            </button>
          );
        })}
      </div>

      {/* Ordenar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: t.textSub }}>
        <Icon name="sort" size={13}/>
        <select value={sort} onChange={(e) => onSort(e.target.value)} style={{
          background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8,
          padding: "7px 10px", fontSize: 12, fontWeight: 600, color: t.text,
          fontFamily: t.font, outline: "none", cursor: "pointer",
        }}>
          {sortOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * EmptyState — estrella outline geométrica teal
 * ------------------------------------------------------------------------- */
function EmptyState({ t, onCTA }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: t.radius, padding: "56px 28px 64px",
      textAlign: "center", fontFamily: t.font,
    }}>
      <div style={{
        width: 160, height: 160, margin: "0 auto 24px",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <svg width="160" height="160" viewBox="0 0 160 160" fill="none"
          style={{ color: t.teal }} aria-hidden="true">
          <circle cx="80" cy="80" r="74" stroke="currentColor" strokeOpacity="0.10"
            strokeWidth="1.5" strokeDasharray="2 6"/>
          <circle cx="80" cy="80" r="56" stroke="currentColor" strokeOpacity="0.18"
            strokeWidth="1.5"/>
          <path d="M28 40 L31 40 M29.5 38.5 L29.5 41.5" stroke="currentColor"
            strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M132 50 L135 50 M133.5 48.5 L133.5 51.5" stroke="currentColor"
            strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M80 42 L92.6 67.6 L121 71.7 L100.5 91.6 L105.4 119.8 L80 106.5 L54.6 119.8 L59.5 91.6 L39 71.7 L67.4 67.6 Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill={t.tealSoft}/>
          <circle cx="80" cy="6"   r="2" fill="currentColor" fillOpacity="0.5"/>
          <circle cx="154" cy="80" r="2" fill="currentColor" fillOpacity="0.4"/>
          <circle cx="80" cy="154" r="2" fill="currentColor" fillOpacity="0.4"/>
          <circle cx="6"  cy="80"  r="2" fill="currentColor" fillOpacity="0.5"/>
        </svg>
      </div>
      <h2 style={{
        margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: t.text,
        letterSpacing: "-0.01em",
      }}>Aún no tienes favoritos guardados</h2>
      <p style={{
        margin: "0 auto 24px", maxWidth: 420,
        fontSize: 13, color: t.textSub, fontWeight: 500, lineHeight: 1.55,
      }}>
        Cuando una oferta te interese, márcala con la estrella desde la búsqueda.
        Aquí podrás revisarla con calma y aplicar cuando estés listo.
      </p>
      <div style={{ display: "inline-flex", gap: 8 }}>
        <button type="button" onClick={() => onCTA?.("buscar")} style={{
          all: "unset", cursor: "pointer",
          padding: "10px 18px", borderRadius: 8,
          background: t.teal, color: "#fff",
          fontSize: 13, fontWeight: 700, letterSpacing: "0.005em",
          fontFamily: t.font, display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          Buscar ofertas <Icon name="arrow" size={13}/>
        </button>
        <button type="button" onClick={() => onCTA?.("cv-buscar")} style={{
          all: "unset", cursor: "pointer",
          padding: "10px 14px", borderRadius: 8,
          background: "transparent", color: t.text,
          fontSize: 13, fontWeight: 600,
          border: `1px solid ${t.border}`, fontFamily: t.font,
        }}>Subir CV</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ErrorState
 * ------------------------------------------------------------------------- */
function ErrorState({ t, onRetry }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: t.radius, padding: "48px 28px",
      textAlign: "center", fontFamily: t.font,
    }}>
      <div style={{ color: t.amber, display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <Icon name="warn" size={36}/>
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: t.text }}>
        No se pudieron cargar los favoritos
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: t.textSub, fontWeight: 500 }}>
        Comprueba tu conexión e inténtalo de nuevo.
      </p>
      <button type="button" onClick={onRetry} style={{
        all: "unset", cursor: "pointer",
        padding: "9px 18px", borderRadius: 8,
        background: t.teal, color: "#fff",
        fontSize: 13, fontWeight: 700, fontFamily: t.font,
      }}>Reintentar</button>
    </div>
  );
}

/* ===========================================================================
 * MAIN — Favoritos
 * ========================================================================= */
export default function Favoritos({ addToast = () => {}, darkMode = false, onNavigate, density = "normal" }) {
  const t = useTokens(darkMode, density);

  const [rawFavorites, setRawFavorites] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [tab,   setTab]   = useState("all");
  const [sort,  setSort]  = useState("match");

  useEffect(() => { loadFavorites(); }, []);

  async function loadFavorites() {
    setLoading(true);
    setLoadError(false);
    try {
      const list = await getFavorites();
      setRawFavorites(list || []);
    } catch {
      setLoadError(true);
      setRawFavorites([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(adzunaId) {
    try {
      await removeFavorite(adzunaId);
      setRawFavorites(prev => prev.filter(f => f.adzuna_id !== adzunaId));
      addToast?.("Oferta eliminada de favoritos", "info");
    } catch {
      addToast?.("No se pudo eliminar el favorito", "error");
    }
  }

  async function handleApply(offer) {
    try {
      await createApplication({
        adzuna_id: offer.raw.adzuna_id,
        titulo:    offer.raw.titulo,
        empresa:   offer.raw.empresa,
        url:       offer.raw.url,
      });
      addToast?.("Candidatura añadida al seguimiento", "success");
    } catch (err) {
      if (err.message?.includes("Ya es") || err.message?.includes("crear")) {
        addToast?.("Esta oferta ya está en tus candidaturas", "info");
      } else {
        addToast?.("No se pudo registrar la candidatura", "error");
      }
    }
  }

  function handleOpen(offer) {
    if (offer.url) window.open(offer.url, "_blank", "noopener,noreferrer");
  }

  function handleNavigate(id) {
    if (onNavigate) {
      onNavigate(id);
    } else {
      window.location.hash = id;
    }
  }

  // Map API → design format
  const favorites = useMemo(() => rawFavorites.map(mapFavorite), [rawFavorites]);

  const counts = useMemo(() => {
    const c = { all: favorites.length, APLICA: 0, QUIZA: 0, NO_ENCAJA: 0 };
    favorites.forEach(f => { if (c[f.status] != null) c[f.status]++; });
    return c;
  }, [favorites]);

  const filtered = useMemo(() => {
    let list = favorites;
    if (tab !== "all") list = list.filter(f => f.status === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.company.toLowerCase().includes(q) ||
        (f.location || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "match")   return b.match - a.match;
      if (sort === "date")    return a.daysAgo - b.daysAgo;
      if (sort === "company") return a.company.localeCompare(b.company);
      return 0;
    });
    return list;
  }, [favorites, query, tab, sort]);

  if (loading) {
    return (
      <div style={{
        minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: t.bg,
      }}>
        <style>{`@keyframes jm-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: `3px solid ${t.border}`, borderTopColor: t.teal,
          animation: "jm-spin 0.8s linear infinite",
        }}/>
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
            margin: 0, fontSize: 28, fontWeight: 800,
            letterSpacing: "-0.025em", color: t.text, lineHeight: 1.15,
          }}>Favoritos</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: t.textSub, fontWeight: 500 }}>
            {favorites.length === 0
              ? "Las ofertas que marques con estrella aparecerán aquí."
              : `${favorites.length} ${favorites.length === 1 ? "oferta guardada" : "ofertas guardadas"} para revisar más tarde.`
            }
          </p>
        </section>

        {loadError ? (
          <ErrorState t={t} onRetry={loadFavorites}/>
        ) : favorites.length === 0 ? (
          <EmptyState t={t} onCTA={handleNavigate}/>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: t.gapLg }}>
            <FilterBar
              t={t}
              query={query} onQuery={setQuery}
              tab={tab}     onTab={setTab}
              sort={sort}   onSort={setSort}
              counts={counts}
            />

            {filtered.length === 0 ? (
              <div style={{
                background: t.surface, border: `1px dashed ${t.borderSt}`,
                borderRadius: t.radius, padding: "40px 24px",
                textAlign: "center", color: t.textSub, fontSize: 13, fontFamily: t.font,
              }}>
                Ningún favorito coincide con tu búsqueda.{" "}
                <button type="button" onClick={() => { setQuery(""); setTab("all"); }}
                  style={{
                    all: "unset", cursor: "pointer",
                    color: t.teal, fontWeight: 700,
                  }}>Limpiar filtros</button>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: t.gap,
              }}>
                {filtered.map(o => (
                  <JobCard key={o.id} t={t} offer={o}
                    onRemove={handleRemove}
                    onApply={handleApply}
                    onOpen={handleOpen}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
