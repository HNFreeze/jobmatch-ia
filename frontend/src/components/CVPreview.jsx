// -*- coding: utf-8 -*-
/**
 * CVPreview — render HTML del cv_json canónico.
 *
 * Soporta dos plantillas:
 *   "professional_modern" (por defecto) — cabecera azul, secciones con fondo
 *   "ats_minimal"                       — diseño limpio, sin adornos
 *
 * - Los enlaces son <a target="_blank" rel="noopener noreferrer">
 * - No edita nada — solo renderiza
 * - Las secciones sin contenido no se renderizan
 * - Dark mode opcional via prop `dm`
 */

const PRIMARY = "#2563eb";
const DARK    = "#0f172a";
const GRAY    = "#6b7280";

// ── URL helpers ───────────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s,;'"<>)]+|github\.com\/[^\s,;'"<>)]+|gitlab\.com\/[^\s,;'"<>)]+|linkedin\.com\/[^\s,;'"<>)]+/;

function extractUrl(text) {
  const m = URL_RE.exec(text || "");
  if (!m) return { clean: text || "", url: null };
  const url   = m[0].replace(/[.,;)]+$/, "");
  const clean = (text.slice(0, m.index) + text.slice(m.index + m[0].length))
    .replace(/^\s*[|·\-]\s*|\s*[|·\-]\s*$/g, "")
    .trim();
  return { clean, url };
}

function ensureHttp(href) {
  if (!href) return "#";
  return href.startsWith("http") ? href : `https://${href}`;
}

function CvLink({ href, children }) {
  return (
    <a
      href={ensureHttp(href)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: PRIMARY, textDecoration: "underline", wordBreak: "break-all" }}
    >
      {children || href.replace(/^https?:\/\//, "").replace(/\/$/, "")}
    </a>
  );
}

// ── Flagged warning ───────────────────────────────────────────────────────────

function FlaggedBadge() {
  return (
    <div style={{
      fontSize: 10, color: "#92400e", background: "#fef3c7",
      border: "1px solid #fde68a", borderRadius: 4,
      padding: "1px 6px", display: "inline-block", marginBottom: 4, fontWeight: 700,
    }}>
      ⚠ Revisar este bloque
    </div>
  );
}

// ── Bullets helper ────────────────────────────────────────────────────────────

function Bullets({ bullets, text, muted }) {
  const items = (bullets || []).filter(b => b && b.trim());
  if (!items.length) return null;
  return (
    <>
      {items.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 7, marginBottom: 2, paddingLeft: 2 }}>
          <span style={{ color: muted, flexShrink: 0, lineHeight: 1.6 }}>–</span>
          <span style={{ lineHeight: 1.6, color: text }}>{b}</span>
        </div>
      ))}
    </>
  );
}

// ── Professional Modern template ──────────────────────────────────────────────

function ProfessionalModernPreview({ data, dm }) {
  const { personal, summary, experience, education, skills, languages, projects, certifications, meta } = data;
  const bg     = dm ? "#1e293b" : "#fff";
  const text   = dm ? "#f1f5f9" : DARK;
  const muted  = dm ? "#94a3b8" : GRAY;
  const border = dm ? "rgba(255,255,255,0.07)" : "#e5e7eb";

  function SectionHeader({ title }) {
    return (
      <div style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5,
        textTransform: "uppercase", color: PRIMARY,
        borderBottom: `1.5px solid #bfdbfe`,
        paddingBottom: 4, marginTop: 18, marginBottom: 10,
      }}>
        {title}
      </div>
    );
  }

  return (
    <div style={{
      background: bg, color: text,
      fontFamily: "system-ui, -apple-system, Arial, Helvetica, sans-serif",
      fontSize: 13, lineHeight: 1.6,
      borderRadius: 8, overflow: "hidden",
      border: `1px solid ${border}`,
    }}>
      {/* Cabecera azul */}
      <div style={{ background: PRIMARY, padding: "20px 28px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>
          {personal.name || "Candidato"}
        </div>
        {personal.title && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 3 }}>
            {personal.title}
          </div>
        )}
      </div>

      {/* Cuerpo */}
      <div style={{ padding: "4px 28px 24px" }}>
        {summary && (
          <>
            <SectionHeader title="Perfil profesional" />
            <p style={{ margin: 0, color: text, lineHeight: 1.65 }}>{summary}</p>
          </>
        )}

        {experience.length > 0 && (
          <>
            <SectionHeader title="Experiencia profesional" />
            {experience.map((exp, i) => (
              <div key={exp.id || i} style={{ marginBottom: 14 }}>
                {exp.flagged && <FlaggedBadge />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: text }}>
                    {exp.company || <span style={{ color: muted, fontStyle: "italic" }}>Sin empresa</span>}
                  </span>
                  <span style={{ fontSize: 11, color: muted }}>
                    {[exp.period, exp.location].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {exp.role && (
                  <div style={{ fontStyle: "italic", color: muted, fontSize: 12, marginBottom: 3 }}>{exp.role}</div>
                )}
                <Bullets bullets={exp.bullets} text={text} muted={muted} />
              </div>
            ))}
          </>
        )}

        {education.length > 0 && (
          <>
            <SectionHeader title="Educación" />
            {education.map((edu, i) => (
              <div key={edu.id || i} style={{ marginBottom: 6 }}>
                {edu.flagged && <FlaggedBadge />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontWeight: 700, color: text }}>
                    {edu.degree || <span style={{ color: muted, fontStyle: "italic" }}>Sin titulación</span>}
                  </span>
                  <span style={{ fontSize: 11, color: muted }}>
                    {[edu.institution, edu.year].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {skills.length > 0 && (
          <>
            <SectionHeader title="Habilidades técnicas" />
            {skills.map((sg, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap", alignItems: "baseline" }}>
                {sg.category && (
                  <span style={{ fontWeight: 700, color: PRIMARY, flexShrink: 0 }}>{sg.category}:</span>
                )}
                <span style={{ color: text }}>{(sg.items || []).join(", ")}</span>
              </div>
            ))}
          </>
        )}

        {languages.length > 0 && (
          <>
            <SectionHeader title="Idiomas" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 28px" }}>
              {languages.map((lang, i) => (
                <span key={i} style={{ color: text }}>
                  <strong>{lang.language}</strong>{lang.level ? `: ${lang.level}` : ""}
                </span>
              ))}
            </div>
          </>
        )}

        {projects.length > 0 && (
          <>
            <SectionHeader title="Proyectos" />
            {projects.map((proj, i) => {
              const { clean: cleanName, url: nameUrl } = extractUrl(proj.name || "");
              const projUrl = nameUrl || proj.url || "";
              return (
                <div key={proj.id || i} style={{ marginBottom: 10 }}>
                  {proj.flagged && <FlaggedBadge />}
                  <div style={{ fontWeight: 700, color: text, marginBottom: projUrl ? 1 : 3 }}>
                    {cleanName || proj.name || ""}
                  </div>
                  {projUrl && (
                    <div style={{ marginBottom: 3 }}>
                      <CvLink href={projUrl} />
                    </div>
                  )}
                  <Bullets bullets={proj.bullets} text={text} muted={muted} />
                </div>
              );
            })}
          </>
        )}

        {certifications.length > 0 && (
          <>
            <SectionHeader title="Certificaciones" />
            {certifications.map((cert, i) => (
              <div key={cert.id || i} style={{ marginBottom: 3, color: text }}>
                {cert.flagged && <FlaggedBadge />}
                {cert.name}{cert.year ? ` (${cert.year})` : ""}
              </div>
            ))}
          </>
        )}

        {(meta?.warnings || []).length > 0 && (
          <div style={{
            marginTop: 20, padding: "10px 14px",
            background: dm ? "rgba(245,158,11,0.1)" : "#fffbeb",
            border: "1px solid #fde68a", borderRadius: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
              Advertencias del sistema
            </div>
            {meta.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 11, color: "#92400e", marginBottom: 2 }}>• {w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ATS Minimal template ──────────────────────────────────────────────────────

function ATSMinimalPreview({ data, dm }) {
  const { personal, summary, experience, education, skills, languages, projects, certifications } = data;
  const bg     = dm ? "#1e293b" : "#fff";
  const text   = dm ? "#f1f5f9" : DARK;
  const muted  = dm ? "#94a3b8" : GRAY;
  const border = dm ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const divider = dm ? "rgba(255,255,255,0.15)" : "#374151";

  function SectionHeader({ title }) {
    return (
      <div style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5,
        textTransform: "uppercase", color: text,
        borderBottom: `1px solid ${muted}`,
        paddingBottom: 3, marginTop: 18, marginBottom: 10,
      }}>
        {title}
      </div>
    );
  }

  return (
    <div style={{
      background: bg, color: text,
      fontFamily: "system-ui, -apple-system, Arial, Helvetica, sans-serif",
      fontSize: 13, lineHeight: 1.6,
      borderRadius: 8, overflow: "hidden",
      border: `1px solid ${border}`,
    }}>
      {/* Cabecera simple */}
      <div style={{ padding: "24px 28px 12px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: text, letterSpacing: -0.3 }}>
          {personal.name || "Candidato"}
        </div>
        {personal.title && (
          <div style={{ fontSize: 13, color: muted, marginTop: 3 }}>{personal.title}</div>
        )}
        <div style={{ borderBottom: `1.5px solid ${divider}`, marginTop: 10 }} />
      </div>

      {/* Cuerpo */}
      <div style={{ padding: "0 28px 24px" }}>
        {summary && (
          <>
            <SectionHeader title="Perfil profesional" />
            <p style={{ margin: 0, color: text, lineHeight: 1.65 }}>{summary}</p>
          </>
        )}

        {experience.length > 0 && (
          <>
            <SectionHeader title="Experiencia profesional" />
            {experience.map((exp, i) => (
              <div key={exp.id || i} style={{ marginBottom: 14 }}>
                {exp.flagged && <FlaggedBadge />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: text }}>
                    {exp.company || <span style={{ color: muted, fontStyle: "italic" }}>Sin empresa</span>}
                  </span>
                  <span style={{ fontSize: 11, color: muted }}>
                    {[exp.period, exp.location].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {exp.role && (
                  <div style={{ fontStyle: "italic", color: muted, fontSize: 12, marginBottom: 3 }}>{exp.role}</div>
                )}
                <Bullets bullets={exp.bullets} text={text} muted={muted} />
              </div>
            ))}
          </>
        )}

        {education.length > 0 && (
          <>
            <SectionHeader title="Educación" />
            {education.map((edu, i) => (
              <div key={edu.id || i} style={{ marginBottom: 6 }}>
                {edu.flagged && <FlaggedBadge />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontWeight: 700, color: text }}>
                    {edu.degree || <span style={{ color: muted, fontStyle: "italic" }}>Sin titulación</span>}
                  </span>
                  <span style={{ fontSize: 11, color: muted }}>
                    {[edu.institution, edu.year].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {skills.length > 0 && (
          <>
            <SectionHeader title="Habilidades técnicas" />
            {skills.map((sg, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap", alignItems: "baseline" }}>
                {sg.category && (
                  <span style={{ fontWeight: 700, color: text, flexShrink: 0 }}>{sg.category}:</span>
                )}
                <span style={{ color: text }}>{(sg.items || []).join(", ")}</span>
              </div>
            ))}
          </>
        )}

        {languages.length > 0 && (
          <>
            <SectionHeader title="Idiomas" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 28px" }}>
              {languages.map((lang, i) => (
                <span key={i} style={{ color: text }}>
                  <strong>{lang.language}</strong>{lang.level ? `: ${lang.level}` : ""}
                </span>
              ))}
            </div>
          </>
        )}

        {projects.length > 0 && (
          <>
            <SectionHeader title="Proyectos" />
            {projects.map((proj, i) => {
              const { clean: cleanName, url: nameUrl } = extractUrl(proj.name || "");
              const projUrl = nameUrl || proj.url || "";
              return (
                <div key={proj.id || i} style={{ marginBottom: 10 }}>
                  {proj.flagged && <FlaggedBadge />}
                  <div style={{ fontWeight: 700, color: text, marginBottom: projUrl ? 1 : 3 }}>
                    {cleanName || proj.name || ""}
                  </div>
                  {projUrl && (
                    <div style={{ marginBottom: 3 }}>
                      <CvLink href={projUrl} />
                    </div>
                  )}
                  <Bullets bullets={proj.bullets} text={text} muted={muted} />
                </div>
              );
            })}
          </>
        )}

        {certifications.length > 0 && (
          <>
            <SectionHeader title="Certificaciones" />
            {certifications.map((cert, i) => (
              <div key={cert.id || i} style={{ marginBottom: 3, color: text }}>
                {cert.flagged && <FlaggedBadge />}
                {cert.name}{cert.year ? ` (${cert.year})` : ""}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function CVPreview({ cvJson, dm, template = "professional_modern" }) {
  if (!cvJson) return null;
  const hiddenSections = new Set(
    Array.isArray(cvJson.meta?.hidden_sections) ? cvJson.meta.hidden_sections : []
  );

  // Filter out empty/incomplete entries so no section header renders without content
  const data = {
    personal:       cvJson.personal       || {},
    summary: hiddenSections.has("summary")
      ? ""
      : (cvJson.summary || "").trim(),
    experience: hiddenSections.has("experience")
      ? []
      : (cvJson.experience || []).filter(e => (e.company || "").trim() || (e.role || "").trim()),
    education: hiddenSections.has("education")
      ? []
      : (cvJson.education || []).filter(e => (e.degree || "").trim() || (e.institution || "").trim()),
    skills: hiddenSections.has("skills")
      ? []
      : (cvJson.skills || []).filter(sg => (sg.items || []).some(i => String(i || "").trim())),
    languages: hiddenSections.has("languages")
      ? []
      : (cvJson.languages || []).filter(l => (l.language || "").trim()),
    projects: hiddenSections.has("projects")
      ? []
      : (cvJson.projects || []).filter(p => (p.name || "").trim()),
    certifications: hiddenSections.has("certifications")
      ? []
      : (cvJson.certifications || []).filter(c => (c.name || "").trim()),
    meta:           cvJson.meta,
  };

  if (template === "ats_minimal") {
    return <ATSMinimalPreview data={data} dm={dm} />;
  }
  return <ProfessionalModernPreview data={data} dm={dm} />;
}

export default CVPreview;
