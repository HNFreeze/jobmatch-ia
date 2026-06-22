import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getApplications, updateApplication, deleteApplication } from "../services/api";
import { typography, palette } from "../constants/theme";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";

const TEAL = "#00758A";

// Days until (or since) a follow-up date. Negative = overdue, 0 = today.
function followUpDiffDays(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

const ACTIVE_STATUSES = new Set(["aplicada", "entrevista"]);

const STATUSES = [
  {
    id: "guardada", label: "Guardada", icon: "📋",
    color: "#64748b", bg: "#f8fafc", border: "#e2e8f0",
    dmColor: "#94a3b8", dmBg: "rgba(100,116,139,0.12)", dmBorder: "rgba(255,255,255,0.08)",
  },
  {
    id: "aplicada", label: "Aplicada", icon: "📤",
    color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe",
    dmColor: "#60a5fa", dmBg: "rgba(59,130,246,0.12)", dmBorder: "rgba(59,130,246,0.28)",
  },
  {
    id: "entrevista", label: "Entrevista", icon: "🎤",
    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe",
    dmColor: "#a78bfa", dmBg: "rgba(124,58,237,0.12)", dmBorder: "rgba(124,58,237,0.28)",
  },
  {
    id: "oferta", label: "Oferta", icon: "🎉",
    color: "#059669", bg: "#ecfdf5", border: "#a7f3d0",
    dmColor: "#34d399", dmBg: "rgba(16,185,129,0.12)", dmBorder: "rgba(16,185,129,0.28)",
  },
  {
    id: "descartada", label: "Descartada", icon: "🗑️",
    color: "#dc2626", bg: "#fef2f2", border: "#fecaca",
    dmColor: "#f87171", dmBg: "rgba(239,68,68,0.12)", dmBorder: "rgba(239,68,68,0.28)",
  },
];

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// ── Card ────────────────────────────────────────────────────────────────────────
function getFollowUpStatus(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return { label: `Vencido hace ${Math.abs(diff)}d`, color: "#ef4444", bg: "#fef2f2", dmBg: "rgba(239,68,68,0.15)" };
  if (diff === 0) return { label: "Hoy", color: "#f59e0b", bg: "#fffbeb", dmBg: "rgba(245,158,11,0.15)" };
  if (diff <= 3)  return { label: `En ${diff}d`, color: "#f59e0b", bg: "#fffbeb", dmBg: "rgba(245,158,11,0.12)" };
  return { label: `${formatDate(dateStr)}`, color: "#64748b", bg: "#f8fafc", dmBg: "rgba(100,116,139,0.12)" };
}

function AppCard({ app, col, dm, isDragging, onDragStart, onDragMove, onDragEnd, onDelete, onNotesChange, onStatusChange, onFollowUpChange, onStartInterview }) {
  const [notesVal, setNotesVal] = useState(app.notes || "");
  const fuStatus = getFollowUpStatus(app.follow_up_date);

  return (
    <div
      style={{
        background: dm ? "#1e293b" : "#fff",
        border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e8ecf1"}`,
        borderRadius: 12,
        padding: "8px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: isDragging ? 0.4 : 1,
        boxShadow: isDragging
          ? "0 10px 28px rgba(0,0,0,0.20)"
          : (dm ? "none" : "0 1px 4px rgba(0,0,0,0.04)"),
        transition: "opacity .15s, box-shadow .15s",
        position: "relative",
      }}
    >
      {/* Tirador de arrastre — funciona con ratón y táctil (móvil) */}
      <div
        onPointerDown={e => onDragStart(e, app)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        title="Arrastra para mover de columna"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          margin: "0 -8px 0", padding: "4px 8px",
          cursor: "grab", touchAction: "none", userSelect: "none",
          borderRadius: 8,
        }}
      >
        <span aria-hidden style={{ letterSpacing: 2, fontSize: 14, lineHeight: 1, color: dm ? "#475569" : "#cbd5e1" }}>⠿</span>
        <span style={{
          width: 9, height: 9, borderRadius: "50%",
          background: dm ? col.dmColor : col.color, opacity: 0.9,
        }}/>
      </div>

      {/* Title + company */}
      <div style={{ paddingRight: 2 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: dm ? "#f1f5f9" : "#111827",
          lineHeight: 1.3, marginBottom: 3,
          fontFamily: typography.family,
        }}>{app.titulo}</div>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: dm ? "#5eead4" : TEAL,
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: typography.family,
        }}>
          <span style={{ fontSize: 11 }}>🏢</span> {app.empresa}
        </div>
      </div>

      {/* URL */}
      {app.url && (
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: 11, color: "#3b82f6",
            textDecoration: "none", fontWeight: 600,
            fontFamily: typography.family,
            cursor: "pointer",
          }}
        >
          Ver oferta ↗
        </a>
      )}

      {/* Notes */}
      <textarea
        value={notesVal}
        onChange={e => setNotesVal(e.target.value)}
        onBlur={() => {
          if (notesVal !== (app.notes || "")) onNotesChange(app.id, notesVal);
        }}
        placeholder="Notas... (entrevista el 15/05, contacto RRHH...)"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "8px 10px", borderRadius: 8,
          fontSize: 12, lineHeight: 1.5, resize: "vertical",
          minHeight: 52,
          border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
          background: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
          color: dm ? "#e2e8f0" : "#374151",
          outline: "none", cursor: "text",
          fontFamily: typography.family,
        }}
      />

      {/* Status selector */}
      <select
        value={app.status}
        onChange={e => onStatusChange(app.id, e.target.value)}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        style={{
          padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
          border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
          background: dm ? "rgba(255,255,255,0.04)" : "#fff",
          color: dm ? "#f1f5f9" : "#374151",
          cursor: "pointer", outline: "none",
          fontFamily: typography.family,
        }}
      >
        {STATUSES.map(s => (
          <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
        ))}
      </select>

      {/* Follow-up date */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{
          fontSize: 11, fontWeight: 600, color: dm ? "#64748b" : "#9ca3af",
          fontFamily: typography.family,
        }}>📅 Recordatorio</label>
        <input
          type="date"
          value={app.follow_up_date || ""}
          onChange={e => onFollowUpChange(app.id, e.target.value || null)}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "6px 10px", borderRadius: 7, fontSize: 12,
            border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
            background: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
            color: dm ? "#e2e8f0" : "#374151",
            outline: "none", cursor: "text",
            fontFamily: typography.family,
          }}
        />
        {fuStatus && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            display: "inline-block", width: "fit-content",
            color: fuStatus.color,
            background: dm ? fuStatus.dmBg : fuStatus.bg,
            fontFamily: typography.family,
          }}>
            {fuStatus.label}
          </span>
        )}
      </div>

      {/* Interview button — columnas "entrevista" y "aplicada" */}
      {(col.id === "entrevista" || col.id === "aplicada") && onStartInterview && (
        <button
          onClick={e => { e.stopPropagation(); onStartInterview(app.titulo, app.empresa, app.id); }}
          style={{
            width: "100%", padding: "9px 0", borderRadius: 8,
            border: col.id === "entrevista"
              ? "none"
              : `1px solid ${dm ? "rgba(124,58,237,0.35)" : "rgba(124,58,237,0.25)"}`,
            background: col.id === "entrevista"
              ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
              : (dm ? "rgba(124,58,237,0.12)" : "#f5f3ff"),
            color: col.id === "entrevista" ? "#fff" : (dm ? "#c4b5fd" : "#6d28d9"),
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: typography.family, letterSpacing: "0.02em",
            boxShadow: col.id === "entrevista" ? "0 2px 8px rgba(124,58,237,0.35)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "filter .15s, background .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
        >
          🎤 Simular entrevista IA
          {col.id === "aplicada" && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
              padding: "1px 5px", borderRadius: 999,
              background: dm ? "rgba(124,58,237,0.35)" : "rgba(124,58,237,0.15)",
              color: dm ? "#c4b5fd" : "#7c3aed",
              marginLeft: 2,
            }}>IA</span>
          )}
        </button>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{
          fontSize: 11, color: dm ? "#475569" : "#9ca3af",
          fontFamily: typography.family,
        }}>
          {formatDate(app.created_at)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(app.id); }}
          title="Eliminar candidatura"
          style={{
            background: "none", border: "none", padding: "2px 4px",
            cursor: "pointer", fontSize: 14,
            color: dm ? "#475569" : "#9ca3af",
            borderRadius: 4,
            transition: "color .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
          onMouseLeave={e => e.currentTarget.style.color = dm ? "#475569" : "#9ca3af"}
        >×</button>
      </div>
    </div>
  );
}

// ── Column ──────────────────────────────────────────────────────────────────────
function KanbanColumn({ col, cards, dm, draggingId, dragOverCol, dragHandlers, onDelete, onNotesChange, onStatusChange, onFollowUpChange, onStartInterview }) {
  const isOver = dragOverCol === col.id;
  const isDragging = draggingId !== null;
  const isInterviewOver = isOver && col.id === "entrevista";

  return (
    <div
      style={{
        flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 0,
      }}
    >
      {/* Column header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 15 }}>{col.icon}</span>
          <span style={{
            fontSize: 12, fontWeight: 800, letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: dm ? col.dmColor : col.color,
            fontFamily: typography.family,
          }}>{col.label}</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: "2px 8px", borderRadius: 999,
          background: dm ? col.dmBg : col.bg,
          color: dm ? col.dmColor : col.color,
          border: `1px solid ${dm ? col.dmBorder : col.border}`,
          fontFamily: typography.family,
        }}>{cards.length}</span>
      </div>

      {/* Drop zone */}
      <div
        data-col-id={col.id}
        style={{
          minHeight: 80,
          display: "flex", flexDirection: "column", gap: 10,
          padding: "6px",
          borderRadius: 12,
          border: isOver
            ? `2px dashed ${dm ? col.dmColor : col.color}`
            : "2px dashed transparent",
          background: isOver
            ? (dm ? col.dmBg : col.bg)
            : "transparent",
          transition: "border-color .12s, background .12s, box-shadow .12s",
          boxShadow: isInterviewOver
            ? `0 0 0 3px ${dm ? "rgba(124,58,237,0.4)" : "rgba(124,58,237,0.3)"}`
            : "none",
          animation: isInterviewOver ? "cand-pulse 1.1s ease-in-out infinite" : "none",
        }}
      >
        {cards.map(app => (
          <AppCard
            key={app.id}
            app={app}
            col={col}
            dm={dm}
            isDragging={draggingId === app.id}
            onDragStart={dragHandlers.start}
            onDragMove={dragHandlers.move}
            onDragEnd={dragHandlers.end}
            onDelete={onDelete}
            onNotesChange={onNotesChange}
            onStatusChange={onStatusChange}
            onFollowUpChange={onFollowUpChange}
            onStartInterview={onStartInterview}
          />
        ))}

        {/* Empty + dragging placeholder */}
        {cards.length === 0 && (
          <div style={{
            padding: "16px 0",
            textAlign: "center",
            fontSize: 12,
            color: isDragging
              ? (dm ? col.dmColor : col.color)
              : (dm ? "#334155" : "#cbd5e1"),
            fontFamily: typography.family,
            fontWeight: isDragging ? 600 : 400,
            borderRadius: 8,
            transition: "color .15s",
          }}>
            {isDragging
              ? (col.id === "entrevista" ? "🎤 Suelta para practicar" : "Suelta aquí")
              : "Sin candidaturas"}
          </div>
        )}

        {/* "Drop here" hint when dragging over non-empty column */}
        {cards.length > 0 && isOver && (
          <div style={{
            padding: "10px 0",
            textAlign: "center",
            fontSize: 11,
            color: dm ? col.dmColor : col.color,
            fontWeight: 700,
            fontFamily: typography.family,
          }}>
            {col.id === "entrevista"
              ? "🎤 Suelta para practicar la entrevista"
              : `Suelta aquí para mover a ${col.label}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function Candidaturas({ darkMode, addToast, onNavigate, onStartInterview }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [ghost, setGhost] = useState(null);          // { app, x, y } — tarjeta fantasma
  const [pendingDelete, setPendingDelete] = useState(null);
  const dragRef = useRef(null);                       // { id, status } en curso
  const overColRef = useRef(null);                    // columna bajo el puntero

  const dm = darkMode;
  const t = palette(dm);

  // "Requiere atención": recordatorios vencidos/hoy + candidaturas activas sin
  // próxima acción definida. Cálculo determinista a partir de los datos.
  const attention = useMemo(() => {
    const items = [];
    for (const a of apps) {
      const diff = followUpDiffDays(a.follow_up_date);
      if (diff !== null && diff <= 0) {
        items.push({ app: a, reason: diff < 0 ? `Recordatorio vencido hace ${Math.abs(diff)}d` : "Recordatorio para hoy", urgent: true });
      } else if (!a.follow_up_date && ACTIVE_STATUSES.has(a.status)) {
        items.push({ app: a, reason: "Sin próxima acción definida", urgent: false });
      }
    }
    return items.sort((x, y) => Number(y.urgent) - Number(x.urgent));
  }, [apps]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getApplications();
        setApps(Array.isArray(data) ? data : []);
      } catch {
        setError("No se pudieron cargar las candidaturas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const moveCardTo = useCallback(async (appId, targetColId) => {
    let prevStatus = null;
    setApps(prev => {
      const app = prev.find(a => a.id === appId);
      if (!app || app.status === targetColId) return prev;
      prevStatus = app.status;
      return prev.map(a => a.id === appId ? { ...a, status: targetColId } : a);
    });
    if (!prevStatus) return;
    try {
      await updateApplication(appId, { status: targetColId });
    } catch {
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: prevStatus } : a));
      addToast?.("Error al mover la candidatura", "error");
    }
  }, [addToast]);

  // ── Arrastre con Pointer Events (ratón + táctil) ─────────────────────────────
  const dragStart = useCallback((e, app) => {
    if (e.button != null && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragRef.current = { id: app.id, status: app.status };
    overColRef.current = app.status;
    setDragId(app.id);
    setOverCol(app.status);
    setGhost({ app, x: e.clientX, y: e.clientY });
  }, []);

  const dragMove = useCallback((e) => {
    if (!dragRef.current) return;
    const x = e.clientX, y = e.clientY;
    setGhost(g => (g ? { ...g, x, y } : g));
    const el = document.elementFromPoint(x, y);
    const colEl = el && el.closest ? el.closest("[data-col-id]") : null;
    const colId = colEl ? colEl.getAttribute("data-col-id") : null;
    overColRef.current = colId;
    setOverCol(colId);
  }, []);

  const dragEnd = useCallback(() => {
    const drag = dragRef.current;
    const target = overColRef.current;
    dragRef.current = null;
    overColRef.current = null;
    setDragId(null);
    setOverCol(null);
    setGhost(null);
    if (drag && target && target !== drag.status) {
      moveCardTo(drag.id, target);
    }
  }, [moveCardTo]);

  const dragHandlers = useMemo(() => ({ start: dragStart, move: dragMove, end: dragEnd }), [dragStart, dragMove, dragEnd]);

  async function handleStatusChange(id, newStatus) {
    const prev = apps.find(a => a.id === id);
    if (!prev || prev.status === newStatus) return;
    const prevStatus = prev.status;
    setApps(curr => curr.map(a => a.id === id ? { ...a, status: newStatus } : a));
    try {
      await updateApplication(id, { status: newStatus });
    } catch {
      setApps(curr => curr.map(a => a.id === id ? { ...a, status: prevStatus } : a));
      addToast?.("Error al actualizar estado", "error");
    }
  }

  async function handleNotesChange(id, notes) {
    try {
      const updated = await updateApplication(id, { notes });
      setApps(curr => curr.map(a => a.id === id ? updated : a));
    } catch {
      addToast?.("Error al guardar notas", "error");
    }
  }

  async function handleFollowUpChange(id, follow_up_date) {
    setApps(curr => curr.map(a => a.id === id ? { ...a, follow_up_date } : a));
    try {
      await updateApplication(id, { follow_up_date });
    } catch {
      addToast?.("Error al guardar recordatorio", "error");
    }
  }

  function requestDelete(id) {
    setPendingDelete(apps.find(a => a.id === id) || null);
  }

  async function confirmDelete() {
    const prev = pendingDelete;
    if (!prev) return;
    setPendingDelete(null);
    setApps(curr => curr.filter(a => a.id !== prev.id));
    try {
      await deleteApplication(prev.id);
      addToast?.("Candidatura eliminada", "success");
    } catch {
      setApps(curr => [...curr, prev].sort((a, b) => a.id - b.id));
      addToast?.("Error al eliminar", "error");
    }
  }

  const total = apps.length;

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: dm ? "#0f172a" : "#f8f9fc",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <style>{`@keyframes cand-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          border: "3px solid", borderColor: dm ? "rgba(255,255,255,0.1)" : "#e2e8f0",
          borderTopColor: TEAL, animation: "cand-spin .75s linear infinite",
        }}/>
      </div>
    );
  }

  return (
    <div style={{
      padding: "clamp(20px,5vw,40px) clamp(12px,4vw,28px)",
      minHeight: "100vh",
      background: dm ? "#0f172a" : "#f8f9fc",
      fontFamily: typography.family,
    }}>
      <style>{`
        @keyframes cand-spin { to { transform: rotate(360deg); } }
        @keyframes cand-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(124,58,237,0.30); }
          50%      { box-shadow: 0 0 0 8px rgba(124,58,237,0.12); }
        }
        @media (max-width: 640px) {
          .cand-board { flex-direction: column !important; overflow-x: visible !important; }
          .cand-col   { flex: 1 1 auto !important; width: 100% !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 800, margin: 0,
          color: dm ? "#f1f5f9" : "#111827",
          fontFamily: typography.family,
        }}>Candidaturas</h1>
        <p style={{
          fontSize: 13, margin: "5px 0 0",
          color: dm ? "#64748b" : "#6b7280",
          fontFamily: typography.family,
        }}>
          Arrastra las tarjetas entre columnas para actualizar el estado · {total} candidatura{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Requieren atención — próxima acción / vencidos / sin seguimiento */}
      {attention.length > 0 && (
        <div style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 12, background: t.surface, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            Requieren tu atención
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: t.surfaceMuted, color: t.textSecondary }}>{attention.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {attention.slice(0, 5).map(({ app, reason, urgent }) => (
              <div key={app.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderTop: `1px solid ${t.border}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.titulo}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{app.empresa}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap",
                  color: urgent ? "#fff" : t.textSecondary, background: urgent ? "#dc2626" : t.surfaceMuted,
                }}>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip entrevista IA */}
      {total > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "11px 16px", borderRadius: 10, marginBottom: 18,
          background: dm ? "rgba(124,58,237,0.10)" : "#f5f3ff",
          border: `1px solid ${dm ? "rgba(124,58,237,0.28)" : "rgba(124,58,237,0.20)"}`,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🎤</span>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: dm ? "#c4b5fd" : "#6d28d9", fontFamily: typography.family, lineHeight: 1.5 }}>
            <strong style={{ fontWeight: 700 }}>Simula entrevistas con IA:</strong>{" "}
            mueve una candidatura a la columna <strong style={{ fontWeight: 700 }}>Entrevista</strong> (o desde <strong style={{ fontWeight: 700 }}>Aplicada</strong>) y aparecerá el botón para practicar con un entrevistador personalizado.
          </p>
        </div>
      )}

      {error && (
        <div style={{
          padding: "14px 18px", borderRadius: 12,
          background: dm ? "rgba(239,68,68,0.08)" : "#fef2f2",
          border: "1px solid #fecaca", color: dm ? "#f87171" : "#b91c1c",
          fontSize: 14, marginBottom: 24,
        }}>{error}</div>
      )}

      {/* Stats row */}
      {total > 0 && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24,
        }}>
          {STATUSES.map(s => {
            const count = apps.filter(a => a.status === s.id).length;
            if (count === 0) return null;
            return (
              <span key={s.id} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 999,
                fontSize: 12, fontWeight: 700,
                background: dm ? s.dmBg : s.bg,
                color: dm ? s.dmColor : s.color,
                border: `1px solid ${dm ? s.dmBorder : s.border}`,
                fontFamily: typography.family,
              }}>
                {s.icon} {s.label} · {count}
              </span>
            );
          })}
        </div>
      )}

      {apps.length === 0 && !error ? (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center", minHeight: 360,
        }}>
          <div style={{
            background: dm ? "#1e293b" : "#fff",
            border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e8ecf1"}`,
            borderRadius: 20, padding: "48px 40px", textAlign: "center",
            maxWidth: 420, width: "100%",
            boxShadow: dm ? "none" : "0 2px 12px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
            <p style={{
              fontSize: 17, fontWeight: 700,
              color: dm ? "#f1f5f9" : "#111827",
              margin: "0 0 10px", fontFamily: typography.family,
            }}>Aún no tienes candidaturas</p>
            <p style={{
              color: dm ? "#64748b" : "#6b7280",
              margin: "0 0 24px", fontSize: 14, lineHeight: 1.6,
              fontFamily: typography.family,
            }}>
              Usa <strong>"Seguir oferta"</strong> en los resultados de búsqueda para añadir candidaturas y hacer seguimiento aquí.
            </p>
            <button
              onClick={() => onNavigate?.("buscar")}
              style={{
                padding: "11px 28px", borderRadius: 50, border: "none", cursor: "pointer",
                background: `linear-gradient(135deg, ${TEAL}, #2563eb)`,
                color: "#fff", fontSize: 14, fontWeight: 700,
                fontFamily: typography.family,
                boxShadow: `0 4px 14px ${TEAL}40`,
              }}
            >Buscar ofertas →</button>
          </div>
        </div>
      ) : (
        <div
          className="cand-board"
          style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 24, alignItems: "flex-start" }}
        >
          {STATUSES.map(col => (
            <div key={col.id} className="cand-col" style={{ flex: "0 0 280px" }}>
              <KanbanColumn
                col={col}
                cards={apps.filter(a => a.status === col.id)}
                dm={dm}
                draggingId={dragId}
                dragOverCol={overCol}
                dragHandlers={dragHandlers}
                onDelete={requestDelete}
                onNotesChange={handleNotesChange}
                onStatusChange={handleStatusChange}
                onFollowUpChange={handleFollowUpChange}
                onStartInterview={onStartInterview}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tarjeta fantasma que sigue al cursor/dedo durante el arrastre */}
      {ghost && (
        <div style={{
          position: "fixed", left: ghost.x, top: ghost.y,
          transform: "translate(-50%, -50%) rotate(-3deg)",
          zIndex: 10000, pointerEvents: "none",
          width: 240, maxWidth: "70vw",
          padding: "12px 14px", borderRadius: 12,
          background: dm ? "#1e293b" : "#fff",
          border: `1px solid ${dm ? "rgba(255,255,255,0.14)" : "#e2e8f0"}`,
          boxShadow: "0 18px 44px rgba(0,0,0,0.32)",
          fontFamily: typography.family,
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ghost.app.titulo}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: dm ? "#5eead4" : TEAL, marginTop: 2 }}>🏢 {ghost.app.empresa}</div>
          {overCol && (
            <div style={{
              marginTop: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
              color: overCol === "entrevista" ? "#a78bfa" : (dm ? "#94a3b8" : "#64748b"),
            }}>
              {overCol === "entrevista" ? "🎤 Practicar entrevista" : `→ ${STATUSES.find(s => s.id === overCol)?.label || ""}`}
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        dm={dm}
        title="Eliminar candidatura"
        description={pendingDelete ? `Se eliminará "${pendingDelete.titulo}" en ${pendingDelete.empresa}. Esta acción no se puede deshacer.` : ""}
        footer={[
          <Button key="c" variant="secondary" dm={dm} onClick={() => setPendingDelete(null)}>Cancelar</Button>,
          <Button key="d" variant="danger" dm={dm} onClick={confirmDelete}>Eliminar</Button>,
        ]}
      />
    </div>
  );
}
