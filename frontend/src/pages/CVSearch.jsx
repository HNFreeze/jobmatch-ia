import { useState, useRef, useCallback, useEffect } from "react";
import { analyzeCV, getLatestCVAnalysis } from "../services/api";
import CompanyLogo from "../components/CompanyLogo";
import {
  gradients,
  typography,
  transition,
  colors,
} from "../constants/theme";

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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tagColor(idx) {
  return TAG_COLORS[idx % TAG_COLORS.length];
}

function ScoreBar({ score, resultado, dm }) {
  const style = RESULT_STYLES[resultado] || RESULT_STYLES.NO_ENCAJA;
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
  const style = RESULT_STYLES[offer.resultado] || RESULT_STYLES.NO_ENCAJA;
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

function OfferModal({ offer, dm, onClose }) {
  const style = RESULT_STYLES[offer.resultado] || RESULT_STYLES.NO_ENCAJA;
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

        {/* Descripción */}
        {offer.descripcion && (
          <Section title="Descripción" dm={dm}>
            <p style={{ fontSize: 13, color: dm ? "#94a3b8" : "#4b5563", lineHeight: 1.7, margin: 0 }}>
              {offer.descripcion.slice(0, 800)}{offer.descripcion.length > 800 ? "…" : ""}
            </p>
          </Section>
        )}

        {/* CTA */}
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

export default function CVSearch({ addToast, darkMode: dm }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(null);

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

  const counts = result ? {
    aplica: result.offers.filter(o => o.resultado === "APLICA").length,
    quiza: result.offers.filter(o => o.resultado === "QUIZÁ").length,
    noEncaja: result.offers.filter(o => o.resultado === "NO_ENCAJA").length,
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
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: dm ? "rgba(37,99,235,0.15)" : "rgba(37,99,235,0.08)",
            borderRadius: 20, padding: "5px 14px", marginBottom: 14,
          }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", letterSpacing: "0.06em" }}>
              NUEVA FUNCIONALIDAD
            </span>
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800,
            background: gradients.text, WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent", backgroundClip: "text",
            margin: "0 0 10px",
          }}>
            Buscar ofertas con tu CV
          </h1>
          <p style={{ fontSize: 14, color: dm ? "#94a3b8" : "#6b7280", maxWidth: 520, margin: "0 auto" }}>
            Sube tu CV en PDF y la IA detectará tu perfil automáticamente para encontrar las ofertas más relevantes.
          </p>
        </div>

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
                onClick={() => { setResult(null); setFile(null); setError(null); }}
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
