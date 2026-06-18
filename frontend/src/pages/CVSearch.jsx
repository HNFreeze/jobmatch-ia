import { useState, useRef, useCallback, useEffect } from "react";
import {
  analyzeCV,
  improveCVFull,
  downloadCVPdf,
  getMyImprovements,
  searchFromImprovement,
  getCVEdit,
  createCVVariant,
  deleteCVVariant,
  optimizeCVVariantForOffer,
} from "../services/api";
import CompanyLogo from "../components/CompanyLogo";
import CVEditorModal from "../components/CVEditorModal";
import {
  gradients,
  typography,
  transition,
  colors,
} from "../constants/theme";
import OfferTrustSignals from "../components/OfferTrustSignals";
import {
  getOfferQualityCounts,
  hasVisibleSalary,
  isAggregatorOffer,
  isDirectSourceOffer,
  isVerifiedOffer,
  isJuniorFriendlyOffer,
} from "../utils/jobTrust";

// ─── Constantes de diseño ────────────────────────────────────────────────────

const RESULT_STYLES = {
  APLICA: {
    bg: "#ecfdf5", border: "#10b981",
    label: "APLICA", icon: "✓", iconBg: "#d1fae5", iconColor: "#10b981",
  },
  "QUIZÁ": {
    bg: "#f8fafc", border: "#64748b",
    label: "QUIZÁ", icon: "?", iconBg: "#f1f5f9", iconColor: "#64748b",
  },
  NO_ENCAJA: {
    bg: "#fff1f2", border: "#ef4444",
    label: "NO ENCAJA", icon: "✗", iconBg: "#fee2e2", iconColor: "#ef4444",
  },
};

const TAG_COLORS = [
  { bg: "#ede9fe", color: "#7c3aed", border: "#ddd6fe" },
  { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  { bg: "#ffe4e6", color: "#be123c", border: "#fecdd3" },
];

const SENIORITY_LABELS = {
  junior: { label: "Junior", color: "#10b981", bg: "#d1fae5" },
  mid: { label: "Mid-level", color: "#2563eb", bg: "#dbeafe" },
  senior: { label: "Senior", color: "#7c3aed", bg: "#ede9fe" },
  lead: { label: "Lead / Staff", color: "#92400e", bg: "#fef3c7" },
  desconocido: { label: "Sin determinar", color: "#6b7280", bg: "#f3f4f6" },
};

const LOADING_STEPS = [
  "Extrayendo texto del CV…",
  "Analizando perfil con IA…",
  "Buscando ofertas relevantes…",
  "Evaluando compatibilidad…",
];

const MAX_FILE_MB = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decodeHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tagColor(idx) {
  return TAG_COLORS[idx % TAG_COLORS.length];
}

function normalizeResultado(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  if (normalized === "QUIZA") return "QUIZÁ";
  return String(value || "").trim();
}

function ScoreBar({ score, resultado, dm }) {
  const style = RESULT_STYLES[normalizeResultado(resultado)] || RESULT_STYLES.NO_ENCAJA;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 6, borderRadius: 3,
        background: dm ? "rgba(255,255,255,0.08)" : "#e5e7eb",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 3,
          width: `${score || 0}%`,
          background: style.border,
          transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: style.border, minWidth: 32, textAlign: "right" }}>
        {score || 0}
      </span>
    </div>
  );
}

// ─── Componente: tarjeta de oferta ───────────────────────────────────────────

function OfferCard({ offer, dm, onSelect }) {
  const style = RESULT_STYLES[normalizeResultado(offer.resultado)] || RESULT_STYLES.NO_ENCAJA;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(offer)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: dm ? "#1e293b" : "#fff",
        border: `1.5px solid ${hovered ? style.border : (dm ? "rgba(255,255,255,0.07)" : "#e5e7eb")}`,
        borderRadius: 14,
        padding: "16px 18px",
        cursor: "pointer",
        transition: `all ${transition.smooth}`,
        boxShadow: hovered
          ? `0 8px 24px rgba(0,0,0,${dm ? 0.3 : 0.1})`
          : `0 1px 3px rgba(0,0,0,${dm ? 0.2 : 0.04})`,
        transform: hovered ? "translateY(-1px)" : "none",
        fontFamily: typography.family,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
        <CompanyLogo
          name={offer.empresa || "?"}
          logoUrl={offer.logo_url || offer.company_logo_url}
          size={40}
          darkMode={dm}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: dm ? "#f1f5f9" : "#111827",
            lineHeight: 1.3, marginBottom: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {offer.titulo || "Oferta sin título"}
          </div>
          <div style={{ fontSize: 12, color: dm ? "#94a3b8" : "#6b7280", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {offer.empresa && <span>{offer.empresa}</span>}
            {offer.ubicacion && <><span>·</span><span>{offer.ubicacion}</span></>}
          </div>
        </div>
        {/* Badge resultado */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
          background: style.iconBg, borderRadius: 20,
          padding: "3px 10px",
        }}>
          <span style={{ color: style.iconColor, fontWeight: 800, fontSize: 11 }}>{style.icon}</span>
          <span style={{ color: style.iconColor, fontWeight: 700, fontSize: 10 }}>{style.label}</span>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 10 }}>
        <ScoreBar score={offer.puntuacion} resultado={offer.resultado} dm={dm} />
      </div>

      <OfferTrustSignals
        offer={offer}
        darkMode={dm}
        compact
        maxSignals={2}
        style={{ marginBottom: 10 }}
      />

      {/* Skills match */}
      {offer.skills_match && offer.skills_match.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {offer.skills_match.slice(0, 5).map((skill, i) => {
            const c = tagColor(i);
            return (
              <span key={skill} style={{
                fontSize: 10, fontWeight: 600, borderRadius: 20,
                padding: "2px 8px", border: `1px solid ${c.border}`,
                background: c.bg, color: c.color,
              }}>
                {skill}
              </span>
            );
          })}
          {offer.skills_match.length > 5 && (
            <span style={{ fontSize: 10, color: dm ? "#64748b" : "#9ca3af", padding: "2px 4px" }}>
              +{offer.skills_match.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Salary + date */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: dm ? "#64748b" : "#9ca3af" }}>
        <span>{offer.salario && offer.salario !== "Salario no especificado" ? offer.salario : ""}</span>
        <span style={{ color: style.border, fontWeight: 600 }}>Ver detalles →</span>
      </div>
    </div>
  );
}

// ─── Componente: modal de detalle de oferta ──────────────────────────────────

function OfferModal({ offer, dm, onClose, onCreateVariant = null, creatingVariant = false }) {
  const style = RESULT_STYLES[normalizeResultado(offer.resultado)] || RESULT_STYLES.NO_ENCAJA;
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: dm ? "#1e293b" : "#fff",
          borderRadius: 18, padding: 28,
          maxWidth: 640, width: "100%", maxHeight: "85vh",
          overflowY: "auto", fontFamily: typography.family,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header modal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1, minWidth: 0 }}>
            <CompanyLogo
              name={offer.empresa || "?"}
              logoUrl={offer.logo_url || offer.company_logo_url}
              size={52}
              darkMode={dm}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", lineHeight: 1.3 }}>
                {offer.titulo}
              </div>
              <div style={{ fontSize: 13, color: dm ? "#94a3b8" : "#6b7280", marginTop: 2 }}>
                {[offer.empresa, offer.ubicacion].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 22,
            cursor: "pointer", color: dm ? "#64748b" : "#9ca3af",
            lineHeight: 1, padding: 4, flexShrink: 0,
          }}>×</button>
        </div>

        {/* Badge + score */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            background: style.iconBg, borderRadius: 20, padding: "4px 14px",
            display: "flex", gap: 5, alignItems: "center",
          }}>
            <span style={{ color: style.iconColor, fontWeight: 800 }}>{style.icon}</span>
            <span style={{ color: style.iconColor, fontWeight: 700, fontSize: 12 }}>{style.label}</span>
          </div>
          <div style={{ flex: 1 }}>
            <ScoreBar score={offer.puntuacion} resultado={offer.resultado} dm={dm} />
          </div>
        </div>

        <OfferTrustSignals
          offer={offer}
          darkMode={dm}
          showDetail
          style={{ marginBottom: 18 }}
        />

        {/* Puntos fuertes */}
        {offer.strengths && offer.strengths.length > 0 && (
          <Section title="Puntos fuertes" color="#10b981" dm={dm}>
            {offer.strengths.map((s, i) => (
              <BulletItem key={i} text={s} color="#10b981" dm={dm} />
            ))}
          </Section>
        )}

        {/* Gaps */}
        {offer.gaps && offer.gaps.length > 0 && (
          <Section title="Gaps detectados" color="#f59e0b" dm={dm}>
            {offer.gaps.map((g, i) => (
              <BulletItem key={i} text={g} color="#f59e0b" dm={dm} />
            ))}
          </Section>
        )}

        {/* Blockers */}
        {offer.blockers && offer.blockers.length > 0 && (
          <Section title="Incompatibilidades" color="#ef4444" dm={dm}>
            {offer.blockers.map((b, i) => (
              <BulletItem key={i} text={b} color="#ef4444" dm={dm} />
            ))}
          </Section>
        )}

        {(offer.offer_requirements?.critical?.length > 0 ||
          offer.offer_requirements?.required_skill_years?.length > 0 ||
          offer.offer_requirements?.hard_constraints?.length > 0) && (
          <Section title="Lectura de la descripción" color="#2563eb" dm={dm}>
            {offer.offer_requirements?.critical?.slice(0, 3).map((item, i) => (
              <BulletItem key={`critical-${i}`} text={`Crítico: ${item}`} color="#b45309" dm={dm} />
            ))}
            {offer.offer_requirements?.required_skill_years?.slice(0, 3).map((item, i) => (
              <BulletItem key={`years-${i}`} text={`${item.skill}: ${item.years}+ años`} color="#2563eb" dm={dm} />
            ))}
            {offer.offer_requirements?.hard_constraints?.slice(0, 2).map((item, i) => (
              <BulletItem key={`constraint-${i}`} text={`Condición: ${item}`} color="#ef4444" dm={dm} />
            ))}
          </Section>
        )}

        {/* Descripción */}
        {offer.descripcion && (
          <Section title="Descripción" dm={dm}>
            <div
              style={{ fontSize: 13, color: dm ? "#94a3b8" : "#4b5563", lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: decodeHtml(offer.descripcion || "") }}
            />
          </Section>
        )}

        {/* CTA */}
        {onCreateVariant && (
          <button
            onClick={() => onCreateVariant(offer)}
            disabled={creatingVariant}
            style={{
              display: "block", width: "100%", textAlign: "center", marginTop: 20, marginBottom: offer.url ? 10 : 0,
              background: "none", color: "#7c3aed",
              border: "1.5px solid #7c3aed",
              padding: "12px 24px", borderRadius: 50, fontWeight: 700,
              fontSize: 14, cursor: creatingVariant ? "wait" : "pointer",
              opacity: creatingVariant ? 0.7 : 1,
              fontFamily: typography.family,
            }}
          >
            {creatingVariant ? "Creando variante..." : "Crear variante de CV para esta oferta"}
          </button>
        )}
        {offer.url && (
          <a
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", textAlign: "center", marginTop: 20,
              background: gradients.primary, color: "#fff",
              padding: "12px 24px", borderRadius: 50, fontWeight: 700,
              fontSize: 14, textDecoration: "none",
              boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
            }}
          >
            Ver oferta completa →
          </a>
        )}
      </div>
    </div>
  );
}

function Section({ title, color, children, dm }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: color || (dm ? "#64748b" : "#9ca3af"),
        marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

function BulletItem({ text, color, dm }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
      <span style={{ color, fontWeight: 700, fontSize: 14, flexShrink: 0, marginTop: 1 }}>·</span>
      <span style={{ fontSize: 13, color: dm ? "#cbd5e1" : "#374151", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

// ─── Componente: tarjeta de resumen de perfil detectado ──────────────────────

function ProfileSummaryCard({ profile, dm, onSuggestProfile }) {
  const seniority = SENIORITY_LABELS[profile.seniority] || SENIORITY_LABELS.desconocido;

  return (
    <div style={{
      background: dm ? "#1e293b" : "#fff",
      border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
      borderRadius: 16, padding: 22,
      fontFamily: typography.family,
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    }}>
      {/* Nombre */}
      {profile.full_name && (
        <div style={{ fontSize: 17, fontWeight: 800, color: dm ? "#f1f5f9" : "#111827", marginBottom: 4 }}>
          {profile.full_name}
        </div>
      )}

      {/* Roles objetivo */}
      {profile.target_roles && profile.target_roles.length > 0 && (
        <div style={{ fontSize: 13, color: dm ? "#94a3b8" : "#6b7280", marginBottom: 12 }}>
          {profile.target_roles.join(" · ")}
        </div>
      )}

      {/* Seniority + años */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, borderRadius: 20,
          padding: "3px 12px",
          background: seniority.bg, color: seniority.color,
        }}>
          {seniority.label}
        </span>
        {profile.years_experience != null && (
          <span style={{
            fontSize: 12, fontWeight: 600, borderRadius: 20,
            padding: "3px 12px",
            background: dm ? "rgba(255,255,255,0.06)" : "#f3f4f6",
            color: dm ? "#cbd5e1" : "#374151",
          }}>
            {profile.years_experience} año{profile.years_experience !== 1 ? "s" : ""} de exp.
          </span>
        )}
      </div>

      {/* Skills */}
      {profile.skills && profile.skills.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: dm ? "#64748b" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
            Skills detectadas
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {profile.skills.slice(0, 20).map((skill, i) => {
              const c = tagColor(i);
              return (
                <span key={skill} style={{
                  fontSize: 11, fontWeight: 600, borderRadius: 20,
                  padding: "3px 9px", border: `1px solid ${c.border}`,
                  background: c.bg, color: c.color,
                }}>
                  {skill}
                </span>
              );
            })}
            {profile.skills.length > 20 && (
              <span style={{ fontSize: 11, color: dm ? "#64748b" : "#9ca3af", padding: "3px 4px" }}>
                +{profile.skills.length - 20} más
              </span>
            )}
          </div>
        </div>
      )}

      {/* Idiomas */}
      {profile.languages && profile.languages.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: dm ? "#64748b" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
            Idiomas
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {profile.languages.map((l, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 600, borderRadius: 20,
                padding: "3px 10px",
                background: dm ? "rgba(255,255,255,0.06)" : "#f3f4f6",
                color: dm ? "#cbd5e1" : "#374151",
              }}>
                {l.language} ({l.level})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ubicaciones / modalidades */}
      {(profile.preferred_locations?.length > 0 || profile.work_modalities?.length > 0) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: dm ? "#64748b" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
            Preferencias
          </div>
          <div style={{ fontSize: 12, color: dm ? "#94a3b8" : "#6b7280" }}>
            {[...profile.preferred_locations || [], ...profile.work_modalities || []].join(" · ")}
          </div>
        </div>
      )}

      {/* Resumen */}
      {profile.summary && (
        <div style={{
          fontSize: 12, color: dm ? "#94a3b8" : "#6b7280",
          lineHeight: 1.6, fontStyle: "italic",
          borderTop: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#f3f4f6"}`,
          paddingTop: 12, marginTop: 4,
        }}>
          "{profile.summary}"
        </div>
      )}

      {/* Sugerencia actualizar perfil */}
      <button
        onClick={onSuggestProfile}
        style={{
          width: "100%", marginTop: 16, padding: "10px 16px",
          background: "none", border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
          borderRadius: 10, cursor: "pointer", fontFamily: typography.family,
          fontSize: 12, fontWeight: 600, color: dm ? "#94a3b8" : "#6b7280",
          transition: `all ${transition.smooth}`,
          textAlign: "center",
        }}
        onMouseEnter={e => { e.target.style.borderColor = "#2563eb"; e.target.style.color = "#2563eb"; }}
        onMouseLeave={e => { e.target.style.borderColor = dm ? "rgba(255,255,255,0.1)" : "#e5e7eb"; e.target.style.color = dm ? "#94a3b8" : "#6b7280"; }}
      >
        ¿Actualizar mi perfil con estos datos? →
      </button>
    </div>
  );
}

// ─── Componente: zona de upload ───────────────────────────────────────────────

function UploadZone({ file, onFile, isDragging, onDragEnter, onDragLeave, onDrop, dm }) {
  const inputRef = useRef(null);

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => !file && inputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging ? "#2563eb" : file ? "#10b981" : (dm ? "rgba(255,255,255,0.15)" : "#d1d5db")}`,
        borderRadius: 16, padding: "32px 24px",
        textAlign: "center", cursor: file ? "default" : "pointer",
        background: isDragging
          ? (dm ? "rgba(37,99,235,0.12)" : "#eff6ff")
          : file
          ? (dm ? "rgba(16,185,129,0.06)" : "#f0fdf4")
          : (dm ? "rgba(255,255,255,0.02)" : "#fafafa"),
        transition: `all ${transition.smooth}`,
        fontFamily: typography.family,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
      />

      {file ? (
        <div>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>
            {file.name}
          </div>
          <div style={{ fontSize: 12, color: dm ? "#64748b" : "#9ca3af", marginBottom: 12 }}>
            {formatBytes(file.size)}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onFile(null); }}
            style={{
              background: "none", border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
              borderRadius: 20, padding: "5px 14px", cursor: "pointer",
              fontSize: 12, color: dm ? "#94a3b8" : "#6b7280",
              fontFamily: typography.family,
            }}
          >
            Cambiar archivo
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", marginBottom: 6 }}>
            {isDragging ? "Suelta aquí tu CV" : "Arrastra tu CV aquí"}
          </div>
          <div style={{ fontSize: 13, color: dm ? "#64748b" : "#9ca3af", marginBottom: 14 }}>
            o haz clic para seleccionar el archivo
          </div>
          <div style={{
            display: "inline-block", fontSize: 11, fontWeight: 600,
            color: dm ? "#475569" : "#9ca3af",
            background: dm ? "rgba(255,255,255,0.05)" : "#f3f4f6",
            borderRadius: 20, padding: "4px 12px",
          }}>
            PDF · máximo {MAX_FILE_MB} MB
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente: indicador de carga ──────────────────────────────────────────

function LoadingIndicator({ step, dm }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0", fontFamily: typography.family }}>
      {/* Spinner */}
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        border: `3px solid ${dm ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
        borderTopColor: "#2563eb",
        margin: "0 auto 20px",
        animation: "cv-spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", marginBottom: 6 }}>
        {LOADING_STEPS[step] || "Procesando…"}
      </div>
      {/* Steps */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
        {LOADING_STEPS.map((s, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: i <= step ? "#2563eb" : (dm ? "rgba(255,255,255,0.1)" : "#e5e7eb"),
            transition: `background ${transition.smooth}`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const SESSION_KEY = "cv_search_result";

export default function CVSearch({ addToast, darkMode: dm }) {
  const [activeTab, setActiveTab] = useState("buscar");

  // ── Tab: Buscar ──
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [selectedOffer, setSelectedOffer] = useState(null);

  // ── Tab: Mejorar ──
  const [improveFile, setImproveFile] = useState(null);
  const [improveLoading, setImproveLoading] = useState(false);
  const [improveError, setImproveError] = useState(null);
  const [improveResult, setImproveResult] = useState(null);   // resultado de /improve-full
  const [improveSearchLoading, setImproveSearchLoading] = useState(false);
  const [improveSearchResult, setImproveSearchResult] = useState(null); // ofertas del CV mejorado
  const [improveSelectedOffer, setImproveSelectedOffer] = useState(null);

  // Persistir resultado de búsqueda en sessionStorage
  useEffect(() => {
    try {
      if (result) sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* noop */ }
  }, [result]);

  // Simular avance de pasos mientras carga
  useEffect(() => {
    if (!loading) return;
    const timers = [
      setTimeout(() => setLoadingStep(1), 2000),
      setTimeout(() => setLoadingStep(2), 5000),
      setTimeout(() => setLoadingStep(3), 9000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  const handleFile = useCallback((f) => {
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    if (!dropped.name.toLowerCase().endsWith(".pdf")) {
      setError("Solo se aceptan archivos PDF.");
      return;
    }
    if (dropped.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`El archivo supera el límite de ${MAX_FILE_MB} MB.`);
      return;
    }
    handleFile(dropped);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);
    setLoadingStep(0);

    try {
      const data = await analyzeCV(file);
      setResult(data);
      addToast?.("CV analizado correctamente", "success");
    } catch (err) {
      const msg = err?.detail || err?.message || "Error al analizar el CV. Inténtalo de nuevo.";
      setError(msg);
      addToast?.(msg, "error");
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handleSuggestProfile = () => {
    addToast?.("Ve a «Mi perfil» para actualizar tus datos manualmente con la información detectada.", "success");
  };

  const handleImprove = async () => {
    if (!improveFile) return;
    setImproveError(null);
    setImproveResult(null);
    setImproveSearchResult(null);
    setImproveLoading(true);
    try {
      const data = await improveCVFull(improveFile);
      setImproveResult(data);
      addToast?.("CV mejorado con éxito", "success");
    } catch (err) {
      const msg = err?.detail || err?.message || "Error al mejorar el CV. Inténtalo de nuevo.";
      setImproveError(msg);
      addToast?.(msg, "error");
    } finally {
      setImproveLoading(false);
    }
  };

  const handleSearchFromImprovement = async () => {
    if (!improveResult?.improvement_id) return;
    setImproveSearchLoading(true);
    setImproveSearchResult(null);
    try {
      const data = await searchFromImprovement(improveResult.improvement_id);
      setImproveSearchResult(data);
      addToast?.(`${data.offers?.length || 0} ofertas encontradas`, "success");
    } catch (err) {
      const msg = err?.detail || err?.message || "Error al buscar ofertas.";
      addToast?.(msg, "error");
    } finally {
      setImproveSearchLoading(false);
    }
  };

  const counts = result ? {
    aplica: result.offers.filter(o => normalizeResultado(o.resultado) === "APLICA").length,
    quiza: result.offers.filter(o => normalizeResultado(o.resultado) === "QUIZÁ").length,
    noEncaja: result.offers.filter(o => normalizeResultado(o.resultado) === "NO_ENCAJA").length,
  } : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: dm
        ? "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)"
        : "linear-gradient(180deg, #f0f4ff 0%, #e8f0fe 100%)",
      fontFamily: typography.family,
    }}>
      {/* Animaciones y responsive */}
      <style>{`
        @keyframes cv-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .cv-results-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* ── Cabecera ── */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800,
            background: gradients.text, WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent", backgroundClip: "text",
            margin: "0 0 10px",
          }}>
            Tu CV, potenciado con IA
          </h1>
          <p style={{ fontSize: 14, color: dm ? "#94a3b8" : "#6b7280", maxWidth: 520, margin: "0 auto" }}>
            Sube tu CV en PDF para buscar ofertas compatibles o mejorar su puntuación ATS.
          </p>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 28,
          background: dm ? "rgba(255,255,255,0.05)" : "#f1f5f9",
          borderRadius: 14, padding: 4, maxWidth: 580, margin: "0 auto 28px",
        }}>
          {[
            { id: "buscar", label: "Buscar ofertas", icon: "🔍" },
            { id: "mejorar", label: "Mejorar CV", icon: "✨" },
            { id: "mis-cvs", label: "Mis CVs", icon: "📄" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: "9px 14px", borderRadius: 10, border: "none",
                cursor: "pointer", fontFamily: typography.family,
                fontSize: 13, fontWeight: 600,
                transition: `all ${transition.smooth}`,
                background: activeTab === tab.id
                  ? (dm ? "#334155" : "#fff")
                  : "transparent",
                color: activeTab === tab.id
                  ? (dm ? "#f1f5f9" : "#111827")
                  : (dm ? "#64748b" : "#6b7280"),
                boxShadow: activeTab === tab.id
                  ? (dm ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.08)")
                  : "none",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════ TAB: MEJORAR CV ══════════════ */}
        {activeTab === "mejorar" && (
          <ImproveTabNew
            file={improveFile}
            setFile={setImproveFile}
            loading={improveLoading}
            error={improveError}
            setError={setImproveError}
            result={improveResult}
            setResult={setImproveResult}
            searchLoading={improveSearchLoading}
            searchResult={improveSearchResult}
            selectedOffer={improveSelectedOffer}
            setSelectedOffer={setImproveSelectedOffer}
            onImprove={handleImprove}
            onSearchFromImprovement={handleSearchFromImprovement}
            addToast={addToast}
            dm={dm}
          />
        )}

        {/* ══════════════ TAB: MIS CVS ══════════════ */}
        {activeTab === "mis-cvs" && (
          <MisCVsTab
            addToast={addToast}
            onSearchFromId={async (id) => {
              // Busca desde un improvement guardado y va al tab buscar
              setImproveSearchLoading(true);
              setImproveSearchResult(null);
              try {
                const data = await searchFromImprovement(id);
                setImproveSearchResult(data);
                setImproveResult({ improvement_id: id });
                setActiveTab("mejorar");
                addToast?.(`${data.offers?.length || 0} ofertas encontradas`, "success");
              } catch (err) {
                addToast?.(err?.detail || "Error al buscar ofertas.", "error");
              } finally {
                setImproveSearchLoading(false);
              }
            }}
            dm={dm}
          />
        )}

        {/* ══════════════ TAB: BUSCAR OFERTAS ══════════════ */}
        {activeTab === "buscar" && <>

        {/* ── Zona de upload ── */}
        {!result && (
          <div style={{ maxWidth: 560, margin: "0 auto 24px" }}>
            <UploadZone
              file={file}
              onFile={handleFile}
              isDragging={isDragging}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              dm={dm}
            />

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10,
                background: "#fff1f2", border: "1px solid #fecdd3",
                fontSize: 13, color: "#be123c", fontWeight: 600,
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Botón analizar */}
            {file && !loading && (
              <button
                onClick={handleAnalyze}
                style={{
                  width: "100%", marginTop: 16, padding: "14px 24px",
                  background: gradients.primary, color: "#fff",
                  border: "none", borderRadius: 50, cursor: "pointer",
                  fontSize: 15, fontWeight: 700, fontFamily: typography.family,
                  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                  transition: `all ${transition.smooth}`,
                }}
                onMouseEnter={e => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 20px rgba(37,99,235,0.4)"; }}
                onMouseLeave={e => { e.target.style.transform = "none"; e.target.style.boxShadow = "0 4px 14px rgba(37,99,235,0.3)"; }}
              >
                Analizar CV y buscar ofertas
              </button>
            )}
          </div>
        )}

        {/* ── Cómo funciona (visible solo cuando no hay resultado ni archivo) ── */}
        {!result && !file && !loading && (
          <div style={{ maxWidth: 700, margin: "32px auto 0" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
            }}>
              {[
                { icon: "📄", title: "Sube tu CV en PDF", desc: "Acepta cualquier CV en formato PDF de hasta 5 MB." },
                { icon: "🤖", title: "La IA lo analiza", desc: "Claude extrae tus skills, experiencia y perfil automáticamente." },
                { icon: "🎯", title: "Ofertas a tu medida", desc: "Recibes un ranking con APLICA / QUIZÁ / NO ENCAJA para cada oferta." },
              ].map(step => (
                <div key={step.title} style={{
                  background: dm ? "rgba(255,255,255,0.04)" : "#fff",
                  border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e8ecf1"}`,
                  borderRadius: 16, padding: "20px 18px", textAlign: "center",
                  boxShadow: dm ? "none" : "0 1px 6px rgba(0,0,0,0.05)",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{step.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", marginBottom: 6, fontFamily: typography.family }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 12, color: dm ? "#64748b" : "#6b7280", lineHeight: 1.6, fontFamily: typography.family }}>
                    {step.desc}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 16, padding: "12px 18px", borderRadius: 12,
              background: dm ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.05)",
              border: `1px solid ${dm ? "rgba(37,99,235,0.2)" : "rgba(37,99,235,0.15)"}`,
              fontSize: 13, color: dm ? "#93c5fd" : "#1d4ed8",
              fontFamily: typography.family, textAlign: "center",
            }}>
              💡 <strong>Tip:</strong> Si tu CV está actualizado obtendrás mejores resultados que buscando solo por stack tecnológico.
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <div style={{
              background: dm ? "#1e293b" : "#fff",
              borderRadius: 16, padding: "8px 24px 24px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            }}>
              <LoadingIndicator step={loadingStep} dm={dm} />
            </div>
          </div>
        )}

        {/* ── Resultados ── */}
        {result && !loading && (
          <>
            {/* Banner de éxito + reintentar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 12, marginBottom: 24,
              background: dm ? "rgba(16,185,129,0.08)" : "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 12, padding: "12px 18px",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>
                ✓ Análisis completado — {result.offers.length} ofertas evaluadas
                {counts && (
                  <span style={{ fontWeight: 400, color: dm ? "#6ee7b7" : "#047857", marginLeft: 8 }}>
                    ({counts.aplica} aplica · {counts.quiza} quizá · {counts.noEncaja} no encaja)
                  </span>
                )}
              </div>
              <button
                onClick={() => { setResult(null); setFile(null); setError(null); sessionStorage.removeItem(SESSION_KEY); }}
                style={{
                  background: "none", border: "1px solid #a7f3d0",
                  borderRadius: 20, padding: "5px 14px", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, color: "#10b981",
                  fontFamily: typography.family,
                }}
              >
                Analizar otro CV
              </button>
            </div>

            {/* Layout dos columnas */}
            <div className="cv-results-grid" style={{
              display: "grid",
              gridTemplateColumns: "300px 1fr",
              gap: 24,
              alignItems: "start",
            }}>
              {/* Columna izquierda: perfil */}
              <div style={{ position: "sticky", top: 80 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: dm ? "#64748b" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Perfil detectado en el CV
                </div>
                <ProfileSummaryCard
                  profile={result.structured_profile}
                  dm={dm}
                  onSuggestProfile={handleSuggestProfile}
                />
              </div>

              {/* Columna derecha: ofertas */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: dm ? "#64748b" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Ofertas encontradas · ordenadas por compatibilidad
                </div>

                {result.offers.length === 0 ? (
                  <div style={{
                    background: dm ? "#1e293b" : "#fff", borderRadius: 16,
                    padding: 32, textAlign: "center",
                    border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", marginBottom: 6 }}>
                      No se encontraron ofertas
                    </div>
                    <div style={{ fontSize: 13, color: dm ? "#64748b" : "#9ca3af" }}>
                      Prueba a actualizar tu perfil con más skills o intenta de nuevo más tarde.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {result.offers.map(offer => (
                      <OfferCard
                        key={offer.adzuna_id || offer.id}
                        offer={offer}
                        dm={dm}
                        onSelect={setSelectedOffer}
                      />
                    ))}
                  </div>
                )}

                {/* Skills gap */}
                {result.skills_gap && (
                  <SkillsGapPanel gap={result.skills_gap} dm={dm} />
                )}
              </div>
            </div>

          </>
        )}
        </>}
        {/* Fin tab buscar */}
      </div>

      {/* Modal de detalle de oferta */}
      {selectedOffer && (
        <OfferModal
          offer={selectedOffer}
          dm={dm}
          onClose={() => setSelectedOffer(null)}
        />
      )}
    </div>
  );
}

// ─── Tab: Mejorar CV con IA ───────────────────────────────────────────────────

function AtsScoreGauge({ score, label, dm }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        position: "relative", width: 90, height: 90, margin: "0 auto 8px",
        borderRadius: "50%",
        background: `conic-gradient(${color} ${score * 3.6}deg, ${dm ? "rgba(255,255,255,0.08)" : "#e5e7eb"} 0deg)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 70, height: 70, borderRadius: "50%",
          background: dm ? "#1e293b" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column",
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 9, color: dm ? "#64748b" : "#9ca3af", fontWeight: 600 }}>/100</span>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: dm ? "#94a3b8" : "#6b7280" }}>{label}</div>
    </div>
  );
}

function ImproveBulletList({ items, color, dm }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color, fontWeight: 800, flexShrink: 0, fontSize: 14, lineHeight: "20px" }}>›</span>
          <span style={{ fontSize: 13, color: dm ? "#cbd5e1" : "#374151", lineHeight: 1.5 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

function ImproveSection({ title, color, icon, children, dm }) {
  return (
    <div style={{
      background: dm ? "#1e293b" : "#fff",
      border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
      borderRadius: 12, padding: "16px 18px",
      fontFamily: typography.family,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function CopyBox({ text, dm }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        background: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
        border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
        borderRadius: 8, padding: "12px 14px",
        fontSize: 13, color: dm ? "#cbd5e1" : "#374151",
        lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
        maxHeight: 160, overflowY: "auto",
      }}>
        {text}
      </div>
      <button
        onClick={handleCopy}
        style={{
          position: "absolute", top: 8, right: 8,
          background: copied ? "#10b981" : (dm ? "#334155" : "#e2e8f0"),
          color: copied ? "#fff" : (dm ? "#94a3b8" : "#64748b"),
          border: "none", borderRadius: 6, padding: "3px 10px",
          fontSize: 11, fontWeight: 600, cursor: "pointer",
          fontFamily: typography.family, transition: "all 0.2s",
        }}
      >
        {copied ? "✓ Copiado" : "Copiar"}
      </button>
    </div>
  );
}

const PROBLEM_ICONS = { keywords: "🔑", structure: "🏗", verbos: "💬", metrics: "📊", format: "📐" };
const PROBLEM_LABELS = { keywords: "Palabras clave", structure: "Estructura", verbos: "Verbos", metrics: "Métricas", format: "Formato" };

function ImproveTabNew({
  file, setFile, loading, error, setError,
  result, setResult, searchLoading, searchResult,
  selectedOffer, setSelectedOffer,
  onImprove, onSearchFromImprovement, addToast, dm,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [cvExpanded, setCvExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editorState, setEditorState] = useState({ open: false, json: null, variantId: null, variant: null });
  const [creatingVariantId, setCreatingVariantId] = useState(null);
  const [searchSortBy, setSearchSortBy] = useState("compatibilidad");
  const [onlyVerifiedOffers, setOnlyVerifiedOffers] = useState(false);
  const [onlyDirectOffers, setOnlyDirectOffers] = useState(false);
  const [hideAggregatedOffers, setHideAggregatedOffers] = useState(false);
  const [onlySalaryOffers, setOnlySalaryOffers] = useState(false);
  const [onlyJuniorOffers, setOnlyJuniorOffers] = useState(false);

  // Auto-open the editor when a new CV is generated (if structured JSON is available).
  // Using improvement_id as dependency so it only fires on a new generation, not on every save.
  useEffect(() => {
    if (result?.cv_structured_json && result?.improvement_id) {
      setEditorState({ open: true, json: result.cv_structured_json, variantId: null, variant: null });
    }
  }, [result?.improvement_id]);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) { setError("Solo se aceptan archivos PDF."); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`El archivo supera ${MAX_FILE_MB} MB.`); return; }
    setError(null); setFile(f);
  }, [setFile, setError]);

  const handleDownload = async () => {
    if (!result?.improvement_id) return;
    setDownloading(true);
    try {
      await downloadCVPdf(result.improvement_id);
    } catch (err) {
      addToast?.(err?.detail || "Error al descargar el PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

  const handleCreateVariant = async (offer) => {
    if (!result?.improvement_id) return;
    const variantKey = offer?.adzuna_id || offer?.id || "variant";
    setCreatingVariantId(variantKey);
    try {
      const data = await createCVVariant(result.improvement_id, { offer });
      if (!data?.cv_json || !data?.variant?.id) {
        throw new Error("No se pudo preparar la variante");
      }
      setEditorState({
        open: true,
        json: data.cv_json,
        variantId: data.variant.id,
        variant: data.variant,
      });
      setSelectedOffer(null);
      addToast?.(
        data.created ? "Variante creada para esta oferta" : "Abriendo la variante existente para esta oferta",
        "success"
      );
    } catch (err) {
      addToast?.(err?.detail || err?.message || "Error al crear la variante del CV", "error");
    } finally {
      setCreatingVariantId(null);
    }
  };

  const quotaLeft = result?.quota?.cv_improve_remaining;
  const qualityCounts = getOfferQualityCounts(searchResult?.offers || []);
  // Best-effort numeric salary used only to order offers by "salario".
  const parseSalaryValue = (salario) => {
    if (!salario || typeof salario !== "string") return 0;
    const matches = salario.replace(/[.\s]/g, "").match(/\d{4,6}/g);
    return matches ? Math.max(...matches.map(Number)) : 0;
  };
  const filteredOffers = (() => {
    const nextOffers = [...(searchResult?.offers || [])];
    let current = nextOffers;

    if (onlyVerifiedOffers) current = current.filter(isVerifiedOffer);
    if (onlyDirectOffers) current = current.filter(isDirectSourceOffer);
    if (hideAggregatedOffers) current = current.filter((offer) => !isAggregatorOffer(offer));
    if (onlySalaryOffers) current = current.filter(hasVisibleSalary);
    if (onlyJuniorOffers) current = current.filter(isJuniorFriendlyOffer);

    if (searchSortBy === "confianza") {
      current.sort((a, b) => (b.source_confidence || 0) - (a.source_confidence || 0));
    } else if (searchSortBy === "fecha") {
      current.sort((a, b) => new Date(b.fecha_publicacion || 0) - new Date(a.fecha_publicacion || 0));
    } else if (searchSortBy === "salario") {
      current.sort((a, b) => (parseSalaryValue(b.salario) || 0) - (parseSalaryValue(a.salario) || 0));
    } else {
      current.sort((a, b) => (b.ranking_score || b.puntuacion || 0) - (a.ranking_score || a.puntuacion || 0));
    }

    return current;
  })();

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>

      {/* ── PASO 1: Upload ── */}
      {!result && !loading && (
        <>
          <div style={{
            background: dm ? "rgba(124,58,237,0.08)" : "#faf5ff",
            border: `1px solid ${dm ? "rgba(124,58,237,0.2)" : "#e9d5ff"}`,
            borderRadius: 12, padding: "14px 18px", marginBottom: 20,
            fontSize: 13, color: dm ? "#c4b5fd" : "#6d28d9", lineHeight: 1.6,
          }}>
            La IA analiza tu CV, detecta problemas ATS, genera el CV mejorado completo y calcula la mejora de puntuacion.
            <span style={{ display: "block", fontSize: 12, opacity: 0.8, marginTop: 4 }}>Limite: 2 mejoras por dia. Se guarda automaticamente para descarga y busqueda de ofertas.</span>
          </div>
          <UploadZone file={file} onFile={(f) => { setError(null); setFile(f); }}
            isDragging={isDragging} onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} dm={dm} />
          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#fff1f2", border: "1px solid #fecdd3", fontSize: 13, color: "#be123c", fontWeight: 600 }}>
              {error}
            </div>
          )}
          {file && (
            <button onClick={onImprove} style={{
              width: "100%", marginTop: 16, padding: "14px 24px",
              background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
              color: "#fff", border: "none", borderRadius: 50, cursor: "pointer",
              fontSize: 15, fontWeight: 700, fontFamily: typography.family,
              boxShadow: "0 4px 14px rgba(124,58,237,0.3)", transition: `all ${transition.smooth}`,
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
            >
              Analizar y mejorar CV con IA
            </button>
          )}
        </>
      )}

      {/* ── PASO 2: Analizando ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 24px", background: dm ? "#1e293b" : "#fff", borderRadius: 16, border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${dm ? "rgba(124,58,237,0.3)" : "#e9d5ff"}`, borderTopColor: "#7c3aed", animation: "cv-spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: dm ? "#c4b5fd" : "#7c3aed", marginBottom: 6 }}>Mejorando tu CV con IA...</div>
          <div style={{ fontSize: 13, color: dm ? "#64748b" : "#9ca3af" }}>Esto puede tardar 15-30 segundos</div>
        </div>
      )}

      {/* ── PASO 3: Resultados ── */}
      {result && !loading && (
        <>
          {/* Banner de estado + acciones principales */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12, marginBottom: 20,
            background: dm ? "rgba(124,58,237,0.08)" : "#faf5ff",
            border: "1px solid #e9d5ff", borderRadius: 14, padding: "14px 18px",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#7c3aed" }}>CV mejorado y guardado</div>
              {quotaLeft != null && (
                <div style={{ fontSize: 12, color: dm ? "#a78bfa" : "#6d28d9", marginTop: 2 }}>{quotaLeft} mejoras restantes hoy</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {result?.cv_structured_json ? (
                <>
                  {/* Primary: open editor (which has preview + download inside) */}
                  <button onClick={() => setEditorState({ open: true, json: result.cv_structured_json, variantId: null, variant: null })} style={{
                    padding: "8px 18px", borderRadius: 20, border: "none",
                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                    color: "#fff", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, fontFamily: typography.family,
                    boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
                  }}>
                    Editar y descargar CV
                  </button>
                  {/* Secondary: direct download without opening the editor */}
                  <button onClick={handleDownload} disabled={downloading} style={{
                    padding: "8px 14px", borderRadius: 20, border: "1.5px solid #7c3aed",
                    background: "none", color: "#7c3aed", cursor: downloading ? "wait" : "pointer",
                    fontSize: 13, fontWeight: 600, fontFamily: typography.family, opacity: downloading ? 0.7 : 1,
                  }}>
                    {downloading ? "Descargando..." : "Descargar PDF directo"}
                  </button>
                </>
              ) : (
                <button onClick={handleDownload} disabled={downloading} style={{
                  padding: "8px 16px", borderRadius: 20, border: "1.5px solid #7c3aed",
                  background: "#7c3aed", color: "#fff", cursor: downloading ? "wait" : "pointer",
                  fontSize: 13, fontWeight: 700, fontFamily: typography.family, opacity: downloading ? 0.7 : 1,
                }}>
                  {downloading ? "Descargando..." : "Descargar PDF"}
                </button>
              )}
              <button onClick={() => { setResult(null); setFile(null); setError(null); }} style={{
                padding: "8px 16px", borderRadius: 20, border: "1.5px solid #e9d5ff",
                background: "none", color: "#7c3aed", cursor: "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: typography.family,
              }}>
                Nuevo CV
              </button>
            </div>
          </div>

          {editorState.open && editorState.json && (
            <CVEditorModal
              improvementId={result.improvement_id}
              initialJson={editorState.json}
              dm={dm}
              variantId={editorState.variantId}
              variant={editorState.variant}
              onClose={() => setEditorState({ open: false, json: null, variantId: null, variant: null })}
              onSaved={(editedJson, meta) => {
                if (!meta?.variantId) {
                  setResult((current) => ({ ...current, cv_structured_json: editedJson }));
                  setEditorState((current) => ({ ...current, json: editedJson }));
                  return;
                }
                setEditorState((current) => ({
                  ...current,
                  json: editedJson,
                  variant: current.variant ? { ...current.variant, name: meta.variantName || current.variant.name } : current.variant,
                }));
              }}
            />
          )}

          {/* ATS Scores */}
          <ImproveSection title="Puntuacion ATS" color="#7c3aed" icon="📊" dm={dm}>
            <div style={{ display: "flex", gap: 32, justifyContent: "center", padding: "8px 0" }}>
              <AtsScoreGauge score={result.ats_score_before} label="Original" dm={dm} />
              <div style={{ display: "flex", alignItems: "center", fontSize: 28, color: dm ? "#64748b" : "#9ca3af" }}>→</div>
              <AtsScoreGauge score={result.ats_score_after} label="Mejorado" dm={dm} />
            </div>
            <div style={{ textAlign: "center", fontSize: 13, color: dm ? "#94a3b8" : "#6b7280", marginTop: 8 }}>
              Mejora de <strong style={{ color: "#10b981", fontSize: 15 }}>+{result.ats_score_after - result.ats_score_before} puntos</strong>
            </div>
          </ImproveSection>

          {/* Problemas detectados */}
          {result.problems_detected?.length > 0 && (
            <ImproveSection title="Problemas detectados en el CV original" color="#ef4444" icon="⚠" dm={dm}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.problems_detected.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14 }}>{PROBLEM_ICONS[p.category] || "•"}</span>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", marginRight: 6 }}>
                        {PROBLEM_LABELS[p.category] || p.category}
                      </span>
                      <span style={{ fontSize: 13, color: dm ? "#cbd5e1" : "#374151" }}>{p.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ImproveSection>
          )}

          {/* Mejoras aplicadas */}
          {result.key_improvements?.length > 0 && (
            <ImproveSection title="Mejoras aplicadas" color="#10b981" icon="✓" dm={dm}>
              <ImproveBulletList items={result.key_improvements} color="#10b981" dm={dm} />
            </ImproveSection>
          )}

          {/* Keywords añadidas */}
          {result.keywords_to_add?.length > 0 && (
            <ImproveSection title="Palabras clave ATS incluidas" color="#2563eb" icon="🔑" dm={dm}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.keywords_to_add.map((kw, i) => {
                  const c = TAG_COLORS[i % TAG_COLORS.length];
                  return <span key={i} style={{ fontSize: 12, fontWeight: 600, borderRadius: 20, padding: "3px 10px", border: `1px solid ${c.border}`, background: c.bg, color: c.color }}>{kw}</span>;
                })}
              </div>
            </ImproveSection>
          )}

          {/* CV mejorado - preview */}
          {result.improved_cv_text && (
            <ImproveSection title="CV mejorado completo" color="#0ea5e9" icon="📝" dm={dm}>
              <div style={{ position: "relative" }}>
                <div style={{
                  background: dm ? "rgba(255,255,255,0.03)" : "#f8fafc",
                  border: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
                  borderRadius: 8, padding: "14px 16px",
                  fontSize: 12, color: dm ? "#94a3b8" : "#475569",
                  lineHeight: 1.7, fontFamily: "monospace",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  maxHeight: cvExpanded ? "none" : 220, overflow: "hidden",
                }}>
                  {result.improved_cv_text}
                </div>
                {!cvExpanded && (
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
                    background: dm ? "linear-gradient(transparent, #1e293b)" : "linear-gradient(transparent, #f8fafc)",
                  }} />
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={() => setCvExpanded(v => !v)} style={{
                  padding: "6px 14px", borderRadius: 20, border: `1px solid ${dm ? "rgba(255,255,255,0.15)" : "#e2e8f0"}`,
                  background: "none", color: dm ? "#94a3b8" : "#64748b", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: typography.family,
                }}>{cvExpanded ? "Contraer" : "Ver completo"}</button>
                <CopyBox text={result.improved_cv_text} dm={dm} />
              </div>
            </ImproveSection>
          )}

          {/* Botón buscar ofertas */}
          {!searchResult && !searchLoading && (
            <button onClick={onSearchFromImprovement} style={{
              width: "100%", marginTop: 8, marginBottom: 4, padding: "14px 24px",
              background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)",
              color: "#fff", border: "none", borderRadius: 50, cursor: "pointer",
              fontSize: 15, fontWeight: 700, fontFamily: typography.family,
              boxShadow: "0 4px 14px rgba(37,99,235,0.3)", transition: `all ${transition.smooth}`,
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
            >
              Buscar ofertas con este CV mejorado
            </button>
          )}

          {/* Loading búsqueda */}
          {searchLoading && (
            <div style={{ textAlign: "center", padding: "24px", background: dm ? "#1e293b" : "#fff", borderRadius: 14, border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`, marginTop: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #bfdbfe", borderTopColor: "#2563eb", animation: "cv-spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, color: dm ? "#93c5fd" : "#2563eb", fontWeight: 600 }}>Buscando ofertas...</div>
            </div>
          )}

          {/* Resultados de búsqueda */}
          {searchResult && !searchLoading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: dm ? "#94a3b8" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                {filteredOffers.length} ofertas visibles · motor propio priorizando compatibilidad y confianza
              </div>
              <div style={{
                display: "grid",
                gap: 12,
                marginBottom: 14,
                padding: "14px 16px",
                borderRadius: 14,
                background: dm ? "#1e293b" : "#fff",
                border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { label: "Verificadas", value: qualityCounts.verified, active: onlyVerifiedOffers, toggle: setOnlyVerifiedOffers },
                      { label: "Directas", value: qualityCounts.direct, active: onlyDirectOffers, toggle: setOnlyDirectOffers },
                      { label: "Con salario", value: qualityCounts.salaryVisible, active: onlySalaryOffers, toggle: setOnlySalaryOffers },
                      { label: "Junior", value: qualityCounts.juniorFriendly, active: onlyJuniorOffers, toggle: setOnlyJuniorOffers },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() => item.toggle(!item.active)}
                        style={{
                          padding: "7px 11px",
                          borderRadius: 999,
                          border: `1px solid ${item.active ? "transparent" : (dm ? "rgba(255,255,255,0.1)" : "#d1d5db")}`,
                          background: item.active ? "#0f766e" : (dm ? "rgba(255,255,255,0.04)" : "#f8fafc"),
                          color: item.active ? "#fff" : (dm ? "#cbd5e1" : "#374151"),
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: typography.family,
                        }}
                      >
                        {item.label} ({item.value})
                      </button>
                    ))}
                    <button
                      onClick={() => setHideAggregatedOffers((value) => !value)}
                      style={{
                        padding: "7px 11px",
                        borderRadius: 999,
                        border: `1px solid ${hideAggregatedOffers ? "transparent" : (dm ? "rgba(255,255,255,0.1)" : "#d1d5db")}`,
                        background: hideAggregatedOffers ? "#1d4ed8" : (dm ? "rgba(255,255,255,0.04)" : "#f8fafc"),
                        color: hideAggregatedOffers ? "#fff" : (dm ? "#cbd5e1" : "#374151"),
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: typography.family,
                      }}
                    >
                      Sin agregadas
                    </button>
                  </div>
                  <select
                    value={searchSortBy}
                    onChange={(e) => setSearchSortBy(e.target.value)}
                    style={{
                      minWidth: 190,
                      borderRadius: 10,
                      padding: "9px 12px",
                      border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#d1d5db"}`,
                      background: dm ? "#0f172a" : "#fff",
                      color: dm ? "#f8fafc" : "#111827",
                      fontFamily: typography.family,
                    }}
                  >
                    <option value="compatibilidad">Ordenar por compatibilidad</option>
                    <option value="confianza">Ordenar por confianza</option>
                    <option value="fecha">Mas recientes</option>
                    <option value="salario">Mayor salario</option>
                  </select>
                </div>
                <div style={{ fontSize: 12, color: dm ? "#94a3b8" : "#64748b", lineHeight: 1.6 }}>
                  Usa estos filtros para centrarte en ofertas verificadas, directas o mas amigables para perfiles junior antes de crear la variante del CV.
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredOffers.length > 0 ? filteredOffers.map(offer => (
                  <OfferCard key={offer.adzuna_id || offer.id} offer={offer} dm={dm} onSelect={setSelectedOffer} />
                )) : (
                  <div style={{
                    padding: "22px 18px",
                    borderRadius: 14,
                    background: dm ? "#1e293b" : "#fff",
                    border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                    fontSize: 13,
                    color: dm ? "#94a3b8" : "#64748b",
                    lineHeight: 1.6,
                  }}>
                    Ninguna oferta coincide con los filtros de calidad actuales. Prueba a desactivar alguno para recuperar mas opciones.
                  </div>
                )}
              </div>
              {searchResult.skills_gap && <SkillsGapPanel gap={searchResult.skills_gap} dm={dm} />}
            </div>
          )}

          {selectedOffer && (
            <OfferModal
              offer={selectedOffer}
              dm={dm}
              onClose={() => setSelectedOffer(null)}
              onCreateVariant={handleCreateVariant}
              creatingVariant={creatingVariantId === (selectedOffer?.adzuna_id || selectedOffer?.id || "variant")}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Mis CVs ─────────────────────────────────────────────────────────────

function MisCVsTab({ addToast, onSearchFromId, dm }) {
  const [improvements, setImprovements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [editorState, setEditorState] = useState({ open: false, id: null, json: null, variantId: null, variant: null });
  const [editLoading, setEditLoading] = useState(null);
  const [optimizingVariant, setOptimizingVariant] = useState(null);

  useEffect(() => {
    getMyImprovements()
      .then(d => setImprovements(d.improvements || []))
      .catch(() => setImprovements([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (id, variantId = null) => {
    setDownloading(variantId != null ? `variant-${variantId}` : id);
    try { await downloadCVPdf(id, null, null, variantId); }
    catch (err) { addToast?.(err?.detail || "Error al descargar", "error"); }
    finally { setDownloading(null); }
  };

  const handleOpenEditor = async (id, variant = null) => {
    const loadingKey = variant?.id != null ? `variant-${variant.id}` : id;
    setEditLoading(loadingKey);
    try {
      const data = await getCVEdit(id, variant?.id ?? null);
      if (data.source === "legacy" || !data.cv_json) {
        addToast?.("Este CV no tiene edición disponible. Regenera el CV para poder editarlo.", "error");
        return;
      }
      setEditorState({
        open: true,
        id,
        json: data.cv_json,
        variantId: data.variant_id || variant?.id || null,
        variant: data.variant || variant || null,
      });
    } catch (err) {
      addToast?.(err?.message || "Error al cargar el CV", "error");
    } finally {
      setEditLoading(null);
    }
  };

  const handleDeleteVariant = async (improvementId, variantId) => {
    try {
      await deleteCVVariant(improvementId, variantId);
      setImprovements((current) => (current || []).map((improvement) => {
        if (improvement.id !== improvementId) return improvement;
        const nextVariants = (improvement.variants || []).filter((variant) => variant.id !== variantId);
        return {
          ...improvement,
          variants: nextVariants,
          variant_count: nextVariants.length,
        };
      }));
      addToast?.("Variante eliminada", "success");
    } catch (err) {
      addToast?.(err?.detail || err?.message || "Error al eliminar la variante", "error");
    }
  };

  const handleOptimizeVariant = async (improvementId, variant) => {
    const optimizeKey = `variant-${variant.id}`;
    setOptimizingVariant(optimizeKey);
    try {
      const data = await optimizeCVVariantForOffer(improvementId, variant.id);
      setImprovements((current) => (current || []).map((improvement) => {
        if (improvement.id !== improvementId) return improvement;
        return {
          ...improvement,
          variants: (improvement.variants || []).map((item) => (
            item.id === variant.id
              ? { ...item, ...(data.variant || {}), updated_at: data.variant?.updated_at || item.updated_at }
              : item
          )),
        };
      }));
      addToast?.(data?.focus_summary || "Variante optimizada para la oferta", "success");
    } catch (err) {
      addToast?.(err?.detail || err?.message || "Error al optimizar la variante", "error");
    } finally {
      setOptimizingVariant(null);
    }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 48, color: dm ? "#64748b" : "#9ca3af" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#7c3aed", animation: "cv-spin 0.8s linear infinite", margin: "0 auto 12px" }} />
      Cargando tus CVs...
    </div>
  );

  if (!improvements?.length) return (
    <div style={{ textAlign: "center", padding: 48, maxWidth: 420, margin: "0 auto" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", marginBottom: 8 }}>Todavia no tienes CVs mejorados</div>
      <div style={{ fontSize: 14, color: dm ? "#64748b" : "#9ca3af" }}>Ve a la pestana "Mejorar CV" y sube tu CV para empezar.</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ fontSize: 13, color: dm ? "#64748b" : "#9ca3af", marginBottom: 16 }}>
        {improvements.length} CV{improvements.length !== 1 ? "s" : ""} mejorado{improvements.length !== 1 ? "s" : ""} guardado{improvements.length !== 1 ? "s" : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {improvements.map(imp => (
          <div key={imp.id} style={{
            background: dm ? "#1e293b" : "#fff",
            border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
            borderRadius: 14, padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            fontFamily: typography.family,
          }}>
            {/* Scores */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: imp.ats_score_before >= 60 ? "#f59e0b" : "#ef4444" }}>{imp.ats_score_before}</div>
                <div style={{ fontSize: 9, color: dm ? "#64748b" : "#9ca3af", fontWeight: 600 }}>ANTES</div>
              </div>
              <div style={{ fontSize: 16, color: dm ? "#475569" : "#cbd5e1" }}>→</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>{imp.ats_score_after}</div>
                <div style={{ fontSize: 9, color: dm ? "#64748b" : "#9ca3af", fontWeight: 600 }}>MEJORADO</div>
              </div>
            </div>

            {/* Keywords */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: dm ? "#64748b" : "#9ca3af", marginBottom: 4 }}>
                {new Date(imp.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              {imp.keywords_to_add?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {imp.keywords_to_add.map((kw, i) => {
                    const c = TAG_COLORS[i % TAG_COLORS.length];
                    return <span key={i} style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 8px", border: `1px solid ${c.border}`, background: c.bg, color: c.color }}>{kw}</span>;
                  })}
                </div>
              )}
              {imp.variants?.length > 0 && (
                <div style={{
                  marginTop: 12, paddingTop: 12,
                  borderTop: `1px solid ${dm ? "rgba(255,255,255,0.08)" : "#eef2ff"}`,
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Variantes por oferta
                  </div>
                  {imp.variants.map((variant) => {
                    const variantKey = `variant-${variant.id}`;
                    return (
                      <div key={variant.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 8, flexWrap: "wrap",
                        background: dm ? "rgba(255,255,255,0.03)" : "#faf5ff",
                        border: `1px solid ${dm ? "rgba(124,58,237,0.18)" : "#e9d5ff"}`,
                        borderRadius: 10, padding: "10px 12px",
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827" }}>
                            {variant.name}
                          </div>
                          <div style={{ fontSize: 11, color: dm ? "#94a3b8" : "#6b7280", marginTop: 2 }}>
                            {[variant.offer_title, variant.offer_company].filter(Boolean).join(" · ") || "Variante manual"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button onClick={() => handleDownload(imp.id, variant.id)} disabled={downloading === variantKey} style={{
                            padding: "6px 12px", borderRadius: 18, border: "1px solid #7c3aed",
                            background: "none", color: "#7c3aed", cursor: "pointer",
                            fontSize: 11, fontWeight: 700, fontFamily: typography.family,
                            opacity: downloading === variantKey ? 0.7 : 1,
                          }}>
                            {downloading === variantKey ? "..." : "PDF"}
                          </button>
                          <button onClick={() => handleOptimizeVariant(imp.id, variant)} disabled={optimizingVariant === variantKey} style={{
                            padding: "6px 12px", borderRadius: 18, border: "1px solid #0f766e",
                            background: "none", color: "#0f766e", cursor: "pointer",
                            fontSize: 11, fontWeight: 700, fontFamily: typography.family,
                            opacity: optimizingVariant === variantKey ? 0.7 : 1,
                          }}>
                            {optimizingVariant === variantKey ? "..." : "Optimizar IA"}
                          </button>
                          <button onClick={() => handleOpenEditor(imp.id, variant)} disabled={editLoading === variantKey} style={{
                            padding: "6px 12px", borderRadius: 18, border: "1px solid #2563eb",
                            background: "none", color: "#2563eb", cursor: "pointer",
                            fontSize: 11, fontWeight: 700, fontFamily: typography.family,
                            opacity: editLoading === variantKey ? 0.7 : 1,
                          }}>
                            {editLoading === variantKey ? "..." : "Editar"}
                          </button>
                          <button onClick={() => handleDeleteVariant(imp.id, variant.id)} style={{
                            padding: "6px 12px", borderRadius: 18, border: "1px solid #ef4444",
                            background: "none", color: "#ef4444", cursor: "pointer",
                            fontSize: 11, fontWeight: 700, fontFamily: typography.family,
                          }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => handleDownload(imp.id)} disabled={downloading === imp.id} style={{
                padding: "7px 14px", borderRadius: 20, border: "1.5px solid #7c3aed",
                background: "#7c3aed", color: "#fff", cursor: "pointer",
                fontSize: 12, fontWeight: 700, fontFamily: typography.family,
                opacity: downloading === imp.id ? 0.7 : 1,
              }}>
                {downloading === imp.id ? "..." : "Descargar PDF"}
              </button>
              <button onClick={() => handleOpenEditor(imp.id)} disabled={editLoading === imp.id} style={{
                padding: "7px 14px", borderRadius: 20, border: "1.5px solid #7c3aed",
                background: "none", color: "#7c3aed", cursor: "pointer",
                fontSize: 12, fontWeight: 700, fontFamily: typography.family,
                opacity: editLoading === imp.id ? 0.7 : 1,
              }}>
                {editLoading === imp.id ? "..." : "Editar"}
              </button>
              <button onClick={() => onSearchFromId(imp.id)} style={{
                padding: "7px 14px", borderRadius: 20, border: "1.5px solid #2563eb",
                background: "none", color: "#2563eb", cursor: "pointer",
                fontSize: 12, fontWeight: 700, fontFamily: typography.family,
              }}>
                Buscar ofertas
              </button>
            </div>
          </div>
        ))}
      </div>

      {editorState.open && editorState.json && (
        <CVEditorModal
          improvementId={editorState.id}
          initialJson={editorState.json}
          dm={dm}
          variantId={editorState.variantId}
          variant={editorState.variant}
          onClose={() => setEditorState({ open: false, id: null, json: null, variantId: null, variant: null })}
          onSaved={(editedJson, meta) => {
            setEditorState((current) => ({ ...current, json: editedJson }));
            if (!meta?.variantId) return;
            setImprovements((current) => (current || []).map((improvement) => {
              if (improvement.id !== editorState.id) return improvement;
              return {
                ...improvement,
                variants: (improvement.variants || []).map((variant) => (
                  variant.id === meta.variantId
                    ? {
                        ...variant,
                        name: meta.variantName || variant.name,
                        updated_at: new Date().toISOString(),
                      }
                    : variant
                )),
              };
            }));
          }}
        />
      )}
    </div>
  );
}

// ─── Skills gap panel ─────────────────────────────────────────────────────────

function SkillsGapPanel({ gap, dm }) {
  if (!gap) return null;
  const { top_missing = [], top_matched = [], summary } = gap;
  if (!top_missing.length && !top_matched.length && !summary) return null;

  return (
    <div style={{
      marginTop: 20,
      background: dm ? "#1e293b" : "#fff",
      border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
      borderRadius: 16, padding: 20,
      fontFamily: typography.family,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", marginBottom: 14 }}>
        Análisis de skills
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {top_matched.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              ✓ Skills valoradas
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {top_matched.slice(0, 8).map((s, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 9px", background: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" }}>{s}</span>
              ))}
            </div>
          </div>
        )}
        {top_missing.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              ⚠ Skills más demandadas
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {top_missing.slice(0, 8).map((s, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 9px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {summary && (
        <p style={{ fontSize: 12, color: dm ? "#94a3b8" : "#6b7280", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
          {summary}
        </p>
      )}
    </div>
  );
}
