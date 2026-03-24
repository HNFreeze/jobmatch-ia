import { useEffect, useState } from "react";
import {
  clearAdminCache,
  deleteAdminUser,
  getAdminActivity,
  getAdminAiUsage,
  getAdminDashboard,
  getAdminUsers,
  resetAdminUserQuotaUsage,
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
  const [loading, setLoading] = useState(true);
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
    }
  }

  useEffect(() => {
    loadAdminData(1, "", "created_at", "desc");
  }, []);

  function scrollToSection(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  function adjustQuotaDraft(userId, delta) {
    setQuotaDrafts((prev) => {
      const current = Number(prev[userId] ?? 0);
      const nextValue = Math.min(200, Math.max(1, current + delta));
      return { ...prev, [userId]: nextValue };
    });
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

  async function handleDeleteUser(user) {
    const confirmationCode = window.prompt(
      `Para eliminar a ${user.email}, introduce la clave de confirmacion`
    );

    if (confirmationCode === null) {
      return;
    }

    setDeletingUserId(user.id);
    setActionError("");
    setActionNotice("");
    try {
      await deleteAdminUser(user.id, confirmationCode.trim());
      setActionNotice(`Usuario eliminado: ${user.email}.`);
      await loadAdminData(page, search, sortBy, sortDir);
    } catch (err) {
      setActionError(err.message || "No se pudo eliminar el usuario.");
    } finally {
      setDeletingUserId(null);
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
    <div style={{ ...S.page, ...(dm ? S.pageDm : {}) }}>
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
            <h1 style={{ ...S.title, color: dm ? "#f8fafc" : "#0f172a" }}>Panel de control</h1>
            <p style={{ ...S.subtitle, color: dm ? "#94a3b8" : "#64748b" }}>
              Gestiona cuentas, cuotas, bloqueos y el uso global de la aplicación desde una zona separada.
            </p>
          </div>

          <div style={S.adminActions}>
            <div style={S.sectionPills}>
              <button type="button" onClick={() => scrollToSection("dashboard-admin")} style={S.pillButton}>Dashboard</button>
              <button type="button" onClick={() => scrollToSection("usuarios-admin")} style={S.pillButton}>Usuarios</button>
              <button type="button" onClick={() => scrollToSection("ia-admin")} style={S.pillButton}>Uso IA</button>
              <button type="button" onClick={() => scrollToSection("actividad-admin")} style={S.pillButton}>Actividad</button>
            </div>
            <div style={S.headerButtons}>
              <button type="button" onClick={toggleDarkMode} style={S.secondaryButton}>
                {dm ? "Modo claro" : "Modo oscuro"}
              </button>
              <button type="button" onClick={onLogout} style={S.primaryButton}>
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
              <HeaderButton label="Estado" onClick={() => handleSortChange("is_blocked")} />
              <HeaderButton label="Verificado" onClick={() => handleSortChange("email_verified")} />
              <HeaderButton label="Alta" onClick={() => handleSortChange("created_at")} />
              <HeaderButton label="Uso hoy" onClick={() => handleSortChange("quota_used_today")} />
              <div style={S.headLabel}>Gestión</div>
            </div>

            {(usersData?.items || []).map((user) => {
              const draftQuota = Number(quotaDrafts[user.id] ?? user.daily_ai_quota ?? 0);
              return (
                <div key={user.id} style={{ ...S.tableRow, borderColor: dm ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}>
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
                      <div style={S.quotaControls}>
                        <button type="button" onClick={() => adjustQuotaDraft(user.id, -1)} style={S.stepButton}>-</button>
                        <div style={{ ...S.quotaValue, ...(dm ? S.quotaValueDm : {}) }}>{draftQuota}</div>
                        <button type="button" onClick={() => adjustQuotaDraft(user.id, 1)} style={S.stepButton}>+</button>
                      </div>
                      <button
                        type="button"
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
                        onClick={() => handleQuotaReset(user)}
                        disabled={resettingQuotaId === user.id}
                        style={{ ...S.resetButton, opacity: resettingQuotaId === user.id ? 0.6 : 1 }}
                      >
                        {resettingQuotaId === user.id ? "Reseteando..." : "Resetear uso de hoy"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBlockToggle(user)}
                        disabled={togglingBlockId === user.id}
                        style={user.is_blocked ? S.unblockButton : S.blockButton}
                      >
                        {togglingBlockId === user.id ? "Actualizando..." : user.is_blocked ? "Desbloquear" : "Bloquear"}
                      </button>

                      {!user.is_admin && (
                        <button
                          type="button"
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
          </div>

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

function formatFeatureLabel(value) {
  const labels = {
    match_signal_extraction: "Extraccion de senales",
    skills_gap: "Plan de mejora",
    cover_letter: "Carta de presentacion",
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
    padding: "28px 20px 40px",
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
  quotaControls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: typography.family,
  },
  quotaValue: {
    minWidth: 54,
    textAlign: "center",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    padding: "8px 10px",
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  },
  quotaValueDm: {
    backgroundColor: "#0f172a",
    borderColor: "rgba(255,255,255,0.1)",
    color: "#f8fafc",
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
