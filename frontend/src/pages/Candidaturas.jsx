import React, { useState, useEffect } from "react";
import { getApplications, updateApplication, deleteApplication } from "../services/api";
import { typography, transition } from "../constants/theme";

// Teal brand colors
const TEAL = "#00758A";

// Status definitions
const STATUSES = [
  { id: "guardada", label: "Guardada", color: "#64748b", bg: "#f1f5f9", dmColor: "#94a3b8", dmBg: "rgba(100,116,139,0.15)" },
  { id: "aplicada", label: "Aplicada", color: "#3b82f6", bg: "#eff6ff", dmColor: "#60a5fa", dmBg: "rgba(59,130,246,0.15)" },
  { id: "entrevista", label: "Entrevista", color: "#8b5cf6", bg: "#f5f3ff", dmColor: "#a78bfa", dmBg: "rgba(139,92,246,0.15)" },
  { id: "oferta", label: "Oferta", color: "#10b981", bg: "#ecfdf5", dmColor: "#34d399", dmBg: "rgba(16,185,129,0.15)" },
  { id: "descartada", label: "Descartada", color: "#ef4444", bg: "#fef2f2", dmColor: "#f87171", dmBg: "rgba(239,68,68,0.15)" },
];

const S = {
  page: { padding: "40px 24px", minHeight: "100vh", fontFamily: typography.family, background: "#f8f9fc" },
  dmPage: { background: "#0f172a" },
  header: { marginBottom: 32 },
  title: { fontSize: 26, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 14, margin: "6px 0 0" },
  board: { display: "flex", gap: 24, overflowX: "auto", paddingBottom: 24 },
  column: { flex: "0 0 320px", display: "flex", flexDirection: "column", gap: 16 },
  colHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  colTitle: { margin: 0, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" },
  card: { padding: 18, borderRadius: 12, border: "1px solid", position: "relative", display: "flex", flexDirection: "column", gap: 10, transition: "transform 0.2s" },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3 },
  cardCompany: { margin: 0, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  cardDate: { margin: 0, fontSize: 11 },
  notesArea: { width: "100%", padding: 10, borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box", border: "1px solid", outline: "none", minHeight: 60, marginTop: 4 },
  selectBox: { padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid", outline: "none", cursor: "pointer", width: "100%", marginTop: 4 },
  deleteBtn: { position: "absolute", top: 12, right: 12, background: "none", border: "none", fontSize: 18, cursor: "pointer", opacity: 0.5 },
};

export default function Candidaturas({ darkMode, addToast }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadApps();
  }, []);

  async function loadApps() {
    try {
      setLoading(true);
      const data = await getApplications();
      setApps(data);
    } catch (e) {
      setError("Error cargando candidaturas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      const updated = await updateApplication(id, { status: newStatus });
      setApps(apps.map(a => a.id === id ? updated : a));
    } catch {
      addToast?.("Error al actualizar estado", "error");
    }
  }

  async function handleNotesChange(id, newNotes) {
    try {
      const updated = await updateApplication(id, { notes: newNotes });
      setApps(apps.map(a => a.id === id ? updated : a));
    } catch {
      addToast?.("Error al guardar notas", "error");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Seguro que quieres borrar esta candidatura?")) return;
    try {
      await deleteApplication(id);
      setApps(apps.filter(a => a.id !== id));
      addToast?.("Candidatura borrada", "success");
    } catch {
      addToast?.("Error al borrar", "error");
    }
  }

  const dm = darkMode;

  return (
    <div style={{ ...S.page, ...(dm ? S.dmPage : {}) }}>
      <div style={S.header}>
        <h1 style={{ ...S.title, color: dm ? "#f1f5f9" : "#111827" }}>Candidaturas</h1>
        <p style={{ ...S.subtitle, color: dm ? "#64748b" : "#6b7280" }}>
          Sigue el progreso de las ofertas a las que has aplicado.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: dm ? "#94a3b8" : "#6b7280" }}>Cargando...</div>
      ) : error ? (
        <div style={{ color: "#ef4444" }}>{error}</div>
      ) : apps.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: dm ? "#f1f5f9" : "#374151", margin: "0 0 8px" }}>
            Aún no tienes candidaturas trackeadas
          </p>
          <p style={{ color: dm ? "#64748b" : "#9ca3af", margin: 0, fontSize: 14 }}>
            Guarda alguna oferta interesante desde la vista de resultados.
          </p>
        </div>
      ) : (
        <div style={S.board}>
          {STATUSES.map(col => {
            const colApps = apps.filter(a => a.status === col.id);
            return (
              <div key={col.id} style={S.column}>
                <div style={S.colHeader}>
                  <h3 style={{ ...S.colTitle, color: dm ? col.dmColor : col.color }}>{col.label}</h3>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
                    backgroundColor: dm ? col.dmBg : col.bg,
                    color: dm ? col.dmColor : col.color,
                  }}>
                    {colApps.length}
                  </span>
                </div>
                {colApps.map(app => (
                  <div key={app.id} style={{
                    ...S.card,
                    backgroundColor: dm ? "#1e293b" : "#fff",
                    borderColor: dm ? "rgba(255,255,255,0.06)" : "#e8ecf1",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    <button style={{ ...S.deleteBtn, color: dm ? "#94a3b8" : "#9ca3af" }} onClick={() => handleDelete(app.id)} title="Borrar">×</button>
                    <div>
                      <h4 style={{ ...S.cardTitle, color: dm ? "#f1f5f9" : "#111827", paddingRight: 20 }}>{app.titulo}</h4>
                      <p style={{ ...S.cardCompany, color: dm ? "#5eead4" : TEAL }}><span style={{ fontSize: 12 }}>🏢</span> {app.empresa}</p>
                    </div>
                    
                    <a href={app.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>Ver oferta ↗</a>
                    
                    <textarea 
                      style={{
                        ...S.notesArea,
                        backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
                        borderColor: dm ? "rgba(255,255,255,0.1)" : "#e2e8f0",
                        color: dm ? "#f1f5f9" : "#111827",
                      }}
                      placeholder="Añadir notas... (ej. Entrevista con RRHH el 15/05)"
                      defaultValue={app.notes || ""}
                      onBlur={e => {
                        if (e.target.value !== app.notes) handleNotesChange(app.id, e.target.value);
                      }}
                    />

                    <select
                      value={app.status}
                      onChange={e => handleStatusChange(app.id, e.target.value)}
                      style={{
                        ...S.selectBox,
                        backgroundColor: dm ? "rgba(255,255,255,0.04)" : "#fff",
                        borderColor: dm ? "rgba(255,255,255,0.1)" : "#e2e8f0",
                        color: dm ? "#f1f5f9" : "#374151",
                      }}
                    >
                      {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>

                    <p style={{ ...S.cardDate, color: dm ? "#64748b" : "#9ca3af" }}>Actualizada: {new Date(app.updated_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {colApps.length === 0 && (
                  <div style={{
                    padding: 16, borderRadius: 12, border: `1px dashed ${dm ? "rgba(255,255,255,0.1)" : "#cbd5e1"}`,
                    textAlign: "center", fontSize: 12, color: dm ? "#475569" : "#94a3b8",
                  }}>
                    Vacío
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
