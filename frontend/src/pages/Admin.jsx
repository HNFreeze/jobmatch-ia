import { useEffect, useState } from "react";
import {
  getAdminActivity,
  getAdminAiUsage,
  getAdminDashboard,
  getAdminUsers,
} from "../services/api";
import { typography } from "../constants/theme";

const TEAL = "#007A8A";

export default function Admin({ darkMode }) {
  const dm = darkMode;
  const [dashboard, setDashboard] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [activity, setActivity] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  async function loadAdminData(currentPage = page, currentSearch = search, currentSortBy = sortBy, currentSortDir = sortDir) {
    setLoading(true);
    setError(null);
    try {
      const [dashboardData, usersResponse, activityData, aiUsageData] = await Promise.all([
        getAdminDashboard(),
        getAdminUsers({
          page: currentPage,
          limit: 12,
          search: currentSearch || undefined,
          sort_by: currentSortBy,
          sort_dir: currentSortDir,
        }),
        getAdminActivity(12),
        getAdminAiUsage(),
      ]);
      setDashboard(dashboardData);
      setUsersData(usersResponse);
      setActivity(activityData);
      setAiUsage(aiUsageData);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData(1, "", "created_at", "desc");
  }, []);

  function handleSearchSubmit(event) {
    event.preventDefault();
    const nextPage = 1;
    setPage(nextPage);
    loadAdminData(nextPage, search, sortBy, sortDir);
  }

  function handleSortChange(nextSortBy) {
    const nextDir = nextSortBy === sortBy && sortDir === "desc" ? "asc" : "desc";
    setSortBy(nextSortBy);
    setSortDir(nextDir);
    loadAdminData(1, search, nextSortBy, nextDir);
    setPage(1);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    loadAdminData(nextPage, search, sortBy, sortDir);
  }

  if (loading && !dashboard) {
    return (
      <div style={S.page}>
        <div style={{ ...S.centerCard, ...(dm ? S.centerCardDm : {}) }}>
          <div style={S.spinner} />
          <p style={{ ...S.centerText, color: dm ? "#94a3b8" : "#64748b" }}>Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  if (error?.status === 403) {
    return (
      <div style={S.page}>
        <div style={{ ...S.centerCard, ...(dm ? S.centerCardDm : {}) }}>
          <h1 style={{ ...S.forbiddenTitle, color: dm ? "#f8fafc" : "#111827" }}>403</h1>
          <p style={{ ...S.centerText, color: dm ? "#94a3b8" : "#64748b" }}>
            Esta zona está reservada para administradores.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.page}>
        <div style={{ ...S.centerCard, ...(dm ? S.centerCardDm : {}) }}>
          <p style={{ ...S.centerText, color: "#b91c1c" }}>
            {error.message || "No se pudo cargar el panel admin."}
          </p>
        </div>
      </div>
    );
  }

  const totalPages = usersData ? Math.max(1, Math.ceil(usersData.total / usersData.limit)) : 1;

  return (
    <div style={{ ...S.page, ...(dm ? S.pageDm : {}) }}>
      <div style={S.container}>
        <div style={S.hero}>
          <div>
            <p style={{ ...S.kicker, color: dm ? "#5eead4" : TEAL }}>Admin</p>
            <h1 style={{ ...S.title, color: dm ? "#f8fafc" : "#0f172a" }}>Panel de administración</h1>
            <p style={{ ...S.subtitle, color: dm ? "#94a3b8" : "#64748b" }}>
              Visión rápida de usuarios, uso de IA y actividad reciente.
            </p>
          </div>
        </div>

        <section style={S.section}>
          <h2 style={{ ...S.sectionTitle, color: dm ? "#f8fafc" : "#111827" }}>Dashboard</h2>
          <div style={S.metricsGrid}>
            <MetricCard label="Usuarios" value={dashboard?.total_users} extra={`${dashboard?.verified_users || 0} verificados`} darkMode={dm} />
            <MetricCard label="Altas hoy" value={dashboard?.users_registered_today} extra="Registros en el día" darkMode={dm} />
            <MetricCard label="Análisis IA" value={dashboard?.total_analyses} extra={`${dashboard?.analyses_today || 0} hoy`} darkMode={dm} />
            <MetricCard label="Cartas" value={dashboard?.total_cover_letters} extra={`${dashboard?.cover_letters_today || 0} hoy`} darkMode={dm} />
          </div>
        </section>

        <section style={S.section}>
          <div style={S.sectionHeader}>
            <h2 style={{ ...S.sectionTitle, color: dm ? "#f8fafc" : "#111827" }}>Usuarios</h2>
            <form onSubmit={handleSearchSubmit} style={S.searchForm}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por email"
                style={{ ...S.input, ...(dm ? S.inputDm : {}) }}
              />
              <button type="submit" style={S.primaryButton}>Buscar</button>
            </form>
          </div>

          <div style={{ ...S.tableWrap, ...(dm ? S.panelDm : S.panel) }}>
            <div style={S.tableHead}>
              <HeaderButton label="Email" onClick={() => handleSortChange("email")} />
              <HeaderButton label="Verificado" onClick={() => handleSortChange("email_verified")} />
              <HeaderButton label="Admin" onClick={() => handleSortChange("is_admin")} />
              <HeaderButton label="Alta" onClick={() => handleSortChange("created_at")} />
              <HeaderButton label="Cuota usada" onClick={() => handleSortChange("quota_used_today")} />
            </div>

            {(usersData?.items || []).map((user) => (
              <div key={user.id} style={{ ...S.tableRow, borderColor: dm ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}>
                <div style={S.emailCell}>
                  <span style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 700 }}>{user.email}</span>
                </div>
                <div>{user.email_verified ? "Sí" : "No"}</div>
                <div>{user.is_admin ? "Sí" : "No"}</div>
                <div>{formatDate(user.created_at)}</div>
                <div>{user.quota_used_today}/{user.daily_ai_quota}</div>
              </div>
            ))}

            {!usersData?.items?.length && (
              <div style={{ ...S.emptyState, color: dm ? "#94a3b8" : "#64748b" }}>No hay usuarios para mostrar.</div>
            )}
          </div>

          <div style={S.pagination}>
            <button
              type="button"
              onClick={() => changePage(Math.max(1, page - 1))}
              disabled={page <= 1}
              style={{ ...S.secondaryButton, opacity: page <= 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 13 }}>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => changePage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              style={{ ...S.secondaryButton, opacity: page >= totalPages ? 0.5 : 1 }}
            >
              Siguiente
            </button>
          </div>
        </section>

        <section style={S.twoCol}>
          <div style={{ ...S.card, ...(dm ? S.panelDm : S.panel) }}>
            <h2 style={{ ...S.sectionTitle, marginBottom: 16, color: dm ? "#f8fafc" : "#111827" }}>Uso IA</h2>
            <div style={S.usageSummary}>
              <SummaryLine label="Uso total" value={`${aiUsage?.total_usage?.units || 0} unidades`} darkMode={dm} />
              <SummaryLine label="Hoy" value={`${aiUsage?.today_usage?.units || 0} unidades`} darkMode={dm} />
              <SummaryLine label="Análisis hoy" value={aiUsage?.today_usage?.analyses || 0} darkMode={dm} />
              <SummaryLine label="Cartas hoy" value={aiUsage?.today_usage?.cover_letters || 0} darkMode={dm} />
            </div>

            <div style={S.subblock}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Top usuarios</p>
              {(aiUsage?.top_users || []).map((item) => (
                <div key={item.email} style={S.listRow}>
                  <span style={{ color: dm ? "#f8fafc" : "#111827" }}>{item.email}</span>
                  <span style={{ color: dm ? "#5eead4" : TEAL, fontWeight: 800 }}>{item.units}</span>
                </div>
              ))}
            </div>

            <div style={S.subblock}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Usuarios al límite</p>
              {(aiUsage?.limit_hits || []).length ? (
                aiUsage.limit_hits.map((item) => (
                  <div key={item.email} style={S.listRow}>
                    <span style={{ color: dm ? "#f8fafc" : "#111827" }}>{item.email}</span>
                    <span style={{ color: "#f97316", fontWeight: 800 }}>{item.used_today}/{item.daily_ai_quota}</span>
                  </div>
                ))
              ) : (
                <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Nadie ha alcanzado el límite hoy.</p>
              )}
            </div>
          </div>

          <div style={{ ...S.card, ...(dm ? S.panelDm : S.panel) }}>
            <h2 style={{ ...S.sectionTitle, marginBottom: 16, color: dm ? "#f8fafc" : "#111827" }}>Actividad reciente</h2>
            {(activity?.items || []).length ? (
              activity.items.map((item, index) => (
                <div key={`${item.type}-${index}-${item.created_at}`} style={{ ...S.activityRow, borderColor: dm ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}>
                  <div>
                    <p style={{ ...S.activityTitle, color: dm ? "#f8fafc" : "#111827" }}>{item.summary}</p>
                    <p style={{ ...S.activityMeta, color: dm ? "#94a3b8" : "#64748b" }}>{item.email}</p>
                  </div>
                  <span style={{ ...S.activityDate, color: dm ? "#64748b" : "#94a3af" }}>{formatDate(item.created_at, true)}</span>
                </div>
              ))
            ) : (
              <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>No hay actividad reciente.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, extra, darkMode }) {
  return (
    <div style={{ ...S.metricCard, ...(darkMode ? S.panelDm : S.panel) }}>
      <p style={{ ...S.metricLabel, color: darkMode ? "#94a3b8" : "#64748b" }}>{label}</p>
      <div style={{ ...S.metricValue, color: darkMode ? "#f8fafc" : "#0f172a" }}>{value ?? 0}</div>
      <p style={{ ...S.metricExtra, color: darkMode ? "#5eead4" : TEAL }}>{extra}</p>
    </div>
  );
}

function SummaryLine({ label, value, darkMode }) {
  return (
    <div style={S.listRow}>
      <span style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>{label}</span>
      <span style={{ color: darkMode ? "#f8fafc" : "#111827", fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function HeaderButton({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={S.headerButton}>
      {label}
    </button>
  );
}

function formatDate(value, short = false) {
  if (!value) return "-";
  try {
    const date = new Date(value);
    return date.toLocaleString("es-ES", short
      ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "-";
  }
}

const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    padding: "28px 20px 40px",
    fontFamily: typography.family,
  },
  pageDm: {
    backgroundColor: "#0f172a",
  },
  container: {
    maxWidth: 1240,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
  },
  kicker: {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  title: {
    margin: "0 0 8px",
    fontSize: 36,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    maxWidth: 640,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  metricCard: {
    borderRadius: 18,
    padding: "18px 18px 16px",
  },
  metricLabel: {
    margin: "0 0 10px",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  metricValue: {
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1,
    marginBottom: 10,
  },
  metricExtra: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
  },
  panel: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  panelDm: {
    backgroundColor: "#1e293b",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
  },
  tableWrap: {
    borderRadius: 18,
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr",
    gap: 12,
    padding: "14px 16px",
    backgroundColor: "rgba(0,122,138,0.08)",
  },
  headerButton: {
    background: "none",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
    color: TEAL,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontFamily: typography.family,
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr",
    gap: 12,
    padding: "14px 16px",
    alignItems: "center",
    fontSize: 13,
    borderTop: "1px solid",
  },
  emailCell: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  searchForm: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  input: {
    minWidth: 220,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    padding: "11px 14px",
    fontSize: 14,
    outline: "none",
    fontFamily: typography.family,
  },
  inputDm: {
    backgroundColor: "#0f172a",
    borderColor: "rgba(255,255,255,0.1)",
    color: "#f8fafc",
  },
  primaryButton: {
    border: "1px solid #005B66",
    backgroundColor: TEAL,
    color: "#fff",
    borderRadius: 999,
    padding: "11px 16px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: typography.family,
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#334155",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: typography.family,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  card: {
    borderRadius: 18,
    padding: "18px 18px 16px",
  },
  usageSummary: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 16,
  },
  subblock: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 14,
  },
  subTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    lineHeight: 1.5,
  },
  activityRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 0",
    borderTop: "1px solid",
  },
  activityTitle: {
    margin: "0 0 4px",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  activityMeta: {
    margin: 0,
    fontSize: 12,
  },
  activityDate: {
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  emptyState: {
    padding: "18px 16px",
    fontSize: 13,
  },
  emptyInline: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
  },
  centerCard: {
    maxWidth: 520,
    margin: "80px auto 0",
    padding: "30px 26px",
    borderRadius: 20,
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    textAlign: "center",
  },
  centerCardDm: {
    backgroundColor: "#1e293b",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  spinner: {
    width: 34,
    height: 34,
    border: "3px solid #dbeafe",
    borderTop: `3px solid ${TEAL}`,
    borderRadius: "50%",
    margin: "0 auto 18px",
    animation: "spin 1s linear infinite",
  },
  centerText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.7,
  },
  forbiddenTitle: {
    margin: "0 0 10px",
    fontSize: 54,
    fontWeight: 900,
    letterSpacing: "-0.05em",
  },
};

if (typeof document !== "undefined" && !document.getElementById("admin-spin-style")) {
  const style = document.createElement("style");
  style.id = "admin-spin-style";
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
