// -*- coding: utf-8 -*-
/**
 * Modal interactivo para editar el CV mejorado antes de exportar a PDF.
 * - Secciones inline editables (nombre, título, resumen, experiencia, educación,
 *   habilidades, idiomas, proyectos, certificaciones)
 * - Drag & drop HTML5 nativo para reordenar bloques dentro de cada sección
 * - Mover bloque de Experiencia a Proyectos
 * - Marcar/desmarcar como incorrecto
 * - Restaurar sugerencia original de la IA (con confirmación)
 * - Guardar → PUT /api/cv/improvement/{id}/edit
 * - Descargar PDF → guarda primero y luego POST /api/cv/improvement/{id}/pdf
 */
import { useState, useRef } from "react";
import { saveCVEdit, downloadCVPdfFromEdit } from "../services/api";
import CVPreview from "./CVPreview";

const PURPLE = "#7c3aed";
const SECTION_KEYS = [
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "projects",
  "certifications",
];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getHiddenSections(cvJson) {
  const sections = cvJson?.meta?.hidden_sections;
  return Array.isArray(sections) ? sections.filter(Boolean) : [];
}

function withSelectedTemplate(cvJson, template) {
  return {
    ...cvJson,
    meta: {
      ...(cvJson?.meta || {}),
      selected_template: template || "professional_modern",
    },
  };
}

function actionBtnStyle(color) {
  return {
    padding: "4px 10px", borderRadius: 12,
    border: `1px solid ${color}`, background: "none", color,
    cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
  };
}

// ── Sub-components (defined outside to avoid remount on every render) ──────────

function SectionWrap({ title, children, dm, visible = true, onToggleVisibility, helperText }) {
  const textColor = dm ? "#f1f5f9" : "#111827";
  const muted = dm ? "#64748b" : "#9ca3af";

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0 8px",
        borderBottom: `1.5px solid ${dm ? "rgba(124,58,237,0.3)" : "#e9d5ff"}`,
        marginBottom: 12,
        gap: 12,
        flexWrap: "wrap",
      }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
          color: PURPLE, textTransform: "uppercase",
        }}>{title}</span>
        {onToggleVisibility && (
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 11, color: visible ? textColor : muted,
            fontWeight: 700, cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={visible}
              onChange={e => onToggleVisibility(e.target.checked)}
              style={{ accentColor: PURPLE, cursor: "pointer" }}
            />
            Incluir en PDF y vista previa
          </label>
        )}
      </div>
      {!visible && (
        <div style={{
          fontSize: 12,
          color: muted,
          marginBottom: 10,
          fontStyle: "italic",
        }}>
          Este apartado está oculto en el PDF final. Puedes seguir editándolo aquí.
        </div>
      )}
      {helperText && (
        <div style={{ fontSize: 11, color: muted, marginBottom: 10 }}>
          {helperText}
        </div>
      )}
      {children}
    </div>
  );
}

function Field({ label, value, onChange, multiline, rows, dm }) {
  const inputBg = dm ? "#0f172a" : "#f8fafc";
  const inputBorder = dm ? "rgba(255,255,255,0.1)" : "#d1d5db";
  const textColor = dm ? "#f1f5f9" : "#111827";
  const muted = dm ? "#64748b" : "#9ca3af";
  const style = {
    background: inputBg, border: `1px solid ${inputBorder}`,
    borderRadius: 6, padding: "5px 9px", fontSize: 13, color: textColor,
    fontFamily: "inherit", width: "100%", boxSizing: "border-box", outline: "none",
  };
  return (
    <div style={{ marginBottom: 6 }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </div>
      )}
      {multiline ? (
        <textarea
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          rows={rows || 3}
          style={{ ...style, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          style={style}
        />
      )}
    </div>
  );
}

function DragCard({ section, idx, flagged, dragInfo, onDragStart, onDragOver, onDrop, onDragEnd, dm, children }) {
  const surface = dm ? "#1e293b" : "#fff";
  const border = dm ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const isDragging = dragInfo?.section === section && dragInfo.fromIdx === idx;
  const isOver = dragInfo?.section === section && dragInfo.overIdx === idx && dragInfo.fromIdx !== idx;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(section, idx)}
      onDragOver={e => { e.preventDefault(); onDragOver(section, idx); }}
      onDrop={() => onDrop(section)}
      onDragEnd={onDragEnd}
      style={{
        background: surface,
        border: `1.5px solid ${isOver ? PURPLE : flagged ? "#f59e0b" : border}`,
        borderRadius: 10, padding: "12px 14px", marginBottom: 8,
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        position: "relative",
        transition: "border-color 0.15s",
        boxSizing: "border-box",
      }}
    >
      {isOver && (
        <div style={{ position: "absolute", top: -2, left: 0, right: 0, height: 2, background: PURPLE, borderRadius: 1 }} />
      )}
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function CVEditorModal({ improvementId, initialJson, dm, onClose, onSaved }) {
  const [cvJson, setCvJson] = useState(() => deepClone(initialJson));
  const originalJson = useRef(deepClone(initialJson));
  const [actionLog, setActionLog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragInfo, setDragInfo] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [template, setTemplate] = useState(
    initialJson?.meta?.selected_template || "professional_modern"
  );

  const logAction = (action) =>
    setActionLog(prev => [...prev, { ...action, ts: Date.now() }]);

  // ── Colors ──────────────────────────────────────────────────────────────────
  const bg       = dm ? "#0f172a" : "#f8fafc";
  const surface  = dm ? "#1e293b" : "#fff";
  const border   = dm ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const text     = dm ? "#f1f5f9" : "#111827";
  const muted    = dm ? "#64748b" : "#9ca3af";
  const inputBg     = dm ? "#0f172a" : "#f8fafc";
  const inputBorder = dm ? "rgba(255,255,255,0.1)" : "#d1d5db";

  const inputStyle = {
    background: inputBg, border: `1px solid ${inputBorder}`,
    borderRadius: 6, padding: "5px 9px", fontSize: 13, color: text,
    fontFamily: "inherit", width: "100%", boxSizing: "border-box", outline: "none",
  };

  // ── State updaters ──────────────────────────────────────────────────────────
  const updatePersonal = (field, value) =>
    setCvJson(p => ({ ...p, personal: { ...p.personal, [field]: value } }));

  const updateSummary = (value) =>
    setCvJson(p => ({ ...p, summary: value }));

  const isSectionVisible = (section) => !getHiddenSections(cvJson).includes(section);

  const toggleSectionVisibility = (section, visible) => {
    logAction({ type: "toggle_section_visibility", section, visible });
    setCvJson(p => {
      const hidden = new Set(getHiddenSections(p));
      if (visible) hidden.delete(section);
      else hidden.add(section);
      return {
        ...p,
        meta: {
          ...(p.meta || {}),
          hidden_sections: SECTION_KEYS.filter(key => hidden.has(key)),
        },
      };
    });
  };

  const updateArrayItem = (section, idx, field, value) =>
    setCvJson(p => {
      const arr = [...(p[section] || [])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...p, [section]: arr };
    });

  const updateBullet = (section, idx, bi, value) =>
    setCvJson(p => {
      const arr = [...(p[section] || [])];
      const bullets = [...(arr[idx].bullets || [])];
      bullets[bi] = value;
      arr[idx] = { ...arr[idx], bullets };
      return { ...p, [section]: arr };
    });

  const addBullet = (section, idx) =>
    setCvJson(p => {
      const arr = [...(p[section] || [])];
      arr[idx] = { ...arr[idx], bullets: [...(arr[idx].bullets || []), ""] };
      return { ...p, [section]: arr };
    });

  const removeBullet = (section, idx, bi) =>
    setCvJson(p => {
      const arr = [...(p[section] || [])];
      arr[idx] = { ...arr[idx], bullets: (arr[idx].bullets || []).filter((_, i) => i !== bi) };
      return { ...p, [section]: arr };
    });

  const deleteBlock = (section, idx) => {
    logAction({ type: "delete_block", section, id: cvJson[section]?.[idx]?.id });
    setCvJson(p => ({ ...p, [section]: (p[section] || []).filter((_, i) => i !== idx) }));
  };

  const toggleFlagged = (section, idx) => {
    const newVal = !cvJson[section]?.[idx]?.flagged;
    logAction({ type: "mark_incorrect", section, id: cvJson[section]?.[idx]?.id, value: newVal });
    updateArrayItem(section, idx, "flagged", newVal);
  };

  const moveToProjects = (idx) => {
    const item = cvJson.experience?.[idx];
    if (!item) return;
    logAction({ type: "move_block", fromSection: "experience", toSection: "projects", id: item.id });
    const projItem = {
      id: item.id || `proj_moved_${Date.now()}`,
      name: item.role ? `${item.company} — ${item.role}` : (item.company || ""),
      url: "",
      bullets: item.bullets || [],
      flagged: false,
    };
    setCvJson(p => ({
      ...p,
      experience: (p.experience || []).filter((_, i) => i !== idx),
      projects: [...(p.projects || []), projItem],
    }));
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const handleDragStart = (section, fromIdx) =>
    setDragInfo({ section, fromIdx, overIdx: fromIdx });

  const handleDragOver = (section, overIdx) =>
    setDragInfo(prev => prev?.section === section ? { ...prev, overIdx } : prev);

  const handleDrop = (section) => {
    if (!dragInfo || dragInfo.section !== section) { setDragInfo(null); return; }
    const { fromIdx, overIdx } = dragInfo;
    if (fromIdx !== overIdx) {
      logAction({ type: "reorder_block", section, fromIdx, toIdx: overIdx });
      setCvJson(p => {
        const arr = [...(p[section] || [])];
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(overIdx, 0, moved);
        return { ...p, [section]: arr };
      });
    }
    setDragInfo(null);
  };

  const handleDragEnd = () => setDragInfo(null);

  const dragProps = { dragInfo, onDragStart: handleDragStart, onDragOver: handleDragOver, onDrop: handleDrop, onDragEnd: handleDragEnd, dm };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    const payload = withSelectedTemplate(cvJson, template);
    try {
      await saveCVEdit(improvementId, payload, actionLog);
      setCvJson(payload);
      onSaved?.(payload);
      onClose();
    } catch (err) {
      alert(err?.message || "Error al guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const payload = withSelectedTemplate(cvJson, template);
    setSaving(true);
    try {
      await saveCVEdit(improvementId, payload, actionLog);
      setCvJson(payload);
      onSaved?.(payload);
    } catch { /* continuar */ }
    setSaving(false);
    setDownloading(true);
    try {
      await downloadCVPdfFromEdit(improvementId, template);
    } catch (err) {
      alert(err?.message || "Error al descargar el PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = () => {
    setCvJson(withSelectedTemplate(deepClone(originalJson.current), template));
    setActionLog([{ type: "restore_all", ts: Date.now() }]);
    setConfirmRestore(false);
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9998, backdropFilter: "blur(2px)" }}
      />

      {/* Scroll container */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 880,
            background: bg, borderRadius: 18,
            boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
            display: "flex", flexDirection: "column",
            fontFamily: "system-ui, -apple-system, sans-serif",
            marginBottom: 24,
          }}
        >

          {/* ── Header ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px 14px", borderBottom: `1px solid ${border}`,
            flexWrap: "wrap", gap: 10,
          }}>
            {/* Left: title */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: text }}>CV mejorado</div>
              {!previewMode && (
                <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>
                  Arrastra para reordenar · Guarda los cambios antes de descargar
                </div>
              )}
            </div>

            {/* Center: tabs */}
            <div style={{
              display: "flex", borderRadius: 8, overflow: "hidden",
              border: `1.5px solid ${dm ? "rgba(255,255,255,0.12)" : "#e5e7eb"}`,
              flexShrink: 0,
            }}>
              {[
                { id: false, label: "Editar" },
                { id: true, label: "Vista previa" },
              ].map(({ id, label }) => (
                <button
                  key={String(id)}
                  onClick={() => setPreviewMode(id)}
                  style={{
                    padding: "6px 16px", border: "none",
                    background: previewMode === id ? PURPLE : "transparent",
                    color: previewMode === id ? "#fff" : muted,
                    cursor: "pointer", fontSize: 12, fontWeight: 700,
                    fontFamily: "inherit", transition: "background 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Right: close */}
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: muted, padding: "2px 6px", lineHeight: 1, flexShrink: 0 }}
            >×</button>
          </div>

          {/* ── Body: Vista previa ── */}
          {previewMode && (
            <div style={{ padding: "20px 24px", overflowY: "auto" }}>
              <CVPreview cvJson={cvJson} dm={dm} template={template} />
            </div>
          )}

          {/* ── Body: Editar ── */}
          {!previewMode && <div style={{ padding: "24px 28px" }}>

            {/* DATOS PERSONALES */}
            <SectionWrap title="Datos personales" dm={dm}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Nombre" value={cvJson.personal?.name} onChange={v => updatePersonal("name", v)} dm={dm} />
                <Field label="Título profesional" value={cvJson.personal?.title} onChange={v => updatePersonal("title", v)} dm={dm} />
              </div>
            </SectionWrap>

            {/* RESUMEN */}
            <SectionWrap
              title="Resumen profesional"
              dm={dm}
              visible={isSectionVisible("summary")}
              onToggleVisibility={(visible) => toggleSectionVisibility("summary", visible)}
              helperText={!cvJson.summary?.trim() ? "Si no quieres mostrar este bloque, puedes dejarlo vacío o desactivarlo." : undefined}
            >
              <Field value={cvJson.summary} onChange={updateSummary} multiline rows={4} dm={dm} />
            </SectionWrap>

            {/* EXPERIENCIA */}
            <SectionWrap
              title="Experiencia profesional"
              dm={dm}
              visible={isSectionVisible("experience")}
              onToggleVisibility={(visible) => toggleSectionVisibility("experience", visible)}
              helperText={!(cvJson.experience || []).length ? "No hay entradas cargadas. Si no quieres esta sección, déjala desactivada." : undefined}
            >
              {(cvJson.experience || []).map((exp, idx) => (
                <DragCard key={exp.id || idx} section="experience" idx={idx} flagged={exp.flagged} {...dragProps}>
                  {exp.flagged && (
                    <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginBottom: 6 }}>
                      ⚠ Bloque marcado como posiblemente incorrecto
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <Field label="Empresa" value={exp.company} onChange={v => updateArrayItem("experience", idx, "company", v)} dm={dm} />
                    <Field label="Cargo" value={exp.role} onChange={v => updateArrayItem("experience", idx, "role", v)} dm={dm} />
                    <Field label="Periodo" value={exp.period} onChange={v => updateArrayItem("experience", idx, "period", v)} dm={dm} />
                    <Field label="Ubicación" value={exp.location} onChange={v => updateArrayItem("experience", idx, "location", v)} dm={dm} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Logros</div>
                  {(exp.bullets || []).map((b, bi) => (
                    <div key={bi} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "flex-start" }}>
                      <span style={{ paddingTop: 7, color: muted, fontSize: 12, flexShrink: 0 }}>–</span>
                      <input
                        type="text"
                        value={b}
                        onChange={e => updateBullet("experience", idx, bi, e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button onClick={() => removeBullet("experience", idx, bi)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16, padding: "3px 4px", lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => addBullet("experience", idx)} style={{ fontSize: 11, fontWeight: 700, color: PURPLE, background: "none", border: `1px dashed ${dm ? "rgba(124,58,237,0.4)" : "#c4b5fd"}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", marginTop: 4 }}>
                    + Añadir logro
                  </button>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => moveToProjects(idx)} style={actionBtnStyle("#2563eb")}>Mover a Proyectos</button>
                    <button onClick={() => toggleFlagged("experience", idx)} style={actionBtnStyle(exp.flagged ? "#10b981" : "#f59e0b")}>
                      {exp.flagged ? "Quitar marca" : "Marcar incorrecto"}
                    </button>
                    <button onClick={() => deleteBlock("experience", idx)} style={actionBtnStyle("#ef4444")}>Eliminar</button>
                  </div>
                </DragCard>
              ))}
            </SectionWrap>

            {/* EDUCACIÓN */}
            <SectionWrap
              title="Educación"
              dm={dm}
              visible={isSectionVisible("education")}
              onToggleVisibility={(visible) => toggleSectionVisibility("education", visible)}
              helperText={!(cvJson.education || []).length ? "No hay estudios cargados. Puedes ocultar este apartado si no lo necesitas." : undefined}
            >
              {(cvJson.education || []).map((edu, idx) => (
                <DragCard key={edu.id || idx} section="education" idx={idx} flagged={edu.flagged} {...dragProps}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 8 }}>
                    <Field label="Titulación" value={edu.degree} onChange={v => updateArrayItem("education", idx, "degree", v)} dm={dm} />
                    <Field label="Centro" value={edu.institution} onChange={v => updateArrayItem("education", idx, "institution", v)} dm={dm} />
                    <Field label="Año" value={edu.year} onChange={v => updateArrayItem("education", idx, "year", v)} dm={dm} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button onClick={() => deleteBlock("education", idx)} style={actionBtnStyle("#ef4444")}>Eliminar</button>
                  </div>
                </DragCard>
              ))}
            </SectionWrap>

            {/* HABILIDADES */}
            <SectionWrap
              title="Habilidades técnicas"
              dm={dm}
              visible={isSectionVisible("skills")}
              onToggleVisibility={(visible) => toggleSectionVisibility("skills", visible)}
              helperText={!(cvJson.skills || []).length ? "No hay categorías de habilidades. Puedes dejar la sección oculta." : undefined}
            >
              {(cvJson.skills || []).map((sg, idx) => (
                <div key={idx} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      value={sg.category || ""}
                      onChange={e => updateArrayItem("skills", idx, "category", e.target.value)}
                      style={{ ...inputStyle, width: 160, flexShrink: 0, fontWeight: 700 }}
                      placeholder="Categoría"
                    />
                    <span style={{ color: muted, fontSize: 12, flexShrink: 0 }}>:</span>
                    <input
                      type="text"
                      value={(sg.items || []).join(", ")}
                      onChange={e => updateArrayItem("skills", idx, "items", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Habilidades separadas por coma"
                    />
                  </div>
                </div>
              ))}
            </SectionWrap>

            {/* IDIOMAS */}
            <SectionWrap
              title="Idiomas"
              dm={dm}
              visible={isSectionVisible("languages")}
              onToggleVisibility={(visible) => toggleSectionVisibility("languages", visible)}
              helperText={!(cvJson.languages || []).length ? "Si no quieres mostrar idiomas, puedes mantener este apartado oculto." : undefined}
            >
              {(cvJson.languages || []).map((lang, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input
                    type="text"
                    value={lang.language || ""}
                    onChange={e => updateArrayItem("languages", idx, "language", e.target.value)}
                    style={{ ...inputStyle, width: 160, flexShrink: 0 }}
                    placeholder="Idioma"
                  />
                  <input
                    type="text"
                    value={lang.level || ""}
                    onChange={e => updateArrayItem("languages", idx, "level", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Nivel (ej. Nativo, C1, Intermedio)"
                  />
                </div>
              ))}
            </SectionWrap>

            {/* PROYECTOS */}
            <SectionWrap
              title="Proyectos"
              dm={dm}
              visible={isSectionVisible("projects")}
              onToggleVisibility={(visible) => toggleSectionVisibility("projects", visible)}
              helperText={!(cvJson.projects || []).length ? "No hay proyectos cargados. Puedes ocultar la sección para que no aparezca en el PDF." : undefined}
            >
              {(cvJson.projects || []).map((proj, idx) => (
                <DragCard key={proj.id || idx} section="projects" idx={idx} flagged={proj.flagged} {...dragProps}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <Field label="Nombre" value={proj.name} onChange={v => updateArrayItem("projects", idx, "name", v)} dm={dm} />
                    <Field label="URL" value={proj.url} onChange={v => updateArrayItem("projects", idx, "url", v)} dm={dm} />
                  </div>
                  {(proj.bullets || []).map((b, bi) => (
                    <div key={bi} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "flex-start" }}>
                      <span style={{ paddingTop: 7, color: muted, fontSize: 12, flexShrink: 0 }}>–</span>
                      <input
                        type="text"
                        value={b}
                        onChange={e => updateBullet("projects", idx, bi, e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button onClick={() => removeBullet("projects", idx, bi)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16, padding: "3px 4px", lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => addBullet("projects", idx)} style={{ fontSize: 11, fontWeight: 700, color: PURPLE, background: "none", border: `1px dashed ${dm ? "rgba(124,58,237,0.4)" : "#c4b5fd"}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", marginTop: 4 }}>
                    + Añadir descripción
                  </button>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button onClick={() => deleteBlock("projects", idx)} style={actionBtnStyle("#ef4444")}>Eliminar</button>
                  </div>
                </DragCard>
              ))}
            </SectionWrap>

            {/* CERTIFICACIONES */}
            <SectionWrap
              title="Certificaciones"
              dm={dm}
              visible={isSectionVisible("certifications")}
              onToggleVisibility={(visible) => toggleSectionVisibility("certifications", visible)}
              helperText={!(cvJson.certifications || []).length ? "Si no tienes certificaciones, deja este apartado desactivado y no se incluirá." : undefined}
            >
              {(cvJson.certifications || []).map((cert, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input
                    type="text"
                    value={cert.name || ""}
                    onChange={e => updateArrayItem("certifications", idx, "name", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Certificación"
                  />
                  <input
                    type="text"
                    value={cert.year || ""}
                    onChange={e => updateArrayItem("certifications", idx, "year", e.target.value)}
                    style={{ ...inputStyle, width: 80, flexShrink: 0 }}
                    placeholder="Año"
                  />
                </div>
              ))}
            </SectionWrap>

          </div>}

          {/* ── Footer ── */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 24px", borderTop: `1px solid ${border}`,
            flexWrap: "wrap", gap: 8,
          }}>
            {/* Restore — only visible in edit mode */}
            {!previewMode ? (
              <button
                onClick={() => setConfirmRestore(true)}
                style={{
                  padding: "8px 14px", borderRadius: 20,
                  border: `1.5px solid ${dm ? "rgba(255,255,255,0.15)" : "#d1d5db"}`,
                  background: "none", color: muted, cursor: "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                }}
              >
                Restaurar sugerencia IA
              </button>
            ) : (
              <div style={{ fontSize: 12, color: muted }}>
                Vista previa del CV final
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={onClose} style={{
                padding: "8px 18px", borderRadius: 20,
                border: `1.5px solid ${dm ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
                background: "none", color: text, cursor: "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              }}>
                Cerrar
              </button>
              {/* Template selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 11, color: muted, fontWeight: 600, whiteSpace: "nowrap" }}>Plantilla:</span>
                <select
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  style={{
                    fontSize: 11, padding: "4px 8px", borderRadius: 8,
                    border: `1px solid ${dm ? "rgba(255,255,255,0.15)" : "#d1d5db"}`,
                    background: inputBg, color: text, cursor: "pointer",
                    fontFamily: "inherit", outline: "none",
                  }}
                >
                  <option value="professional_modern">Professional Modern</option>
                  <option value="ats_minimal">ATS Minimal</option>
                </select>
              </div>
              <button onClick={handleDownload} disabled={downloading || saving} style={{
                padding: "8px 18px", borderRadius: 20,
                border: "1.5px solid #2563eb", background: "none", color: "#2563eb",
                cursor: (downloading || saving) ? "wait" : "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                opacity: (downloading || saving) ? 0.7 : 1,
              }}>
                {downloading ? "Descargando..." : "Descargar PDF"}
              </button>
              {!previewMode && (
                <button onClick={handleSave} disabled={saving} style={{
                  padding: "8px 20px", borderRadius: 20,
                  background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                  border: "none", color: "#fff",
                  cursor: saving ? "wait" : "pointer",
                  fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                  opacity: saving ? 0.7 : 1,
                  boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
                }}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Confirm restore dialog ── */}
      {confirmRestore && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: surface, borderRadius: 14, padding: "24px 28px",
            zIndex: 10001, maxWidth: 380, width: "90%",
            boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 10 }}>
              ¿Restaurar sugerencia de la IA?
            </div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 20, lineHeight: 1.6 }}>
              Se perderán todos los cambios realizados. Esta acción no se puede deshacer.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmRestore(false)} style={{
                padding: "8px 16px", borderRadius: 20, border: `1px solid ${border}`,
                background: "none", color: text, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              }}>Cancelar</button>
              <button onClick={handleRestore} style={{
                padding: "8px 16px", borderRadius: 20, background: PURPLE,
                border: "none", color: "#fff", cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              }}>Restaurar</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default CVEditorModal;
