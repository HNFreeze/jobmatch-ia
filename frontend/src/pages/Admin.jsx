import { useEffect, useState } from "react";
import {
  clearAdminCache,
  cleanupInactiveUsers,
  deleteAdminUser,
  exportEvaluationCsv,
  getAdminActivity,
  getAdminAiUsage,
  getAdminDashboard,
  getAdminJobIndexHealth,
  getAdminJobSourceStatus,
  getAdminJobIngestionRuns,
  getAdminUsers,
  getMatchingQualityMetrics,
  resetAdminUserQuotaUsage,
  startAdminJobIngestion,
  updateAdminUserBlock,
  updateAdminUserQuota,
} from "../services/api";
import { typography } from "../constants/theme";
import BrandLogo from "../components/BrandLogo";

const TEAL = "#007A8A";

export default function Admin({ darkMode, onLogout, toggleDarkMode }) {
  const dm = darkMode;
  const [dashboard, setDashboard] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [activity, setActivity] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [jobHealth, setJobHealth] = useState(null);
  const [jobSources, setJobSources] = useState(null);
  const [ingestionRuns, setIngestionRuns] = useState(null);
  const [matchingQuality, setMatchingQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard-admin");
  const [motorExpanded, setMotorExpanded] = useState(false);
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [quotaDrafts, setQuotaDrafts] = useState({});
  const [savingQuotaId, setSavingQuotaId] = useState(null);
  const [resettingQuotaId, setResettingQuotaId] = useState(null);
  const [togglingBlockId, setTogglingBlockId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [actionNotice, setActionNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheNotice, setCacheNotice] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [startingIngestion, setStartingIngestion] = useState(false);
  const [ingestionNotice, setIngestionNotice] = useState("");
  const [ingestionDraft, setIngestionDraft] = useState({
    skills: "",
    locations: "",
    sources: "public_sources,adzuna,jobspy,jsearch",
  });

  async function loadAdminData(currentPage = page, currentSearch = search, currentSortBy = sortBy, currentSortDir = sortDir) {
    setLoading(true);
    setError(null);
    try {
      const [dashboardData, usersResponse, activityData, aiUsageData, jobHealthData, jobSourceData, ingestionData, matchingQualityData] = await Promise.all([
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
        getAdminJobIndexHealth(),
        getAdminJobSourceStatus(),
        getAdminJobIngestionRuns(10),
        getMatchingQualityMetrics().catch(() => null),
      ]);

      setDashboard(dashboardData);
      setUsersData(usersResponse);
      setActivity(activityData);
      setAiUsage(aiUsageData);
      setJobHealth(jobHealthData);
      setJobSources(jobSourceData);
      setIngestionRuns(ingestionData);
      setMatchingQuality(matchingQualityData);
      setQuotaDrafts((prev) => {
        const next = { ...prev };
        (usersResponse.items || []).forEach((user) => {
          next[user.id] = next[user.id] ?? user.daily_ai_quota ?? 0;
        });
        return next;
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }

  useEffect(() => {
    loadAdminData(1, "", "created_at", "desc");
  }, []);

  useEffect(() => {
    if (!ingestionRuns?.running) return undefined;
    const timer = setInterval(() => {
      loadAdminData(page, search, sortBy, sortDir);
    }, 5000);
    return () => clearInterval(timer);
  }, [ingestionRuns?.running, page, search, sortBy, sortDir]);

  useEffect(() => {
    const sectionIds = [
      "dashboard-admin", "ia-admin", "calidad-matching", "actividad-admin",
      "usuarios-admin", "motor-admin", "sistema-admin",
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { threshold: 0, rootMargin: "-20% 0px -70% 0px" },
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function formatAgo(date) {
    if (!date) return null;
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return "justo ahora";
    if (mins === 1) return "hace 1 min";
    if (mins < 60) return `hace ${mins} min`;
    return `hace ${Math.floor(mins / 60)}h`;
  }

  function scrollToSection(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function parseCsvInput(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    loadAdminData(1, search, sortBy, sortDir);
  }

  function handleSortChange(nextSortBy) {
    const nextDir = nextSortBy === sortBy && sortDir === "desc" ? "asc" : "desc";
    setSortBy(nextSortBy);
    setSortDir(nextDir);
    setPage(1);
    loadAdminData(1, search, nextSortBy, nextDir);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    loadAdminData(nextPage, search, sortBy, sortDir);
  }

  async function handleQuotaSave(user) {
    const value = Number(quotaDrafts[user.id] ?? user.daily_ai_quota ?? 0);
    if (!Number.isInteger(value) || value < 1 || value > 200) {
      setActionError("La cuota debe mantenerse entre 1 y 200.");
      setActionNotice("");
      return;
    }

    setSavingQuotaId(user.id);
    setActionError("");
    setActionNotice("");
    try {
      await updateAdminUserQuota(user.id, value);
      setActionNotice(`Cuota diaria actualizada para ${user.email}.`);
      await loadAdminData(page, search, sortBy, sortDir);
    } catch (err) {
      setActionError(err.message || "No se pudo actualizar la cuota.");
    } finally {
      setSavingQuotaId(null);
    }
  }

  async function handleQuotaReset(user) {
    setResettingQuotaId(user.id);
    setActionError("");
    setActionNotice("");
    try {
      await resetAdminUserQuotaUsage(user.id);
      setActionNotice(`Uso diario reseteado para ${user.email}.`);
      await loadAdminData(page, search, sortBy, sortDir);
    } catch (err) {
      setActionError(err.message || "No se pudo resetear la cuota.");
    } finally {
      setResettingQuotaId(null);
    }
  }

  async function handleBlockToggle(user) {
    setTogglingBlockId(user.id);
    setActionError("");
    setActionNotice("");
    try {
      await updateAdminUserBlock(user.id, !user.is_blocked);
      setActionNotice(
        user.is_blocked
          ? `Cuenta desbloqueada para ${user.email}.`
          : `Cuenta bloqueada para ${user.email}.`
      );
      await loadAdminData(page, search, sortBy, sortDir);
    } catch (err) {
      setActionError(err.message || "No se pudo actualizar el bloqueo.");
    } finally {
      setTogglingBlockId(null);
    }
  }

  function handleDeleteUser(user) {
    setDeleteModalUser(user);
    setDeleteConfirmCode("");
  }

  async function handleConfirmDelete() {
    if (!deleteModalUser) return;
    setDeletingUserId(deleteModalUser.id);
    setActionError("");
    setActionNotice("");
    try {
      await deleteAdminUser(deleteModalUser.id, deleteConfirmCode.trim());
      setActionNotice(`Usuario eliminado: ${deleteModalUser.email}.`);
      setDeleteModalUser(null);
      await loadAdminData(page, search, sortBy, sortDir);
    } catch (err) {
      setActionError(err.message || "No se pudo eliminar el usuario.");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      await exportEvaluationCsv();
    } catch (err) {
      setActionError(err.message || "No se pudo exportar el CSV.");
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleCleanupPreview() {
    setCleanupRunning(true);
    setCleanupResult(null);
    try {
      const result = await cleanupInactiveUsers({ daysInactive: cleanupDays, dryRun: true });
      setCleanupResult(result);
    } catch (err) {
      setActionError(err.message || "Error al previsualizar limpieza.");
    } finally {
      setCleanupRunning(false);
    }
  }

  async function handleCleanupConfirm() {
    if (!window.confirm(`¿Eliminar definitivamente ${cleanupResult?.would_delete || 0} usuarios inactivos? Esta acción no se puede deshacer.`)) return;
    setCleanupRunning(true);
    try {
      const result = await cleanupInactiveUsers({ daysInactive: cleanupDays, dryRun: false });
      setActionNotice(`Limpieza completada: ${result.deleted} usuarios eliminados.`);
      setCleanupResult(null);
      await loadAdminData(page, search, sortBy, sortDir);
    } catch (err) {
      setActionError(err.message || "Error en la limpieza.");
    } finally {
      setCleanupRunning(false);
    }
  }

  async function handleStartIngestion() {
    setStartingIngestion(true);
    setIngestionNotice("");
    setActionError("");
    try {
      const payload = {
        skills: parseCsvInput(ingestionDraft.skills),
        locations: parseCsvInput(ingestionDraft.locations),
        sources: parseCsvInput(ingestionDraft.sources),
      };
      const result = await startAdminJobIngestion(payload);
      setIngestionNotice(`Ingesta lanzada. Run #${result.run_id} en estado ${result.status}.`);
      await loadAdminData(page, search, sortBy, sortDir);
    } catch (err) {
      setIngestionNotice(`Error: ${err.message || "No se pudo lanzar la ingesta."}`);
    } finally {
      setStartingIngestion(false);
    }
  }

  if (loading && !dashboard) {
    return (
      <div style={{ ...S.page, ...(dm ? S.pageDm : {}) }}>
        <div style={{ ...S.centerCard, ...(dm ? S.centerCardDm : {}) }}>
          <div style={S.spinner} />
          <p style={{ ...S.centerText, color: dm ? "#94a3b8" : "#64748b" }}>Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  if (error?.status === 403) {
    return (
      <div style={{ ...S.page, ...(dm ? S.pageDm : {}) }}>
        <div style={{ ...S.centerCard, ...(dm ? S.centerCardDm : {}) }}>
          <h1 style={{ ...S.forbiddenTitle, color: dm ? "#f8fafc" : "#111827" }}>403</h1>
          <p style={{ ...S.centerText, color: dm ? "#94a3b8" : "#64748b" }}>Esta zona está reservada para administradores.</p>
          <button type="button" onClick={onLogout} style={S.primaryButton}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...S.page, ...(dm ? S.pageDm : {}) }}>
        <div style={{ ...S.centerCard, ...(dm ? S.centerCardDm : {}) }}>
          <p style={{ ...S.centerText, color: "#b91c1c" }}>{error.message || "No se pudo cargar el panel admin."}</p>
        </div>
      </div>
    );
  }

  const totalPages = usersData ? Math.max(1, Math.ceil(usersData.total / usersData.limit)) : 1;

  return (
    <div className="admin-page-wrap" style={{ ...S.page, ...(dm ? S.pageDm : {}) }}>
      <div style={S.bgGlowOne} />
      <div style={S.bgGlowTwo} />
      <div style={S.container}>
        <header style={{ ...S.adminHeader, ...(dm ? S.panelDm : S.panel) }}>
          <div>
            <div style={S.brandWrap}>
              <BrandLogo
                size={34}
                showWordmark={true}
                gap={10}
                wordmarkSize={22}
                tone={dm ? "light" : "gradient"}
              />
            </div>
            <p style={{ ...S.kicker, color: dm ? "#67e8f9" : TEAL }}>Administración</p>
            <h1 className="admin-header-title" style={{ ...S.title, color: dm ? "#f8fafc" : "#0f172a" }}>Panel de control</h1>
            <p style={{ ...S.subtitle, color: dm ? "#94a3b8" : "#64748b" }}>
              Gestiona cuentas, cuotas, bloqueos y el uso global de la aplicación desde una zona separada.
            </p>
          </div>

          <div style={S.adminActions}>
            <div style={S.sectionPills}>
              {[
                { id: "dashboard-admin",  label: "Dashboard" },
                { id: "ia-admin",         label: "Uso IA" },
                { id: "calidad-matching", label: "Calidad IA" },
                { id: "actividad-admin",  label: "Actividad" },
                { id: "usuarios-admin",   label: "Usuarios" },
                { id: "motor-admin",      label: "Motor" },
                { id: "sistema-admin",    label: "Sistema" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className="admin-pill-btn"
                  onClick={() => scrollToSection(id)}
                  style={{ ...S.pillButton, ...(activeSection === id ? S.pillButtonActive : {}) }}
                >
                  {label}
                </button>
              ))}
              <a
                href="https://clarity.microsoft.com"
                target="_blank"
                rel="noopener noreferrer"
                className="admin-pill-btn"
                style={{ ...S.pillButton, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                📊 Analítica
              </a>
            </div>
            <div style={S.headerButtons}>
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => loadAdminData(page, search, sortBy, sortDir)}
                disabled={loading}
                style={{ ...S.secondaryButton, opacity: loading ? 0.6 : 1 }}
                title="Actualizar datos"
              >
                {loading ? "↻ Actualizando…" : `↻ Actualizar${lastRefreshed ? ` · ${formatAgo(lastRefreshed)}` : ""}`}
              </button>
              <button type="button" className="admin-btn-secondary" onClick={toggleDarkMode} style={S.secondaryButton}>
                {dm ? "Modo claro" : "Modo oscuro"}
              </button>
              <button type="button" className="admin-btn-primary" onClick={onLogout} style={S.primaryButton}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        {(actionNotice || actionError) && (
          <div
            style={{
              ...S.noticeCard,
              ...(actionError ? S.errorCard : S.successCard),
              ...(dm ? S.noticeCardDm : {}),
            }}
          >
            {actionError || actionNotice}
          </div>
        )}

        <section id="dashboard-admin" style={S.section}>
          <h2 style={{ ...S.sectionTitle, color: dm ? "#f8fafc" : "#111827" }}>Dashboard</h2>
          <div style={S.metricsGrid}>
            <MetricCard label="Usuarios" value={dashboard?.total_users} extra={`${dashboard?.verified_users || 0} verificados`} darkMode={dm} />
            <MetricCard label="Altas hoy" value={dashboard?.users_registered_today} extra="Registros del día" darkMode={dm} />
            <MetricCard label="Análisis IA" value={dashboard?.total_analyses} extra={`${dashboard?.analyses_today || 0} hoy`} darkMode={dm} />
            <MetricCard label="Cartas" value={dashboard?.total_cover_letters} extra={`${dashboard?.cover_letters_today || 0} hoy`} darkMode={dm} />
          </div>
        </section>

        <section id="motor-admin" style={S.section}>
          <div style={S.sectionHeader}>
            <div>
              <h2 style={{ ...S.sectionTitle, color: dm ? "#f8fafc" : "#111827" }}>Motor de ofertas</h2>
              <p style={{ ...S.sectionLead, color: dm ? "#94a3b8" : "#64748b" }}>
                Vista rápida de cobertura, frescura y rendimiento de las fuentes que alimentan el índice propio.
              </p>
            </div>
          </div>

          <div style={S.metricsGrid}>
            <MetricCard
              label="Ofertas activas"
              value={jobHealth?.overview?.active_offers}
              extra={`${jobHealth?.overview?.total_offers || 0} totales`}
              darkMode={dm}
            />
            <MetricCard
              label="Verificadas"
              value={jobHealth?.overview?.verified_recently}
              extra={formatPercent(
                (jobHealth?.overview?.verified_recently || 0) / Math.max(jobHealth?.overview?.active_offers || 1, 1),
                0,
              )}
              darkMode={dm}
            />
            <MetricCard
              label="Confianza media"
              value={formatPercent(jobHealth?.overview?.avg_confidence || 0, 0)}
              extra={`${jobHealth?.overview?.source_count || 0} fuentes`}
              darkMode={dm}
            />
            <MetricCard
              label="Listados antiguos"
              value={jobHealth?.overview?.stale_listing}
              extra="Revisar prioridad"
              darkMode={dm}
            />
          </div>

          <button
            type="button"
            onClick={() => setMotorExpanded(v => !v)}
            style={{ ...S.secondaryButton, marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            {motorExpanded ? "▲ Mostrar menos" : "▼ Ver fuentes y detalles"}
          </button>

          {motorExpanded && <div style={{ ...S.card, ...(dm ? S.panelDm : S.panel), marginTop: 16 }}>
            <div style={S.sectionHeader}>
              <div>
                <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a", marginBottom: 6 }}>Fuentes disponibles y configuración</p>
                <p style={{ ...S.sectionLead, color: dm ? "#94a3b8" : "#64748b", margin: 0 }}>
                  Aquí ves qué conectores gratuitos o públicos soporta el motor y si ya están listos en este entorno.
                </p>
              </div>
            </div>

            <div style={{ ...S.metricsGrid, marginTop: 12 }}>
              <MetricCard
                label="Fuentes listas"
                value={jobSources?.overview?.ready_sources}
                extra={`${jobSources?.overview?.missing_sources || 0} pendientes`}
                darkMode={dm}
              />
              <MetricCard
                label="ATS públicos listos"
                value={jobSources?.overview?.public_ready_sources}
                extra="Sin pago por lectura"
                darkMode={dm}
              />
              <MetricCard
                label="Targets públicos"
                value={jobSources?.overview?.configured_public_targets}
                extra="Boards, sites o slugs configurados"
                darkMode={dm}
              />
              <MetricCard
                label="Fallback activo"
                value={(jobSources?.sources || []).some((item) => item.key === "adzuna" && item.is_configured) ? "Sí" : "No"}
                extra="Adzuna"
                darkMode={dm}
              />
            </div>

            <div style={{ ...S.sourceStatusGrid, marginTop: 16 }}>
              {(jobSources?.sources || []).map((source) => (
                <div
                  key={source.key}
                  style={{
                    ...S.sourceStatusCard,
                    ...(dm ? S.sourceStatusCardDm : {}),
                    borderColor: source.is_configured
                      ? (dm ? "rgba(16,185,129,0.34)" : "rgba(16,185,129,0.26)")
                      : (dm ? "rgba(148,163,184,0.18)" : "#dbe2ea"),
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 900 }}>{source.label}</span>
                      <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                        {formatSourceType(source.source_type)} · {formatPricingLabel(source.pricing)}
                      </span>
                    </div>
                    <span style={{
                      ...S.sourceStatusBadge,
                      backgroundColor: source.is_configured
                        ? (dm ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.12)")
                        : (dm ? "rgba(148,163,184,0.16)" : "#eef2f7"),
                      color: source.is_configured ? "#047857" : (dm ? "#cbd5e1" : "#475569"),
                      borderColor: source.is_configured
                        ? "rgba(16,185,129,0.22)"
                        : (dm ? "rgba(148,163,184,0.2)" : "#dbe2ea"),
                    }}>
                      {source.is_configured ? "Lista" : "Pendiente"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <span style={S.runStatBadge}>{source.configured_key_count}/{source.required_key_count} claves</span>
                    <span style={S.runStatBadge}>{source.configured_values_count || 0} targets</span>
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.6, color: dm ? "#cbd5e1" : "#475569" }}>
                    {source.activation_hint}
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.6, color: dm ? "#94a3b8" : "#64748b" }}>
                    <strong>Variables:</strong> {source.env_keys.join(", ")}
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.6, color: dm ? "#94a3b8" : "#64748b" }}>
                    <strong>Vista previa:</strong> {(source.configured_values_preview || []).join(", ") || "sin boards/sites/slugs aún"}
                  </div>
                </div>
              ))}
            </div>
          </div>}

          <div style={S.twoCol}>
            <div style={{ ...S.card, ...(dm ? S.panelDm : S.panel) }}>
              <div style={S.subblock}>
                <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Fuentes principales</p>
                {(jobHealth?.sources || []).length ? (
                  jobHealth.sources.map((source) => (
                    <div
                      key={`${source.source_name}-${source.source_type}`}
                      style={{ ...S.healthRow, borderColor: dm ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 800 }}>
                          {formatSourceName(source.source_name)}
                        </span>
                        <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                          {formatSourceType(source.source_type)} · última entrada {formatDate(source.last_seen_at, true)}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                        <span style={S.runStatBadge}>{source.active_offers} activas</span>
                        <span style={S.runStatBadge}>{source.verified_recently} verificadas</span>
                        <span style={S.runStatBadge}>{formatPercent(source.avg_confidence || 0, 0)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Todavía no hay datos de fuentes en el índice.</p>
                )}
              </div>

              <div style={S.subblock}>
                <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Top ubicaciones activas</p>
                {(jobHealth?.top_locations || []).length ? (
                  jobHealth.top_locations.map((item) => (
                    <div key={item.location} style={S.listRow}>
                      <span style={{ color: dm ? "#94a3b8" : "#64748b" }}>{item.location}</span>
                      <span style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 800 }}>{item.count}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Todavía no hay suficiente señal geográfica.</p>
                )}
              </div>
            </div>

            <div style={{ ...S.card, ...(dm ? S.panelDm : S.panel) }}>
              <div style={S.subblock}>
                <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Estado de frescura</p>
                {(jobHealth?.freshness || []).length ? (
                  jobHealth.freshness.map((item) => (
                    <div key={item.key} style={S.listRow}>
                      <span style={{ color: dm ? "#94a3b8" : "#64748b" }}>{item.label}</span>
                      <span style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 800 }}>{item.count}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Sin datos de frescura todavía.</p>
                )}
              </div>

              <div style={S.subblock}>
                <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Últimas ingestas</p>
                {(jobHealth?.recent_runs || []).length ? (
                  jobHealth.recent_runs.map((run) => (
                    <div
                      key={`health-run-${run.id}`}
                      style={{ ...S.healthRow, borderColor: dm ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 800 }}>
                          Run #{run.id} · {formatIngestionStatus(run.status)}
                        </span>
                        <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                          {formatDate(run.created_at, true)} · duración {formatDuration(run.started_at, run.finished_at)}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                        <span style={S.runStatBadge}>{run.saved_new_count} nuevas</span>
                        <span style={S.runStatBadge}>{run.saved_updated_count} actualizadas</span>
                        <span style={S.runStatBadge}>{run.inactive_count} inactivas</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Todavía no hay ingestas registradas.</p>
                )}
              </div>
            </div>
          </div>}
        </section>

        <section id="usuarios-admin" style={S.section}>
          <div style={S.sectionHeader}>
            <div>
              <h2 style={{ ...S.sectionTitle, color: dm ? "#f8fafc" : "#111827" }}>Usuarios</h2>
              <p style={{ ...S.sectionLead, color: dm ? "#94a3b8" : "#64748b" }}>
                Ajusta la cuota diaria con botones, guarda el cambio y resetea el uso de hoy cuando necesites devolver acceso completo.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} style={S.searchForm}>
              <input
                className="admin-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por email"
                style={{ ...S.input, ...(dm ? S.inputDm : {}) }}
              />
              <button type="submit" className="admin-btn-primary" style={S.primaryButton}>Buscar</button>
            </form>
          </div>

          <div style={{ ...S.tableWrap, ...(dm ? S.panelDm : S.panel) }}>
            <div style={{ minWidth: 720 }}>
            <div style={S.tableHead}>
              <HeaderButton label="Email" onClick={() => handleSortChange("email")} />
              <HeaderButton label="Estado" onClick={() => handleSortChange("is_blocked")} />
              <HeaderButton label="Verificado" onClick={() => handleSortChange("email_verified")} />
              <HeaderButton label="Alta" onClick={() => handleSortChange("created_at")} />
              <HeaderButton label="Uso hoy" onClick={() => handleSortChange("quota_used_today")} />
              <div style={S.headLabel}>Gestión</div>
            </div>

            {(usersData?.items || []).map((user) => {
              const draftQuota = Number(quotaDrafts[user.id] ?? user.daily_ai_quota ?? 0);
              return (
                <div key={user.id} className="admin-table-row" style={{ ...S.tableRow, borderColor: dm ? "rgba(255,255,255,0.06)" : "#e5e7eb", transition: "background 0.14s ease" }}>
                  <div style={S.emailCell}>
                    <div style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 700 }}>{user.email}</div>
                    <div style={{ ...S.rowMeta, color: dm ? "#94a3b8" : "#64748b" }}>
                      {user.is_admin ? "Administrador" : "Usuario"} · {user.is_blocked ? "Bloqueado" : "Activo"}
                    </div>
                  </div>

                  <div>
                    <StatusBadge label={user.is_blocked ? "Bloqueado" : "Activo"} tone={user.is_blocked ? "danger" : "success"} />
                  </div>

                  <div>{user.email_verified ? "Sí" : "No"}</div>
                  <div>{formatDate(user.created_at)}</div>
                  <div>{user.quota_used_today}/{user.daily_ai_quota}</div>

                  <div style={S.manageCell}>
                    <div style={S.quotaEditor}>
                      <span style={{ ...S.quotaLabel, color: dm ? "#94a3b8" : "#64748b" }}>Cuota diaria</span>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={draftQuota}
                        onChange={(e) => {
                          const v = Math.min(200, Math.max(1, Number(e.target.value) || 1));
                          setQuotaDrafts(prev => ({ ...prev, [user.id]: v }));
                        }}
                        style={{
                          width: 72, textAlign: "center", borderRadius: 8,
                          border: `1px solid ${dm ? "rgba(255,255,255,0.15)" : "#d1d5db"}`,
                          background: dm ? "#0f172a" : "#fff",
                          color: dm ? "#f8fafc" : "#0f172a",
                          fontSize: 14, fontWeight: 700, padding: "6px 8px",
                          fontFamily: typography.family,
                        }}
                      />
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        onClick={() => handleQuotaSave(user)}
                        disabled={savingQuotaId === user.id}
                        style={{ ...S.secondaryButton, opacity: savingQuotaId === user.id ? 0.6 : 1 }}
                      >
                        {savingQuotaId === user.id ? "Guardando..." : "Guardar cuota"}
                      </button>
                    </div>

                    <div style={S.actionButtons}>
                      <button
                        type="button"
                        className="admin-btn-reset"
                        onClick={() => handleQuotaReset(user)}
                        disabled={resettingQuotaId === user.id}
                        style={{ ...S.resetButton, opacity: resettingQuotaId === user.id ? 0.6 : 1 }}
                      >
                        {resettingQuotaId === user.id ? "Reseteando..." : "Resetear uso de hoy"}
                      </button>

                      <button
                        type="button"
                        className={user.is_blocked ? "admin-btn-unblock" : "admin-btn-block"}
                        onClick={() => handleBlockToggle(user)}
                        disabled={togglingBlockId === user.id}
                        style={user.is_blocked ? S.unblockButton : S.blockButton}
                      >
                        {togglingBlockId === user.id ? "Actualizando..." : user.is_blocked ? "Desbloquear" : "Bloquear"}
                      </button>

                      {!user.is_admin && (
                        <button
                          type="button"
                          className="admin-btn-delete"
                          onClick={() => handleDeleteUser(user)}
                          disabled={deletingUserId === user.id}
                          style={{ ...S.deleteButton, opacity: deletingUserId === user.id ? 0.6 : 1 }}
                        >
                          {deletingUserId === user.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!usersData?.items?.length && (
              <div style={{ ...S.emptyState, color: dm ? "#94a3b8" : "#64748b" }}>No hay usuarios para mostrar.</div>
            )}
            </div>
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
          <div id="ia-admin" style={{ ...S.card, ...(dm ? S.panelDm : S.panel) }}>
            <h2 style={{ ...S.sectionTitle, marginBottom: 16, color: dm ? "#f8fafc" : "#111827" }}>Uso IA</h2>
            <div style={S.usageSummary}>
              <SummaryLine label="Uso total" value={`${aiUsage?.total_usage?.units || 0} unidades`} darkMode={dm} />
              <SummaryLine label="Hoy" value={`${aiUsage?.today_usage?.units || 0} unidades`} darkMode={dm} />
              <SummaryLine label="Análisis hoy" value={aiUsage?.today_usage?.analyses || 0} darkMode={dm} />
              <SummaryLine label="Cartas hoy" value={aiUsage?.today_usage?.cover_letters || 0} darkMode={dm} />
            </div>

            <div style={{ ...S.costGrid, marginBottom: 18 }}>
              <CostCard
                label="Coste estimado hoy"
                value={formatUsd(aiUsage?.cost_estimate?.estimated_spent_today_usd)}
                darkMode={dm}
              />
              <CostCard
                label="Coste desde seguimiento"
                value={formatUsd(aiUsage?.cost_estimate?.estimated_spent_since_tracking_usd)}
                darkMode={dm}
              />
              <CostCard
                label="Coste combinado"
                value={formatUsd(aiUsage?.cost_estimate?.combined_spent_usd)}
                helper={`Base manual: ${formatUsd(aiUsage?.cost_estimate?.baseline_spent_usd)}`}
                darkMode={dm}
              />
              <CostCard
                label="Saldo estimado"
                value={
                  aiUsage?.cost_estimate?.estimated_remaining_usd === null
                    ? "No configurado"
                    : formatUsd(aiUsage?.cost_estimate?.estimated_remaining_usd)
                }
                helper={
                  aiUsage?.cost_estimate?.baseline_remaining_usd
                    ? `Base manual: ${formatUsd(aiUsage.cost_estimate.baseline_remaining_usd)}`
                    : "Configurable desde entorno"
                }
                darkMode={dm}
              />
            </div>

            <div style={S.subblock}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Top usuarios</p>
              {(aiUsage?.top_users || []).map((item) => (
                <div key={item.email} style={S.listRow}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: dm ? "#f8fafc" : "#111827" }}>{item.email}</span>
                    <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                      {formatUsd(item.estimated_cost_usd)} · {item.units} unidades
                    </span>
                  </div>
                  <span style={{ color: dm ? "#5eead4" : TEAL, fontWeight: 800 }}>{item.analyses + item.cover_letters}</span>
                </div>
              ))}
            </div>

            <div style={S.subblock}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Coste por funcionalidad</p>
              {(aiUsage?.cost_estimate?.feature_breakdown || []).length ? (
                aiUsage.cost_estimate.feature_breakdown.map((item) => (
                  <div key={item.feature} style={S.listRow}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ color: dm ? "#f8fafc" : "#111827" }}>{formatFeatureLabel(item.feature)}</span>
                      <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>{item.requests} llamadas</span>
                    </div>
                    <span style={{ color: dm ? "#5eead4" : TEAL, fontWeight: 800 }}>{formatUsd(item.estimated_cost_usd)}</span>
                  </div>
                ))
              ) : (
                <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Todavia no hay llamadas registradas para estimar coste.</p>
              )}
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
            <div style={S.subblock}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Evolucion de 7 dias</p>
              {(aiUsage?.cost_estimate?.daily_breakdown || []).length ? (
                <div style={S.timelineWrap}>
                  {aiUsage.cost_estimate.daily_breakdown.map((item) => (
                    <div key={item.date} style={S.timelineRow}>
                      <div style={S.timelineDay}>
                        <span style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 700 }}>
                          {formatShortDay(item.date)}
                        </span>
                        <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                          {item.units} u.
                        </span>
                      </div>
                      <div style={{ ...S.timelineBarTrack, ...(dm ? S.timelineBarTrackDm : {}) }}>
                        <div
                          style={{
                            ...S.timelineBarFill,
                            width: `${Math.max(8, getCostBarWidth(aiUsage.cost_estimate.daily_breakdown, item.estimated_cost_usd))}%`,
                          }}
                        />
                      </div>
                      <div style={S.timelineValueWrap}>
                        <span style={{ color: dm ? "#5eead4" : TEAL, fontWeight: 800 }}>{formatUsd(item.estimated_cost_usd)}</span>
                        <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                          {item.analyses} an. · {item.cover_letters} cartas
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Todavia no hay suficiente historico diario.</p>
              )}
            </div>

            <div style={S.subblock}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Modelos y tokens</p>
              {(aiUsage?.cost_estimate?.model_breakdown || []).length ? (
                aiUsage.cost_estimate.model_breakdown.map((item) => (
                  <div key={item.model} style={S.listRow}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ color: dm ? "#f8fafc" : "#111827" }}>{formatModelName(item.model)}</span>
                      <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                        {item.requests} llamadas · in {formatCompactNumber(item.input_tokens)} · out {formatCompactNumber(item.output_tokens)}
                      </span>
                    </div>
                    <span style={{ color: dm ? "#5eead4" : TEAL, fontWeight: 800 }}>{formatUsd(item.estimated_cost_usd)}</span>
                  </div>
                ))
              ) : (
                <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Todavia no hay modelos registrados.</p>
              )}
            </div>

            <div style={S.subblock}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a" }}>Ultimas llamadas IA</p>
              {(aiUsage?.cost_estimate?.recent_events || []).length ? (
                aiUsage.cost_estimate.recent_events.map((item, index) => (
                  <div
                    key={`${item.created_at}-${item.feature}-${index}`}
                    style={{ ...S.activityRow, borderColor: dm ? "rgba(255,255,255,0.06)" : "#e5e7eb", padding: "10px 0" }}
                  >
                    <div>
                      <p style={{ ...S.activityTitle, color: dm ? "#f8fafc" : "#111827" }}>
                        {formatFeatureLabel(item.feature)} · {formatModelName(item.model)}
                      </p>
                      <p style={{ ...S.activityMeta, color: dm ? "#94a3b8" : "#64748b" }}>
                        {item.email || "Sistema"} · in {formatCompactNumber(item.input_tokens)} · out {formatCompactNumber(item.output_tokens)}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ color: dm ? "#5eead4" : TEAL, fontWeight: 800 }}>{formatUsd(item.estimated_cost_usd)}</span>
                      <span style={{ ...S.activityDate, color: dm ? "#64748b" : "#94a3af" }}>{formatDate(item.created_at, true)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Todavia no hay llamadas recientes registradas.</p>
              )}
            </div>
          </div>

          <div id="sistema-admin" style={{ ...S.card, ...(dm ? S.panelDm : S.panel) }}>
            <h2 style={{ ...S.sectionTitle, marginBottom: 4, color: dm ? "#f8fafc" : "#111827" }}>Sistema</h2>
            <p style={{ ...S.sectionLead, color: dm ? "#94a3b8" : "#64748b", marginBottom: 20 }}>
              Herramientas de mantenimiento de la plataforma.
            </p>

            <div id="ingesta-admin" style={{ borderTop: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`, paddingTop: 18, marginBottom: 22 }}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a", marginBottom: 6 }}>Ingesta manual de ofertas</p>
              <p style={{ fontSize: 13, color: dm ? "#94a3b8" : "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
                Lanza una ingesta bajo demanda, revisa el estado y consulta el log resumido de cada ejecución.
              </p>

              {ingestionNotice && (
                <div style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 12,
                  backgroundColor: ingestionNotice.startsWith("Error") ? (dm ? "rgba(239,68,68,0.12)" : "#fee2e2") : (dm ? "rgba(16,185,129,0.12)" : "#dcfce7"),
                  color: ingestionNotice.startsWith("Error") ? "#dc2626" : "#15803d",
                  border: `1px solid ${ingestionNotice.startsWith("Error") ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
                }}>
                  {ingestionNotice}
                </div>
              )}

              <div style={S.ingestionForm}>
                <label style={S.ingestionField}>
                  <span style={{ ...S.quotaLabel, color: dm ? "#94a3b8" : "#64748b" }}>Skills semilla</span>
                  <input
                    value={ingestionDraft.skills}
                    onChange={(event) => setIngestionDraft((prev) => ({ ...prev, skills: event.target.value }))}
                    placeholder="python, react, java"
                    style={{ ...S.input, ...(dm ? S.inputDm : {}), width: "100%", minWidth: 0, boxSizing: "border-box" }}
                  />
                </label>

                <label style={S.ingestionField}>
                  <span style={{ ...S.quotaLabel, color: dm ? "#94a3b8" : "#64748b" }}>Ubicaciones</span>
                  <input
                    value={ingestionDraft.locations}
                    onChange={(event) => setIngestionDraft((prev) => ({ ...prev, locations: event.target.value }))}
                    placeholder="Madrid, Barcelona, Toda España"
                    style={{ ...S.input, ...(dm ? S.inputDm : {}), width: "100%", minWidth: 0, boxSizing: "border-box" }}
                  />
                </label>

                <label style={S.ingestionField}>
                  <span style={{ ...S.quotaLabel, color: dm ? "#94a3b8" : "#64748b" }}>Fuentes</span>
                  <input
                    value={ingestionDraft.sources}
                    onChange={(event) => setIngestionDraft((prev) => ({ ...prev, sources: event.target.value }))}
                    placeholder="public_sources, adzuna"
                    style={{ ...S.input, ...(dm ? S.inputDm : {}), width: "100%", minWidth: 0, boxSizing: "border-box" }}
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={handleStartIngestion}
                  disabled={startingIngestion || ingestionRuns?.running}
                  style={{ ...S.primaryButton, opacity: (startingIngestion || ingestionRuns?.running) ? 0.6 : 1 }}
                >
                  {startingIngestion ? "Lanzando..." : ingestionRuns?.running ? "Ingesta en curso" : "Lanzar ingesta"}
                </button>

                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => loadAdminData(page, search, sortBy, sortDir)}
                  style={S.secondaryButton}
                >
                  Actualizar historial
                </button>
              </div>

              <div style={S.ingestionRunsWrap}>
                {(ingestionRuns?.items || []).length ? (
                  ingestionRuns.items.map((run) => (
                    <details key={run.id} style={{ ...S.runCard, borderColor: dm ? "rgba(255,255,255,0.07)" : "#e5e7eb", backgroundColor: dm ? "rgba(15,23,42,0.35)" : "#f8fafc" }}>
                      <summary style={S.runSummary}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ color: dm ? "#f8fafc" : "#111827", fontWeight: 800 }}>
                            Run #{run.id} · {formatIngestionStatus(run.status)}
                          </span>
                          <span style={{ color: dm ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                            {formatDate(run.created_at, true)} · {run.requested_sources?.join(", ") || "sin fuentes"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={S.runStatBadge}>fetched {run.fetched_count}</span>
                          <span style={S.runStatBadge}>new {run.saved_new_count}</span>
                          <span style={S.runStatBadge}>updated {run.saved_updated_count}</span>
                          <span style={S.runStatBadge}>inactive {run.inactive_count}</span>
                        </div>
                      </summary>

                      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: dm ? "#94a3b8" : "#64748b", lineHeight: 1.6 }}>
                          <strong>Skills:</strong> {(run.requested_skills || []).join(", ") || "por defecto"}<br />
                          <strong>Ubicaciones:</strong> {(run.requested_locations || []).join(", ") || "por defecto"}
                        </div>

                        <div>
                          <div style={{ ...S.quotaLabel, color: dm ? "#94a3b8" : "#64748b", marginBottom: 6 }}>Log</div>
                          <div style={{ ...S.logBox, ...(dm ? S.logBoxDm : {}) }}>
                            {(run.logs || []).length ? run.logs.map((line, index) => (
                              <div key={`${run.id}-log-${index}`}>{line}</div>
                            )) : "Sin log disponible todavía."}
                          </div>
                        </div>
                      </div>
                    </details>
                  ))
                ) : (
                  <p style={{ ...S.emptyInline, color: dm ? "#94a3b8" : "#64748b" }}>Todavía no hay ejecuciones de ingesta.</p>
                )}
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`, paddingTop: 18 }}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a", marginBottom: 6 }}>Caché de búsquedas</p>
              <p style={{ fontSize: 13, color: dm ? "#94a3b8" : "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
                Fuerza que todos los usuarios obtengan resultados frescos en su próxima búsqueda.
                Útil tras cambios en el matching o en los datos de empresa.
              </p>
              {cacheNotice && (
                <div style={{
                  padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12,
                  backgroundColor: cacheNotice.startsWith("Error") ? (dm ? "rgba(239,68,68,0.12)" : "#fee2e2") : (dm ? "rgba(16,185,129,0.12)" : "#dcfce7"),
                  color: cacheNotice.startsWith("Error") ? "#dc2626" : "#15803d",
                  border: `1px solid ${cacheNotice.startsWith("Error") ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
                }}>
                  {cacheNotice}
                </div>
              )}
              <button
                type="button"
                disabled={clearingCache}
                onClick={async () => {
                  if (!window.confirm("¿Borrar toda la caché de búsquedas? Los usuarios verán resultados frescos en su próxima consulta.")) return;
                  setClearingCache(true);
                  setCacheNotice("");
                  try {
                    const res = await clearAdminCache();
                    setCacheNotice(`✓ Caché borrada — ${res.deleted} ${res.deleted === 1 ? "entrada eliminada" : "entradas eliminadas"}.`);
                  } catch (err) {
                    setCacheNotice(`Error: ${err.message || "No se pudo borrar el caché."}`);
                  } finally {
                    setClearingCache(false);
                  }
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                  backgroundColor: clearingCache ? (dm ? "rgba(239,68,68,0.07)" : "#fee2e2") : (dm ? "rgba(239,68,68,0.1)" : "#fff1f2"),
                  color: "#dc2626",
                  border: "1px solid rgba(239,68,68,0.25)",
                  cursor: clearingCache ? "not-allowed" : "pointer",
                  fontFamily: typography.family,
                  opacity: clearingCache ? 0.7 : 1,
                  transition: "opacity 0.15s ease",
                }}
              >
                {clearingCache ? "Borrando…" : "🗑 Limpiar caché de búsquedas"}
              </button>
            </div>

            {/* ── Limpieza de usuarios inactivos ── */}
            <div style={{ borderTop: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`, paddingTop: 18, marginTop: 4 }}>
              <p style={{ ...S.subTitle, color: dm ? "#e2e8f0" : "#0f172a", marginBottom: 6 }}>Limpieza de usuarios inactivos</p>
              <p style={{ fontSize: 13, color: dm ? "#94a3b8" : "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
                Elimina cuentas que no han tenido actividad (búsquedas, candidaturas, favoritos) en el período indicado.
                Usa el modo previsualización primero para ver quiénes serían afectados.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: dm ? "#94a3b8" : "#64748b" }}>
                  Días de inactividad:
                </label>
                <input
                  type="number" min={7} max={365} value={cleanupDays}
                  onChange={e => setCleanupDays(Math.min(365, Math.max(7, Number(e.target.value) || 30)))}
                  style={{
                    width: 80, padding: "6px 10px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                    border: `1px solid ${dm ? "rgba(255,255,255,0.15)" : "#d1d5db"}`,
                    background: dm ? "#0f172a" : "#fff", color: dm ? "#f8fafc" : "#0f172a",
                    fontFamily: typography.family,
                  }}
                />
                <button type="button" onClick={handleCleanupPreview} disabled={cleanupRunning}
                  style={{ ...S.secondaryButton, opacity: cleanupRunning ? 0.6 : 1 }}>
                  {cleanupRunning ? "Analizando…" : "Previsualizar"}
                </button>
              </div>
              {cleanupResult && (
                <div style={{
                  padding: "12px 14px", borderRadius: 10,
                  background: dm ? "rgba(245,158,11,0.08)" : "#fffbeb",
                  border: `1px solid ${dm ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.35)"}`,
                  marginBottom: 12,
                }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: dm ? "#fcd34d" : "#b45309" }}>
                    {cleanupResult.would_delete} usuarios serían eliminados (inactivos desde {new Date(cleanupResult.cutoff).toLocaleDateString("es-ES")})
                  </p>
                  {(cleanupResult.users || []).length > 0 && (
                    <div style={{ fontSize: 12, color: dm ? "#94a3b8" : "#64748b", maxHeight: 120, overflowY: "auto" }}>
                      {cleanupResult.users.map(u => (
                        <div key={u.id}>{u.email} · registrado {new Date(u.created_at).toLocaleDateString("es-ES")}</div>
                      ))}
                    </div>
                  )}
                  {cleanupResult.would_delete > 0 && (
                    <button type="button" onClick={handleCleanupConfirm} disabled={cleanupRunning}
                      style={{ ...S.deleteButton, marginTop: 10, opacity: cleanupRunning ? 0.6 : 1 }}>
                      {cleanupRunning ? "Eliminando…" : `Eliminar ${cleanupResult.would_delete} usuarios`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Panel Calidad del Motor de Matching ── */}
          {matchingQuality && (
            <div id="calidad-matching" style={{ ...S.card, ...(dm ? S.panelDm : S.panel) }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                <h2 style={{ ...S.sectionTitle, margin: 0, color: dm ? "#f8fafc" : "#111827" }}>
                  Calidad del motor de matching
                </h2>
                <span style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
                  padding: "3px 10px", borderRadius: 999,
                  background: matchingQuality.interpretacion_level === "good"
                    ? "rgba(16,185,129,0.12)" : matchingQuality.interpretacion_level === "warning"
                    ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                  color: matchingQuality.interpretacion_level === "good" ? "#059669"
                    : matchingQuality.interpretacion_level === "warning" ? "#b45309" : "#dc2626",
                  border: `1px solid ${matchingQuality.interpretacion_level === "good"
                    ? "rgba(16,185,129,0.25)" : matchingQuality.interpretacion_level === "warning"
                    ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)"}`,
                }}>
                  {matchingQuality.interpretacion}
                </span>
              </div>

              {/* KPIs principales */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Total feedbacks", value: matchingQuality.total_feedbacks, color: dm ? "#94a3b8" : "#64748b" },
                  { label: "Positivos", value: matchingQuality.positivos, color: "#059669" },
                  { label: "Negativos", value: matchingQuality.negativos, color: "#dc2626" },
                  { label: "Precisión", value: `${matchingQuality.ratio_precision}%`, color: matchingQuality.ratio_precision >= 70 ? "#059669" : matchingQuality.ratio_precision >= 50 ? "#b45309" : "#dc2626" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    borderRadius: 10, padding: "12px 14px",
                    background: dm ? "rgba(255,255,255,0.04)" : "#f8fafc",
                    border: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e5e7eb"}`,
                  }}>
                    <div style={{ fontSize: 11, color: dm ? "#64748b" : "#94a3b8", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Barra de precisión */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: dm ? "#94a3b8" : "#64748b", marginBottom: 6 }}>
                  <span>Ratio de precisión</span>
                  <span style={{ color: matchingQuality.ratio_precision >= 70 ? "#059669" : matchingQuality.ratio_precision >= 50 ? "#b45309" : "#dc2626", fontWeight: 800 }}>
                    {matchingQuality.ratio_precision}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: dm ? "rgba(255,255,255,0.08)" : "#e5e7eb", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${matchingQuality.ratio_precision}%`,
                    borderRadius: 999,
                    background: matchingQuality.ratio_precision >= 70
                      ? "linear-gradient(90deg,#10b981,#059669)"
                      : matchingQuality.ratio_precision >= 50
                      ? "linear-gradient(90deg,#f59e0b,#d97706)"
                      : "linear-gradient(90deg,#ef4444,#dc2626)",
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>

              {/* Distribución por resultado de IA */}
              {Object.keys(matchingQuality.distribucion_por_resultado || {}).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: dm ? "#64748b" : "#94a3b8", marginBottom: 10 }}>
                    Distribución por etiqueta IA
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(matchingQuality.distribucion_por_resultado).map(([label, count]) => {
                      const total = matchingQuality.total_feedbacks || 1;
                      const pct = Math.round((count / total) * 100);
                      const color = label === "APLICA" ? "#059669" : label === "QUIZÁ" ? "#b45309" : "#dc2626";
                      const bg = label === "APLICA" ? "rgba(16,185,129,0.1)" : label === "QUIZÁ" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
                      return (
                        <div key={label} style={{ display: "grid", gridTemplateColumns: "80px 1fr 36px 36px", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: 999, textAlign: "center" }}>{label}</span>
                          <div style={{ height: 6, borderRadius: 999, background: dm ? "rgba(255,255,255,0.08)" : "#e5e7eb", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width .4s" }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color, textAlign: "right" }}>{pct}%</span>
                          <span style={{ fontSize: 11, color: dm ? "#64748b" : "#94a3b8", textAlign: "right" }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Precision por categoría IA */}
              {matchingQuality.precision_by_result && Object.keys(matchingQuality.precision_by_result).length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: dm ? "#64748b" : "#94a3b8", marginBottom: 10 }}>
                    Precisión por etiqueta (usuarios que validan cada categoría)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
                    {Object.entries(matchingQuality.precision_by_result).map(([label, data]) => {
                      const color = label === "APLICA" ? "#059669" : label === "QUIZÁ" ? "#b45309" : "#dc2626";
                      const bg = label === "APLICA" ? "rgba(16,185,129,0.08)" : label === "QUIZÁ" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";
                      return (
                        <div key={label} style={{ borderRadius: 10, padding: "12px 14px", background: bg, border: `1px solid ${color}33` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color }}>{data.precision}%</div>
                          <div style={{ fontSize: 11, color: dm ? "#64748b" : "#94a3b8", marginTop: 2 }}>{data.positivos}/{data.total} votos +</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Evolución semanal */}
              {(matchingQuality.weekly_evolution || []).some(w => w.total > 0) && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: dm ? "#64748b" : "#94a3b8", marginBottom: 10 }}>
                    Evolución semanal del ratio de precisión (últimas 8 semanas)
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
                    {(matchingQuality.weekly_evolution || []).map((w, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        {w.ratio !== null && (
                          <span style={{ fontSize: 9, color: dm ? "#64748b" : "#94a3b8", fontWeight: 600 }}>{w.ratio}%</span>
                        )}
                        <div style={{ width: "100%", borderRadius: 3, overflow: "hidden", height: 36, background: dm ? "rgba(255,255,255,0.06)" : "#e5e7eb", position: "relative" }}>
                          {w.ratio !== null && (
                            <div style={{
                              position: "absolute", bottom: 0, width: "100%",
                              height: `${Math.max(6, w.ratio)}%`,
                              background: w.ratio >= 70 ? "#10b981" : w.ratio >= 50 ? "#f59e0b" : "#ef4444",
                              borderRadius: 3, transition: "height .4s ease",
                            }} />
                          )}
                        </div>
                        <span style={{ fontSize: 8, color: dm ? "#64748b" : "#94a3b8" }}>{w.week}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón exportar CSV */}
              {matchingQuality.total_feedbacks > 0 && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${dm ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={exportingCsv}
                    style={{ ...S.secondaryButton, opacity: exportingCsv ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {exportingCsv ? "Exportando…" : "⬇ Exportar datos de evaluación (CSV)"}
                  </button>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: dm ? "#64748b" : "#94a3b8" }}>
                    Incluye feedback de matching, historial de búsquedas y resumen de usuarios. Útil para la memoria del TFM.
                  </p>
                </div>
              )}

              {matchingQuality.total_feedbacks === 0 && (
                <p style={{ fontSize: 13, color: dm ? "#64748b" : "#94a3b8", margin: 0 }}>
                  Aún no hay feedback de usuarios. Los votos positivos/negativos en búsquedas alimentarán estas métricas.
                </p>
              )}
            </div>
          )}

          <div id="actividad-admin" style={{ ...S.card, ...(dm ? S.panelDm : S.panel) }}>
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

      {/* ── Modal eliminación usuario ── */}
      {deleteModalUser && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteModalUser(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: dm ? "#1e293b" : "#fff",
              border: `1px solid ${dm ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
              borderRadius: 16, padding: 28,
              width: "100%", maxWidth: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              fontFamily: typography.family,
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: dm ? "#f8fafc" : "#0f172a" }}>
              Eliminar usuario
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: dm ? "#94a3b8" : "#64748b", lineHeight: 1.5 }}>
              Esta acción es <strong style={{ color: "#dc2626" }}>irreversible</strong>. Se borrarán todos los datos de{" "}
              <strong style={{ color: dm ? "#f8fafc" : "#0f172a" }}>{deleteModalUser.email}</strong>.
              Introduce la clave de confirmación para continuar.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="Clave de confirmación"
              value={deleteConfirmCode}
              onChange={e => setDeleteConfirmCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleConfirmDelete()}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px", borderRadius: 8, marginBottom: 16,
                border: `1px solid ${dm ? "rgba(255,255,255,0.15)" : "#d1d5db"}`,
                background: dm ? "#0f172a" : "#f9fafb",
                color: dm ? "#f8fafc" : "#0f172a",
                fontSize: 14, fontFamily: typography.family,
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                style={{ ...S.secondaryButton }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingUserId === deleteModalUser.id}
                style={{
                  ...S.deleteButton,
                  opacity: deletingUserId === deleteModalUser.id ? 0.6 : 1,
                }}
              >
                {deletingUserId === deleteModalUser.id ? "Eliminando…" : "Confirmar eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}
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

function CostCard({ label, value, helper, darkMode }) {
  return (
    <div style={{ ...S.costCard, ...(darkMode ? S.costCardDm : {}) }}>
      <p style={{ ...S.costLabel, color: darkMode ? "#94a3b8" : "#64748b" }}>{label}</p>
      <div style={{ ...S.costValue, color: darkMode ? "#f8fafc" : "#0f172a" }}>{value}</div>
      {helper ? <p style={{ ...S.costHelper, color: darkMode ? "#67e8f9" : TEAL }}>{helper}</p> : null}
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

function StatusBadge({ label, tone }) {
  const toneStyles = tone === "danger"
    ? { backgroundColor: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.18)" }
    : { backgroundColor: "rgba(16,185,129,0.12)", color: "#059669", border: "1px solid rgba(16,185,129,0.18)" };
  return <span style={{ ...S.statusBadge, ...toneStyles }}>{label}</span>;
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

function formatUsd(value) {
  const numeric = Number(value || 0);
  return `${numeric.toFixed(4)} USD`;
}

function formatPercent(value, digits = 0) {
  const numeric = Number(value || 0);
  return `${(numeric * 100).toFixed(digits)}%`;
}

function formatIngestionStatus(value) {
  const labels = {
    queued: "En cola",
    running: "Ejecutándose",
    completed: "Completada",
    failed: "Fallida",
  };
  return labels[value] || value || "Desconocido";
}

function formatFeatureLabel(value) {
  const labels = {
    match_signal_extraction: "Extracción de señales",
    skills_gap: "Plan de mejora",
    cover_letter: "Carta de presentación",
  };
  return labels[value] || value;
}

function formatModelName(value) {
  const labels = {
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  };
  return labels[value] || value;
}

function formatCompactNumber(value) {
  const numeric = Number(value || 0);
  if (numeric >= 1000000) return `${(numeric / 1000000).toFixed(1)}M`;
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}k`;
  return `${numeric}`;
}

function formatShortDay(value) {
  try {
    return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  } catch {
    return value;
  }
}

function formatDuration(startedAt, finishedAt) {
  if (!startedAt) return "pendiente";
  const start = new Date(startedAt);
  const end = finishedAt ? new Date(finishedAt) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "n/d";

  const diffSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s`;

  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatSourceName(value) {
  const labels = {
    infojobs: "InfoJobs",
    greenhouse: "Greenhouse",
    lever: "Lever",
    ashby: "Ashby",
    recruitee: "Recruitee",
    adzuna: "Adzuna",
    desconocida: "Desconocida",
  };
  const normalized = String(value || "").trim().toLowerCase();
  return labels[normalized] || String(value || "Desconocida");
}

function formatSourceType(value) {
  const labels = {
    official_api: "API oficial",
    public_ats: "ATS público",
    career_page: "Web de empresa",
    aggregator: "Agregador",
  };
  return labels[String(value || "").trim().toLowerCase()] || (value || "Fuente");
}

function formatPricingLabel(value) {
  const labels = {
    public_free: "Gratuita y pública",
    free_developer: "Gratis con alta de desarrollador",
  };
  return labels[String(value || "").trim().toLowerCase()] || "Configuración manual";
}

function getCostBarWidth(items, currentValue) {
  const values = (items || []).map((item) => Number(item.estimated_cost_usd || 0));
  const max = Math.max(...values, 0);
  if (max <= 0) return 8;
  return Math.min(100, (Number(currentValue || 0) / max) * 100);
}

const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    padding: "clamp(16px, 4vw, 28px) clamp(12px, 3vw, 20px) 40px",
    fontFamily: typography.family,
    position: "relative",
    overflowX: "hidden",
  },
  pageDm: {
    backgroundColor: "#0f172a",
  },
  bgGlowOne: {
    position: "absolute",
    top: -140,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "rgba(34,211,238,0.10)",
    filter: "blur(40px)",
    pointerEvents: "none",
  },
  bgGlowTwo: {
    position: "absolute",
    bottom: -140,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "rgba(15,23,42,0.08)",
    filter: "blur(48px)",
    pointerEvents: "none",
  },
  container: {
    maxWidth: 1260,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    position: "relative",
    zIndex: 1,
  },
  adminHeader: {
    borderRadius: 24,
    padding: "22px 22px 20px",
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  adminActions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "flex-end",
    flex: "1 1 320px",
  },
  sectionPills: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  pillButton: {
    border: "1px solid rgba(0,122,138,0.18)",
    backgroundColor: "rgba(0,122,138,0.08)",
    color: TEAL,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: typography.family,
    transition: "all 0.15s ease",
  },
  pillButtonActive: {
    border: "2px solid rgba(0,122,138,0.55)",
    backgroundColor: "rgba(0,122,138,0.18)",
    color: TEAL,
    boxShadow: "0 0 0 2px rgba(0,122,138,0.12)",
  },
  headerButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  noticeCard: {
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  noticeCardDm: {
    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
  },
  successCard: {
    backgroundColor: "rgba(16,185,129,0.10)",
    color: "#047857",
    border: "1px solid rgba(16,185,129,0.18)",
  },
  errorCard: {
    backgroundColor: "rgba(239,68,68,0.10)",
    color: "#b91c1c",
    border: "1px solid rgba(239,68,68,0.18)",
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
    maxWidth: 680,
  },
  brandWrap: {
    marginBottom: 14,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    scrollMarginTop: 24,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
  },
  sectionLead: {
    margin: "6px 0 0",
    fontSize: 13,
    lineHeight: 1.65,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
    overflowX: "auto",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "2.3fr 1fr 1fr 1fr 1fr 2.5fr",
    gap: 12,
    padding: "14px 16px",
    backgroundColor: "rgba(0,122,138,0.08)",
    alignItems: "center",
  },
  headLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: TEAL,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
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
    gridTemplateColumns: "2.3fr 1fr 1fr 1fr 1fr 2.5fr",
    gap: 12,
    padding: "14px 16px",
    alignItems: "center",
    fontSize: 13,
    borderTop: "1px solid",
  },
  emailCell: {
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  manageCell: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  quotaEditor: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  quotaLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  actionButtons: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
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
  ingestionForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  ingestionField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },
  ingestionRunsWrap: {
    display: "grid",
    gap: 10,
  },
  runCard: {
    border: "1px solid",
    borderRadius: 14,
    padding: "12px 14px",
  },
  runSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    listStyle: "none",
    flexWrap: "wrap",
  },
  runStatBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    backgroundColor: "rgba(0,122,138,0.08)",
    color: TEAL,
    border: "1px solid rgba(0,122,138,0.14)",
  },
  logBox: {
    maxHeight: 220,
    overflow: "auto",
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    border: "1px solid #e2e8f0",
    padding: "10px 12px",
    fontSize: 12,
    lineHeight: 1.6,
    fontFamily: "Consolas, monospace",
    color: "#334155",
    whiteSpace: "pre-wrap",
  },
  logBoxDm: {
    backgroundColor: "#0f172a",
    borderColor: "rgba(255,255,255,0.08)",
    color: "#cbd5e1",
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
    transition: "transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease",
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
    transition: "background 0.14s ease, border-color 0.14s ease, transform 0.14s ease",
  },
  resetButton: {
    border: "1px solid rgba(245,158,11,0.22)",
    backgroundColor: "rgba(245,158,11,0.10)",
    color: "#b45309",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: typography.family,
    transition: "background 0.14s ease, transform 0.14s ease",
  },
  blockButton: {
    border: "1px solid rgba(239,68,68,0.22)",
    backgroundColor: "rgba(239,68,68,0.10)",
    color: "#b91c1c",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: typography.family,
    transition: "background 0.14s ease, transform 0.14s ease",
  },
  unblockButton: {
    border: "1px solid rgba(16,185,129,0.22)",
    backgroundColor: "rgba(16,185,129,0.10)",
    color: "#047857",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: typography.family,
    transition: "background 0.14s ease, transform 0.14s ease",
  },
  deleteButton: {
    border: "1px solid rgba(127,29,29,0.22)",
    backgroundColor: "rgba(127,29,29,0.10)",
    color: "#991b1b",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: typography.family,
    transition: "background 0.14s ease, transform 0.14s ease",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  card: {
    borderRadius: 18,
    padding: "18px 18px 16px",
    minWidth: 0,
  },
  usageSummary: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 16,
  },
  costGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  costCard: {
    borderRadius: 16,
    border: "1px solid rgba(0,122,138,0.14)",
    backgroundColor: "rgba(0,122,138,0.06)",
    padding: "14px 14px 12px",
  },
  costCardDm: {
    backgroundColor: "rgba(6,182,212,0.08)",
    borderColor: "rgba(103,232,249,0.14)",
  },
  costLabel: {
    margin: "0 0 8px",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
  },
  costValue: {
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1.1,
    marginBottom: 6,
  },
  costHelper: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 700,
  },
  timelineWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  timelineRow: {
    display: "grid",
    gridTemplateColumns: "74px minmax(120px, 1fr) 120px",
    alignItems: "center",
    gap: 10,
  },
  timelineDay: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  timelineBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.16)",
    overflow: "hidden",
  },
  timelineBarTrackDm: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  timelineBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #14b8a6 0%, #06b6d4 100%)",
  },
  timelineValueWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
  },
  subblock: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 14,
  },
  sourceStatusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  sourceStatusCard: {
    borderRadius: 16,
    border: "1px solid #dbe2ea",
    backgroundColor: "rgba(0,122,138,0.03)",
    padding: "14px 14px 12px",
    display: "grid",
    gap: 10,
    minWidth: 0,
  },
  sourceStatusCardDm: {
    backgroundColor: "rgba(15,23,42,0.72)",
  },
  sourceStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: "1px solid",
    padding: "4px 9px",
    fontSize: 11,
    fontWeight: 800,
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
  healthRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    padding: "12px 0",
    borderTop: "1px solid",
    flexWrap: "wrap",
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
    margin: "0 0 18px",
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

if (typeof document !== "undefined" && !document.getElementById("admin-hover-styles")) {
  const s = document.createElement("style");
  s.id = "admin-hover-styles";
  s.textContent = `
    .admin-btn-primary:hover  { filter: brightness(1.12); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,117,138,0.32) !important; }
    .admin-btn-secondary:hover { background: #f1f5f9 !important; border-color: #94a3b8 !important; transform: translateY(-1px); }
    .admin-btn-reset:hover    { background: rgba(245,158,11,0.18) !important; transform: translateY(-1px); }
    .admin-btn-block:hover    { background: rgba(239,68,68,0.18) !important; transform: translateY(-1px); }
    .admin-btn-unblock:hover  { background: rgba(16,185,129,0.18) !important; transform: translateY(-1px); }
    .admin-btn-delete:hover   { background: rgba(127,29,29,0.18) !important; transform: translateY(-1px); }
    .admin-table-row:hover    { background: rgba(0,122,138,0.03) !important; }
    .admin-pill-btn:hover     { background: rgba(0,122,138,0.14) !important; transform: translateY(-1px); }
    @media (max-width: 640px) {
      .admin-page-wrap { padding: 16px 12px 32px !important; }
      .admin-header-title { font-size: 24px !important; }
      .admin-search-input { min-width: 0 !important; width: 100% !important; }
    }
  `;
  document.head.appendChild(s);
}
