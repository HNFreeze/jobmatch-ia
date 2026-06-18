import CompanyLogo from "../../components/CompanyLogo";
import OfferTrustSignals from "../../components/OfferTrustSignals";
import {
  typography,
} from "../../constants/theme";

const TEAL = "#00758A";

const RESULT_STYLES = {
  APLICA:    { bg: "#ecfdf5", border: "#10b981", label: "APLICA",     icon: "✓", iconBg: "#d1fae5", iconColor: "#10b981" },
  QUIZÁ:     { bg: "#f1f5f9", border: "#64748b", label: "QUIZÁ",      icon: "?", iconBg: "#f1f5f9", iconColor: "#64748b" },
  NO_ENCAJA: { bg: "#fff1f2", border: "#ef4444", label: "NO ENCAJA",  icon: "✗", iconBg: "#fee2e2", iconColor: "#ef4444" },
};

function normalizeResultValue(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  if (normalized === "QUIZA" || normalized === "QUIZ?") return "QUIZÁ";
  return String(value || "").trim();
}

function isNewOffer(dateStr) {
  if (!dateStr) return false;
  try {
    return (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24) < 3;
  } catch { return false; }
}

function extractTechTags(offer, userStack) {
  if (!userStack?.length) return [];
  const text = ((offer.titulo || "") + " " + (offer.descripcion || "")).toLowerCase();
  return userStack.filter(tech => text.includes(tech.toLowerCase())).slice(0, 5);
}

// S styles needed for offer card
const S = {
  offerCard: {
    padding: "24px 28px",
    borderRadius: 16,
    backgroundColor: "#fff",
    border: "1px solid #e8ecf1",
    borderLeft: "4px solid",
    cursor: "pointer",
    transition: "all 0.2s ease",
    position: "relative",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: "#f1f5f9",
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
  starBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
    transition: "transform 0.15s ease",
  },
  btnDetail: {
    padding: "8px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    backgroundColor: TEAL,
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontFamily: typography.family,
    transition: "opacity 0.15s ease",
  },
};

/**
 * OfferCard — renders a single job offer card in the Profile results view.
 *
 * Props:
 *  offer             — the offer object
 *  darkMode          — boolean
 *  compactCards      — boolean (compact view toggle)
 *  isFav             — boolean
 *  isCompared        — boolean
 *  isTracked         — boolean
 *  feedbackValue     — "up" | "down" | null
 *  feedbackBusy      — boolean
 *  userStack         — string[]
 *  insightSlot       — ReactNode  (MatchInsightSummary rendered by parent)
 *  calculateDaysAgo  — function(dateStr) → string
 *  onOpen            — () => void
 *  onToggleFavorite  — () => void
 *  onToggleCompare   — () => void
 *  onDiscard         — () => void
 *  onTrack           — () => void
 *  onFeedback        — (rating: "up" | "down") => void
 *  index             — number (animation stagger)
 */
export default function OfferCard({
  offer,
  darkMode,
  compactCards,
  isFav,
  isCompared,
  isTracked,
  feedbackValue,
  feedbackBusy,
  userStack,
  insightSlot,
  calculateDaysAgo,
  onOpen,
  onToggleFavorite,
  onToggleCompare,
  onDiscard,
  onTrack,
  onFeedback,
  index = 0,
}) {
  const dm = darkMode;
  const rs = RESULT_STYLES[normalizeResultValue(offer.resultado)] || RESULT_STYLES.NO_ENCAJA;
  const tags = extractTechTags(offer, userStack);
  const isNew = isNewOffer(offer.fecha_publicacion);

  return (
    <div
      className="job-card"
      onClick={onOpen}
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
        {!compactCards && <OfferTrustSignals offer={offer} darkMode={dm} compact maxSignals={2} />}
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
        {tags.slice(0, compactCards ? 3 : tags.length).map(tag => (
          <span key={tag} style={{ ...S.chip, ...(dm ? S.chipDm : {}) }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Row 3: IA Insight slot — passed from parent (hidden in compact mode) */}
      {!compactCards && insightSlot}

      {/* Row 4: Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 18, gap: 12 }}>
        <button
          style={{ ...S.starBtn, color: isFav ? "#f59e0b" : (dm ? "#475569" : "#d1d5db"), marginRight: "auto" }}
          onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
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
          onClick={e => { e.stopPropagation(); onToggleCompare(); }}
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
          onClick={e => { e.stopPropagation(); onDiscard(); }}
        >
          Descartar
        </button>
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
          onClick={e => { e.stopPropagation(); onTrack(); }}
          title={isTracked ? "Ya añadida a candidaturas" : "Guardar en candidaturas"}
        >
          {isTracked ? "✓ Candidatura" : "+ Candidatura"}
        </button>
        <button
          className="btn-card-detail"
          onClick={e => { e.stopPropagation(); onOpen(); }}
          style={S.btnDetail}
        >
          Ver detalle
        </button>
        {/* Feedback */}
        <div style={{ display: "flex", gap: 5, marginLeft: 6 }}>
          {["up", "down"].map(rating => {
            const isActive = feedbackValue === rating;
            const isBusy = feedbackBusy;
            return (
              <button
                key={rating}
                title={rating === "up" ? "Buen resultado" : "Mal resultado"}
                disabled={isBusy}
                onClick={e => { e.stopPropagation(); onFeedback(rating); }}
                style={{
                  width: 28, height: 28, borderRadius: 7, border: "none",
                  background: isActive
                    ? (rating === "up" ? "#d1fae5" : "#fee2e2")
                    : (dm ? "rgba(255,255,255,0.06)" : "#f3f4f6"),
                  cursor: isBusy ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, opacity: isBusy ? 0.5 : 1,
                  transition: "all 0.15s ease",
                  outline: isActive
                    ? (rating === "up" ? "1.5px solid #10b981" : "1.5px solid #ef4444")
                    : "none",
                }}
              >
                {rating === "up" ? "👍" : "👎"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
