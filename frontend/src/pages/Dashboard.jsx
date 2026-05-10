import { useState, useEffect } from "react";
import {
  getUserProfile, getFavorites, getApplications, getHistory, getAiQuota,
} from "../services/api";
import { getMyAlert } from "../services/api";
import { typography, transition } from "../constants/theme";

const TEAL = "#00758A";

function StatCard({ icon, value, label, sub, color, darkMode }) {
  const dm = darkMode;
  return (
    <div style={{
      background: dm ? "#1e293b" : "#fff",
      border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
      borderRadius: 16,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{
        fontSize: 32, fontWeight: 800,
        color: color || (dm ? "#f1f5f9" : "#111827"),
        lineHeight: 1,
        fontFamily: typography.family,
      }}>{value ?? "—"}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: dm ? "#94a3b8" : "#374151", fontFamily: typography.family }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: dm ? "#64748b" : "#9ca3af", fontFamily: typography.family }}>{sub}</div>
      )}
    </div>
  );
}

function QuickAction({ icon, label, desc, onClick, accent, darkMode }) {
  const dm = darkMode;
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "16px 20px",
        background: hovered
          ? (dm ? "rgba(255,255,255,0.07)" : "#f8fafc")
          : (dm ? "#1e293b" : "#fff"),
        border: `1px solid ${hovered ? accent : (dm ? "rgba(255,255,255,0.07)" : "#e5e7eb")}`,
        borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%",
        transition: `all ${transition.smooth}`,
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${accent}18`, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", fontFamily: typography.family }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: dm ? "#94a3b8" : "#6b7280", marginTop: 2, fontFamily: typography.family }}>
          {desc}
        </div>
      </div>
      <span style={{ color: accent, fontSize: 18, flexShrink: 0 }}>→</span>
    </button>
  );
}

function RecentHistory({ history, darkMode }) {
  const dm = darkMode;
  if (!history?.length) return null;

  const resultColors = {
    APLICA: "#10b981", QUIZÁ: "#64748b", NO_ENCAJA: "#ef4444",
  };

  return (
    <div style={{
      background: dm ? "#1e293b" : "#fff",
      border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
      borderRadius: 16, padding: "20px 22px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
        color: dm ? "#64748b" : "#9ca3af", marginBottom: 14, fontFamily: typography.family }}>
        Últimas búsquedas
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.slice(0, 5).map((h, i) => {
          const stack = (() => { try { return JSON.parse(h.stack || "[]"); } catch { return []; } })();
          const aplica = h.num_aplica || 0;
          const quiza = h.num_quiza || 0;
          const date = h.created_at
            ? new Date(h.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
            : "";
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              background: dm ? "rgba(255,255,255,0.03)" : "#f8fafc",
              borderRadius: 10, border: `1px solid ${dm ? "rgba(255,255,255,0.05)" : "#f1f3f5"}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: dm ? "#f1f5f9" : "#111827",
                  fontFamily: typography.family, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stack.slice(0, 3).join(" · ") || "Búsqueda general"}
                </div>
                <div style={{ fontSize: 11, color: dm ? "#64748b" : "#9ca3af", marginTop: 2, fontFamily: typography.family }}>
                  {date}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {aplica > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                    background: "#d1fae5", color: "#15803d" }}>
                    {aplica} aplica
                  </span>
                )}
                {quiza > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                    background: dm ? "rgba(255,255,255,0.08)" : "#f1f5f9", color: dm ? "#94a3b8" : "#6b7280" }}>
                    {quiza} quizá
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertBanner({ alert, onManage, darkMode }) {
  const dm = darkMode;
  if (!alert || !alert.is_active) return null;
  return (
    <div style={{
      background: dm ? "rgba(0,117,138,0.15)" : "rgba(0,117,138,0.06)",
      border: `1px solid ${dm ? "rgba(0,117,138,0.3)" : "rgba(0,117,138,0.2)"}`,
      borderRadius: 12, padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontSize: 20 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: dm ? "#5eead4" : TEAL, fontFamily: typography.family }}>
          Alerta activa — Compatibilidad ≥ {alert.min_score_threshold}%
        </div>
        <div style={{ fontSize: 11, color: dm ? "#94a3b8" : "#6b7280", fontFamily: typography.family }}>
          Frecuencia: {alert.email_frequency === "daily" ? "diaria" : "semanal"} ·{" "}
          {alert.last_triggered_at
            ? `Última alerta: ${new Date(alert.last_triggered_at).toLocaleDateString("es-ES")}`
            : "Aún sin disparar"}
        </div>
      </div>
      <button onClick={onManage} style={{
        background: "none", border: `1px solid ${dm ? "rgba(94,234,212,0.3)" : "rgba(0,117,138,0.3)"}`,
        borderRadius: 8, padding: "6px 12px", cursor: "pointer",
        fontSize: 11, fontWeight: 700, color: dm ? "#5eead4" : TEAL, fontFamily: typography.family,
      }}>
        Gestionar
      </button>
    </div>
  );
}

export default function Dashboard({ darkMode, onNavigate }) {
  const dm = darkMode;
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [applications, setApplications] = useState([]);
  const [history, setHistory] = useState([]);
  const [quota, setQuota] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getUserProfile(),
      getFavorites(),
      getApplications(),
      getHistory(),
      getAiQuota(),
      getMyAlert(),
    ]).then(([p, f, a, h, q, al]) => {
      if (p.status === "fulfilled") setProfile(p.value);
      if (f.status === "fulfilled") setFavorites(f.value || []);
      if (a.status === "fulfilled") setApplications(a.value || []);
      if (h.status === "fulfilled") setHistory(h.value || []);
      if (q.status === "fulfilled") setQuota(q.value);
      if (al.status === "fulfilled") setAlert(al.value?.alert);
      setLoading(false);
    });
  }, []);

  const stack = profile?.stack || [];
  const completion = (() => {
    const fields = [
      stack.length > 0,
      profile?.anos_experiencia != null,
      profile?.idiomas?.length > 0,
      profile?.ubicaciones?.length > 0,
      profile?.modalidad?.length > 0,
    ];
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
  })();

  const quotaUsed = quota?.used ?? 0;
  const quotaLimit = quota?.daily_limit ?? 0;
  const quotaRemaining = quota?.remaining ?? 0;

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: `3px solid ${dm ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
          borderTopColor: TEAL,
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: dm ? "#0f172a" : "#f8fafc",
      fontFamily: typography.family,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 800,
            color: dm ? "#f1f5f9" : "#111827",
            letterSpacing: "-0.02em",
          }}>
            Hola{profile?.alias ? `, ${profile.alias}` : ""} 👋
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 15, color: dm ? "#94a3b8" : "#6b7280" }}>
            Aquí tienes un resumen de tu actividad en JobMatch IA
          </p>
        </div>

        {/* Alert banner */}
        <div style={{ marginBottom: 20 }}>
          <AlertBanner
            alert={alert}
            onManage={() => onNavigate?.("perfil")}
            darkMode={dm}
          />
        </div>

        {/* Stats grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}>
          <StatCard
            icon="⭐"
            value={favorites.length}
            label="Favoritos guardados"
            sub="Ofertas marcadas"
            color={dm ? "#fbbf24" : "#b45309"}
            darkMode={dm}
          />
          <StatCard
            icon="📋"
            value={applications.length}
            label="Candidaturas"
            sub="Procesos activos"
            color={dm ? "#60a5fa" : "#1d4ed8"}
            darkMode={dm}
          />
          <StatCard
            icon="🔍"
            value={history.length}
            label="Búsquedas realizadas"
            sub="Análisis IA completados"
            color={dm ? "#a78bfa" : "#7c3aed"}
            darkMode={dm}
          />
          <StatCard
            icon="🤖"
            value={quotaRemaining > 0 ? quotaRemaining : (quotaLimit > 0 ? "0" : "—")}
            label="Análisis restantes"
            sub={quotaLimit > 0 ? `${quotaUsed}/${quotaLimit} usados hoy` : "Cuota disponible"}
            color={quotaRemaining === 0 && quotaLimit > 0 ? "#ef4444" : TEAL}
            darkMode={dm}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Profile completion */}
            {completion < 100 && (
              <div style={{
                background: dm ? "#1e293b" : "#fff",
                border: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                borderRadius: 16, padding: "20px 22px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: dm ? "#f1f5f9" : "#111827", fontFamily: typography.family }}>
                    Completa tu perfil
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: TEAL }}>{completion}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: dm ? "#334155" : "#e5e7eb", overflow: "hidden" }}>
                  <div style={{
                    width: `${completion}%`, height: "100%", borderRadius: 999,
                    background: `linear-gradient(90deg, ${TEAL}, #2563eb)`,
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: dm ? "#94a3b8" : "#6b7280", fontFamily: typography.family }}>
                  Un perfil completo mejora la precisión del análisis IA hasta un 40%.
                </p>
                <button
                  onClick={() => onNavigate?.("configuracion")}
                  style={{
                    marginTop: 12, padding: "8px 16px", borderRadius: 50,
                    background: "none", border: `1.5px solid ${TEAL}`,
                    color: TEAL, fontWeight: 700, fontSize: 12,
                    cursor: "pointer", fontFamily: typography.family,
                  }}
                >
                  Completar perfil →
                </button>
              </div>
            )}

            {/* Recent history */}
            <RecentHistory history={history} darkMode={dm} />
          </div>

          {/* Right column: Quick actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
              color: dm ? "#64748b" : "#9ca3af", marginBottom: 4, fontFamily: typography.family }}>
              Acciones rápidas
            </div>
            <QuickAction
              icon="🔍"
              label="Buscar ofertas por perfil"
              desc="Matching IA con tu stack"
              onClick={() => onNavigate?.("buscar")}
              accent={TEAL}
              darkMode={dm}
            />
            <QuickAction
              icon="📄"
              label="Subir CV y buscar"
              desc="Análisis ATS + matching"
              onClick={() => onNavigate?.("cv")}
              accent="#7c3aed"
              darkMode={dm}
            />
            <QuickAction
              icon="⭐"
              label="Mis favoritos"
              desc={`${favorites.length} ofertas guardadas`}
              onClick={() => onNavigate?.("favoritos")}
              accent="#f59e0b"
              darkMode={dm}
            />
            <QuickAction
              icon="📋"
              label="Mis candidaturas"
              desc={`${applications.length} procesos activos`}
              onClick={() => onNavigate?.("candidaturas")}
              accent="#3b82f6"
              darkMode={dm}
            />
            <QuickAction
              icon="🔔"
              label="Alertas de empleo"
              desc={alert?.is_active ? `Activa ≥ ${alert.min_score_threshold}%` : "Sin alerta configurada"}
              onClick={() => onNavigate?.("perfil")}
              accent={alert?.is_active ? "#10b981" : "#6b7280"}
              darkMode={dm}
            />
          </div>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 340px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
